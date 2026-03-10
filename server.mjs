import express from "express";
import dotenv from "dotenv";
import Anthropic from "@anthropic-ai/sdk";

dotenv.config();

const app = express();
app.use(express.json());

const port = process.env.PORT || 8787;

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

app.post("/api/chat", async (req, res) => {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return res
        .status(500)
        .json({ error: "Server missing ANTHROPIC_API_KEY environment variable." });
    }

    const { system, messages } = req.body ?? {};

    if (!system || !Array.isArray(messages)) {
      return res
        .status(400)
        .json({ error: "Request body must include system and messages array." });
    }

    const response = await client.messages.create({
      // Use a widely-available legacy model ID.
      model: "claude-3-haiku-20240307",
      max_tokens: 2048,
      system,
      messages,
    });

    const first = response.content?.[0];
    const text = first && first.type === "text" ? first.text : "";

    return res.json({ text });
  } catch (err) {
    console.error("Error in /api/chat:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
});

app.listen(port, () => {
  console.log(`Feel Sketch API server listening on http://localhost:${port}`);
});

