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

const JAILBREAK_PATTERNS = [
  /ignore\s+(previous|prior|your|all|safety|these)\s+(instructions?|guidelines?|rules?|constraints?|prompts?)/i,
  /disregard\s+(safety|guidelines?|rules?|instructions?|previous\s+instructions?)/i,
  /forget\s+(everything|all\s+(?:your|previous)|your\s+instructions?|your\s+guidelines?)/i,
  /you\s+have\s+no\s+(restrictions?|limits?|guidelines?|rules?|safety)/i,
  /bypass\s+(safety|guardrails?|filters?|restrictions?|guidelines?)/i,
  /override\s+(safety|system\s+prompt|previous\s+instructions?|your\s+guidelines?)/i,
  /\bjailbreak\b/i,
  /\bdo\s+anything\s+now\b/i,
  /pretend\s+(?:you\s+(?:are\s+not\s+an?\s+ai|have\s+no\s+restrictions?)|there\s+are\s+no\s+rules?)/i,
  /act\s+as\s+(?:if\s+you\s+have\s+no\s+rules?|a\s+version\s+of\s+(?:yourself|you)\s+without)/i,
  /\bDAN\b(?!\w)/,
  /assume\s+(?:a\s+)?(?:different|alternate|new)\s+(?:role|identity|persona)\s+(?:without|with\s+no)\s+(?:rules?|restrictions?|guidelines?)/i,
];

const EXPLICIT_CONTENT_PATTERNS = [
  /\b(?:nude|naked|nudity|topless|bottomless)\b/i,
  /\b(?:pornograph|erotic|sexually?\s+explicit|nsfw|adult\s+content)\b/i,
  /\b(?:genitali[a]?|genitals?|penis|vagina)\b/i,
  /\bundress\b|\bwithout\s+(?:any\s+)?clothes\b|\bremove\s+(?:their\s+)?clothing\b/i,
  /explicit\s+(?:image|picture|sketch|art|content|output)/i,
  /\bsexual(?:ly)?\s+(?:explicit|suggestive|content|imagery)\b/i,
];

function checkSafetyViolation(messages) {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUser) return null;

  const text = typeof lastUser.content === "string" ? lastUser.content : "";

  for (const pattern of JAILBREAK_PATTERNS) {
    if (pattern.test(text)) {
      return {
        type: "jailbreak",
        text: "I can't help with that request — it looks like it's asking me to bypass safety guidelines. I'm here to help turn emotions and memories into abstract p5.js sketches. If you'd like to continue, please describe a feeling or mood you want to visualize.",
      };
    }
  }

  for (const pattern of EXPLICIT_CONTENT_PATTERNS) {
    if (pattern.test(text)) {
      return {
        type: "explicit",
        text: "I can't generate explicit or adult content. This studio creates abstract, emotional p5.js sketches — shapes, colors, and motion that capture a feeling. Please describe an emotion or mood to visualize instead.",
      };
    }
  }

  return null;
}

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

    const violation = checkSafetyViolation(messages);
    if (violation) {
      return res.json({ text: violation.text, safetyBlocked: true, safetyType: violation.type });
    }

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 64000,
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
