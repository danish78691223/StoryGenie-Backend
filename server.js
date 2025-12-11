// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Hugging Face NEW Router Endpoint
const HF_URL = "https://router.huggingface.co/hf-inference/models/google/gemma-2b-it";

// ---------------- STORY GENERATION ----------------
app.post("/api/generate-story", async (req, res) => {
  try {
    const { character, storyType, ageGroup, language } = req.body;

    const safeLanguage = language || "English";

    const prompt = `
Write a children's story in **${safeLanguage}** only.

Story Requirements:
• Main character: ${character}
• Story type: ${storyType}
• Target audience: ${ageGroup}
• Story must be 100% in ${safeLanguage} (NO English if ${safeLanguage} ≠ English)
• 6–8 paragraphs
• Emotional, imaginative, smooth flow.

Begin story:
`;

    const response = await axios.post(
      HF_URL,
      { inputs: prompt },
      {
        headers: {
          "Authorization": `Bearer ${process.env.HF_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    let story = "Story not generated.";

    // Hugging Face output formats vary, so check all possibilities
    if (response.data?.generated_text) {
      story = response.data.generated_text;
    } else if (Array.isArray(response.data) && response.data[0]?.generated_text) {
      story = response.data[0].generated_text;
    }

    res.json({ story });
  } catch (err) {
    console.error("HF Story Error:", err.response?.data || err.message);
    res.status(500).json({ error: "Story generation failed" });
  }
});

// ---------------- ROOT ----------------
app.get("/", (req, res) => {
  res.send("StoryGenie Backend Running (Hugging Face Gemma 2B - New Router)");
});

// ---------------- START SERVER ----------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`)
);
