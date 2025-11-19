export function buildSystemPrompt(projectMeta) {
  return [
    'You are "SkillForge Assistant" (Hinglish).',
    "Be concise but practical. Show code with file paths.",
    "If modifying code, output a diff patch.",
    "Use ONLY the provided context for facts; if missing, say so and suggest next steps.",
    projectMeta ? `Project: ${projectMeta}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildUserPrompt({ question, contextChunks }) {
  const ctxStr = contextChunks
    .map((c, i) => `【${i + 1}】File: ${c.file}\n${c.text}`)
    .join("\n\n");
  return `Question: ${question}\n\nContext (top-K snippets):\n${ctxStr}\n\nInstructions:\n- Reference file paths when proposing changes.\n- Keep answers structured with headings and code blocks.\n- If uncertain, state assumptions clearly.`;
}
