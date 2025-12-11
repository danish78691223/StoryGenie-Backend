// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Hugging Face endpoint
const HF_URL = "https://api-inference.huggingface.co/models/google/gemma-2b-it";

// ---------------- STORY GENERATION ----------------
app.post("/api/generate-story", async (req, res) => {
  try {
    const { character, storyType, ageGroup, language } = req.body;

    const safeLanguage = language || "English";

    const prompt = `
Write a children's story in **${safeLanguage}** only.

Story Requirements:
- Main character: ${character}
- Story type: ${storyType}
- Target audience: ${ageGroup}
- Fully in ${safeLanguage} (no English unless ${safeLanguage} is English)
- 6–8 short paragraphs
- Emotional, imaginative, smooth storytelling.

Begin:
`;

    const response = await axios.post(
      HF_URL,
      { 
        inputs: prompt 
      },
      {
        headers: {
          "Authorization": `Bearer ${process.env.HF_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    // Hugging Face returns array format text
    const story = response.data?.generated_text || 
                  response.data?.[0]?.generated_text || 
                  "Story could not be generated.";

    res.json({ story });
  } catch (err) {
    console.error("HF Story Error:", err.response?.data || err.message);
    res.status(500).json({ error: "Story generation failed" });
  }
});

// ---------------- ROOT ----------------
app.get("/", (req, res) => {
  res.send("StoryGenie Backend Running (Hugging Face Gemma 2B)");
});

// ---------------- START SERVER ----------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`)
);
