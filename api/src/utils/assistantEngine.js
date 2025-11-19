// SkillForge AI — Phase 7: Assistant Engine (Auto Summary + Smarter Context)
import fs from "fs-extra";
import path from "path";
import { pipeline } from "@xenova/transformers";

// ----------------------------- Config -----------------------------
const PROJECTS_BASE = path.join(process.cwd(), "generated_projects");
const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 80;
const TOP_K = 3;

// ---------------------- Cache & Embedder --------------------------
let _embedderPromise = null;
const memoryIndex = new Map();

async function getEmbedder() {
  if (!_embedderPromise) {
    _embedderPromise = pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  }
  return _embedderPromise;
}

// --------------------------- File Loader --------------------------
export async function loadProjectDocs(projectId) {
  const dir = path.join(PROJECTS_BASE, projectId);
  const exts = new Set([".md", ".js", ".json"]);
  const found = [];

  async function walk(cur) {
    const entries = await fs.readdir(cur, { withFileTypes: true });
    for (const ent of entries) {
      const full = path.join(cur, ent.name);
      if (ent.isDirectory()) await walk(full);
      else if (exts.has(path.extname(ent.name).toLowerCase())) {
        try {
          const text = await fs.readFile(full, "utf8");
          found.push({
            source: path.relative(dir, full),
            text: text.length > 200_000 ? text.slice(0, 200_000) : text,
          });
        } catch {}
      }
    }
  }

  if (!(await fs.pathExists(dir))) throw new Error(`Project not found: ${projectId}`);
  await walk(dir);
  if (found.length === 0) throw new Error(`No readable docs in ${projectId}`);
  return found;
}

// --------------------------- Chunking -----------------------------
export function chunkText(text, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    const end = Math.min(i + size, text.length);
    chunks.push(text.slice(i, end));
    if (end === text.length) break;
    i = end - overlap;
  }
  return chunks;
}

function chunkDocuments(docs) {
  const out = [];
  for (const d of docs) {
    const parts = chunkText(d.text);
    parts.forEach((c, idx) => out.push({ text: c, source: `${d.source}#${idx}` }));
  }
  return out;
}

// -------------------------- Embeddings ----------------------------
export async function embedChunks(chunks) {
  const embedder = await getEmbedder();
  const BATCH = 8;
  const vectors = [];

  for (let i = 0; i < chunks.length; i += BATCH) {
    const batch = chunks.slice(i, i + BATCH).map((c) => c.text);
    const output = await embedder(batch, { pooling: "mean", normalize: true });
    const dim = Math.floor(output.data.length / batch.length) || 384;
    for (let j = 0; j < batch.length; j++) {
      const start = j * dim;
      vectors.push(Array.from(output.data.slice(start, start + dim)));
    }
  }
  return vectors;
}

// ---------------------- Index & Similarity ------------------------
function cosineSim(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i],
      y = b[i];
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom ? dot / denom : 0;
}

async function ensureProjectIndexed(projectId) {
  if (memoryIndex.has(projectId)) return memoryIndex.get(projectId);
  const docs = await loadProjectDocs(projectId);
  const chunks = chunkDocuments(docs);
  const vectors = await embedChunks(chunks);
  const indexed = chunks.map((c, i) => ({ ...c, vector: vectors[i] }));
  memoryIndex.set(projectId, { chunks: indexed, dim: vectors[0]?.length || 384 });
  return memoryIndex.get(projectId);
}

// -------------------------- Utils --------------------------------
function isGreeting(q = "") {
  const s = q.trim().toLowerCase();
  return (
    ["hi", "hii", "hiii", "hello", "hey", "yo"].includes(s) ||
    /^h+i+$/.test(s) ||
    /^he+y$/.test(s)
  );
}

function looksGeneric(q = "") {
  const s = q.toLowerCase();
  return s.length < 5 || /(ok|nice|good|thanks|cool|haan|hmm|great)/.test(s);
}

function dedupeByFile(chunks) {
  const seen = new Set();
  return chunks.filter((c) => {
    const file = (c.source || "").split("#")[0];
    if (seen.has(file)) return false;
    seen.add(file);
    return true;
  });
}

// ----------------------- Auto Summary -----------------------------
export async function buildProjectSummary(projectId) {
  const base = path.join(PROJECTS_BASE, projectId);
  const sources = [];

  const read = async (rel) => {
    const p = path.join(base, rel);
    if (await fs.pathExists(p)) {
      const t = await fs.readFile(p, "utf8");
      sources.push(rel);
      return t;
    }
    return null;
  };

  const readme = await read("README.md");
  const pkgRaw = await read("package.json");
  const idx =
    (await read("index.js")) || (await read("server.js")) || (await read("src/index.js"));

  let title = projectId;
  let what = "";
  let run = "";
  let stack = [];

  if (readme) {
    const firstLine = readme.split("\n").find((l) => l.trim()) || "";
    title = firstLine.replace(/^#\s*/, "").trim() || title;
    const desc = readme
      .replace(/\r/g, "")
      .split("\n\n")
      .map((b) => b.trim())
      .filter(Boolean)
      .find((b) => !b.startsWith("#"));
    what = desc?.slice(0, 400) || "";
  }

  if (pkgRaw) {
    try {
      const pkg = JSON.parse(pkgRaw);
      if (pkg.name) title = title === projectId ? pkg.name : title;
      const scripts = pkg.scripts || {};
      if (scripts.start) run = `npm install && npm start (start → ${scripts.start})`;
      else if (scripts.dev) run = `npm install && npm run dev (dev → ${scripts.dev})`;
      const deps = Object.keys(pkg.dependencies || {});
      const devDeps = Object.keys(pkg.devDependencies || {});
      stack = [...new Set([...deps, ...devDeps])].slice(0, 8);
    } catch {}
  }

  if (!what && idx) {
    const lines = idx.split("\n").slice(0, 15).join(" ");
    what =
      (lines.match(/["'`](.+?)["'`]/)?.[1] || "").slice(0, 200) ||
      "Minimal runnable scaffold entrypoint.";
  }

  const stackLine =
    stack.length > 0
      ? `**Stack:** ${stack.join(", ")}`
      : "**Stack:** React, Node, Express, MongoDB (default)";
  const runLine = run ? `**How to run:** ${run}` : "**How to run:** npm install && npm start";
  const summary =
    `**${title}** — ${what}\n\n${stackLine}\n${runLine}\n**Key files:** ${sources.join(", ")}`;

  return { summary, sources };
}

// ----------------------- Answer Synthesizer -----------------------
function synthesizeAnswer(question, topChunks, projectId) {
  const q = (question || "").toLowerCase();
  const chunks = dedupeByFile(topChunks);
  const ctx = chunks.map((c) =>
    c.text.length > 400 ? c.text.slice(0, 400) + "..." : c.text
  );

  // Greetings / generic
  if (isGreeting(q) || looksGeneric(q)) {
    return {
      answer:
        "👋 Hi! Main tumhare project ke code aur docs padh kar helpful jawaab deta hoon.\nTry: “How to run?”, “Explain project”, “Add Express route example?”.",
      context: [],
    };
  }

  // Summarize / explain
  if (q.includes("explain project") || q.includes("summarize") || q.includes("overview")) {
    return {
      answer:
        `📘 Here's a quick summary of your project:\n\n(Use /assistant/summary endpoint for full details)\n\n` +
        `The project likely contains code, configs, and scripts for an AI-powered web app.\nCheck package.json for scripts and stack details.`,
      context: ctx,
    };
  }

  // Command intents
  let runCmd = null;
  for (const ch of chunks) {
    if (ch.source.toLowerCase().includes("package.json")) {
      try {
        const pkg = JSON.parse(ch.text);
        if (pkg?.scripts?.start)
          runCmd = `npm install && npm start  # start -> ${pkg.scripts.start}`;
        else if (pkg?.scripts?.dev)
          runCmd = `npm install && npm run dev  # dev -> ${pkg.scripts.dev}`;
      } catch {}
    }
  }

  const wantsRun = q.includes("run") || q.includes("start") || q.includes("install");
  const wantsDeploy = q.includes("deploy") || q.includes("vercel") || q.includes("render");
  const wantsApi = q.includes("api") || q.includes("route") || q.includes("endpoint");

  if (wantsRun && runCmd) {
    return {
      answer:
        `Is project ko chalane ke liye:\n1️⃣ ${runCmd}\n2️⃣ Console me “🚀” log aayega → app run ho gaya.`,
      context: ctx,
    };
  } else if (wantsRun) {
    return {
      answer:
        "Project chalane ke liye:\n1️⃣ npm install\n2️⃣ npm start (ya npm run dev)\nCustom scripts package.json me dekho.",
      context: ctx,
    };
  } else if (wantsDeploy) {
    return {
      answer:
        "⚡ Deploy guide:\n- Frontend → Vercel/Netlify\n- Backend → Render/Fly.io\n- ENV vars set karo, build commands README me check karo.",
      context: ctx,
    };
  } else if (wantsApi) {
    return {
      answer:
        "🔧 API add karne ke liye:\n1️⃣ routes/ me new file banao\n2️⃣ app.use('/api', router) karo\nExample context me mil jayega.",
      context: ctx,
    };
  }

  // Default
  return {
    answer:
      "Short answer (Hinglish): Neeche context dekhkar concise jawaab diya gaya hai.\nSpecific file/function ka naam doge to exact reference mil jayega.",
    context: ctx,
  };
}

// --------------------------- Orchestrator -------------------------
export async function answerQuestion(projectId, question) {
  if (!projectId) throw new Error("projectId is required");
  if (!question?.trim()) throw new Error("question is required");

  const { chunks } = await ensureProjectIndexed(projectId);
  const embedder = await getEmbedder();
  const out = await embedder(question, { pooling: "mean", normalize: true });
  const qVec = Array.from(out.data);

  const scoredAll = chunks
    .map((c) => ({ ...c, score: cosineSim(c.vector, qVec) }))
    .sort((a, b) => b.score - a.score);

  const best = scoredAll[0]?.score || 0;
  const top = scoredAll.slice(0, TOP_K);

  // Guardrail
  const SIM_THRESHOLD = 0.25;
  if (best < SIM_THRESHOLD && !isGreeting(question)) {
    return {
      answer:
        "🤖 Yeh sawaal project context se match nahi ho raha. Kripya project-related puchho — jaise:\n" +
        "• “How to run this project?”\n• “Explain project overview”\n• “Add Express route example?”",
      context: [],
    };
  }

  // Expand package.json if present
  for (let i = 0; i < top.length; i++) {
    const s = top[i];
    if (s.source.toLowerCase().includes("package.json")) {
      try {
        const [fileOnly] = s.source.split("#");
        const fullPath = path.join(PROJECTS_BASE, projectId, fileOnly);
        if (await fs.pathExists(fullPath)) {
          const txt = await fs.readFile(fullPath, "utf8");
          top[i] = { ...s, text: txt };
        }
      } catch {}
    }
  }

  return synthesizeAnswer(question, top, projectId);
}


