"use client";

import { useState } from "react";

export type ClientMessage = {
  id: string;
  type: string;
  channel: string;
  subject: string | null;
  bodyHtml: string | null;
  bodyText: string | null;
  toEmail: string | null;
  createdAt: string;
};

function channelLabel(channel: string) {
  if (channel === "EMAIL") return "Email";
  if (channel === "SMS") return "SMS";
  if (channel === "WHATSAPP") return "WhatsApp";
  return channel || "—";
}

function typeLabel(type: string) {
  if (type.includes("delivery_ready")) return "Traducción lista";
  if (type.includes("milestone_sms")) return "Aviso de hito";
  if (type.includes("eta")) return "Fecha de entrega";
  return type;
}

function MessageBody({ html, text }: { html: string | null; text: string | null }) {
  const [open, setOpen] = useState(false);
  if (!html && !text) return null;
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs font-semibold text-bleu hover:underline"
      >
        {open ? "Ocultar mensaje" : "Ver mensaje enviado"}
      </button>
      {open &&
        (html ? (
          // Cuerpo del email renderizado en iframe aislado (sin scripts): se ve EXACTO
          // lo que recibió el cliente sin riesgo de ejecución.
          <iframe
            title="Mensaje enviado al cliente"
            sandbox=""
            srcDoc={html}
            className="mt-2 h-72 w-full rounded-lg border border-sepia/40 bg-white"
          />
        ) : (
          <p className="mt-2 whitespace-pre-wrap rounded-lg border border-sepia/40 bg-cream/60 p-3 text-sm text-encre">
            {text}
          </p>
        ))}
    </div>
  );
}

export default function ClientMessagesSection({ messages }: { messages: ClientMessage[] }) {
  if (!messages.length) {
    return (
      <p className="text-sm text-encre/60">
        Aún no se ha enviado ningún mensaje al cliente desde este pedido.
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {messages.map((m) => (
        <li key={m.id} className="rounded-xl border border-sepia/30 bg-cream/50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-encre">
              {typeLabel(m.type)}{" "}
              <span className="rounded-md bg-bleu/10 px-1.5 py-0.5 text-[11px] font-semibold text-bleu">
                {channelLabel(m.channel)}
              </span>
            </p>
            <p className="text-xs text-encre/50">
              {new Date(m.createdAt).toLocaleString("es-ES")}
            </p>
          </div>
          {m.toEmail && <p className="mt-0.5 text-xs text-encre/60">Para: {m.toEmail}</p>}
          {m.subject && <p className="mt-1 text-sm text-encre/80">{m.subject}</p>}
          <MessageBody html={m.bodyHtml} text={m.bodyText} />
        </li>
      ))}
    </ul>
  );
}
