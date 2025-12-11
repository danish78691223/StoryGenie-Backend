// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ---------------- OPENAI CLIENT ----------------
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ------------- STORY GENERATION API --------------
app.post("/api/generate-story", async (req, res) => {
  try {
    const { character, storyType, ageGroup, language } = req.body;

    const safeLanguage = language || "English";

    console.log("LANG RECEIVED:", safeLanguage);

    // ---------------- PROMPT ----------------
    const prompt = `
You are an expert multilingual children's story writer.

Write a complete story ONLY in **${safeLanguage}**.
No English words unless ${safeLanguage} is English.

Story Requirements:
• Story Type: ${storyType}
• Audience: ${ageGroup}
• Main Character: ${character}
• Should be engaging, emotional, and imaginative.
• Length: 6–8 short paragraphs.

Rules:
• Output MUST be entirely in ${safeLanguage}.
• No translation notes.
• No explanations.
• Only the final story.

Now write the story below:
`;

    // ------------- CALL OPENAI API -------------
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 900,
      temperature: 0.85,
    });

    const story = completion.choices[0].message.content.trim();

    res.json({ story });
  } catch (err) {
    console.error("AI Error:", err.response?.data || err);
    res.status(500).json({ error: "Story generation failed" });
  }
});

// --------------------------------------------
app.get("/", (req, res) => {
  res.send("StoryGenie Backend Running (OpenAI Version)");
});

// --------------------------------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`)
);
