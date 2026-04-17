"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

type Step = {
  label: string;
  href?: string;
  tooltip?: string;
  current?: boolean;
};

const STEPS: Step[] = [
  {
    label: "Escaneo",
    current: true,
  },
  {
    label: "Presupuesto",
    href: "/presupuesto-instantaneo",
    tooltip: "Emitido por HBTJ Consultores Lingüísticos S.L.",
  },
  {
    label: "Traducción",
    tooltip:
      "Por traductor jurado MAEC según idioma · Francés: titular nº 3850",
  },
  {
    label: "Entrega firmada",
    tooltip: "PDF firmado electrónicamente, válido ante registros",
  },
];

export default function FlowMicroBanner() {
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();

  return (
    <nav
      aria-label="Progreso del servicio"
      className="border-b border-bleu/10 bg-cream/70"
    >
      <div className="mx-auto max-w-5xl px-4 py-2.5 sm:py-3">
        {/* Desktop — fila completa */}
        <ol className="hidden items-center gap-2 text-xs sm:flex sm:text-sm">
          {STEPS.map((step, i) => (
            <StepItem key={step.label} step={step} last={i === STEPS.length - 1} />
          ))}
        </ol>

        {/* Mobile — colapso con toggle */}
        <div className="sm:hidden">
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={panelId}
            onClick={() => setExpanded((v) => !v)}
            className="flex w-full items-center justify-between gap-2 text-left text-xs font-medium text-bleu"
          >
            <span>
              <span className="text-sepia">Paso 1 de 4 — </span>
              <span className="font-semibold text-bleu" aria-current="step">
                Escaneo
              </span>
            </span>
            <ChevronRight
              className={`h-4 w-4 shrink-0 transition-transform ${
                expanded ? "rotate-90" : ""
              }`}
              aria-hidden="true"
            />
          </button>

          {expanded && (
            <ol
              id={panelId}
              className="mt-2 flex flex-col gap-1.5 border-t border-bleu/10 pt-2 text-xs"
            >
              {STEPS.map((step) => (
                <StepItem key={step.label} step={step} stacked />
              ))}
            </ol>
          )}
        </div>
      </div>
    </nav>
  );
}

function StepItem({
  step,
  last,
  stacked,
}: {
  step: Step;
  last?: boolean;
  stacked?: boolean;
}) {
  const content = (
    <span
      className={`${step.current ? "font-semibold text-bleu" : "text-sepia"}`}
      title={step.tooltip}
    >
      {step.label}
    </span>
  );

  const li = (
    <li
      aria-current={step.current ? "step" : undefined}
      className={stacked ? "flex items-center gap-2" : "flex items-center gap-2"}
    >
      {step.href ? (
        <Link
          href={step.href}
          className="rounded hover:text-bleu-light focus:outline-none focus-visible:ring-2 focus-visible:ring-bleu/40"
          title={step.tooltip}
        >
          {content}
        </Link>
      ) : (
        content
      )}
      {!stacked && !last && (
        <ChevronRight className="h-3.5 w-3.5 text-bleu/30" aria-hidden="true" />
      )}
    </li>
  );

  return li;
}
