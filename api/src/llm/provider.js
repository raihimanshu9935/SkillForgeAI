// SkillForge AI — LLM Provider Abstraction (Stable Final Version)
// Supports Ollama (local) + OpenAI (cloud) with fallback and proper streaming

import fetch from "node-fetch";

// Select priority providers (ollama → openai)
function selectProvider() {
  const order = (process.env.LLM_PROVIDER_PRIORITY || "ollama,openai")
    .split(",")
    .map((s) => s.trim());
  return order;
}

// ------------------- OpenAI Stream -------------------
async function* streamFromOpenAI({ messages, model, temperature, max_tokens }) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY missing");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: model || process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: temperature ?? Number(process.env.RAG_TEMPERATURE || 0.2),
      max_tokens: Number(process.env.OPENAI_MAX_TOKENS || 600),
      stream: true,
      messages,
    }),
  });

  if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}`);

  const decoder = new TextDecoder("utf8");
  const reader = res.body.getReader();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split("\n");

    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const data = line.replace("data:", "").trim();
      if (data === "[DONE]") return;
      try {
        const json = JSON.parse(data);
        const delta = json.choices?.[0]?.delta?.content || "";
        if (delta) yield delta;
      } catch {}
    }
  }
}

// ------------------- Ollama Stream (Universal Fix) -------------------
async function* streamFromOllama({ messages, model, temperature, num_predict }) {
  const host = process.env.OLLAMA_HOST || "http://127.0.0.1:11434";
  const res = await fetch(`${host}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: model || process.env.OLLAMA_MODEL || "llama3.1:8b",
      messages,
      options: {
        temperature: temperature ?? Number(process.env.RAG_TEMPERATURE || 0.2),
        num_predict: Number(process.env.OLLAMA_NUM_PREDICT || 512),
      },
      stream: true,
    }),
  });

  if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);

  // ✅ Works both in Node 18+ and Node 22+ (no .getReader() errors)
  const decoder = new TextDecoder("utf-8");

  if (res.body.getReader) {
    // Modern stream (ReadableStream)
    const reader = res.body.getReader();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const json = JSON.parse(line);
          const delta = json.message?.content || "";
          if (delta) yield delta;
        } catch {}
      }
    }
  } else {
    // Fallback (Node legacy mode)
    for await (const chunk of res.body) {
      const text = chunk.toString("utf8");
      const lines = text.split("\n");
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const json = JSON.parse(line);
          const delta = json.message?.content || "";
          if (delta) yield delta;
        } catch {}
      }
    }
  }
}

// ------------------- Main Generator -------------------
export async function* generateStream(messages) {
  const providers = selectProvider();
  let lastError;

  for (const provider of providers) {
    try {
      if (provider === "ollama") return yield* streamFromOllama({ messages });
      if (provider === "openai") return yield* streamFromOpenAI({ messages });
    } catch (err) {
      console.error(`❌ ${provider} provider failed:`, err.message);
      lastError = err;
    }
  }

  throw lastError || new Error("No LLM provider available");
}


