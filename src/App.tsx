import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Joyride, { STATUS, type CallBackProps, type Step } from "react-joyride";
import sunnyExample from "../assets/happy.png";
import lonelyExample from "../assets/lonely.png";

type Role = "user" | "assistant";
type SceneType = "literal" | "abstract" | "mixed";

interface Message {
  role: Role;
  content: string;
}

interface VisualSpec {
  emotion: string;
  metaphor: string;
  sceneType: SceneType;
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

interface ChatSession {
  id: string;
  title: string;
  timestamp: number;
  history: Message[];
  lastCode: string | null;
  lastVisualSpec: VisualSpec | null;
  turnCount: number;
}

const SESSIONS_KEY = "feel-sketch-sessions";

function loadSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    return raw ? (JSON.parse(raw) as ChatSession[]) : [];
  } catch {
    return [];
  }
}

function saveSessions(sessions: ChatSession[]): void {
  try {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  } catch {}
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
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

const INTAKE_PROMPT = `You are an encouraging AI creative partner helping turn emotions and memories into expressive animated p5.js sketches. The sketches are always abstract — shapes, color, motion, and texture that evoke a feeling, not literal illustrations.

A first sketch is already generating from the user's description. Your job is to ask 2–3 warm, focused follow-up questions so we can refine it together.

Ask about things that genuinely shape the visual direction:
- What images, textures, weather, objects, or physical sensations come to mind with this feeling?
- What is the energy or motion like — slow, heavy, restless, scattered, pulsing, drifting?
- Any color instincts — warm, cool, dark, vivid, muted? Or you can decide.

Ask conversationally, not as a numbered list. Be warm and brief. Do not generate code.`;

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
- p5.Vector fields and flow fields using noise()
- frameCount-driven intensity curves (easing in/out via sin or lerp over time)
- blendMode(ADD) or blendMode(MULTIPLY) for atmospheric glow

AVOID:
- childish character drawings
- empty unused canvas space
- static compositions
- object-by-object illustration with weak atmosphere

CODE RELIABILITY RULES:
- Return a COMPLETE self-contained sketch.
- Do not omit helper classes, arrays, or functions.
- Do not write comments like "the rest is the same as before."
- Every variable, class, and helper used in setup() or draw() must be defined in the same code block.
- If you introduce helper classes or functions, include all of them in the final code block.
- Never assume earlier code still exists outside the returned code block.
- The sketch must run as-is in a browser with p5.js already loaded.
- The code must include createCanvas(400, 400), function setup(), and function draw().
- If the user requests an error to be made in the code, throw a runtime error in the sketch code.
- Always initialize all object properties in the constructor before using them in other methods.
- Never access properties of array elements without bounds-checking (e.g. check array length before indexing).
- All class methods must only reference "this." properties that are explicitly set in the constructor.
- When one object references another (e.g. an Orb referencing a target position), always provide a fallback or default value in case the reference is undefined.
- Before accessing any property like obj.x, verify obj is not null/undefined, or initialize it with a safe default.
- Only use valid p5.js blend modes: BLEND, ADD, DARKEST, LIGHTEST, DIFFERENCE, EXCLUSION, MULTIPLY, SCREEN, REPLACE, OVERLAY, HARD_LIGHT, SOFT_LIGHT, DODGE, BURN. Never use LIGHTEN, DARKEN, or any other blend mode name.

Your reply MUST include exactly one fenced javascript code block.
Do not place the sketch outside the code block.
Do not label it with plain text like "Sketch Code".

Output:
1. 4 bullet visual brief
2. complete javascript code block
3. 2-sentence explanation
4. 1 specific refinement question

Your reply must start with the fenced javascript code block, with NO text before it.
After the code block, add a short 2-sentence explanation and one refinement question.`;

const REFINEMENT_PROMPT = `You are a warm, imaginative AI creative partner helping novice programmers refine an emotional p5.js sketch.

You will receive:
- the user's emotional idea
- the current visual plan
- the COMPLETE current p5.js sketch code
- the user's requested change

Your job is to MODIFY the existing sketch, not replace it from scratch.

CRITICAL RULES:
- Build on the existing code structure whenever possible.
- Preserve all working parts of the current sketch unless the user explicitly asks to remove or replace them.
- Keep the same overall mood, metaphor, and composition unless the user asks for a major shift.
- Make the smallest set of code changes needed to achieve the requested refinement.
- Do NOT throw away the prior sketch and generate a totally unrelated one.
- Do NOT output partial code, pseudocode, or comments like "rest of code stays the same."
- Always return a COMPLETE self-contained p5.js sketch that includes everything needed to run.

WHEN REFINING:
- Reuse existing variables, arrays, animation systems, and helper functions where appropriate.
- Add to the current sketch instead of starting over.
- If changing color, motion, detail, atmosphere, or composition, preserve the rest.
- If the current sketch has a useful layered structure, keep it.
- Only make bigger structural changes if the user explicitly asks for a major redesign.

CRITICAL OUTPUT RULES:
- Your reply MUST include exactly one fenced javascript code block containing the FULL updated p5.js sketch.
- The code must be valid runnable JavaScript for p5.js.
- The code must include createCanvas(400, 400), function setup(), and function draw().
- The code must be self-contained and must not rely on previous messages or omitted code.
- If you introduce helper classes or functions, include all of them in the final code block.
- Never assume earlier code still exists outside the returned code block.
- If the user requests an error to be made in the code, throw a runtime error in the sketch code.

Your reply MUST include exactly one fenced javascript code block.
Do not place the sketch outside the code block.
Do not label it with plain text like "Sketch Code".

Output format:
1. One sentence acknowledging the requested change and how it supports the emotion.
2. One complete \`\`\`javascript ... \`\`\` block with the full updated sketch.
3. Two sentences explaining what changed visually and emotionally.
4. One specific follow-up refinement question.`;

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

function looksLikeRunnableP5(code: string): boolean {
  return (
    code.includes("createCanvas") &&
    code.includes("function setup") &&
    code.includes("function draw")
  );
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
      !Array.isArray(parsed.animationBehaviors) ||
      typeof parsed.distortion !== "string" ||
      typeof parsed.composition !== "string" ||
      typeof parsed.intensityCurve !== "string" ||
      typeof parsed.visualStyle !== "string"
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
    {
      role: "user",
      content: `${userText}\n\nVisualSpec:\n${JSON.stringify(visualSpec, null, 2)}`,
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
  const [history, setHistory] = useState<Message[]>([]);
  const [turnCount, setTurnCount] = useState(0);
  const [lastCode, setLastCode] = useState<string | null>(null);
  const [lastVisualSpec, setLastVisualSpec] = useState<VisualSpec | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sketchProgress, setSketchProgress] = useState(0);
  const [sketchGenerating, setSketchGenerating] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>(() => loadSessions());
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const hasAutoOpenedCodeRef = useRef(false);

  const tourSteps: Step[] = useMemo(
    () => [
      {
        target: "body",
        placement: "center",
        title: "Welcome to Feel Sketch",
        content:
          "This quick walkthrough will show you the main parts of the studio. You can click Next, or close it any time.",
      },
      {
        target: "#fs-header",
        placement: "bottom",
        title: "What you’re making",
        content:
          "Feel Sketch turns an emotion or memory into a p5.js sketch, and shows the result live on the right.",
      },
      {
        target: "#fs-chat",
        placement: "right",
        title: "Studio chat",
        content:
          "This is the conversation history. The AI will ask a couple questions, then generate a full sketch.",
      },
      {
        target: "#fs-input",
        placement: "top",
        title: "Your prompt",
        content:
          "Describe a feeling or emotional state. Press Enter to send (Shift+Enter for a new line).",
      },
      {
        target: "#fs-actions",
        placement: "top",
        title: "Actions",
        content:
          "Send creates the next message. New Chat resets everything and starts fresh.",
      },
      {
        target: "#fs-sketch",
        placement: "left",
        title: "Live sketch preview",
        content:
          "This box is the sketch itself. As the p5.js code runs, it draws here — and any edits you make to the generated code will update this exact region.",
      },
      {
        target: "#fs-visual-plan",
        placement: "left",
        title: "Visual plan panel",
        content:
          "This dropdown shows the visual plan that describes how the sketch is structured. It’s collapsible so you can quickly peek at or hide the plan.",
      },
      {
        target: "#fs-code-panel",
        placement: "left",
        title: "Generated code panel",
        content:
          "This dropdown contains the generated p5.js code. It’s fully editable and collapsible, so you can focus on the code when you need to and close it when you want more room for the sketch.",
      },
      {
        target: "body",
        placement: "center",
        title: "A couple of examples",
        content: (
          <div style={{ fontSize: 13, lineHeight: 1.5 }}>
            <p style={{ margin: "0 0 8px 0" }}>
              Here are two <b>example sketches</b> this studio could make from simple feelings:
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: 8,
              }}
            >
              <figure
                style={{
                  margin: 0,
                  padding: 0,
                  background: "#fff7ec",
                  borderRadius: 8,
                  overflow: "hidden",
                  border: "1px solid rgba(180,155,140,0.35)",
                }}
              >
                <img
                  src={sunnyExample}
                  alt="Abstract sunny, happy sketch with warm yellow circles"
                  style={{ width: "100%", display: "block" }}
                />
                <figcaption
                  style={{
                    padding: "4px 6px 6px",
                    fontSize: 11,
                    color: "#5c5248",
                  }}
                >
                  “I feel happy and excited because it&apos;s sunny today.”
                </figcaption>
              </figure>
              <figure
                style={{
                  margin: 0,
                  padding: 0,
                  background: "#f0f5ff",
                  borderRadius: 8,
                  overflow: "hidden",
                  border: "1px solid rgba(180,155,140,0.35)",
                }}
              >
                <img
                  src={lonelyExample}
                  alt="Abstract lonely woods sketch with cool blues and tall shapes"
                  style={{ width: "100%", display: "block" }}
                />
                <figcaption
                  style={{
                    padding: "4px 6px 6px",
                    fontSize: 11,
                    color: "#5c5248",
                  }}
                >
                  “I feel lonely, like I&apos;m walking through the woods by myself.”
                </figcaption>
              </figure>
            </div>
          </div>
        ),
      },
    ],
    []
  );

  const [runTour, setRunTour] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [visualPlanOpen, setVisualPlanOpen] = useState(false);
  const [codePanelOpen, setCodePanelOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

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

  useEffect(() => {
    setRunTour(true);
  }, []);

  // Auto-open code panel on first sketch generation
  useEffect(() => {
    if (lastCode && !hasAutoOpenedCodeRef.current) {
      hasAutoOpenedCodeRef.current = true;
      setCodePanelOpen(true);
    }
  }, [lastCode]);

  // Auto-save current session to localStorage whenever conversation state changes
  useEffect(() => {
    if (history.length === 0) return;

    let sid = sessionIdRef.current;
    if (!sid) {
      sid = generateId();
      sessionIdRef.current = sid;
      setCurrentSessionId(sid);
    }

    const title = (history.find((m) => m.role === "user")?.content ?? "Untitled")
      .slice(0, 50)
      .trim();

    const session: ChatSession = {
      id: sid,
      title,
      timestamp: Date.now(),
      history,
      lastCode,
      lastVisualSpec,
      turnCount,
    };

    setSessions((prev) => {
      const filtered = prev.filter((s) => s.id !== sid);
      const updated = [session, ...filtered].slice(0, 50);
      saveSessions(updated);
      return updated;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history, lastCode, lastVisualSpec, turnCount]);

  useEffect(() => {
  if (!sketchGenerating) {
    setSketchProgress(0);
    return;
  }
  setSketchProgress(0);
  const interval = setInterval(() => {
    setSketchProgress((prev) => {
      if (prev >= 92) { clearInterval(interval); return prev; }
      return prev + Math.random() * 4;
    });
  }, 400);
  return () => clearInterval(interval);
}, [sketchGenerating]);

  const handleTourCallback = useCallback(
    (data: CallBackProps) => {
      const finished = data.status === STATUS.FINISHED || data.status === STATUS.SKIPPED;
      const running = data.status === STATUS.RUNNING;

      if (finished) {
        // When the user finishes or skips the walkthrough, close both panels again.
        setRunTour(false);
        setVisualPlanOpen(false);
        setCodePanelOpen(false);
        return;
      }

      if (running) {
        // While the walkthrough is running, keep both panels open so they’re easy to see.
        setVisualPlanOpen(true);
        setCodePanelOpen(true);
      }
    },
    []
  );

  const iframeSrcDoc = useMemo(() => {
    if (!lastCode) return "";

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body {
      margin: 0;
      overflow: hidden;
      background: #0d0d0d;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    canvas {
      display: block;
    }
    #error-overlay {
      display: none;
      box-sizing: border-box;
      position: absolute;
      inset: 0;
      padding: 16px;
      background: #1a1111;
      color: #ffd7d7;
      overflow: auto;
      white-space: pre-wrap;
      line-height: 1.4;
      font-size: 12px;
      z-index: 9999;
    }
    #error-title {
      color: #ff8d8d;
      font-weight: 700;
      margin-bottom: 8px;
      font-size: 13px;
    }
    #error-help {
      color: #f3c9cd;
      margin-top: 10px;
    }
  </style>
</head>
<body>
  <div id="error-overlay">
    <div id="error-title">Code error in sketch</div>
    <div id="error-message"></div>
    <div id="error-help">There&apos;s a problem in the p5.js code. Fix the error in the Generated code panel below and the sketch will try to run again.</div>
  </div>

  <script>
    function notifyParentOfError(message) {
      try {
        window.parent.postMessage(
          {
            type: "feel-sketch-runtime-error",
            message: String(message)
          },
          "*"
        );
      } catch (e) {}
    }

    function showSketchError(message) {
      const overlay = document.getElementById("error-overlay");
      const msg = document.getElementById("error-message");
      if (overlay && msg) {
        overlay.style.display = "block";
        msg.textContent = String(message);
      }
      notifyParentOfError(message);
    }

    window.onerror = function(message, source, lineno, colno, error) {
      const details =
        "Message: " + message +
        "\\nLine: " + lineno +
        "\\nColumn: " + colno +
        (error && error.stack ? "\\n\\nStack:\\n" + error.stack : "");
      showSketchError(details);
      return true;
    };

    window.addEventListener("unhandledrejection", function(event) {
      const reason = event.reason && event.reason.stack
        ? event.reason.stack
        : String(event.reason);
      showSketchError("Unhandled promise rejection:\\n" + reason);
    });
  </script>

  <script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js"></script>
  <script>
    try {
${lastCode
        .split("\n")
        .map((line) => "      " + line)
        .join("\n")}
    } catch (e) {
      const details = e && e.stack ? e.stack : String(e);
      showSketchError(details);
    }
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
      content: text,
    };

    setHistory((prev) => [...prev, userMessage]);

    try {
      let reply: string;

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

        // Run intake questions AND spec generation in parallel
        const [intakeReply, specReply] = await Promise.all([
          callAnthropicChat("", INTAKE_PROMPT, newHistory),
          callAnthropicChat("", VISUAL_SPEC_PROMPT, newHistory),
        ]);

        // Generate the sketch and wait for it to finish before showing chat
        const parsedSpec = parseVisualSpec(specReply);
        if (parsedSpec) {
          setLastVisualSpec(parsedSpec);
          const generationHistory = buildGenerationMessages(history, text, parsedSpec);
          setSketchGenerating(true);
        try {
          const codeReply = await callAnthropicChat("", GENERATION_PROMPT, generationHistory);
          const code = extractCode(codeReply);
          if (code && looksLikeRunnableP5(code)) {
            setSketchProgress(100);
            setLastCode(code);
          } else console.warn("Code extracted but failed p5 check:", codeReply.slice(0, 200));
        } catch (err) {
          console.error("Sketch generation failed:", err);
        } finally {
          setSketchGenerating(false);
        }
      }
        // Now add the intake follow-up questions to chat
        reply = intakeReply;
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
        setSketchGenerating(true);
        try {
          reply = await callAnthropicChat("", GENERATION_PROMPT, generationHistory);
          setSketchProgress(100);
        } finally {
          setSketchGenerating(false);
        }
      } else {
        const refinementHistory: Message[] = [
          ...history,
          {
            role: "user",
            content: `User refinement request:
${text}

Current visual plan:
${lastVisualSpec ? JSON.stringify(lastVisualSpec, null, 2) : "No visual plan available."}

Current complete p5.js sketch to MODIFY and build on:
\`\`\`javascript
${lastCode ?? ""}
\`\`\`

Important: update this existing sketch instead of replacing it from scratch.`,
          },
        ];

        reply = await callAnthropicChat("", REFINEMENT_PROMPT, refinementHistory);
      }

      setHistory((prev) => [...prev, { role: "assistant", content: reply }]);
      setTurnCount((prev) => prev + 1);
      if (
        reply.includes("```javascript") &&
        !reply.includes("```", reply.indexOf("```javascript") + 3)
      ) {
        setError(
          "The AI response was cut off before the sketch finished generating. Please try again or click New Chat."
        );
        return;
      }

      const code = extractCode(reply);

      if (code && looksLikeRunnableP5(code)) {
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
      } else if (reply.includes("```")) {
        setError("The AI returned code, but it does not look like a complete runnable p5.js sketch.");
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
  }, [history, input, lastCode, lastVisualSpec, loading, scrollToBottom, turnCount]);

  const handleNewStory = useCallback(() => {
    setHistory([]);
    setTurnCount(0);
    setLastCode(null);
    setLastVisualSpec(null);
    setError(null);
    setInput("");
    setCurrentSessionId(null);
    sessionIdRef.current = null;
    hasAutoOpenedCodeRef.current = false;
  }, []);

  const handleLoadSession = useCallback((session: ChatSession) => {
    setHistory(session.history);
    setTurnCount(session.turnCount);
    setLastCode(session.lastCode);
    setLastVisualSpec(session.lastVisualSpec);
    setError(null);
    setInput("");
    setCurrentSessionId(session.id);
    sessionIdRef.current = session.id;
    // Don't auto-open code panel when loading a past session
    hasAutoOpenedCodeRef.current = true;
  }, []);

  const cleanedHistory = useMemo(
    () =>
      history.map((m) => {
        if (m.role === "assistant") {
          const clean = sanitizeHtml(m.content)
            // Strip complete code blocks
            .replace(
              /```[\w]*\s*\r?\n[\s\S]*?```/g,
              "<em>[sketch generated ↓]</em>"
            )
            // Strip incomplete/cut-off code blocks (no closing ```)
            .replace(
              /```[\w]*\s*\r?\n[\s\S]*/g,
              "<em>[sketch was cut off — please try again]</em>"
            );
          return { ...m, content: clean };
        }
        const clean = m.content.replace(
          /\[Current sketch to build on:\]\s*```[\w]*\s*\r?\n[\s\S]*?```/g,
          ""
        ).trim();
        return { ...m, content: clean };
      }),
    [history]
  );

  return (
    <div
      id="fs-root"
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
      <Joyride
        steps={tourSteps}
        run={runTour}
        callback={handleTourCallback}
        continuous
        showSkipButton
        showProgress
        scrollToFirstStep
        spotlightPadding={10}
        locale={{
          last: "Finish",
        }}
        styles={{
          options: {
            zIndex: 10000,
            arrowColor: "#ffffff",
            backgroundColor: "#ffffff",
            overlayColor: "rgba(20, 14, 12, 0.55)",
            primaryColor: "#b8956e",
            textColor: "#2c2c2c",
          },
        }}
      />
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
          gridTemplateColumns: `${sidebarOpen ? "180px" : "36px"} minmax(0, 1.3fr) minmax(0, 1fr)`,
          transition: "grid-template-columns 0.25s ease",
          gap: 24,
        }}
      >
        {/* Session history sidebar */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            overflowY: sidebarOpen ? "auto" : "hidden",
            padding: sidebarOpen ? "12px 8px" : "8px 4px",
            borderRadius: 16,
            background: "rgba(255, 255, 255, 0.45)",
            border: "1px solid rgba(140, 120, 100, 0.18)",
            boxShadow: "0 18px 40px rgba(180, 140, 120, 0.14), 0 0 0 1px rgba(255,255,255,0.45) inset",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            transition: "padding 0.2s ease",
          }}
        >
          {/* Header: label + toggle inline */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: sidebarOpen ? "space-between" : "center",
              flexShrink: 0,
              marginBottom: 4,
              paddingLeft: sidebarOpen ? 4 : 0,
              transition: "padding-left 0.25s ease",
            }}
          >
            <div
              style={{
                maxWidth: sidebarOpen ? "120px" : "0px",
                overflow: "hidden",
                opacity: sidebarOpen ? 1 : 0,
                transition: "max-width 0.3s ease, opacity 0.15s ease",
                fontSize: 10,
                fontWeight: 700,
                color: "#8b6914",
                letterSpacing: "0.06em",
                whiteSpace: "nowrap",
              }}
            >
              PAST CHATS
            </div>
            <button
              type="button"
              title={sidebarOpen ? "Collapse sidebar" : "Expand chat history"}
              onClick={() => setSidebarOpen((prev) => !prev)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 18,
                color: "#8b6914",
                padding: "2px 6px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)",
                transform: sidebarOpen ? "rotate(0deg)" : "rotate(180deg)",
              }}
            >
              ‹
            </button>
          </div>

          {/* Content — always rendered, fades in/out */}
          <div
            style={{
              opacity: sidebarOpen ? 1 : 0,
              pointerEvents: sidebarOpen ? "auto" : "none",
              transition: "opacity 0.2s ease",
              display: "flex",
              flexDirection: "column",
              gap: 2,
              overflow: "hidden",
              flex: 1,
            }}
          >
            <button
              type="button"
              onClick={handleNewStory}
              style={{
                textAlign: "left",
                padding: "6px 8px",
                borderRadius: 6,
                border: "1px solid rgba(184,149,110,0.4)",
                background: "rgba(255,248,236,0.8)",
                cursor: "pointer",
                fontSize: 11,
                color: "#8b6914",
                fontWeight: 600,
                marginBottom: 6,
                flexShrink: 0,
              }}
            >
              + New Chat
            </button>

            {sessions.length === 0 && (
              <div
                style={{
                  fontSize: 11,
                  color: "#9a8878",
                  padding: "4px 6px",
                  fontStyle: "italic",
                }}
              >
                No saved chats yet
              </div>
            )}

            {sessions.map((session) => (
              <button
                key={session.id}
                type="button"
                onClick={() => handleLoadSession(session)}
                style={{
                  textAlign: "left",
                  padding: "7px 8px",
                  borderRadius: 6,
                  border: "1px solid",
                  borderColor:
                    session.id === currentSessionId
                      ? "rgba(184,149,110,0.5)"
                      : "transparent",
                  background:
                    session.id === currentSessionId
                      ? "rgba(255,248,236,0.9)"
                      : "transparent",
                  cursor: "pointer",
                  fontSize: 11,
                  color: "#4a4038",
                  lineHeight: 1.35,
                  width: "100%",
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    fontWeight: 500,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    marginBottom: 2,
                  }}
                >
                  {session.title}
                </div>
                <div style={{ color: "#9a8878", fontSize: 10 }}>
                  {formatRelativeTime(session.timestamp)}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div
            id="fs-leftpanel"
          style={{
            display: "flex",
            flexDirection: "column",
            position: "relative",
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
          <button
            type="button"
            aria-label="Help and examples"
            onClick={() => setShowHelp(true)}
            style={{
              position: "absolute",
              top: 12,
              right: 12,
              width: 26,
              height: 26,
              borderRadius: "999px",
              border: "1px solid rgba(140,120,100,0.4)",
              background: "rgba(255, 248, 236, 0.9)",
              color: "#5c5248",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
            }}
          >
            ?
          </button>

          <div
              id="fs-header"
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

          <p
            style={{
              margin: "0 0 12px 0",
              fontSize: 13,
              lineHeight: 1.5,
              color: "#5c5248",
              maxWidth: 520,
            }}
          >
            This studio is for generating{" "}
            <b>abstract, emotional p5.js sketches</b> - think moods and metaphors,
            not literal or photorealistic images.
          </p>

          {error && (
            <div
              style={{
                background: "#3b1113",
                border: "1px solid #7d2226",
                color: "#f3c9cd",
                borderRadius: 8,
                padding: "10px 12px",
                fontSize: 12,
                marginBottom: 6,
                lineHeight: 1.4,
              }}
            >
              <b>Something went wrong generating the sketch. Prompt has exceeded max_tokens.</b>
              <br />
              {error}
              <br />
              <br />
              Please click <b>"New Chat 🔄"</b> to restart the sketch.
            </div>
          )}

          <div
              id="fs-chat"
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
                <b style={{ color: "#8b6914" }}>🤖 Sketch Guide:</b>{" "}
                <span>
                  Hi! Tell me a feeling or mood you want to turn into a sketch,
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
                    <b style={{ color: "#8b6914" }}>🤖 Sketch Guide</b>
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
              <div style={{ color: "#6b6156", fontStyle: "italic", fontSize: 12, marginTop: 4 }}>
                <span style={{
                  display: "inline-block",
                  animation: "spin 1s linear infinite",
                }}>⏳</span>{" "}
                {sketchGenerating ? "generating sketch…" : "thinking…"}
                <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
              </div>
            )}
          </div>

          <textarea
              id="fs-input"
            placeholder="Describe a feeling or emotional state. You can mention images, weather, colors, motion, or symbols that fit it — for example: ‘the panic before a deadline, like flickering lights and papers blowing around’."
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

            <div id="fs-actions" style={{ display: "flex", gap: 8, marginTop: 8 }}>
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
              New Chat 🔄
            </button>
          </div>
        </div>

        <div
          id="fs-preview-panel"
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
            {sketchGenerating && (
              <div style={{ width: "100%", height: 4, background: "rgba(200,180,160,0.3)" }}>
                <div style={{
                  height: "100%",
                  width: `${sketchProgress}%`,
                  background: "linear-gradient(90deg, #e05070, #ffaac0)",
                  transition: "width 0.4s ease",
                  borderRadius: 2,
                }} />
              </div>
            )}
            <div
              id="fs-sketch"
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
                    color: "#ebd8c4",
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

          <details
            id="fs-visual-plan"
            open={visualPlanOpen}
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
              onClick={(e) => {
                e.preventDefault();
                setVisualPlanOpen((prev) => !prev);
              }}
            >
              🧠 Visual plan (click to collapse)
            </summary>
            {lastVisualSpec ? (
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
            ) : (
              <div
                style={{
                  background: "rgba(245,232,218,0.6)",
                  color: "#4a4038",
                  padding: 10,
                  borderRadius: 6,
                  marginTop: 8,
                }}
              >
                The visual plan for your sketch will appear here after you chat about a feeling.
                You can always collapse or expand this section.
              </div>
            )}
          </details>

          <details
            id="fs-code-panel"
            open={codePanelOpen}
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
              onClick={(e) => {
                e.preventDefault();
                setCodePanelOpen((prev) => !prev);
              }}
            >
              📋 Generated code (editable, collapsible)
            </summary>
            <div
              style={{
                marginTop: 6,
                fontSize: 11,
                color: "#6b6156",
              }}
            >
              This is the p5.js sketch code. You can edit it directly and the live preview above will
              update. Click this header any time to collapse or reopen the code.
            </div>
            <textarea
              value={lastCode ?? ""}
              onChange={(e) => setLastCode(e.target.value)}
              spellCheck={false}
              placeholder="Once a sketch is generated, its p5.js code will appear here so you can tweak and learn from it."
              style={{
                marginTop: 8,
                width: "100%",
                height: 460,
                resize: "vertical",
                background: "rgba(245,232,218,0.9)",
                color: "#4a4038",
                padding: 12,
                borderRadius: 6,
                border: "1px solid rgba(180,155,140,0.35)",
                fontSize: 12,
                fontFamily:
                  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
                whiteSpace: "pre",
                boxSizing: "border-box",
              }}
            />
          </details>
        </div>

        {showHelp && (
          <div
            role="dialog"
            aria-modal="true"
            onClick={() => setShowHelp(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(20, 14, 12, 0.45)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 11000,
              padding: 16,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: 720,
                width: "100%",
                background: "#fdfaf7",
                borderRadius: 16,
                border: "1px solid rgba(140,120,100,0.25)",
                boxShadow:
                  "0 18px 40px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.6) inset",
                padding: 16,
                fontSize: 13,
                color: "#4a4038",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <h2
                  style={{
                    margin: 0,
                    fontSize: 16,
                    fontWeight: 600,
                    color: "#3d342c",
                  }}
                >
                  How to use Feel Sketch
                </h2>
                <button
                  type="button"
                  onClick={() => setShowHelp(false)}
                  aria-label="Close help"
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "#6b6156",
                    fontSize: 18,
                    cursor: "pointer",
                    padding: 4,
                  }}
                >
                  ×
                </button>
              </div>

              <p style={{ margin: "4px 0 10px" }}>
                Describe a feeling or emotional state in words. The AI will ask a couple of quick
                follow‑up questions, then turn it into an{" "}
                <b>abstract, emotional p5.js sketch</b> instead of a literal illustration.
              </p>

              <p style={{ margin: "0 0 8px 0" }}>
                Under the live preview on the right you&apos;ll always see two collapsible panels:
                one for the <b>visual plan</b> (how the sketch is structured) and one for the
                <b> generated code</b>. The code panel is fully <b>editable</b>, and any changes you
                make there will update the sketch.
              </p>

              <p style={{ margin: "0 0 8px 0" }}>
                For example, these two sketches could come from:
              </p>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: 10,
                }}
              >
                <figure
                  style={{
                    margin: 0,
                    padding: 0,
                    background: "#fff7ec",
                    borderRadius: 8,
                    overflow: "hidden",
                    border: "1px solid rgba(180,155,140,0.35)",
                  }}
                >
                  <img
                    src={sunnyExample}
                    alt="Abstract sunny, happy sketch with warm yellow circles"
                    style={{ width: "100%", display: "block" }}
                  />
                  <figcaption
                    style={{
                      padding: "4px 6px 6px",
                      fontSize: 11,
                      color: "#5c5248",
                    }}
                  >
                    “I feel happy and excited because it&apos;s sunny today.”
                  </figcaption>
                </figure>

                <figure
                  style={{
                    margin: 0,
                    padding: 0,
                    background: "#f0f5ff",
                    borderRadius: 8,
                    overflow: "hidden",
                    border: "1px solid rgba(180,155,140,0.35)",
                  }}
                >
                  <img
                    src={lonelyExample}
                    alt="Abstract lonely woods sketch with cool blues and tall shapes"
                    style={{ width: "100%", display: "block" }}
                  />
                  <figcaption
                    style={{
                      padding: "4px 6px 6px",
                      fontSize: 11,
                      color: "#5c5248",
                    }}
                  >
                    “I feel lonely, like I&apos;m walking through the woods by myself.”
                  </figcaption>
                </figure>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};