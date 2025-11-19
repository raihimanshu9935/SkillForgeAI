import { useEffect, useRef, useState } from "react";
import axios from "axios";
import ChatMessage from "../components/ChatMessage";
import { motion } from "framer-motion";

// 🔰 Global config
axios.defaults.baseURL = import.meta.env.VITE_API_URL || "http://localhost:4000";


// ---------------- ErrorBoundary (safety against blank screen) ----------------
function ErrorBoundary({ children }) {
  const [err, setErr] = useState(null);
  if (err) {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <div className="max-w-xl w-full rounded-xl border p-6 bg-white shadow">
          <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
          <p className="text-sm text-red-600 whitespace-pre-wrap">{String(err)}</p>
          <button
            className="mt-4 px-3 py-2 rounded bg-emerald-600 text-white"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
  return (
    <div
      onErrorCapture={(e) => {
        console.error("💥 React render error:", e);
        setErr(e?.message || "Unknown render error");
      }}
    >
      {children}
    </div>
  );
}

// ---------------- Main Assistant Component ----------------
export default function Assistant() {
  const [projectId, setProjectId] = useState("ai-ecommerce-123");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [deepMode, setDeepMode] = useState(false);

  const chatEndRef = useRef(null);
  const abortRef = useRef(null);
  const bufferRef = useRef("");
  const rafRef = useRef(0);

  // auto-scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // ---------------- Project summary load ----------------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setSummaryLoading(true);
        const { data } = await axios.get("/assistant/summary", { params: { projectId } });
        if (cancelled) return;
        if (data?.success && data?.summary) {
          setMessages([
            {
              role: "assistant",
              text:
                "📘 Project Summary:\n\n" +
                data.summary +
                "\n\n(Ask: “How to run this?” or “Explain index.js”.)",
              context: [],
            },
          ]);
        } else {
          setMessages([
            { role: "assistant", text: "⚠️ Couldn't auto-load summary. You can still chat freely." },
          ]);
        }
      } catch (err) {
        console.error("Summary error:", err);
        if (!cancelled) {
          setMessages([
            { role: "assistant", text: "⚠️ Failed to load summary. Check backend connection." },
          ]);
        }
      } finally {
        if (!cancelled) setSummaryLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // ---------------- Streaming (SSE) ----------------
  const startStream = async (question) => {
    try {
      abortRef.current?.abort(); // cancel existing
    } catch { }
    const controller = new AbortController();
    abortRef.current = controller;

    setMessages((prev) => [...prev, { role: "assistant", text: "" }]);
    bufferRef.current = "";

    const url = new URL(`${axios.defaults.baseURL}/assistant/stream`);
    url.searchParams.set("projectId", projectId);
    url.searchParams.set("q", question);
    url.searchParams.set("deep", String(deepMode));

    try {
      const res = await fetch(url.toString(), {
        method: "GET",
        signal: controller.signal,
        headers: {
          Accept: "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
      if (!res.ok || !res.body) throw new Error(`Stream HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      const processChunk = async () => {
        const { done, value } = await reader.read();
        if (done || controller.signal.aborted) {
          setLoading(false);
          return;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(6);

          // handle control JSON
          if (payload.startsWith("{")) {
            try {
              const obj = JSON.parse(payload);
              if (obj.done) {
                if (obj.context) {
                  setMessages((prev) => {
                    const arr = [...prev];
                    arr[arr.length - 1] = { ...arr[arr.length - 1], context: obj.context };
                    return arr;
                  });
                }
                controller.abort();
                setLoading(false);
                return;
              }
            } catch {
              // ignore
            }
          }

          // handle text tokens
          bufferRef.current += payload;
          if (!rafRef.current) {
            rafRef.current = requestAnimationFrame(() => {
              setMessages((prev) => {
                const arr = [...prev];
                arr[arr.length - 1] = { ...arr[arr.length - 1], text: bufferRef.current };
                return arr;
              });
              rafRef.current = 0;
            });
          }
        }

        if (!controller.signal.aborted) await processChunk();
      };

      await processChunk();
    } catch (err) {
      if (controller.signal.aborted) return;
      console.warn("Stream error:", err);
      setMessages((m) => [
        ...m,
        { role: "assistant", text: "⚠️ Stream connection lost. Try again.", context: [] },
      ]);
      setLoading(false);
    }
  };

  // ---------------- Send message ----------------
  const sendMessage = async () => {
    const q = input.trim();
    if (!q || loading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: q }]);
    setLoading(true);

    if (deepMode) {
      await startStream(q);
      return;
    }

    try {
      const { data } = await axios.post("/assistant/query", {
        projectId,
        question: q,
      });
      const answer = data?.answer || "No context found.";
      const context = Array.isArray(data?.context) ? data.context : [];
      setMessages((m) => [...m, { role: "assistant", text: answer, context }]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text: err?.response?.data?.error || "⚠️ Server error occurred.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // ---------------- Cleanup ----------------
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);
  useEffect(() => {
    abortRef.current?.abort();
  }, [deepMode]);

  // ---------------- Reload Summary ----------------
  const reloadSummary = async () => {
    setSummaryLoading(true);
    try {
      const { data } = await axios.get("/assistant/summary", { params: { projectId } });
      if (data?.success && data?.summary) {
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            text: "🔄 Project Overview (Updated):\n\n" + data.summary,
            context: [],
          },
        ]);
      }
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", text: "⚠️ Failed to reload summary." },
      ]);
    } finally {
      setSummaryLoading(false);
    }
  };

  // ---------------- UI ----------------
  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-sky-50 to-indigo-50 text-slate-900">
        <header className="sticky top-0 z-10 border-b bg-white/70 backdrop-blur shadow-sm">
          <div className="mx-auto max-w-5xl px-4 py-4 flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-xl md:text-2xl font-semibold flex items-center gap-2">
              🤖 SkillForge AI Assistant
            </h1>
            <div className="flex items-center gap-3">
              <label className="text-sm text-slate-600">Project ID:</label>
              <input
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="rounded-lg border px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-emerald-300"
              />
              <button
                onClick={reloadSummary}
                disabled={summaryLoading}
                className="ml-1 px-3 py-1.5 text-sm rounded-lg bg-gradient-to-r from-emerald-600 to-sky-600 text-white hover:opacity-90 transition disabled:opacity-40"
              >
                {summaryLoading ? "..." : "View Overview"}
              </button>
              <label className="flex items-center gap-2 text-sm text-slate-700 ml-2">
                <input
                  type="checkbox"
                  checked={deepMode}
                  onChange={(e) => setDeepMode(e.target.checked)}
                  className="h-4 w-4 accent-emerald-600"
                />
                <span>Explain Deeply (RAG+)</span>
              </label>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-4 py-6">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="h-[70vh] overflow-y-auto rounded-2xl border bg-white shadow-lg p-4"
          >
            {messages.length === 0 && !summaryLoading ? (
              <div className="h-full grid place-items-center text-center text-slate-500">
                <div>
                  <p className="text-lg font-medium">
                    Loading summary or start chatting 👇
                  </p>
                  <p className="text-sm mt-1">
                    Ask: “How to run this project?” or “Explain index.js”
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((m, idx) => (
                  <ChatMessage key={idx} role={m.role} text={m.text} context={m.context} />
                ))}
                {loading && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-start gap-3 max-w-[85%]"
                  >
                    <div className="shrink-0 w-8 h-8 rounded-full bg-emerald-100 grid place-items-center">
                      🤖
                    </div>
                    <div className="rounded-2xl px-4 py-2 bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200">
                      <span className="inline-flex items-center gap-1 animate-pulse">
                        <span>●</span><span>●</span><span>●</span>
                      </span>
                    </div>
                  </motion.div>
                )}
                <div ref={chatEndRef} />
              </div>
            )}
          </motion.div>

          {/* Input */}
          <div className="mt-4 flex items-center gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              rows={1}
              className="flex-1 rounded-2xl border px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-300 resize-none shadow-sm"
              placeholder="Type your question… (Press Enter)"
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="rounded-2xl px-5 py-3 bg-gradient-to-r from-emerald-600 to-sky-600 text-white font-medium shadow hover:shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "..." : "Send"}
            </button>
          </div>
        </main>
      </div>
    </ErrorBoundary>
  );
}




