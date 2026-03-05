"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, UIMessage, TextUIPart } from "ai";
import { useRef, useEffect, useState, FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning!";
  if (hour < 17) return "Good afternoon!";
  return "Good evening!";
}

function getMessageText(message: UIMessage): string {
  return message.parts
    .filter((part): part is TextUIPart => part.type === "text")
    .map((part) => part.text)
    .join("");
}

/** Lightweight markdown: bold, italic, inline code, line breaks */
function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split("\n");
  return lines.map((line, i) => {
    const parts = line.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
    const rendered = parts.map((part, j) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={j}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith("*") && part.endsWith("*")) {
        return <em key={j}>{part.slice(1, -1)}</em>;
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return (
          <code key={j} className="bg-secondary rounded px-1 py-0.5 text-[0.9em] font-mono">
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
    return (
      <span key={i}>
        {rendered}
        {i < lines.length - 1 && line !== "" && <br />}
      </span>
    );
  });
}

const SUGGESTION_CHIPS = [
  { label: "Start a conversation", message: "Hello! I'd like to practice." },
  { label: "Ask for corrections", message: "Please correct my mistakes as we talk." },
  { label: "Try a scenario", message: "Let's roleplay ordering food at a restaurant." },
];

export function Chat() {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
    }),
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isLoading = status === "submitted" || status === "streaming";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const resizeTextarea = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const maxHeight = 4 * 24 + 16;
    el.style.height = Math.min(el.scrollHeight, maxHeight) + "px";
  };

  useEffect(() => {
    resizeTextarea();
  }, [input]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage({ text: input.trim() });
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!input.trim() || isLoading) return;
      sendMessage({ text: input.trim() });
      setInput("");
    }
  };

  const handleChipSelect = (message: string) => {
    sendMessage({ text: message });
  };

  const hasInput = input.trim().length > 0;

  return (
    <div className="flex flex-col h-dvh">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-6 pb-4">
            <div className="text-center">
              <p className="text-xl font-semibold text-foreground mb-1">{getGreeting()}</p>
              <p className="text-sm text-muted-foreground">Start chatting to practice your language skills</p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              {SUGGESTION_CHIPS.map((chip) => (
                <button
                  key={chip.label}
                  onClick={() => handleChipSelect(chip.message)}
                  className="px-4 py-2 rounded-full text-sm bg-muted text-foreground hover:bg-accent transition-colors"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message: UIMessage) => {
          const content = getMessageText(message);
          const isUser = message.role === "user";
          return (
            <div
              key={message.id}
              className={cn("flex msg-in", isUser ? "justify-end" : "justify-start")}
            >
              <div
                className="text-[15px] leading-relaxed"
                style={{
                  maxWidth: "82%",
                  padding: "10px 14px",
                  borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                  background: isUser ? "var(--brand)" : "var(--muted)",
                  color: isUser ? "#fff" : "var(--foreground)",
                  wordBreak: "break-word",
                }}
              >
                {isUser ? content : renderMarkdown(content)}
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex justify-start msg-in">
            <div
              className="flex gap-[5px] items-center"
              style={{
                padding: "12px 16px",
                borderRadius: "18px 18px 18px 4px",
                background: "var(--muted)",
              }}
            >
              <span className="typing-dot w-1.5 h-1.5 rounded-full bg-muted-foreground inline-block" />
              <span className="typing-dot w-1.5 h-1.5 rounded-full bg-muted-foreground inline-block" />
              <span className="typing-dot w-1.5 h-1.5 rounded-full bg-muted-foreground inline-block" />
            </div>
          </div>
        )}

        {error && (
          <div className="text-center py-2">
            <p className="text-[13px] text-destructive">Something went wrong. Please try again.</p>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-border bg-card">
        <form onSubmit={handleSubmit} className="flex items-end gap-2 px-3 py-3">
          {/* Textarea */}
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message"
            disabled={isLoading}
            rows={1}
            className="flex-1 resize-none min-h-[44px] max-h-[112px] overflow-y-auto rounded-2xl text-base leading-6 border-border bg-muted focus-visible:ring-1 focus-visible:ring-primary px-4 py-2.5"
          />

          {/* Send button */}
          {hasInput && (
            <Button
              type="submit"
              size="icon"
              disabled={isLoading}
              className="w-11 h-11 rounded-full bg-primary text-primary-foreground shrink-0 disabled:opacity-50"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </Button>
          )}
        </form>
      </div>
    </div>
  );
}
