"use client";

import { track } from "@vercel/analytics";
import { MessageCircle } from "lucide-react";
import { buildPresupuestoWhatsAppLink, WHATSAPP_LOCAL } from "@/lib/contact";

const DISPLAY = WHATSAPP_LOCAL.replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3");

export default function WhatsAppCta() {
  return (
    <a
      href={buildPresupuestoWhatsAppLink({ page: "/" })}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => track("whatsapp_click", { page: "/", source: "hero" })}
      className="inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-vert px-5 py-4 text-left text-white shadow-sm transition-colors hover:bg-vert/90 sm:w-auto sm:rounded-full sm:py-3.5 sm:text-center"
    >
      <MessageCircle className="h-6 w-6 shrink-0" aria-hidden="true" />
      <span className="flex flex-col sm:block">
        <span className="text-base font-bold sm:text-[17px]">¿Prefieres WhatsApp? <span className="sm:hidden">Escríbenos</span></span>
        <span className="text-sm text-white/85 sm:ml-1 sm:text-[17px] sm:font-bold sm:text-white">
          <span className="hidden sm:inline">Escríbenos al </span>{DISPLAY}<span className="sm:hidden"> · te contestamos en el día</span>
        </span>
      </span>
    </a>
  );
}
