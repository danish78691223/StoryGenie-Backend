// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
//import Groq from "groq-sdk";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

//const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ----------- AI STORY GENERATOR API --------------
app.post("/api/generate-story", async (req, res) => {
  try {
    const { character, storyType, ageGroup, language } = req.body;

    const safeLanguage = language || "English";

    console.log("LANG RECEIVED:", safeLanguage); // debugging

    const prompt = `
You are a multilingual children's story writer.

Write the ENTIRE story ONLY in ${safeLanguage}.  
Do NOT include English unless ${safeLanguage} is English.  

Story Requirements:
- Story Type: ${storyType}
- Audience: ${ageGroup}
- Main Character: ${character}

Rules:
- The ENTIRE OUTPUT MUST BE IN ${safeLanguage}.
- No translations, no explanations, only the final story.
- Use native-level ${safeLanguage} vocabulary.
- 5–7 short paragraphs.

Now write the story:
`;

    const response = await client.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.8,
      max_tokens: 900,
    });

    const story = response.choices?.[0]?.message?.content?.trim();

    res.json({ story });
  } catch (err) {
    console.error("AI Error:", err);
    res.status(500).json({ error: "Story generation failed" });
  }
});


// ------------------------------------

app.get("/", (req, res) => {
  res.send("StoryGenie Backend Running");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`)
);
