import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ai = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

const storySchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    styleGuide: { type: Type.STRING },
    characters: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          appearance: { type: Type.STRING },
          personality: { type: Type.STRING }
        },
        required: ["name", "appearance", "personality"]
      }
    },
    paragraphs: {
      type: Type.ARRAY,
      minItems: 5,
      maxItems: 8,
      items: {
        type: Type.OBJECT,
        properties: {
          text: { type: Type.STRING },
          imagePrompt: { type: Type.STRING }
        },
        required: ["text", "imagePrompt"]
      }
    }
  },
  required: ["title", "styleGuide", "characters", "paragraphs"]
};

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
    "- Return structured JSON only.",
    "- Every paragraph needs an imagePrompt describing exactly what should be illustrated.",
    "- Image prompts must be visual, cinematic, child-friendly, and contain no written text.",
    "- Keep recurring characters visually consistent using stable appearance descriptions.",
    "- styleGuide should define one consistent storybook art direction."
  ].join("\\n");
}

async function generateStoryWithGemini(input) {
  if (!ai) throw new Error("Gemini is not configured.");

  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: buildStoryPrompt(input),
    config: {
      temperature: 0.95,
      responseMimeType: "application/json",
      responseSchema: storySchema
    }
  });

  const parsed = JSON.parse(response.text || "{}");
  if (!parsed.paragraphs || !parsed.paragraphs.length) {
    throw new Error("Gemini returned an empty story.");
  }
  return parsed;
}

function compactCharacterContext(characters) {
  return (characters || [])
    .map(function (c) {
      return c.name + ": " + c.appearance + ". Personality: " + c.personality + ".";
    })
    .join(" | ");
}

async function generateImageWithGemini(input) {
  if (!ai) throw new Error("Gemini is not configured.");

  const imagePrompt = [
    "Create a single illustration for one storybook page.",
    "",
    "Scene:",
    input.prompt,
    "",
    "Visual style:",
    input.styleGuide,
    "",
    "Character continuity:",
    input.characterContext,
    "",
    "Rules:",
    "- Keep recurring characters visually consistent.",
    "- Match the supplied scene precisely.",
    "- Child-friendly polished storybook illustration.",
    "- No captions, speech bubbles, logos, or written text."
  ].join("\\n");

  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-image",
    contents: imagePrompt,
    config: {
      responseModalities: ["TEXT", "IMAGE"]
    }
  });

  const parts = response.candidates && response.candidates[0] &&
    response.candidates[0].content && response.candidates[0].content.parts
    ? response.candidates[0].content.parts
    : [];

  const imagePart = parts.find(function (part) {
    return part.inlineData && part.inlineData.data;
  });

  if (!imagePart) throw new Error("Gemini did not return an image.");

  const mimeType = imagePart.inlineData.mimeType || "image/png";
  return "data:" + mimeType + ";base64," + imagePart.inlineData.data;
}

app.get("/", function (req, res) {
  res.send("StoryGenie Gemini Backend Running");
});

app.get("/api/health", function (req, res) {
  res.json({ ok: true, geminiConfigured: Boolean(GEMINI_API_KEY) });
});

app.post("/api/generate-story", async function (req, res) {
  try {
    const input = req.body || {};
    if (!input.character || !input.storyType || !input.ageGroup || !input.language) {
      return res.status(400).json({
        error: "character, storyType, ageGroup and language are required."
      });
    }

    const story = await generateStoryWithGemini(input);
    const characterContext = compactCharacterContext(story.characters);

    const paragraphs = await Promise.all(
      story.paragraphs.map(async function (paragraph, index) {
        try {
          const image = await generateImageWithGemini({
            prompt: paragraph.imagePrompt,
            styleGuide: story.styleGuide,
            characterContext: characterContext
          });

          return {
            id: "p-" + (index + 1),
            text: paragraph.text,
            imagePrompt: paragraph.imagePrompt,
            image: image
          };
        } catch (imageError) {
          console.error("Image generation failed:", imageError);
          return {
            id: "p-" + (index + 1),
            text: paragraph.text,
            imagePrompt: paragraph.imagePrompt,
            image: null
          };
        }
      })
    );

    res.json({
      title: story.title,
      styleGuide: story.styleGuide,
      characters: story.characters,
      paragraphs: paragraphs,
      story: paragraphs.map(function (p) { return p.text; }).join("\\n\\n")
    });
  } catch (err) {
    console.error("Gemini Story Error:", err);
    res.status(500).json({
      error: err && err.message ? err.message : "Story generation failed"
    });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, function () {
  console.log("Server running on port " + PORT);
});
