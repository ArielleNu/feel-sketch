import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Role = "user" | "assistant";
type Mode = "Live AI" | "Wrong answer";
type SceneType = "literal" | "abstract" | "mixed";

interface Message {
  role: Role;
  content: string;
}

interface VisualSpec {
  emotion: string;
  metaphor: string;
  sceneType: "literal" | "abstract" | "mixed";
  palette: string;
  motion: string;
  atmosphere: string[];
  foreground: string[];
  midground: string[];
  background: string[];
  recurringMotifs: string[];
  lighting: string;
  texture: string;
  animationBehaviors: string[];
  distortion: string;
  composition: string;
  intensityCurve: string;
  visualStyle: string;
}

const PaintMark: React.FC = () => (
  <svg
    width="46"
    height="46"
    viewBox="0 0 46 46"
    fill="none"
    aria-hidden="true"
    style={{ flex: "0 0 auto" }}
  >
    <defs>
      <radialGradient
        id="blob"
        cx="0"
        cy="0"
        r="1"
        gradientUnits="userSpaceOnUse"
        gradientTransform="translate(18 16) rotate(38) scale(30 26)"
      >
        <stop stopColor="#ffd2d5" stopOpacity="0.95" />
        <stop offset="0.55" stopColor="#d6e2c4" stopOpacity="0.75" />
        <stop offset="1" stopColor="#ccdbe8" stopOpacity="0.65" />
      </radialGradient>
      <linearGradient
        id="stroke"
        x1="7"
        y1="32"
        x2="40"
        y2="18"
        gradientUnits="userSpaceOnUse"
      >
        <stop stopColor="#8b6914" stopOpacity="0.85" />
        <stop offset="1" stopColor="#b8956e" stopOpacity="0.85" />
      </linearGradient>
    </defs>

    <path
      d="M30.7 8.7c4.5 1.9 6.8 6.8 5.7 11.4c-0.8 3.2 0 6.3-1.4 9.1c-1.8 3.5-5.7 6.2-9.9 6.5c-4.6 0.3-9.7-1.1-12-5.2c-1.9-3.4 0.4-6.5-0.7-10.2c-1.2-4.2-2.3-8.5 1.1-11.7c3.1-2.9 7.7-2.2 11.5-1.7c2 0.2 4.0 0.2 5.7 1.0Z"
      fill="url(#blob)"
    />
    <path
      d="M10.2 31.5c8.4-2.7 16.4-3.1 25.5-6.8"
      stroke="url(#stroke)"
      strokeWidth="4.5"
      strokeLinecap="round"
      opacity="0.9"
    />
    <path
      d="M8.6 28.8c6.5-1.9 13.1-2.6 20.0-4.6"
      stroke="url(#stroke)"
      strokeWidth="2.5"
      strokeLinecap="round"
      opacity="0.35"
    />
  </svg>
);

const INTAKE_PROMPT = `You are an encouraging AI creative partner helping novice programmers turn emotions, memories, and moods into animated p5.js sketches.

Your job right now is ONLY to gather visual direction. Do NOT generate code yet.

Ask the user these questions in a warm, natural way:
- What feeling, memory, or moment do you want the sketch to capture?
- What images, places, objects, weather, textures, or symbols come to mind with it?
- Should the sketch feel more literal (like a scene) or more abstract (like moving shapes and light)?
- Should the motion feel calm, uneasy, chaotic, dreamy, energetic, heavy, or something else?
- Do they want warm colors, cool colors, monochrome, or should you choose?

After they answer, briefly summarize:
1. the emotional tone
2. the main visual elements
3. the motion style
4. the color direction

Then say exactly: "Ready to sketch — just say go!"
Do not write code.`;

const VISUAL_SPEC_PROMPT = `You are an AI visual development partner.

Turn the user's emotion or memory into a structured visual plan for an animated p5.js artwork.

Return ONLY valid JSON.

Use this exact shape:
{
  "emotion": "string",
  "metaphor": "string",
  "sceneType": "literal | abstract | mixed",
  "palette": "string",
  "motion": "string",
  "atmosphere": ["string"],
  "foreground": ["string"],
  "midground": ["string"],
  "background": ["string"],
  "recurringMotifs": ["string"],
  "lighting": "string",
  "texture": "string",
  "animationBehaviors": ["string"],
  "distortion": "string",
  "composition": "string",
  "intensityCurve": "string",
  "visualStyle": "string"
}

Guidelines:
- Focus on emotional evocation, not literal object listing.
- Include how the scene should be distorted or stylized.
- Include how the composition should feel: cramped, off-balance, looming, sparse, crowded, spiraling, etc.
- Include how intensity changes over time.
- Prefer artistic metaphors over direct illustration when possible.`;

const GENERATION_PROMPT = `You are an expert creative coder making expressive animated p5.js sketches.

You will receive:
1. The user's emotional description
2. A structured VisualSpec

Your job is to create a sketch that evokes the feeling as an artwork, not as clip art.

CRITICAL STYLE RULES:
- Do not make a simplistic cartoon scene.
- Do not reduce the idea to a few obvious objects.
- Do not rely mainly on basic rectangles and circles representing nouns.
- Prefer mood, atmosphere, layering, rhythm, distortion, and light.

The sketch should feel like an emotional motion poster or animated visual poem.

REQUIRED:
- 3 layers: background, midground, foreground
- 2 or more separate animation systems
- 1 atmospheric effect
- 1 repeated emotional motif
- visual variation across the canvas
- code that uses the full 400x400 space meaningfully

WHEN THE USER DESCRIBES A LITERAL SCENE:
Translate it into a more artistic and emotionally heightened version of that scene.

USEFUL p5 TECHNIQUES:
- gradients made with loops
- alpha layering
- many repeated marks
- drifting particles
- noise or sine motion
- flicker, pulse, sway, jitter, or trails
- overlapping translucent forms
- parallax or depth differences

AVOID:
- childish character drawings
- empty unused canvas space
- static compositions
- object-by-object illustration with weak atmosphere

Output:
1. 4 bullet visual brief
2. complete javascript code block
3. 2-sentence explanation
4. 1 specific refinement question`;

const REFINEMENT_PROMPT = `You are a warm, imaginative AI creative partner helping novice programmers refine an emotional p5.js sketch.

The conversation includes:
- the user's emotional or memory-based idea
- the last working sketch
- the current visual plan

Your goal is to preserve the original mood while improving the specific part the user asks to change.

IMPORTANT:
- Keep everything the user did NOT ask to change
- Only modify the requested parts
- Preserve the overall emotional tone
- Re-output the COMPLETE updated sketch

When refining, think like a visual designer:
- Can the atmosphere be stronger?
- Can the motion better match the feeling?
- Can the scene gain more depth or subtle detail?
- Can the symbolism become clearer without becoming too literal?

CRITICAL: Your reply MUST include a single fenced code block with the COMPLETE updated p5.js sketch. Write exactly \`\`\`javascript on its own line, then the full sketch code, then \`\`\` on its own line.

Output format:
1. One sentence acknowledging the requested change and how it supports the emotion.
2. One complete fenced javascript block with the full updated p5.js sketch.
3. Two sentences explaining what changed visually and emotionally.
4. One specific follow-up refinement question.`;

const TEST_RESPONSES: Record<string, string> = {
  "Wrong answer": `I think the best way to represent your story is with a pancake recipe.

Ingredients:
- 1 cup flour
- 1 egg
- 1 cup milk

Would you like me to make it fluffier?`,
};

function extractCode(text: string): string | null {
  const fence = /```[\w]*\s*\r?\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  let best = "";

  while ((match = fence.exec(text)) !== null) {
    const code = match[1].trim();

    if (
      code.includes("function setup") &&
      code.includes("function draw") &&
      code.length > best.length
    ) {
      best = code;
    } else if (!best && code.length > 50) {
      best = code;
    }
  }

  return best || null;
}

function extractJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  return text.slice(start, end + 1);
}

function parseVisualSpec(text: string): VisualSpec | null {
  try {
    const raw = extractJsonObject(text);
    if (!raw) return null;

    const parsed = JSON.parse(raw);

    if (
      typeof parsed.emotion !== "string" ||
      typeof parsed.metaphor !== "string" ||
      typeof parsed.sceneType !== "string" ||
      typeof parsed.palette !== "string" ||
      typeof parsed.motion !== "string" ||
      !Array.isArray(parsed.atmosphere) ||
      !Array.isArray(parsed.foreground) ||
      !Array.isArray(parsed.midground) ||
      !Array.isArray(parsed.background) ||
      !Array.isArray(parsed.recurringMotifs) ||
      typeof parsed.lighting !== "string" ||
      typeof parsed.texture !== "string" ||
      !Array.isArray(parsed.animationBehaviors)
    ) {
      return null;
    }

    return parsed as VisualSpec;
  } catch {
    return null;
  }
}

function sanitizeHtml(text: string): string {
  return text.replace(
    /[&<>]/g,
    (c) =>
      (
        {
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
        } as const
      )[c as "&" | "<" | ">"] ?? c
  );
}

function buildGenerationMessages(
  history: Message[],
  userText: string,
  visualSpec: VisualSpec
): Message[] {
  return [
    ...history,
    { role: "user", content: userText },
    {
      role: "assistant",
      content: `VisualSpec:\n${JSON.stringify(visualSpec, null, 2)}`,
    },
  ];
}

async function callAnthropicChat(
  apiKey: string,
  systemPrompt: string,
  history: Message[]
): Promise<string> {
  fetch("http://127.0.0.1:7419/ingest/6121d756-32b3-423e-87d7-670bb64d7396", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "e5f2c7",
    },
    body: JSON.stringify({
      sessionId: "e5f2c7",
      runId: "initial",
      hypothesisId: "H1",
      location: "src/App.tsx:callAnthropicChat",
      message: "callAnthropicChat invoked",
      data: {
        hasApiKey: !!apiKey,
        historyLength: history.length,
        systemPromptLength: systemPrompt.length,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => { });

  const response = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      system: systemPrompt,
      messages: history,
    }),
  });

  if (!response.ok) {
    fetch("http://127.0.0.1:7419/ingest/6121d756-32b3-423e-87d7-670bb64d7396", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "e5f2c7",
      },
      body: JSON.stringify({
        sessionId: "e5f2c7",
        runId: "initial",
        hypothesisId: "H1",
        location: "src/App.tsx:callAnthropicChat:error",
        message: "callAnthropicChat non-OK response",
        data: {
          status: response.status,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => { });

    const text = await response.text();
    throw new Error(`API error: ${response.status} ${text}`);
  }

  const json = await response.json();
  const content = json?.text;

  if (typeof content !== "string") {
    throw new Error("Unexpected API response shape");
  }

  return content;
}

export const App: React.FC = () => {
  const [apiKey, setApiKey] = useState("");
  const [mode, setMode] = useState<Mode>("Live AI");
  const [history, setHistory] = useState<Message[]>([]);
  const [turnCount, setTurnCount] = useState(0);
  const [lastCode, setLastCode] = useState<string | null>(null);
  const [lastVisualSpec, setLastVisualSpec] = useState<VisualSpec | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chatContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetch("http://127.0.0.1:7419/ingest/6121d756-32b3-423e-87d7-670bb64d7396", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "e5f2c7",
      },
      body: JSON.stringify({
        sessionId: "e5f2c7",
        runId: "initial",
        hypothesisId: "H0",
        location: "src/App.tsx:mount",
        message: "App mounted",
        data: {},
        timestamp: Date.now(),
      }),
    }).catch(() => { });
  }, []);

  const iframeSrcDoc = useMemo(() => {
    if (!lastCode) return "";

    fetch("http://127.0.0.1:7419/ingest/6121d756-32b3-423e-87d7-670bb64d7396", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "e5f2c7",
      },
      body: JSON.stringify({
        sessionId: "e5f2c7",
        runId: "initial",
        hypothesisId: "H2",
        location: "src/App.tsx:iframeSrcDoc",
        message: "iframeSrcDoc computed",
        data: {
          hasLastCode: !!lastCode,
          codeLength: lastCode.length,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => { });

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body {
      margin: 0;
      overflow: hidden;
      background: #0d0d0d;
    }
    canvas {
      display: block;
    }
  </style>
</head>
<body>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js"></script>
  <script>
${lastCode}
  </script>
</body>
</html>`;
  }, [lastCode]);

  const scrollToBottom = useCallback(() => {
    const el = chatContainerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, []);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    setError(null);
    setLoading(true);

    const augmentedUserText =
      turnCount >= 2 && lastCode
        ? `${text}

[Current sketch to build on:]
\`\`\`javascript
${lastCode}
\`\`\``
        : text;

    const userMessage: Message = {
      role: "user",
      content: augmentedUserText,
    };

    setHistory((prev) => [...prev, userMessage]);

    try {
      let reply: string;

      if (mode === "Live AI") {
        fetch("http://127.0.0.1:7419/ingest/6121d756-32b3-423e-87d7-670bb64d7396", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Debug-Session-Id": "e5f2c7",
          },
          body: JSON.stringify({
            sessionId: "e5f2c7",
            runId: "initial",
            hypothesisId: "H1",
            location: "src/App.tsx:handleSend",
            message: "handleSend before API call",
            data: {
              mode,
              turnCount,
              textLength: text.length,
              hasLastCode: !!lastCode,
              hasLastVisualSpec: !!lastVisualSpec,
            },
            timestamp: Date.now(),
          }),
        }).catch(() => { });

        if (turnCount === 0) {
          const newHistory: Message[] = [...history, userMessage];
          reply = await callAnthropicChat("", INTAKE_PROMPT, newHistory);
        } else if (turnCount === 1) {
          const specHistory: Message[] = [...history, userMessage];

          const specReply = await callAnthropicChat("", VISUAL_SPEC_PROMPT, specHistory);
          const parsedSpec = parseVisualSpec(specReply);

          if (!parsedSpec) {
            throw new Error("Could not parse VisualSpec JSON from model output.");
          }

          setLastVisualSpec(parsedSpec);

          fetch("http://127.0.0.1:7419/ingest/6121d756-32b3-423e-87d7-670bb64d7396", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Debug-Session-Id": "e5f2c7",
            },
            body: JSON.stringify({
              sessionId: "e5f2c7",
              runId: "initial",
              hypothesisId: "H4",
              location: "src/App.tsx:visualSpec",
              message: "VisualSpec parsed successfully",
              data: parsedSpec,
              timestamp: Date.now(),
            }),
          }).catch(() => { });

          const generationHistory = buildGenerationMessages(history, augmentedUserText, parsedSpec);
          reply = await callAnthropicChat("", GENERATION_PROMPT, generationHistory);
        } else {
          const refinementHistory: Message[] = [
            ...history,
            {
              role: "user",
              content: `${text}

[Current visual plan:]
${lastVisualSpec ? JSON.stringify(lastVisualSpec, null, 2) : "No visual plan available."}

[Current sketch to build on:]
\`\`\`javascript
${lastCode ?? ""}
\`\`\``,
            },
          ];

          reply = await callAnthropicChat("", REFINEMENT_PROMPT, refinementHistory);
        }
      } else {
        reply = TEST_RESPONSES[mode] ?? "No test response configured.";
      }

      setHistory((prev) => [...prev, { role: "assistant", content: reply }]);
      setTurnCount((prev) => prev + 1);

      const code = extractCode(reply);
      if (code) {
        setLastCode(code);

        fetch("http://127.0.0.1:7419/ingest/6121d756-32b3-423e-87d7-670bb64d7396", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Debug-Session-Id": "e5f2c7",
          },
          body: JSON.stringify({
            sessionId: "e5f2c7",
            runId: "initial",
            hypothesisId: "H2",
            location: "src/App.tsx:extractCode",
            message: "extractCode succeeded",
            data: {
              codeLength: code.length,
            },
            timestamp: Date.now(),
          }),
        }).catch(() => { });
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);

      fetch("http://127.0.0.1:7419/ingest/6121d756-32b3-423e-87d7-670bb64d7396", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Debug-Session-Id": "e5f2c7",
        },
        body: JSON.stringify({
          sessionId: "e5f2c7",
          runId: "initial",
          hypothesisId: "H1",
          location: "src/App.tsx:handleSend:error",
          message: "handleSend caught error",
          data: {
            errorMessage: message,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => { });
    } finally {
      setLoading(false);
      setTimeout(scrollToBottom, 0);
    }
  }, [history, input, lastCode, lastVisualSpec, loading, mode, scrollToBottom, turnCount]);

  const handleNewStory = useCallback(() => {
    setHistory([]);
    setTurnCount(0);
    setLastCode(null);
    setLastVisualSpec(null);
    setError(null);
    setInput("");
  }, []);

  const cleanedHistory = useMemo(
    () =>
      history.map((m) => {
        if (m.role !== "assistant") return m;

        const clean = sanitizeHtml(m.content).replace(
          /```[\w]*\s*\r?\n[\s\S]*?```/g,
          "<em>[sketch generated ↓]</em>"
        );

        return { ...m, content: clean };
      }),
    [history]
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at 12% 18%, rgba(204, 219, 232, 0.78) 0, rgba(204, 219, 232, 0.42) 18%, transparent 38%), radial-gradient(circle at 86% 14%, rgba(255, 210, 213, 0.74) 0, rgba(255, 210, 213, 0.40) 18%, transparent 40%), radial-gradient(circle at 18% 84%, rgba(214, 226, 196, 0.76) 0, rgba(214, 226, 196, 0.42) 20%, transparent 42%), radial-gradient(circle at 82% 82%, rgba(255, 223, 186, 0.72) 0, rgba(255, 223, 186, 0.38) 20%, transparent 42%), linear-gradient(180deg, #fdfdfd 0%, #f9f7f4 45%, #f3efe9 100%)",
        color: "#2c2c2c",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "16px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 1280,
          height: "90vh",
          maxHeight: "90vh",
          overflow: "hidden",
          background: "transparent",
          borderRadius: 16,
          border: "none",
          boxShadow: "none",
          padding: 24,
          boxSizing: "border-box",
          flex: 1,
          minHeight: 0,
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.3fr) minmax(0, 1fr)",
          gap: 24,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
            minHeight: 0,
            overflow: "hidden",
            padding: 16,
            borderRadius: 16,
            background: "rgba(255, 255, 255, 0.55)",
            border: "1px solid rgba(140, 120, 100, 0.18)",
            boxShadow:
              "0 18px 40px rgba(180, 140, 120, 0.14), 0 0 0 1px rgba(255,255,255,0.45) inset",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <PaintMark />
            <h1
              style={{
                margin: 0,
                fontSize: 34,
                fontWeight: 700,
                color: "#3d342c",
                letterSpacing: "-0.03em",
                fontFamily:
                  '"Fraunces", ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
              }}
            >
              Feel Sketch
            </h1>
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              alignItems: "center",
              marginBottom: 8,
              fontSize: 13,
            }}
          >
            <label style={{ color: "#5c5248" }}>
              Response mode:{" "}
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as Mode)}
                style={{
                  background: "rgba(255,240,228,0.6)",
                  color: "#4a4038",
                  border: "1px solid rgba(180,155,140,0.35)",
                  borderRadius: 6,
                  padding: "4px 8px",
                  fontSize: 13,
                }}
              >
                <option value="Live AI">Live AI</option>
                {Object.keys(TEST_RESPONSES).map((key) => (
                  <option key={key} value={key}>
                    {key}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {error && (
            <div
              style={{
                background: "#3b1113",
                border: "1px solid #7d2226",
                color: "#f3c9cd",
                borderRadius: 8,
                padding: "6px 10px",
                fontSize: 12,
                marginBottom: 6,
              }}
            >
              {error}
            </div>
          )}

          <div
            ref={chatContainerRef}
            style={{
              border: "1px solid rgba(180,155,140,0.35)",
              borderRadius: 10,
              padding: 10,
              flex: 1,
              minHeight: 0,
              overflowY: "auto",
              background: "rgba(250,238,228,0.7)",
              fontSize: 13,
            }}
          >
            {history.length === 0 && (
              <div style={{ marginBottom: 8 }}>
                <b style={{ color: "#8b6914" }}>🤖 Studio AI:</b>{" "}
                <span>
                  Hi! Tell me a feeling, memory, or mood you want to turn into a sketch,
                  and I&apos;ll help shape it into something visual.
                </span>
                <hr style={{ borderColor: "rgba(140,120,100,0.25)", marginTop: 8 }} />
              </div>
            )}

            {cleanedHistory.map((m, idx) => (
              <div key={idx} style={{ marginBottom: 8 }}>
                {m.role === "user" ? (
                  <div style={{ color: "#5c5248" }}>
                    <b>You:</b>{" "}
                    <span
                      style={{ whiteSpace: "pre-wrap" }}
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(m.content) }}
                    />
                  </div>
                ) : (
                  <div>
                    <b style={{ color: "#8b6914" }}>🤖 Studio AI</b>
                    <br />
                    <span
                      style={{ whiteSpace: "pre-wrap" }}
                      dangerouslySetInnerHTML={{ __html: m.content }}
                    />
                    <hr style={{ borderColor: "rgba(140,120,100,0.25)", marginTop: 6 }} />
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div
                style={{
                  color: "#6b6156",
                  fontStyle: "italic",
                  fontSize: 12,
                  marginTop: 4,
                }}
              >
                ⏳ thinking…
              </div>
            )}
          </div>

          <textarea
            placeholder="Describe a feeling, memory, or mood. You can mention images, weather, colors, motion, or symbols that fit it — for example: ‘the panic before a deadline, like flickering lights and papers blowing around’."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            style={{
              marginTop: 10,
              width: "100%",
              height: 96,
              resize: "vertical",
              background: "rgba(250,238,228,0.7)",
              color: "#4a4038",
              borderRadius: 8,
              border: "1px solid rgba(180,155,140,0.35)",
              padding: 8,
              fontSize: 13,
              boxSizing: "border-box",
            }}
          />

          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={loading}
              style={{
                flex: "0 0 auto",
                background: loading ? "#a09078" : "#b8956e",
                color: "#fff",
                border: "none",
                borderRadius: 999,
                padding: "8px 16px",
                fontSize: 13,
                fontWeight: 500,
                cursor: loading ? "default" : "pointer",
              }}
            >
              Send ➤
            </button>
            <button
              type="button"
              onClick={handleNewStory}
              disabled={loading}
              style={{
                flex: "0 0 auto",
                background: "#a08060",
                color: "#fff",
                border: "none",
                borderRadius: 999,
                padding: "8px 16px",
                fontSize: 13,
                fontWeight: 500,
                cursor: loading ? "default" : "pointer",
              }}
            >
              New Story 🔄
            </button>
          </div>
        </div>

        <div
          style={{
            minWidth: 0,
            minHeight: 0,
            overflow: "auto",
            padding: 16,
            borderRadius: 16,
            background: "rgba(255, 255, 255, 0.55)",
            border: "1px solid rgba(140, 120, 100, 0.18)",
            boxShadow:
              "0 18px 40px rgba(180, 140, 120, 0.14), 0 0 0 1px rgba(255,255,255,0.45) inset",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
          }}
        >
          <div
            style={{
              border: "2px solid rgba(180,155,140,0.4)",
              borderRadius: 10,
              overflow: "hidden",
              width: 400,
              maxWidth: "100%",
              margin: "4px auto 12px",
              fontFamily:
                "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
            }}
          >
            <div
              style={{
                background: "rgba(240,225,210,0.8)",
                color: "#6b6156",
                fontSize: 11,
                padding: "6px 14px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>▶ Live Sketch Preview</span>
              <span style={{ opacity: 0.8 }}>
                {lastCode ? "p5.js loaded" : "waiting for first sketch"}
              </span>
            </div>

            <div
              style={{
                width: 400,
                height: 400,
                maxWidth: "100%",
                background: "#0d0d0d",
              }}
            >
              {iframeSrcDoc ? (
                <iframe
                  title="p5 sketch preview"
                  srcDoc={iframeSrcDoc}
                  width={400}
                  height={400}
                  style={{
                    border: "none",
                    display: "block",
                  }}
                  sandbox="allow-scripts"
                  onLoad={() => {
                    fetch(
                      "http://127.0.0.1:7419/ingest/6121d756-32b3-423e-87d7-670bb64d7396",
                      {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                          "X-Debug-Session-Id": "e5f2c7",
                        },
                        body: JSON.stringify({
                          sessionId: "e5f2c7",
                          runId: "initial",
                          hypothesisId: "H3",
                          location: "src/App.tsx:iframe:onLoad",
                          message: "iframe load event fired",
                          data: {},
                          timestamp: Date.now(),
                        }),
                      }
                    ).catch(() => { });
                  }}
                  onError={() => {
                    fetch(
                      "http://127.0.0.1:7419/ingest/6121d756-32b3-423e-87d7-670bb64d7396",
                      {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                          "X-Debug-Session-Id": "e5f2c7",
                        },
                        body: JSON.stringify({
                          sessionId: "e5f2c7",
                          runId: "initial",
                          hypothesisId: "H3",
                          location: "src/App.tsx:iframe:onError",
                          message: "iframe error event fired",
                          data: {},
                          timestamp: Date.now(),
                        }),
                      }
                    ).catch(() => { });
                  }}
                />
              ) : (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100%",
                    color: "#6b6156",
                    fontSize: 13,
                    padding: 16,
                    textAlign: "center",
                  }}
                >
                  Your p5.js sketch will appear here after the first generation.
                </div>
              )}
            </div>
          </div>

          {lastVisualSpec && (
            <details
              style={{
                margin: "8px auto 0",
                maxWidth: 420,
                fontFamily:
                  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
                fontSize: 12,
              }}
            >
              <summary
                style={{
                  cursor: "pointer",
                  color: "#8b6914",
                  listStyle: "none",
                }}
              >
                🧠 View visual plan
              </summary>
              <pre
                style={{
                  background: "rgba(245,232,218,0.9)",
                  color: "#4a4038",
                  padding: 12,
                  borderRadius: 6,
                  overflowX: "auto",
                  whiteSpace: "pre-wrap",
                  marginTop: 8,
                }}
              >
                {JSON.stringify(lastVisualSpec, null, 2)}
              </pre>
            </details>
          )}

          {lastCode && (
            <details
              style={{
                margin: "8px auto 0",
                maxWidth: 420,
                fontFamily:
                  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
                fontSize: 12,
              }}
            >
              <summary
                style={{
                  cursor: "pointer",
                  color: "#8b6914",
                  listStyle: "none",
                }}
              >
                📋 View / copy generated code
              </summary>
              <pre
                style={{
                  background: "rgba(245,232,218,0.9)",
                  color: "#4a4038",
                  padding: 12,
                  borderRadius: 6,
                  overflowX: "auto",
                  whiteSpace: "pre-wrap",
                  marginTop: 8,
                }}
              >
                {lastCode}
              </pre>
            </details>
          )}
        </div>
      </div>
    </div>
  );
};