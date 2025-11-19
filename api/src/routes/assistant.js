// SkillForge AI — Assistant Routes (Phase 8: RAG+ Hybrid Mode + Streaming)

import express from "express";
import rateLimit from "../middleware/rateLimit.js";
import { answerQuestion, buildProjectSummary, loadProjectDocs } from "../utils/assistantEngine.js";
import { ragAnswerStream } from "../rag/orchestrate.js";

const router = express.Router();

// 🔒 Apply rate limiter (protects from spam or abuse)
router.use(rateLimit);

// ------------------------ Helper ------------------------
function limitContext(ctx) {
  const max = Number(process.env.RAG_MAX_CHUNKS || 6);
  const maxChars = Number(process.env.RAG_CHARS_PER_CHUNK || 1200);
  return (ctx || []).slice(0, max).map((s) => ({
    file: s.file || s.source || "unknown",
    score: s.score || 0,
    text: (s.text || "").slice(0, maxChars),
  }));
}

// =========================================================
// 🔹 POST /assistant/query
// Supports deep (RAG+) and normal MiniLM mode
// =========================================================
router.post("/query", async (req, res) => {
  try {
    const { projectId, question, deep } = req.body || {};

    if (!projectId || !question) {
      return res.status(400).json({
        success: false,
        error: "projectId and question are required",
      });
    }

    console.log(`🤖 Assistant Query [${projectId}] → "${question}" (deep=${!!deep})`);

    // Get minimal docs context for RAG
    const docs = await loadProjectDocs(projectId);
    const context = limitContext(docs.slice(0, 5));

    // --- Deep RAG+ Mode ---
    if (deep && process.env.RAG_ENABLED === "true") {
      let answer = "";
      for await (const chunk of ragAnswerStream({ projectId, question, context })) {
        answer += chunk;
      }
      return res.json({ success: true, answer, context });
    }

    // --- Default: MiniLM engine ---
    const result = await answerQuestion(projectId, question);
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error("❌ /assistant/query error:", err);
    return res.status(500).json({
      success: false,
      error: "Assistant failed to process your question.",
    });
  }
});

// =========================================================
// 🔹 GET /assistant/stream
// Streams deep RAG+ or MiniLM answer via SSE
// =========================================================
router.get("/stream", async (req, res) => {
  try {
    const { projectId, q, deep } = req.query || {};
    if (!projectId || !q) return res.status(400).end();

    console.log(`📡 Stream request: [${projectId}] q="${q}" deep=${deep}`);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const docs = await loadProjectDocs(projectId);
    const context = limitContext(docs.slice(0, 5));

    // --- Deep streaming via RAG+ ---
    if (deep === "true" && process.env.RAG_ENABLED === "true") {
      let full = "";
      for await (const tok of ragAnswerStream({ projectId, question: q, context })) {
        full += tok;
        res.write(`data: ${tok}\n\n`);
      }
      res.write(`data: ${JSON.stringify({ done: true, context })}\n\n`);
      res.end();
      return;
    }

    // --- Fallback: MiniLM synthesis (split into sentences) ---
    const result = await answerQuestion(projectId, q);
    const lines = result.answer.split(/(?<=[.!?])\s+/);
    for (const l of lines) res.write(`data: ${l}\n\n`);
    res.write(`data: ${JSON.stringify({ done: true, context: result.context })}\n\n`);
    res.end();
  } catch (err) {
    console.error("❌ /assistant/stream error:", err);
    try {
      res.end();
    } catch {}
  }
});

// =========================================================
// 🔹 GET /assistant/summary
// Auto builds quick project overview
// =========================================================
router.get("/summary", async (req, res) => {
  try {
    const { projectId } = req.query || {};
    if (!projectId) {
      return res.status(400).json({ success: false, error: "projectId is required" });
    }

    console.log(`📘 Building project summary for: ${projectId}`);
    const data = await buildProjectSummary(String(projectId));

    return res.json({
      success: true,
      summary: data.summary,
      sources: data.sources,
    });
  } catch (err) {
    console.error("❌ /assistant/summary error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to build project summary. Check console logs.",
    });
  }
});

// =========================================================
// 🔹 Health check endpoint
// =========================================================
router.get("/ping", (req, res) => {
  return res.json({
    success: true,
    message: "SkillForge AI Assistant (RAG+ Ready) ✅",
    time: new Date().toISOString(),
  });
});

export default router;

