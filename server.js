// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// -------------------- FREE HuggingFace Story Generator --------------------
const HF_URL = "https://router.huggingface.co/v1/chat/completions";
const HF_KEY = process.env.HF_API_KEY; // must be added in Render Dashboard

app.post("/api/generate-story", async (req, res) => {
  try {
    const { character, storyType, ageGroup, language } = req.body;

    const prompt = `
Write a children's story in **${language}**.

Conditions:
- Story Type: ${storyType}
- Age Group: ${ageGroup}
- Main Character: ${character}
- Write 5–7 short paragraphs.
- Use ONLY ${language}, no English translation.

Now write the full story:
`;

    const response = await fetch(HF_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${HF_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "meta-llama/Llama-3.2-3B-Instruct", // FREE MODEL
        messages: [{ role: "user", content: prompt }],
        max_tokens: 500,
        temperature: 0.8,
      }),
    });

    const data = await response.json();

    console.log("HF RESPONSE:", data);

    const story = data?.choices?.[0]?.message?.content?.trim();

    res.json({ story });
  } catch (err) {
    console.error("HF Story Error:", err);
    res.status(500).json({ error: "Story generation failed" });
  }
});

// ---------------- ROOT ----------------
app.get("/", (req, res) => {
  res.send("StoryGenie Backend Running");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`)
);
