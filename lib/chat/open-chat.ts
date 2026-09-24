// lib/chat/open-chat.ts — Abrir el asistente (components/ChatWidget.tsx) desde
// cualquier sitio de la web con una pregunta ya escrita. El widget se carga
// con dynamic() y puede no estar montado aún: la pregunta se deja también en
// sessionStorage y el widget la recoge al montar. La puerta del chat (email +
// consentimiento) y el límite diario siguen aplicando: aquí no se salta nada.

export const CHAT_OPEN_EVENT = "tj:chat-open";
export const CHAT_PREFILL_KEY = "chatbot_prefill";

export function openChatWith(text: string) {
  if (typeof window === "undefined") return;
  const clean = text.trim();
  try {
    if (clean) sessionStorage.setItem(CHAT_PREFILL_KEY, clean);
  } catch {}
  window.dispatchEvent(new CustomEvent(CHAT_OPEN_EVENT, { detail: { text: clean } }));
}
