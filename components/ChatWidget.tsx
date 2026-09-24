"use client";

// components/ChatWidget.tsx — Botón flotante + panel del asistente. La lógica
// (sesión, puerta, streaming, límites) vive en components/chat/useChat.ts y la
// conversación en components/chat/ChatConversation.tsx: lo mismo que pinta el
// panel anclado de la portada. En las portadas con panel anclado (es/fr) el
// flotante no se monta: nunca dos conversaciones a la vez.

import { useState, useEffect, useCallback, useRef } from "react";
import { usePathname } from "next/navigation";
import { localeFromPath, LOCALE_HOME } from "@/lib/i18n/locales";
import { CHAT_LANGS } from "@/lib/i18n/home-hero";
import { useChat } from "@/components/chat/useChat";
import ChatConversation from "@/components/chat/ChatConversation";
import type { ChatLang } from "@/lib/chat/ui-strings";

// Portadas con el asistente anclado (components/home/AsistentePanel.tsx).
const EMBEDDED_CHAT_PATHS = new Set(CHAT_LANGS.map((l) => LOCALE_HOME[l]));

export default function ChatWidget() {
  const pathname = usePathname();
  if (EMBEDDED_CHAT_PATHS.has(pathname || "")) return null;
  const uiLang: ChatLang = localeFromPath(pathname) === "fr" ? "fr" : "es";
  return <FloatingChat lang={uiLang} />;
}

function FloatingChat({ lang }: { lang: ChatLang }) {
  const chat = useChat(lang);
  const { t } = chat;
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && !isClosing) {
      setTimeout(() => chat.inputRef.current?.focus(), 300);
    }
  }, [isOpen, isClosing, chat.inputRef]);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setIsOpen(false);
      setIsClosing(false);
    }, 200);
  }, []);

  // ESC para cerrar + focus trap
  useEffect(() => {
    if (!isOpen || isClosing) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        handleClose();
        return;
      }
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
  }, [isOpen, isClosing, handleClose]);

  // El flotante de WhatsApp se esconde mientras el chat está abierto
  useEffect(() => {
    document.body.dataset.chatOpen = isOpen && !isClosing ? "true" : "false";
    return () => {
      delete document.body.dataset.chatOpen;
    };
  }, [isOpen, isClosing]);

  const panelVisible = isOpen || isClosing;

  return (
    <>
      <button
        onClick={() => (isOpen ? handleClose() : setIsOpen(true))}
        aria-label={isOpen ? t.closeAria : t.openAria}
        className={`fixed bottom-6 right-6 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-bleu text-parchment shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl ${
          isOpen ? "scale-0 opacity-0 pointer-events-none" : "scale-100 opacity-100"
        }`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-7 w-7" aria-hidden="true">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"
          />
        </svg>
      </button>

      {panelVisible && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label={t.dialogAria}
          aria-modal="true"
          className={`fixed z-[60] flex flex-col bg-parchment
            bottom-0 right-0 h-[100dvh] w-screen
            sm:bottom-6 sm:right-6 sm:h-[520px] sm:w-[380px] sm:rounded-2xl sm:border sm:border-cream/30
            shadow-[0_16px_48px_rgba(0,0,0,0.12)]
            transition-all duration-200
            ${isClosing ? "opacity-0 translate-y-4 sm:translate-y-2" : "opacity-100 translate-y-0 animate-chatSlideUp"}
          `}
        >
          <div className="flex items-center justify-between rounded-t-none bg-bleu px-4 py-3 sm:rounded-t-2xl">
            <div className="flex items-center gap-3">
              <button
                onClick={handleClose}
                aria-label={t.closeAria}
                className="flex h-8 w-8 items-center justify-center rounded-full text-parchment/80 transition-colors hover:bg-white/10 hover:text-parchment sm:hidden"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
              </button>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-parchment">{t.headerTitle}</span>
                <span className="flex items-center gap-1 text-xs text-parchment/70">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                  {t.online}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={chat.clearConversation}
                aria-label={t.clearAria}
                title={t.clearAria}
                className="flex h-8 w-8 items-center justify-center rounded-full text-parchment/70 transition-colors hover:bg-white/10 hover:text-parchment"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                </svg>
              </button>
              <button
                onClick={handleClose}
                aria-label={t.closeAria}
                className="hidden sm:flex h-8 w-8 items-center justify-center rounded-full text-parchment/70 transition-colors hover:bg-white/10 hover:text-parchment"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <ChatConversation chat={chat} variant="floating" />
        </div>
      )}
    </>
  );
}
