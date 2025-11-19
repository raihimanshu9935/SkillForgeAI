import express from "express";
import Profile from "../models/Profile.js";
import Template from "../models/Template.js";
import { pipeline } from "@xenova/transformers";

const router = express.Router();

// 🧮 Cosine similarity
function cosineSim(a = [], b = []) {
  if (!a.length || !b.length || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// 🧠 Short reason helper
function shortReason(template, profile) {
  const skills = new Set((profile.skills || []).map(s => s.toLowerCase()));
  const tags = (template.tags || []).map(t => t.toLowerCase());
  const stack = (template.stack || []).map(t => t.toLowerCase());
  const overlaps = [...new Set([...tags, ...stack].filter(t => skills.has(t)))].slice(0, 3);
  return overlaps.length
    ? `Matches your skills: ${overlaps.join(", ")}`
    : `Relevant to your experience and projects.`;
}

router.get("/suggest", async (req, res) => {
  try {
    const { userId, limit } = req.query;
    const topN = Math.min(parseInt(limit || "3", 10) || 3, 10);

    if (!userId)
      return res.status(400).json({ error: "userId is required" });

    const profile = await Profile.findOne({ userId });
    if (!profile || !(profile.skills?.length || profile.githubRepos?.length)) {
      return res.status(400).json({
        error: "Profile not found or missing skills/repos. Import resume/GitHub first.",
      });
    }

    const templates = await Template.find({});
    const validTemplates = templates.filter(
      (t) => Array.isArray(t.embedding) && t.embedding.length
    );
    if (!validTemplates.length)
      return res.status(503).json({
        error: "No template embeddings found. Run embedTemplates.js first.",
      });

    // 🧠 LOCAL model (no OpenAI)
    console.log("⚙️ Generating local user embedding...");
    const embedder = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");

    const summary = `
      Skills: ${(profile.skills || []).join(", ")}
      GitHub: ${(profile.githubRepos || [])
        .map((r) => r.name + " " + r.description)
        .join(", ")}
      Summary: ${profile.summary || ""}
    `;

    const output = await embedder(summary, { pooling: "mean", normalize: true });
    const userVec = Array.from(output.data);

    const scored = validTemplates
      .map((t) => ({
        id: t.id,
        title: t.title,
        similarity: Number(cosineSim(userVec, t.embedding).toFixed(4)),
        tags: t.tags,
        stack: t.stack,
        shortReason: shortReason(t, profile),
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topN);

    return res.json(scored);
  } catch (err) {
    console.error("suggest error:", err);
    return res.status(500).json({ error: "Internal error while suggesting projects." });
  }
});

export default router;

