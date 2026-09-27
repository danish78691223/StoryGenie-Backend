import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const STORY_MODEL = process.env.GEMINI_STORY_MODEL || "gemini-3.5-flash";
const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image";

async function callGemini(model, body) {
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured.");

  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/" +
      model +
      ":generateContent?key=" +
      encodeURIComponent(GEMINI_API_KEY),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.error?.message || "Gemini API request failed (" + response.status + ")."
    );
  }

  return data;
}

function buildStoryPrompt(input) {
  return [
    "Create a memorable, emotionally engaging story.",
    "Language: " + input.language,
    "Audience: " + input.ageGroup,
    "Story type: " + input.storyType,
    "Main character: " + input.character,
    "",
    "Requirements:",
    "- Write 5 to 8 connected paragraphs.",
    "- Start with a strong hook.",
    "- Give the protagonist a clear goal, obstacle, and meaningful change.",
    "- Include dialogue, sensory details, suspense or humor where appropriate.",
    "- Make the ending satisfying and age-appropriate.",
    "- Use only the requested story language for story text.",
    "- Return JSON matching the requested schema.",
    "- Every paragraph needs an imagePrompt describing exactly what should be illustrated.",
    "- Image prompts must be visual, cinematic, child-friendly, and contain no written text.",
    "- Keep recurring characters visually consistent using stable appearance descriptions.",
    "- styleGuide must define one consistent storybook art direction."
  ].join("\\n");
}

async function generateStory(input) {
  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: buildStoryPrompt(input) }]
      }
    ],
    generationConfig: {
      temperature: 0.95,
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          styleGuide: { type: "STRING" },
          characters: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                name: { type: "STRING" },
                appearance: { type: "STRING" },
                personality: { type: "STRING" }
              },
              required: ["name", "appearance", "personality"]
            }
          },
          paragraphs: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                text: { type: "STRING" },
                imagePrompt: { type: "STRING" }
              },
              required: ["text", "imagePrompt"]
            }
          }
        },
        required: ["title", "styleGuide", "characters", "paragraphs"]
      }
    }
  };

  const data = await callGemini(STORY_MODEL, body);
  const text = data?.candidates?.[0]?.content?.parts
    ?.map(function (p) { return p.text || ""; })
    .join("")
    .trim();

  if (!text) throw new Error("Gemini returned an empty story.");
  const story = JSON.parse(text);

  if (!Array.isArray(story.paragraphs) || !story.paragraphs.length) {
    throw new Error("Gemini returned no story paragraphs.");
  }

  return story;
}

function characterContext(characters) {
  return (characters || [])
    .map(function (c) {
      return c.name + ": " + c.appearance + ". Personality: " + c.personality + ".";
    })
    .join(" | ");
}

async function generateImage(input) {
  const prompt = [
    "Create one polished children's storybook illustration.",
    "",
    "Exact scene:",
    input.imagePrompt,
    "",
    "Consistent art direction:",
    input.styleGuide,
    "",
    "Recurring character reference:",
    input.characterContext,
    "",
    "Keep the recurring characters' appearance consistent.",
    "Match the scene and emotion from the paragraph.",
    "No captions, speech bubbles, logos, watermark-like text, or borders."
  ].join("\\n");

  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }]
      }
    ],
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"]
    }
  };

  const data = await callGemini(IMAGE_MODEL, body);
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find(function (part) {
    return part.inlineData && part.inlineData.data;
  });

  if (!imagePart) throw new Error("Gemini did not return an image.");

  const mime = imagePart.inlineData.mimeType || "image/png";
  return "data:" + mime + ";base64," + imagePart.inlineData.data;
}

app.get("/", function (req, res) {
  res.send("StoryGenie Gemini Backend Running");
});

app.get("/api/health", function (req, res) {
  res.json({
    ok: true,
    geminiConfigured: Boolean(GEMINI_API_KEY),
    storyModel: STORY_MODEL,
    imageModel: IMAGE_MODEL
  });
});

app.post("/api/generate-story", async function (req, res) {
  try {
    const input = req.body || {};

    if (!input.character || !input.storyType || !input.ageGroup || !input.language) {
      return res.status(400).json({
        error: "character, storyType, ageGroup and language are required."
      });
    }

    const story = await generateStory(input);
    const chars = characterContext(story.characters);

    const paragraphs = await Promise.all(
      story.paragraphs.map(async function (paragraph, index) {
        let image = null;

        try {
          image = await generateImage({
            imagePrompt: paragraph.imagePrompt,
            styleGuide: story.styleGuide,
            characterContext: chars
          });
        } catch (error) {
          console.error("Image generation failed for paragraph " + (index + 1) + ":", error);
        }

        return {
          id: "p-" + (index + 1),
          text: paragraph.text,
          imagePrompt: paragraph.imagePrompt,
          image
        };
      })
    );

    res.json({
      title: story.title,
      styleGuide: story.styleGuide,
      characters: story.characters || [],
      paragraphs,
      story: paragraphs.map(function (p) { return p.text; }).join("\\n\\n")
    });
  } catch (error) {
    console.error("StoryGenie Gemini Error:", error);
    res.status(500).json({
      error: error?.message || "Story generation failed."
    });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, function () {
  console.log("StoryGenie Gemini backend running on port " + PORT);
});
