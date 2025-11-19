// SkillForge AI — RAG Orchestrator (ESM Version)

import { buildSystemPrompt, buildUserPrompt } from "./prompt.js";
import { generateStream } from "../llm/provider.js";
import { keyFor, get, set } from "./cache.js";

/**
 * Streams RAG answer token-by-token.
 * @param {object} opts
 * @param {string} opts.projectId
 * @param {string} opts.question
 * @param {Array}  opts.context
 * @param {string} [opts.projectMeta]
 */
export async function* ragAnswerStream({ projectId, question, context, projectMeta }) {
  const cacheKey = keyFor({ projectId, question, ctx: context });
  const cached = get(cacheKey);
  if (cached) {
    yield cached;
    return;
  }

  const sys = buildSystemPrompt(projectMeta);
  const usr = buildUserPrompt({ question, contextChunks: context });
  const messages = [
    { role: "system", content: sys },
    { role: "user", content: usr },
  ];

  let full = "";
  try {
    for await (const token of generateStream(messages)) {
      full += token;
      yield token;
    }
  } finally {
    if (full.trim())
      set(cacheKey, full, Number(process.env.RAG_CACHE_TTL_SEC || 3600));
  }
}

