// SkillForge AI — Frontend SSE Streaming Hook (for RAG+ mode)
export function startStream({ projectId, prompt, params = {}, onChunk, onDone, onError }) {
  const q = new URLSearchParams({
    projectId,
    q: prompt,
    deep: String(!!params.deep),
  });

  const url = `http://localhost:4000/assistant/stream?${q.toString()}`;
  const eventSource = new EventSource(url);

  eventSource.onmessage = (event) => {
    try {
      if (event.data.startsWith("{") && event.data.includes("done")) {
        const parsed = JSON.parse(event.data);
        if (parsed.done) {
          eventSource.close();
          onDone?.(parsed.context || []);
          return;
        }
      } else {
        onChunk?.(event.data);
      }
    } catch (err) {
      console.error("SSE parse error:", err);
    }
  };

  eventSource.onerror = (err) => {
    console.error("SSE connection error:", err);
    eventSource.close();
    onError?.(err);
  };

  return eventSource;
}
