"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { WHATSAPP_LINK } from "@/lib/contact";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const WELCOME_MESSAGE: Message = {
  role: "assistant",
  content:
    "¡Hola! Soy el asistente de traduccionesjuradas.net. ¿En qué puedo ayudarte?\n\nPuedo orientarte sobre:\n• Precio de tu traducción jurada\n• Plazos de entrega\n• Documentos necesarios para tu trámite\n• Paquete teletrabajo Marruecos → España",
};

const QUICK_REPLIES = [
  { label: "Precio orientativo", emoji: "💰" },
  { label: "Documentos necesarios", emoji: "📋" },
  { label: "Teletrabajo Marruecos", emoji: "🇲🇦" },
  { label: "Hablar por WhatsApp", emoji: "📱", isWhatsApp: true },
];

const MAX_MESSAGES = 20;
const SESSION_KEY = "chatbot_session";
const MESSAGES_KEY = "chatbot_messages";

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [sessionId] = useState(() => {
    if (typeof window === "undefined") return crypto.randomUUID();
    return sessionStorage.getItem(SESSION_KEY) || crypto.randomUUID();
  });
  const [showQuickReplies, setShowQuickReplies] = useState(true);
  const [rateLimited, setRateLimited] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Persist sessionId
  useEffect(() => {
    sessionStorage.setItem(SESSION_KEY, sessionId);
  }, [sessionId]);

  // Restore messages from sessionStorage
  useEffect(() => {
    const saved = sessionStorage.getItem(MESSAGES_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Message[];
        if (parsed.length > 1) {
          setMessages(parsed);
          setShowQuickReplies(false);
        }
      } catch {
        // ignore
      }
    }
  }, []);

  // Save messages to sessionStorage
  useEffect(() => {
    if (messages.length > 1) {
      sessionStorage.setItem(MESSAGES_KEY, JSON.stringify(messages));
    }
  }, [messages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && !isClosing) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen, isClosing]);

  // ESC to close + focus trap
  useEffect(() => {
    if (!isOpen || isClosing) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        handleClose();
        return;
      }
      // Focus trap
      if (e.key === "Tab" && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isClosing]);

  // Toggle WhatsApp float visibility when chat is open
  useEffect(() => {
    document.body.dataset.chatOpen = isOpen && !isClosing ? "true" : "false";
    return () => {
      delete document.body.dataset.chatOpen;
    };
  }, [isOpen, isClosing]);

  const userMessageCount = messages.filter((m) => m.role === "user").length;

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setIsOpen(false);
      setIsClosing(false);
    }, 200);
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming) return;

      if (userMessageCount >= MAX_MESSAGES || rateLimited) {
        setRateLimited(true);
        return;
      }

      setShowQuickReplies(false);
      const userMsg: Message = { role: "user", content: text.trim() };
      const updatedMessages = [...messages, userMsg];
      setMessages(updatedMessages);
      setInput("");
      setIsStreaming(true);

      // Only send user/assistant messages (skip the welcome message for API)
      const apiMessages = updatedMessages
        .filter((_, i) => i > 0) // skip welcome
        .map((m) => ({ role: m.role, content: m.content }));

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: apiMessages, sessionId }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          if (res.status === 429) {
            setRateLimited(true);
          }
          const errorText =
            err.error || "Lo siento, ha ocurrido un error. Inténtalo de nuevo.";
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: errorText },
          ]);
          setIsStreaming(false);
          return;
        }

        // Read session ID from response
        const newSessionId = res.headers.get("X-Session-Id");
        if (newSessionId) {
          sessionStorage.setItem(SESSION_KEY, newSessionId);
        }

        // Stream response
        const reader = res.body?.getReader();
        if (!reader) throw new Error("No reader");

        const decoder = new TextDecoder();
        let assistantContent = "";

        // Add empty assistant message that we'll update
        setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6);
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);
              if (parsed.text) {
                assistantContent += parsed.text;
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    role: "assistant",
                    content: assistantContent,
                  };
                  return updated;
                });
              }
            } catch {
              // ignore malformed chunks
            }
          }
        }
      } catch (err) {
        console.error("[ChatWidget] Error:", err);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              "Lo siento, ha ocurrido un error de conexión. Inténtalo de nuevo o escríbenos por WhatsApp.",
          },
        ]);
      } finally {
        setIsStreaming(false);
      }
    },
    [messages, isStreaming, sessionId, userMessageCount, rateLimited]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleQuickReply = (reply: (typeof QUICK_REPLIES)[number]) => {
    if (reply.isWhatsApp) {
      window.open(WHATSAPP_LINK, "_blank", "noopener,noreferrer");
      return;
    }
    sendMessage(reply.label);
  };

  const clearConversation = () => {
    setMessages([WELCOME_MESSAGE]);
    setShowQuickReplies(true);
    setRateLimited(false);
    sessionStorage.removeItem(MESSAGES_KEY);
  };

  const panelVisible = isOpen || isClosing;

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => {
          if (isOpen) {
            handleClose();
          } else {
            setIsOpen(true);
          }
        }}
        aria-label={isOpen ? "Cerrar asistente" : "Abrir asistente virtual"}
        className={`fixed bottom-6 right-6 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-bleu text-parchment shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl ${
          isOpen ? "scale-0 opacity-0 pointer-events-none" : "scale-100 opacity-100"
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="h-7 w-7"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"
          />
        </svg>
      </button>

      {/* Chat panel */}
      {panelVisible && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Asistente virtual"
          aria-modal="true"
          className={`fixed z-[60] flex flex-col bg-parchment
            bottom-0 right-0 h-[100dvh] w-screen
            sm:bottom-6 sm:right-6 sm:h-[520px] sm:w-[380px] sm:rounded-2xl sm:border sm:border-cream/30
            shadow-[0_16px_48px_rgba(0,0,0,0.12)]
            transition-all duration-200
            ${isClosing
              ? "opacity-0 translate-y-4 sm:translate-y-2"
              : "opacity-100 translate-y-0 animate-chatSlideUp"
            }
          `}
        >
          {/* Header */}
          <div className="flex items-center justify-between rounded-t-none bg-bleu px-4 py-3 sm:rounded-t-2xl">
            <div className="flex items-center gap-3">
              {/* Mobile back arrow */}
              <button
                onClick={handleClose}
                aria-label="Cerrar asistente"
                className="flex h-8 w-8 items-center justify-center rounded-full text-parchment/80 transition-colors hover:bg-white/10 hover:text-parchment sm:hidden"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
              </button>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-parchment">
                  Asistente · traduccionesjuradas.net
                </span>
                <span className="flex items-center gap-1 text-xs text-parchment/70">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                  En línea
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={clearConversation}
                aria-label="Limpiar conversación"
                className="flex h-8 w-8 items-center justify-center rounded-full text-parchment/70 transition-colors hover:bg-white/10 hover:text-parchment"
                title="Limpiar conversación"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                </svg>
              </button>
              {/* Desktop X close */}
              <button
                onClick={handleClose}
                aria-label="Cerrar asistente"
                className="hidden sm:flex h-8 w-8 items-center justify-center rounded-full text-parchment/70 transition-colors hover:bg-white/10 hover:text-parchment"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex animate-chatMsgIn ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
                style={{ animationDelay: i === 0 ? "0ms" : "50ms" }}
              >
                <div
                  className={`max-w-[85%] whitespace-pre-wrap px-3 py-2 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "rounded-[12px_4px_12px_12px] bg-bleu text-white"
                      : "rounded-[4px_12px_12px_12px] border-l-[3px] border-or bg-cream text-sepia"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {isStreaming &&
              messages[messages.length - 1]?.role !== "assistant" && (
                <div className="flex justify-start animate-chatMsgIn">
                  <div className="rounded-[4px_12px_12px_12px] border-l-[3px] border-or bg-cream px-4 py-3">
                    <div className="flex gap-1">
                      <span className="h-2 w-2 rounded-full bg-graphite/40 animate-bounce [animation-delay:0ms]" />
                      <span className="h-2 w-2 rounded-full bg-graphite/40 animate-bounce [animation-delay:150ms]" />
                      <span className="h-2 w-2 rounded-full bg-graphite/40 animate-bounce [animation-delay:300ms]" />
                    </div>
                  </div>
                </div>
              )}

            {/* Quick replies */}
            {showQuickReplies && (
              <div className="flex flex-wrap gap-2 pt-1" role="group" aria-label="Respuestas rápidas">
                {QUICK_REPLIES.map((reply, i) => (
                  <button
                    key={reply.label}
                    onClick={() => handleQuickReply(reply)}
                    className="rounded-full border border-bleu/20 bg-card px-4 py-2.5 text-sm font-medium text-bleu transition-colors hover:bg-bleu hover:text-parchment animate-chatMsgIn"
                    style={{ animationDelay: `${150 + i * 75}ms` }}
                  >
                    {reply.emoji} {reply.label}
                  </button>
                ))}
              </div>
            )}

            {/* Rate limit message */}
            {rateLimited && (
              <div className="rounded-lg border border-or/30 bg-cream p-3 text-center text-sm text-sepia animate-chatMsgIn">
                <p className="mb-2">
                  Para continuar la conversación y enviar documentos, te
                  recomiendo escribirnos por WhatsApp:
                </p>
                <a
                  href={WHATSAPP_LINK}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-[#25D366] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#20bd5a]"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                  Continuar por WhatsApp
                </a>
              </div>
            )}

            {/* Scroll anchor + aria-live for screen readers */}
            <div ref={messagesEndRef} aria-live="polite" className="sr-only">
              {messages.length > 1 && messages[messages.length - 1].role === "assistant"
                ? messages[messages.length - 1].content
                : ""}
            </div>
          </div>

          {/* Input */}
          {!rateLimited && (
            <form
              onSubmit={handleSubmit}
              className="flex items-end gap-2 border-t border-cream bg-card px-3 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] sm:rounded-b-2xl sm:pb-2"
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  // Auto-grow
                  e.target.style.height = "auto";
                  e.target.style.height = Math.min(e.target.scrollHeight, 96) + "px";
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage(input);
                    // Reset height
                    if (inputRef.current) inputRef.current.style.height = "auto";
                  }
                }}
                placeholder="Escribe tu consulta..."
                rows={1}
                disabled={isStreaming}
                aria-label="Mensaje"
                className="flex-1 resize-none rounded-lg border border-cream/50 bg-parchment px-3 py-2 text-sm text-sepia placeholder:text-graphite/50 focus:border-bleu/30 focus:outline-none disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={isStreaming || !input.trim()}
                aria-label="Enviar mensaje"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-bleu text-parchment transition-colors hover:bg-bleu-dark disabled:opacity-40"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              </button>
            </form>
          )}
        </div>
      )}
    </>
  );
}
