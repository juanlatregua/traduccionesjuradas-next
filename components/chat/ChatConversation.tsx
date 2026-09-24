"use client";

// components/chat/ChatConversation.tsx — La conversación en sí: lista de
// mensajes (scroll INTERNO, la página no salta), respuestas rápidas, aviso de
// límite, puerta de email + consentimiento y campo de escribir. La pintan el
// widget flotante (variant "floating") y el panel anclado de la portada
// (variant "embedded"); la lógica viene toda de useChat.

import { useEffect, useRef } from "react";
import { RichMessage } from "@/lib/chat/format-response";
import type { ChatController } from "@/components/chat/useChat";

export default function ChatConversation({
  chat,
  variant,
}: {
  chat: ChatController;
  variant: "floating" | "embedded";
}) {
  const { t } = chat;
  const listRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const embedded = variant === "embedded";

  // Scroll interno al último mensaje: scrollTop en el contenedor, nunca
  // scrollIntoView (que arrastra la página entera en el panel anclado).
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat.messages, chat.isStreaming]);

  const formBase = embedded
    ? "flex flex-col gap-2 border-t border-cream bg-card px-3 py-3"
    : "flex flex-col gap-2 border-t border-cream bg-card px-3 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] sm:rounded-b-2xl sm:pb-3";

  return (
    <>
      <div
        ref={listRef}
        className={`overflow-y-auto px-4 py-3 space-y-3 ${
          embedded ? "max-h-[min(55vh,440px)] min-h-[200px] bg-parchment" : "flex-1"
        }`}
      >
        {chat.messages.map((msg, i) => (
          <div
            key={i}
            className={`flex animate-chatMsgIn ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            style={{ animationDelay: i === 0 ? "0ms" : "50ms" }}
          >
            <div
              className={`max-w-[85%] whitespace-pre-wrap px-3 py-2 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "rounded-[12px_4px_12px_12px] bg-bleu text-white"
                  : "rounded-[4px_12px_12px_12px] border-l-[3px] border-or bg-cream text-sepia"
              }`}
            >
              {msg.attachments && msg.attachments.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {msg.attachments.map((att, ai) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={ai} src={att.previewUrl} alt={att.fileName} className="h-20 w-20 rounded-md object-cover ring-1 ring-white/40" />
                  ))}
                </div>
              )}
              {msg.role === "assistant" ? <RichMessage content={msg.content} /> : msg.content}
            </div>
          </div>
        ))}

        {chat.isStreaming && chat.messages[chat.messages.length - 1]?.role !== "assistant" && (
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

        {chat.showQuickReplies && (
          <div className="flex flex-wrap gap-2 pt-1" role="group" aria-label={t.quickRepliesAria}>
            {t.quickReplies.map((reply, i) => (
              <button
                key={reply.label}
                type="button"
                onClick={() => chat.quickReply(reply)}
                className="min-h-11 rounded-full border border-bleu/20 bg-card px-4 py-2 text-sm font-medium text-bleu transition-colors hover:bg-bleu hover:text-parchment animate-chatMsgIn"
                style={{ animationDelay: `${150 + i * 75}ms` }}
              >
                {reply.emoji} {reply.label}
              </button>
            ))}
          </div>
        )}

        {chat.rateLimited && (
          <div className="rounded-lg border border-or/30 bg-cream p-3 text-center text-sm text-sepia animate-chatMsgIn">
            <p className="mb-2">{t.rateLimitedText}</p>
            <a
              href={chat.whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-[#25D366] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#20bd5a]"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              {t.rateLimitedCta}
            </a>
          </div>
        )}

        <div aria-live="polite" className="sr-only">
          {chat.messages.length > 1 && chat.messages[chat.messages.length - 1].role === "assistant"
            ? chat.messages[chat.messages.length - 1].content
            : ""}
        </div>
      </div>

      {/* Puerta: email + consentimiento antes del primer mensaje */}
      {!chat.rateLimited && !chat.gatePassed && (
        <form onSubmit={chat.submitGate} className={formBase}>
          {chat.queued && (
            <p className="rounded-lg border border-or/30 bg-cream px-3 py-2 text-xs text-sepia">
              <span className="font-semibold">{t.queuedLabel}</span> «{chat.queued}»
            </p>
          )}
          <p className="text-xs font-medium text-sepia">{t.gateIntro}</p>
          <div className="flex items-center gap-2">
            <input
              ref={chat.gateInputRef}
              type="email"
              inputMode="email"
              autoComplete="email"
              value={chat.gateEmail}
              onChange={(e) => chat.setGateEmail(e.target.value)}
              placeholder={t.gateEmailPlaceholder}
              aria-label="Email"
              className="min-h-11 flex-1 rounded-lg border border-cream/50 bg-parchment px-3 py-2 text-sm text-sepia placeholder:text-graphite/50 focus:border-bleu/30 focus:outline-none"
            />
            <button
              type="submit"
              className="min-h-11 shrink-0 rounded-lg bg-bleu px-3 py-2 text-sm font-medium text-parchment transition-colors hover:bg-bleu-dark"
            >
              {t.gateStart}
            </button>
          </div>
          <label className="flex items-start gap-2 text-[11px] leading-snug text-graphite">
            <input
              type="checkbox"
              checked={chat.gateConsent}
              onChange={(e) => chat.setGateConsent(e.target.checked)}
              className="mt-0.5 h-3.5 w-3.5 rounded border-graphite/40 text-bleu"
            />
            <span>
              {t.gateConsent}{" "}
              <a href="/privacidad" target="_blank" className="text-bleu underline">{t.privacyLabel}</a>.
            </span>
          </label>
          {chat.gateError && <p className="text-xs text-red-600">{chat.gateError}</p>}
        </form>
      )}

      {/* Campo de escribir */}
      {!chat.rateLimited && chat.gatePassed && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            chat.sendMessage(chat.input, chat.pendingAttachments);
          }}
          className={embedded ? "flex flex-col gap-2 border-t border-cream bg-card px-3 py-2" : "flex flex-col gap-2 border-t border-cream bg-card px-3 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] sm:rounded-b-2xl sm:pb-2"}
        >
          {chat.pendingAttachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {chat.pendingAttachments.map((att, i) => (
                <div key={i} className="relative h-14 w-14 overflow-hidden rounded-md ring-1 ring-bleu/20">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={att.previewUrl} alt={att.fileName} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => chat.removeAttachment(i)}
                    aria-label={t.removeAttachment(att.fileName)}
                    className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-graphite/80 text-[10px] leading-none text-white hover:bg-graphite"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          {chat.attachmentError && <p className="text-xs text-red-600">{chat.attachmentError}</p>}
          <div className="flex items-end gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept={chat.acceptedImageTypes.join(",")}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) chat.handleFileSelect(file);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              aria-hidden="true"
              tabIndex={-1}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label={t.attachAria}
              disabled={chat.isStreaming || chat.pendingAttachments.length >= 3}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-cream/50 bg-parchment text-bleu transition-colors hover:bg-cream/50 disabled:opacity-40"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-4 w-4" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" />
              </svg>
            </button>
            <textarea
              ref={chat.inputRef}
              value={chat.input}
              onChange={(e) => {
                chat.setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = Math.min(e.target.scrollHeight, 96) + "px";
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  chat.sendMessage(chat.input, chat.pendingAttachments);
                  if (chat.inputRef.current) chat.inputRef.current.style.height = "auto";
                }
              }}
              placeholder={t.inputPlaceholder}
              rows={1}
              disabled={chat.isStreaming}
              aria-label={t.inputAria}
              className="min-h-11 flex-1 resize-none rounded-lg border border-cream/50 bg-parchment px-3 py-2.5 text-base text-sepia placeholder:text-graphite/50 focus:border-bleu/30 focus:outline-none disabled:opacity-50 sm:text-sm"
            />
            <button
              type="submit"
              disabled={chat.isStreaming || (!chat.input.trim() && chat.pendingAttachments.length === 0)}
              aria-label={t.sendAria}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-bleu text-parchment transition-colors hover:bg-bleu-dark disabled:opacity-40"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            </button>
          </div>
        </form>
      )}
    </>
  );
}
