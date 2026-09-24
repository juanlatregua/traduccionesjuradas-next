"use client";

// components/chat/useChat.ts — TODA la lógica del asistente en un solo sitio:
// sesión, restauración, puerta (email + consentimiento, exigidos también por
// /api/chat), streaming, adjuntos y límites. La usan el widget flotante
// (components/ChatWidget.tsx) y el panel anclado de la portada
// (components/home/AsistentePanel.tsx). Ninguno de los dos duplica nada de esto.

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { usePathname } from "next/navigation";
import { buildPresupuestoWhatsAppLink, detectLangFromPathname } from "@/lib/contact";
import { CHAT_UI, type ChatLang, type QuickReply } from "@/lib/chat/ui-strings";

export type Attachment = {
  fileName: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  base64: string;
  previewUrl: string;
};

export type Message = {
  role: "user" | "assistant";
  content: string;
  attachments?: Attachment[];
};

const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_MESSAGES = 20;
const SESSION_KEY = "chatbot_session";
const MESSAGES_KEY = "chatbot_messages";
// Puerta: sin email (+ consentimiento) no hay asistente. Se guarda en
// localStorage para no volver a pedirlo en visitas siguientes.
const EMAIL_KEY = "chatbot_email";
const CONSENT_KEY = "chatbot_consent";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("FileReader returned non-string"));
        return;
      }
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function useChat(lang: ChatLang) {
  const t = CHAT_UI[lang];
  const pathname = usePathname();
  const [messages, setMessages] = useState<Message[]>(() => [{ role: "assistant", content: t.welcome }]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [sessionId] = useState(() => {
    if (typeof window === "undefined") return crypto.randomUUID();
    return sessionStorage.getItem(SESSION_KEY) || crypto.randomUUID();
  });
  const [showQuickReplies, setShowQuickReplies] = useState(true);
  const [rateLimited, setRateLimited] = useState(false);
  const [chatEmail, setChatEmail] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem(EMAIL_KEY) || "";
  });
  const [chatConsent, setChatConsent] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(CONSENT_KEY) === "1";
  });
  const gatePassed = Boolean(chatEmail) && chatConsent;
  const [gateEmail, setGateEmail] = useState("");
  const [gateConsent, setGateConsent] = useState(false);
  const [gateError, setGateError] = useState<string | null>(null);
  // Pregunta escrita antes de pasar la puerta (portada): sale sola al pasarla.
  const [queued, setQueued] = useState<string | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const gateInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const whatsappLink = useMemo(
    () => buildPresupuestoWhatsAppLink({ lang: detectLangFromPathname(pathname) }),
    [pathname]
  );

  useEffect(() => {
    sessionStorage.setItem(SESSION_KEY, sessionId);
  }, [sessionId]);

  // Restaurar la conversación de esta pestaña
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

  // Guardar (sin adjuntos: base64 demasiado grande y los blob: no sobreviven)
  useEffect(() => {
    if (messages.length > 1) {
      const slim = messages.map(({ role, content }) => ({ role, content }));
      try {
        sessionStorage.setItem(MESSAGES_KEY, JSON.stringify(slim));
      } catch {
        // quota exceeded — drop silently
      }
    }
  }, [messages]);

  const userMessageCount = messages.filter((m) => m.role === "user").length;

  const submitGate = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      const email = gateEmail.trim().toLowerCase();
      if (!EMAIL_RE.test(email)) {
        setGateError(t.gateErrEmail);
        return;
      }
      if (!gateConsent) {
        setGateError(t.gateErrConsent);
        return;
      }
      localStorage.setItem(EMAIL_KEY, email);
      localStorage.setItem(CONSENT_KEY, "1");
      setChatEmail(email);
      setChatConsent(true);
      setGateError(null);
      setTimeout(() => inputRef.current?.focus(), 0);
    },
    [gateEmail, gateConsent, t]
  );

  const sendMessage = useCallback(
    async (text: string, attachments: Attachment[] = []) => {
      const trimmedText = text.trim();
      if (!trimmedText && attachments.length === 0) return;
      if (isStreaming) return;

      if (userMessageCount >= MAX_MESSAGES || rateLimited) {
        setRateLimited(true);
        return;
      }
      if (!gatePassed) {
        // Sin email + consentimiento no se llama al asistente: foco a la puerta.
        setGateError(t.gateErrNeedEmail);
        gateInputRef.current?.focus();
        return;
      }

      setShowQuickReplies(false);
      const userMsg: Message = {
        role: "user",
        content: trimmedText,
        attachments: attachments.length > 0 ? attachments : undefined,
      };
      const updatedMessages = [...messages, userMsg];
      setMessages(updatedMessages);
      setInput("");
      setPendingAttachments([]);
      setAttachmentError(null);
      setIsStreaming(true);

      // Solo mensajes usuario/asistente (se salta el saludo)
      const apiMessages = updatedMessages
        .filter((_, i) => i > 0)
        .map((m) => {
          if (m.role === "user" && m.attachments && m.attachments.length > 0) {
            const blocks: Array<
              | { type: "text"; text: string }
              | { type: "image"; source: { type: "base64"; media_type: string; data: string }; fileName?: string }
            > = [];
            for (const att of m.attachments) {
              blocks.push({
                type: "image",
                source: { type: "base64", media_type: att.mediaType, data: att.base64 },
                fileName: att.fileName,
              });
            }
            if (m.content) blocks.push({ type: "text", text: m.content });
            return { role: m.role, content: blocks };
          }
          return { role: m.role, content: m.content };
        });

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: apiMessages, sessionId, email: chatEmail, consent: chatConsent === true }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          if (res.status === 429 || res.status === 503) {
            setRateLimited(true);
          }
          if (res.status === 401 && err?.needEmail) {
            localStorage.removeItem(EMAIL_KEY);
            localStorage.removeItem(CONSENT_KEY);
            setChatEmail("");
            setChatConsent(false);
          }
          setMessages((prev) => [...prev, { role: "assistant", content: err.error || t.errGeneric }]);
          setIsStreaming(false);
          return;
        }

        const newSessionId = res.headers.get("X-Session-Id");
        if (newSessionId) {
          sessionStorage.setItem(SESSION_KEY, newSessionId);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No reader");

        const decoder = new TextDecoder();
        let assistantContent = "";
        setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          for (const line of chunk.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6);
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.text) {
                assistantContent += parsed.text;
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: "assistant", content: assistantContent };
                  return updated;
                });
              }
            } catch {
              // ignore malformed chunks
            }
          }
        }
      } catch (err) {
        console.error("[useChat] Error:", err);
        setMessages((prev) => [...prev, { role: "assistant", content: t.errConn }]);
      } finally {
        setIsStreaming(false);
      }
    },
    [messages, isStreaming, sessionId, userMessageCount, rateLimited, chatEmail, chatConsent, gatePassed, t]
  );

  // Pregunta encolada desde fuera (portada): se envía sola al pasar la puerta.
  const ask = useCallback((text: string) => {
    const clean = text.trim();
    if (!clean) return;
    setShowQuickReplies(false);
    setQueued(clean);
  }, []);

  useEffect(() => {
    if (!gatePassed || !queued || isStreaming) return;
    setQueued(null);
    sendMessage(queued);
  }, [gatePassed, queued, isStreaming, sendMessage]);

  const quickReply = useCallback(
    (reply: QuickReply) => {
      if (reply.isWhatsApp) {
        window.open(whatsappLink, "_blank", "noopener,noreferrer");
        return;
      }
      sendMessage(reply.label);
    },
    [whatsappLink, sendMessage]
  );

  const clearConversation = useCallback(() => {
    setMessages([{ role: "assistant", content: t.welcome }]);
    setShowQuickReplies(true);
    setRateLimited(false);
    setPendingAttachments([]);
    setAttachmentError(null);
    setQueued(null);
    sessionStorage.removeItem(MESSAGES_KEY);
  }, [t]);

  const handleFileSelect = useCallback(
    async (file: File) => {
      setAttachmentError(null);
      if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        setAttachmentError(t.attachErrType);
        return;
      }
      if (file.size > MAX_FILE_BYTES) {
        setAttachmentError(t.attachErrSize);
        return;
      }
      try {
        const base64 = await fileToBase64(file);
        const previewUrl = URL.createObjectURL(file);
        setPendingAttachments((prev) => [
          ...prev,
          { fileName: file.name, mediaType: file.type as Attachment["mediaType"], base64, previewUrl },
        ]);
      } catch (err) {
        console.error("[useChat] File read error:", err);
        setAttachmentError(t.attachErrRead);
      }
    },
    [t]
  );

  const removeAttachment = useCallback((index: number) => {
    setPendingAttachments((prev) => {
      const att = prev[index];
      if (att) URL.revokeObjectURL(att.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  return {
    t,
    lang,
    messages,
    input,
    setInput,
    isStreaming,
    rateLimited,
    gatePassed,
    gateEmail,
    setGateEmail,
    gateConsent,
    setGateConsent,
    gateError,
    submitGate,
    gateInputRef,
    inputRef,
    sendMessage,
    ask,
    queued,
    quickReply,
    showQuickReplies,
    pendingAttachments,
    attachmentError,
    handleFileSelect,
    removeAttachment,
    clearConversation,
    whatsappLink,
    acceptedImageTypes: ACCEPTED_IMAGE_TYPES,
  };
}

export type ChatController = ReturnType<typeof useChat>;
