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
        className="text-xs font-semibold text-cyan-400 hover:underline"
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
            className="mt-2 h-72 w-full rounded-lg border border-slate-700 bg-slate-900"
          />
        ) : (
          <p className="mt-2 whitespace-pre-wrap rounded-lg border border-slate-700 bg-slate-800/40 p-3 text-sm text-slate-100">
            {text}
          </p>
        ))}
    </div>
  );
}

export default function ClientMessagesSection({ messages }: { messages: ClientMessage[] }) {
  if (!messages.length) {
    return (
      <p className="text-sm text-slate-400">
        Aún no se ha enviado ningún mensaje al cliente desde este pedido.
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {messages.map((m) => (
        <li key={m.id} className="rounded-xl border border-slate-700 bg-slate-800/40 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-100">
              {typeLabel(m.type)}{" "}
              <span className="rounded-md bg-cyan-500/15 px-1.5 py-0.5 text-[11px] font-semibold text-cyan-400">
                {channelLabel(m.channel)}
              </span>
            </p>
            <p className="text-xs text-slate-500">
              {new Date(m.createdAt).toLocaleString("es-ES")}
            </p>
          </div>
          {m.toEmail && <p className="mt-0.5 text-xs text-slate-400">Para: {m.toEmail}</p>}
          {m.subject && <p className="mt-1 text-sm text-slate-300">{m.subject}</p>}
          <MessageBody html={m.bodyHtml} text={m.bodyText} />
        </li>
      ))}
    </ul>
  );
}
