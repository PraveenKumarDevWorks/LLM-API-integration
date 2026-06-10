"use client";

import { useState, useRef, useEffect } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

// Quick-start prompts shown on the empty state screen.
// Clicking one immediately sends it as a message without typing.
const SUGGESTED_PROMPTS = [
  "Explain quantum computing in simple terms",
  "Write a Python function to sort a list",
  "What are best practices for React?",
  "Help me debug a JavaScript error",
];

/**
 * ChatPage — root page component.
 *
 * Renders a full-screen chat UI that:
 *  1. Holds the entire conversation in local state
 *  2. Sends messages to POST /api/chat and reads the streaming response
 *  3. Appends each decoded chunk to the last assistant message as it arrives,
 *     producing a typewriter effect without any third-party streaming library
 */
export default function ChatPage() {
  // Full conversation history. Each entry is { role, content }.
  // Both the user turn and the in-progress assistant turn live here.
  const [messages, setMessages] = useState<Message[]>([]);

  // Current value of the textarea.
  const [input, setInput] = useState("");

  // True while a streaming request is in flight. Disables the input and send button.
  const [loading, setLoading] = useState(false);

  // Index of the message whose "Copy" button was recently clicked,
  // used to show a temporary "Copied" confirmation label.
  const [copied, setCopied] = useState<number | null>(null);

  // Ref attached to an invisible div at the bottom of the message list.
  // Scrolling it into view keeps the latest message visible automatically.
  const bottomRef = useRef<HTMLDivElement>(null);

  // Ref to the textarea so we can read its scrollHeight and resize it to fit content.
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /**
   * Auto-scroll effect.
   * Runs every time `messages` changes — keeps the bottom of the conversation
   * in view as new messages or new chunks are appended.
   */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /**
   * Auto-resize effect.
   * Runs every time `input` changes. Resets the textarea height to "auto" first
   * so shrinkage works, then sets it to the natural scroll height capped at 160px.
   * This gives a single-line feel that expands up to ~6 lines before scrolling.
   */
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
  }, [input]);

  /**
   * sendMessage — core chat function.
   *
   * @param text  The message to send. Defaults to the current textarea value.
   *              Suggested-prompt buttons pass their string directly so they
   *              can fire without touching the textarea state.
   *
   * Flow:
   *  1. Appends a user message to state and clears the input.
   *  2. Immediately appends an empty assistant message (shows the typing indicator).
   *  3. POSTs the full message history to /api/chat.
   *  4. Reads response.body as a ReadableStream, decoding each Uint8Array chunk
   *     to a string and appending it to the last message in state.
   *  5. Sets loading=false once the stream closes.
   */
  async function sendMessage(text = input) {
    if (!text.trim() || loading) return;

    const userMessage: Message = { role: "user", content: text };
    const updatedMessages = [...messages, userMessage];

    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    // Placeholder assistant message — renders the bouncing-dot typing indicator
    // until the first chunk arrives, then fills in with streamed text.
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Send the full history (not just the latest message) so the LLM has context.
      body: JSON.stringify({ messages: updatedMessages }),
    });

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();

    // Read chunks until the stream signals done.
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // Decode the raw bytes to a UTF-8 string. `stream: true` tells the decoder
      // not to flush its internal buffer between chunks (handles multi-byte chars).
      const chunk = decoder.decode(value, { stream: true });

      // Append the chunk to the last message (the in-progress assistant turn).
      // Uses the functional form of setMessages to avoid stale-closure issues
      // when multiple chunks arrive in quick succession.
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: updated[updated.length - 1].content + chunk,
        };
        return updated;
      });
    }

    setLoading(false);
  }

  /**
   * copyText — copies an assistant message to the clipboard.
   *
   * @param text   The full text of the message to copy.
   * @param index  The index of the message in the `messages` array, used to
   *               identify which button should show the "Copied" confirmation.
   *
   * Sets `copied` to the message index for 2 seconds, then resets to null,
   * reverting the button label back to "Copy".
   */
  async function copyText(text: string, index: number) {
    await navigator.clipboard.writeText(text);
    setCopied(index);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 bg-slate-900/80 backdrop-blur border-b border-slate-700/50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
            </svg>
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white">AI Assistant</h1>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <p className="text-xs text-slate-400">GPT-4o mini · Online</p>
            </div>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={() => { setMessages([]); setInput(""); }}
            className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-700/50 transition-all"
          >
            Clear chat
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-8 pb-20">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center mx-auto shadow-2xl mb-4">
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-white">How can I help you?</h2>
              <p className="text-slate-400 text-sm mt-1">Ask me anything — I&apos;m here to assist.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 w-full max-w-lg">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  className="text-left p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/50 text-slate-300 text-xs hover:bg-slate-700/60 hover:border-slate-600 hover:text-white transition-all leading-relaxed"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-md">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                  </svg>
                </div>
              )}

              <div className="group relative max-w-[75%]">
                <div
                  className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-gradient-to-br from-violet-600 to-indigo-600 text-white rounded-tr-sm shadow-lg"
                      : "bg-slate-800/80 border border-slate-700/50 text-slate-100 rounded-tl-sm"
                  }`}
                >
                  {msg.content === "" && loading && i === messages.length - 1 ? (
                    <span className="flex gap-1 items-center h-4">
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0ms]" />
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:150ms]" />
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:300ms]" />
                    </span>
                  ) : (
                    <>
                      {msg.content}
                      {msg.role === "assistant" && loading && i === messages.length - 1 && (
                        <span className="inline-block w-0.5 h-3.5 bg-slate-400 ml-0.5 animate-pulse" />
                      )}
                    </>
                  )}
                </div>

                {msg.role === "assistant" && msg.content && (
                  <button
                    onClick={() => copyText(msg.content, i)}
                    className="absolute -bottom-6 left-0 opacity-0 group-hover:opacity-100 transition-opacity text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1"
                  >
                    {copied === i ? (
                      <>
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Copied
                      </>
                    ) : (
                      <>
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Copy
                      </>
                    )}
                  </button>
                )}
              </div>

              {msg.role === "user" && (
                <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold text-slate-300">
                  U
                </div>
              )}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 pb-5 pt-3">
        <div className="flex items-end gap-3 bg-slate-800/80 border border-slate-700/50 rounded-2xl px-4 py-3 focus-within:border-violet-500/50 transition-all shadow-xl">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              // Enter alone = send. Shift+Enter = newline (default textarea behavior).
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Message AI Assistant..."
            rows={1}
            className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-500 outline-none resize-none leading-relaxed"
            disabled={loading}
          />
          <button
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            className="flex-shrink-0 w-9 h-9 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-xl flex items-center justify-center disabled:opacity-30 hover:from-violet-500 hover:to-indigo-500 transition-all shadow-md disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4 text-white translate-x-px" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.269 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        </div>
        <p className="text-center text-xs text-slate-600 mt-2">Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  );
}
