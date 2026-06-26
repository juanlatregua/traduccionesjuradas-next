// components/order-workspace/OrderStepper.tsx
//
// Banda lineal de pasos del pedido + "Siguiente paso". NO calcula estado propio:
// consume getOrderActionStage / getNextBestAction (lib/order-actions). Server
// Component (sin JS): el CTA es un ancla que hace scroll a la seccion de la landing.

import type { OrderActionStage, NextBestAction } from "@/lib/order-actions";

// Los 9 stages del backend agrupados en los 7 pasos visibles del flujo de Juan.
const STEPS: { label: string; stages: OrderActionStage[] }[] = [
  { label: "Presupuesto", stages: ["DRAFT", "QUOTE_READY"] },
  { label: "Enviar y cobrar", stages: ["SENT_TO_CLIENT", "PAYMENT_PENDING"] },
  { label: "Asignar traductor", stages: ["PAYMENT_VALIDATED"] },
  { label: "Subir traducción", stages: ["IN_PRODUCTION"] },
  { label: "Enviar al cliente", stages: ["DELIVERY_READY"] },
  { label: "Finalizar", stages: ["DELIVERED"] },
  { label: "Archivado", stages: ["CLOSED"] },
];

// El "tab" que sugiere getNextBestAction → ancla de la seccion de la landing.
const TAB_ANCHOR: Record<NextBestAction["tab"], string> = {
  presupuesto: "#docs",
  documentos: "#docs",
  comprobante: "#finanzas",
  workflow: "#traduccion",
  asignar: "#colab",
  entrega: "#traduccion",
  notificar: "#traduccion",
  finanzas: "#finanzas",
  control: "#finanzas",
};

export default function OrderStepper({
  stage,
  nextAction,
}: {
  stage: OrderActionStage;
  nextAction: NextBestAction;
}) {
  const currentIdx = STEPS.findIndex((s) => s.stages.includes(stage));
  const closed = stage === "CLOSED";
  const anchor = TAB_ANCHOR[nextAction.tab] || "#traduccion";

  return (
    <div className="rounded-3xl border border-sepia/30 bg-white p-5 shadow-sm">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-encre/50">
        Estado del pedido
      </p>
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-2 text-xs">
        {STEPS.map((s, i) => {
          const state = i < currentIdx ? "done" : i === currentIdx ? "current" : "pending";
          return (
            <li key={s.label} className="flex items-center gap-1">
              <span
                className={
                  state === "current"
                    ? "rounded-full bg-bleu px-3 py-1 font-semibold text-white"
                    : state === "done"
                      ? "rounded-full bg-emerald-100 px-3 py-1 font-medium text-emerald-800"
                      : "rounded-full bg-sepia/15 px-3 py-1 text-encre/45"
                }
              >
                {state === "done" ? "✓ " : `${i + 1}. `}
                {s.label}
              </span>
              {i < STEPS.length - 1 && <span className="text-sepia/40">→</span>}
            </li>
          );
        })}
      </ol>

      {closed ? (
        <div className="mt-4 rounded-2xl border border-emerald-300/60 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          ✓ Pedido finalizado — sin acciones pendientes.
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-bleu/30 bg-bleu/5 px-4 py-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-bleu">Siguiente paso</p>
            <p className="text-base font-bold text-encre">{nextAction.label}</p>
            <p className="text-xs text-encre/60">{nextAction.reason}</p>
          </div>
          <a
            href={anchor}
            className="rounded-xl bg-bleu px-5 py-2.5 text-sm font-semibold text-white hover:bg-bleu-dark"
          >
            Ir al paso →
          </a>
        </div>
      )}
    </div>
  );
}
