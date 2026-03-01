"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function PedidoRecibidoContent() {
  const params = useSearchParams();
  const ref = params.get("ref") || "";
  const amountCents = Number(params.get("amount") || 0);
  const title = params.get("title") || "";
  const amount = amountCents > 0 ? (amountCents / 100).toFixed(2) : null;

  const whatsappUrl = `https://wa.me/34951333614?text=${encodeURIComponent(
    `Hola, acabo de hacer un pedido (ref: ${ref}) y tengo una consulta.`
  )}`;

  return (
    <main className="flex min-h-[60vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg rounded-3xl border border-cream bg-card p-6 shadow-sm sm:p-8">
        {/* Check icon */}
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-cream">
          <svg
            className="h-8 w-8 text-bleu"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2.5}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>

        <h1 className="mt-5 text-center text-xl font-bold text-encre">
          Hemos recibido tu pedido
        </h1>

        <div className="mt-5 space-y-3 rounded-2xl border border-cream bg-cream p-4">
          {ref && (
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-sepia">Referencia</span>
              <span className="font-bold text-bleu">{ref}</span>
            </div>
          )}
          {title && (
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-sepia">Concepto</span>
              <span className="truncate pl-4 text-right text-encre">{title}</span>
            </div>
          )}
          {amount && (
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-sepia">Precio estimado</span>
              <span className="font-bold text-bleu">~{amount} EUR</span>
            </div>
          )}
        </div>

        <div className="mt-5 space-y-3 text-sm text-sepia">
          <p>
            Revisaremos tu documento y te enviaremos el <strong>presupuesto definitivo por email</strong> en breve.
            Podras pagar una vez confirmado el precio.
          </p>
          <p className="text-xs text-graphite">
            Horario de respuesta: <strong>09:00 a 19:00 CET</strong>. Solemos responder en menos de 30 minutos dentro de ese horario.
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <a
            href="/consulta"
            className="flex-1 rounded-2xl border border-bleu bg-card px-4 py-2.5 text-center text-sm font-semibold text-bleu hover:bg-cream"
          >
            Consultar estado
          </a>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 rounded-2xl bg-bleu px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-bleu-dark"
          >
            WhatsApp (urgencias)
          </a>
        </div>
      </div>
    </main>
  );
}

export default function PedidoRecibidoPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-[60vh] items-center justify-center">
          <p className="text-sm text-graphite">Cargando...</p>
        </main>
      }
    >
      <PedidoRecibidoContent />
    </Suspense>
  );
}
