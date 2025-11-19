import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function ChatMessage({ role, text, context = [] }) {
  const isUser = role === "user";

  return (
    <div
      className={`flex ${isUser ? "justify-end" : "justify-start"} items-start gap-3`}
    >
      {!isUser && (
        <div className="shrink-0 w-8 h-8 rounded-full bg-emerald-100 grid place-items-center">
          🤖
        </div>
      )}

      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ${
          isUser
            ? "bg-gradient-to-r from-sky-600 to-emerald-600 text-white"
            : "bg-white border border-slate-200"
        }`}
      >
        {/* ✅ Markdown Rendered Text */}
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            code: ({ node, inline, className, children, ...props }) => (
              <pre className="bg-slate-100 rounded p-2 text-[13px] whitespace-pre-wrap">
                {children}
              </pre>
            ),
            p: ({ children }) => <p className="mb-2">{children}</p>,
            h1: ({ children }) => <h1 className="text-xl font-bold mb-2">{children}</h1>,
            h2: ({ children }) => <h2 className="text-lg font-semibold mb-1">{children}</h2>,
            h3: ({ children }) => <h3 className="text-base font-semibold mb-1">{children}</h3>,
          }}
        >
          {text || ""}
        </ReactMarkdown>

        {/* ✅ Context Display */}
        {context.length > 0 && (
          <details className="mt-3 bg-slate-50 rounded-lg p-3 border border-slate-200">
            <summary className="cursor-pointer font-medium text-emerald-700">
              Referenced Context ({context.length})
            </summary>
            <div className="mt-2 space-y-2">
              {context.map((c, idx) => (
                <div key={idx} className="text-sm">
                  <div className="font-semibold">{c.file}</div>
                  <pre className="text-[13px] bg-white border border-slate-200 rounded p-2 whitespace-pre-wrap overflow-x-auto">
                    {c.text}
                  </pre>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>

      {isUser && (
        <div className="shrink-0 w-8 h-8 rounded-full bg-sky-100 grid place-items-center">
          🧑‍💻
        </div>
      )}
    </div>
  );
}

