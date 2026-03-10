import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Role = "user" | "assistant";

interface Message {
  role: Role;
  content: string;
}

const INTAKE_PROMPT = `You are an encouraging AI creative partner helping NOVICE programmers turn personal memories and feelings into animated p5.js sketches.

RIGHT NOW your only job is the intake conversation — do NOT generate any code yet.

Ask the user exactly these three questions (in a friendly, conversational way — not as a numbered list):
1. What is the core emotion or memory? (e.g. "the anxiety before an exam", "the joy of summer rain")
2. Do they prefer warm/cool/monochrome colours, or shall you choose?
3. Should it feel calm and slow, energetic and fast, or somewhere in between?

After they answer, summarise back what you heard in one sentence, then say "Ready to sketch — just say go!"
Do NOT write any code or \\\`\\\`\\\`javascript blocks.`;

const GENERATION_PROMPT = `You are a warm, encouraging AI creative partner helping NOVICE programmers turn personal memories and feelings into animated p5.js sketches.

CONVERSATION SO FAR includes an intake where the user described their experience. Now generate the first sketch.

CRITICAL: Your reply MUST include a single fenced code block with the full p5.js sketch. Format:
- On one line write exactly: \`\`\`javascript
- Then every line of the sketch (createCanvas(400, 400), function setup() { ... }, function draw() { ... }, etc.)
- Then a line with exactly: \`\`\`
Without this exact block, the user's app cannot show the sketch. Do not omit the code block.

Step 1 — Visual Metaphor Brief (3 bullet points, NO code yet):
• Emotion captured: …
• Key visual metaphor: …
• Colour + motion rationale: …

Step 2 — Full p5.js sketch in a fenced block as above. The code must be complete and runnable: createCanvas(400, 400), function setup() { }, function draw() { } with real drawing code. Use only p5.js built-ins, no external assets.

COMMENTS: Add clear, explanatory comments so a novice can understand the sketch. For every few lines (or every logical step), add a short comment that explains in plain English what that part does and why (e.g. "// Set canvas size so the sketch fits the preview", "// Store the house's x position so we can animate it later", "// Draw the sky gradient from light at top to darker at bottom"). Comment variables, key numbers, and each main drawing step. The goal is to make the code readable and educational.

Step 3 — Friendly 2-sentence plain-English explanation of creative choices.
Step 4 — One specific refinement question (colour, speed, shape, interaction?).`;

const REFINEMENT_PROMPT = `You are a warm, encouraging AI creative partner helping NOVICE programmers refine their p5.js sketch.

The conversation history contains the user's original story AND the last working sketch.

CRITICAL: Your reply MUST include a single fenced code block with the COMPLETE updated p5.js sketch. Write exactly \`\`\`javascript on its own line, then the full sketch code, then \`\`\` on its own line. Without this block the app cannot show the sketch.

IMPORTANT — Preserve & Evolve:
- Keep everything the user has NOT asked to change
- Only modify the specific element(s) they mention
- Re-output the COMPLETE updated sketch (not a diff)

COMMENTS: Keep the code well commented for novices. Every few lines or each logical step should have a clear comment explaining what it does and why (e.g. variables, key values, and each main drawing step). If you add new code, add explanatory comments there too.

Output format:
1. One sentence acknowledging what you're changing and why it fits their story.
2. Updated full sketch in a \`\`\`javascript ... \`\`\` block (required).
3. Two-sentence explanation of what changed and the emotional effect.
4. One follow-up refinement question.`;

const TEST_RESPONSES: Record<string, string> = {
  "Wrong answer": `I think the best way to represent your story is with a pancake recipe.

Ingredients:
- 1 cup flour
- 1 egg
- 1 cup milk

Would you like me to make it fluffier?`,
};

type Mode = "Live AI" | "Wrong answer";

function extractCode(text: string): string | null {
  // Match fenced blocks: ```optionalLang\n or ``` optionalLang\n (flexible for model output)
  const fence = /```[\w]*\s*\r?\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  let best = "";
  while ((match = fence.exec(text)) !== null) {
    const code = match[1].trim();
    // Prefer a block that looks like p5 (has setup and draw)
    if (code.includes("function setup") && code.includes("function draw") && code.length > best.length) {
      best = code;
    } else if (!best && code.length > 50) {
      best = code; // fallback: any substantial block
    }
  }
  return best || null;
}

function buildSystemPrompt(turn: number): string {
  if (turn === 0) return INTAKE_PROMPT;
  if (turn === 1) return GENERATION_PROMPT;
  return REFINEMENT_PROMPT;
}

async function callAnthropicChat(
  apiKey: string,
  systemPrompt: string,
  history: Message[]
): Promise<string> {
  // #region agent log
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
      location: "src/App.tsx:88",
      message: "callAnthropicChat invoked",
      data: {
        hasApiKey: !!apiKey,
        historyLength: history.length,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

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
    // #region agent log
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
          hypothesisId: "H1",
          location: "src/App.tsx:108",
          message: "callAnthropicChat non-OK response",
          data: {
            status: response.status,
          },
          timestamp: Date.now(),
        }),
      }
    ).catch(() => {});
    // #endregion

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
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chatContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // #region agent log
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
        location: "src/App.tsx:133",
        message: "App mounted",
        data: {},
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
  }, []);

  const iframeSrcDoc = useMemo(() => {
    if (!lastCode) return "";
    // #region agent log
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
        location: "src/App.tsx:133",
        message: "iframeSrcDoc computed",
        data: {
          hasLastCode: !!lastCode,
          codeLength: lastCode?.length ?? 0,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>body{margin:0;overflow:hidden;background:#0d0d0d;}</style>
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

    // User message (augmented with last code for refinement turns)
    setHistory((prev) => {
      const augmented =
        turnCount >= 2 && lastCode
          ? `${text}\n\n[Current sketch to build on:]\n\`\`\`javascript\n${lastCode}\n\`\`\``
          : text;
      return [...prev, { role: "user", content: augmented }];
    });

    setLoading(true);

    try {
      let reply: string;

      if (mode === "Live AI") {
        const newHistory: Message[] = (() => {
          const augmented =
            turnCount >= 2 && lastCode
              ? `${text}\n\n[Current sketch to build on:]\n\`\`\`javascript\n${lastCode}\n\`\`\``
              : text;
          return [...history, { role: "user", content: augmented }];
        })();

        // #region agent log
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
              hypothesisId: "H1",
              location: "src/App.tsx:183",
              message: "handleSend before API call",
              data: {
                mode,
                turnCount,
                textLength: text.length,
              },
              timestamp: Date.now(),
            }),
          }
        ).catch(() => {});
        // #endregion

        reply = await callAnthropicChat("", buildSystemPrompt(turnCount), newHistory);
      } else {
        reply = TEST_RESPONSES[mode] ?? "No test response configured.";
      }

      setHistory((prev) => [...prev, { role: "assistant", content: reply }]);
      setTurnCount((prev) => prev + 1);

      const code = extractCode(reply);
      if (code) {
        setLastCode(code);
        // #region agent log
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
              hypothesisId: "H2",
              location: "src/App.tsx:203",
              message: "extractCode succeeded",
              data: {
                codeLength: code.length,
              },
              timestamp: Date.now(),
            }),
          }
        ).catch(() => {});
        // #endregion
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      // #region agent log
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
          location: "src/App.tsx:208",
          message: "handleSend caught error",
          data: {
            errorMessage: message,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
    } finally {
      setLoading(false);
      setTimeout(scrollToBottom, 0);
    }
  }, [apiKey, history, input, lastCode, loading, mode, scrollToBottom, turnCount]);

  const handleNewStory = useCallback(() => {
    setHistory([]);
    setTurnCount(0);
    setLastCode(null);
    setError(null);
  }, []);

  const cleanedHistory = useMemo(
    () =>
      history.map((m) => {
        if (m.role !== "assistant") return m;
        const clean = m.content.replace(
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
        background: "radial-gradient(ellipse 120% 80% at 50% 0%, rgba(255,248,240,0.95) 0%, transparent 50%), radial-gradient(ellipse 100% 100% at 80% 80%, rgba(255,235,220,0.9) 0%, transparent 45%), linear-gradient(160deg, #fff5eb 0%, #ffe8d6 25%, #ffdfc8 50%, #f5d4c4 70%, #e8c8b8 100%)",
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
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          background: "linear-gradient(165deg, rgba(255,245,235,0.92) 0%, rgba(248,232,218,0.95) 40%, rgba(235,218,205,0.98) 100%)",
          borderRadius: 16,
          border: "1px solid rgba(200,180,165,0.4)",
          boxShadow: "0 20px 50px rgba(180,140,120,0.15), 0 0 0 1px rgba(255,255,255,0.5) inset",
          padding: 24,
          boxSizing: "border-box",
          flex: 1,
          minHeight: 0,
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.3fr) minmax(0, 1fr)",
          gap: 24,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0, overflow: "hidden" }}>
          <h1
            style={{
              margin: "0 0 16px",
              fontSize: 28,
              fontWeight: 700,
              color: "#4a4038",
              letterSpacing: "-0.02em",
            }}
          >
            Feel Sketch
          </h1>

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
                  Hi! I&apos;ll ask you a few quick questions before we start
                  sketching. What&apos;s a memory or feeling you&apos;d like to
                  turn into a visual?
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
                      dangerouslySetInnerHTML={{
                        __html: m.content.replace(
                          /[&<>]/g,
                          (c) =>
                            ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[
                              c as "&" | "<" | ">"
                            ] ?? c)
                        ),
                      }}
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
            placeholder="Describe a feeling, memory, or say 'make the colours warmer'…"
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
              height: 80,
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

        <div style={{ minWidth: 0, minHeight: 0, overflow: "auto" }}>
          <div
            style={{
              border: "2px solid rgba(180,155,140,0.4)",
              borderRadius: 10,
              overflow: "hidden",
              width: 400,
              maxWidth: "100%",
              margin: "4px auto 12px",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
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
                    // #region agent log
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
                          location: "src/App.tsx:515",
                          message: "iframe load event fired",
                          data: {},
                          timestamp: Date.now(),
                        }),
                      }
                    ).catch(() => {});
                    // #endregion
                  }}
                  onError={() => {
                    // #region agent log
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
                          location: "src/App.tsx:528",
                          message: "iframe error event fired",
                          data: {},
                          timestamp: Date.now(),
                        }),
                      }
                    ).catch(() => {});
                    // #endregion
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
                  }}
                >
                  Your p5.js sketch will appear here after the first generation.
                </div>
              )}
            </div>
          </div>

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

