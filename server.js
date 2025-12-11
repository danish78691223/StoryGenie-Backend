// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ---------------- GEMINI CLIENT ----------------
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ---------------- STORY GENERATION API ----------------
app.post("/api/generate-story", async (req, res) => {
  try {
    const { character, storyType, ageGroup, language } = req.body;

    const safeLanguage = language || "English";

    const prompt = `
Write a complete children's story in **${safeLanguage}** only.

Story Requirements:
- Main character: ${character}
- Story type: ${storyType}
- Age group: ${ageGroup}
- Use cultural tone suitable for ${safeLanguage}
- Output MUST be ONLY in ${safeLanguage}
- No English if ${safeLanguage} is not English
- Length: 6–8 short paragraphs
- Smooth storytelling, emotional and engaging.

Begin the story now:
`;

    // ---------------- CALL GEMINI ----------------
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const result = await model.generateContent(prompt);
    const story = result.response.text();

    res.json({ story });
  } catch (err) {
    console.error("Gemini Error:", err);
    res.status(500).json({ error: "Story generation failed" });
  }
});

// -------------------------------------------------------
app.get("/", (req, res) => {
  res.send("StoryGenie Backend Running (Gemini 2.0 Flash)");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`)
);
