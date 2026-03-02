"use client";

import {
  CheckCircle2,
  Clock,
  FileText,
  CreditCard,
  Languages,
  Download,
  ArrowRight,
} from "lucide-react";

type OrderStep = {
  key: string;
  label: string;
  icon: React.ElementType;
  completed: boolean;
  active: boolean;
};

type Props = {
  orderReference: string;
  currentStatus:
    | "PAID"
    | "IN_TRANSLATION"
    | "TRANSLATED"
    | "DELIVERED"
    | string;
  documentType?: string;
  estimatedDelivery?: string;
  translationUrl?: string;
};

const STEPS: {
  key: string;
  label: string;
  icon: React.ElementType;
  statuses: string[];
}[] = [
  {
    key: "paid",
    label: "Pago confirmado",
    icon: CreditCard,
    statuses: ["PAID", "IN_TRANSLATION", "TRANSLATED", "DELIVERED"],
  },
  {
    key: "translating",
    label: "En traducción",
    icon: Languages,
    statuses: ["IN_TRANSLATION", "TRANSLATED", "DELIVERED"],
  },
  {
    key: "translated",
    label: "Traducido",
    icon: FileText,
    statuses: ["TRANSLATED", "DELIVERED"],
  },
  {
    key: "delivered",
    label: "Entregado",
    icon: Download,
    statuses: ["DELIVERED"],
  },
];

export default function OrderTracker({
  orderReference,
  currentStatus,
  documentType,
  estimatedDelivery,
  translationUrl,
}: Props) {
  const steps: OrderStep[] = STEPS.map((s) => ({
    key: s.key,
    label: s.label,
    icon: s.icon,
    completed: s.statuses.includes(currentStatus),
    active:
      s.statuses.includes(currentStatus) &&
      !STEPS[STEPS.indexOf(s) + 1]?.statuses.includes(currentStatus),
  }));

  return (
    <div className="rounded-xl border border-bleu/15 bg-card p-6 shadow-paper animate-fadeIn">
      <div className="flex items-center justify-between">
        <h3 className="font-baskerville text-xl text-encre">
          Pedido {orderReference}
        </h3>
        <span className="rounded-full bg-vert/10 px-3 py-1 text-xs font-medium text-vert flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Confirmado
        </span>
      </div>

      {documentType && (
        <p className="mt-1 text-sm text-graphite">{documentType}</p>
      )}

      {/* Timeline */}
      <div className="mt-6 space-y-0">
        {steps.map((step, i) => {
          const Icon = step.icon;
          return (
            <div key={step.key} className="flex items-start gap-3">
              {/* Connector line + circle */}
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${
                    step.completed
                      ? step.active
                        ? "border-bleu bg-bleu text-white"
                        : "border-vert bg-vert text-white"
                      : "border-graphite/20 bg-cream text-graphite/40"
                  }`}
                >
                  {step.completed && !step.active ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </div>
                {i < steps.length - 1 && (
                  <div
                    className={`w-0.5 h-8 ${
                      step.completed ? "bg-vert" : "bg-graphite/10"
                    }`}
                  />
                )}
              </div>
              {/* Label */}
              <div className="pt-1">
                <p
                  className={`text-sm font-medium ${
                    step.active
                      ? "text-bleu"
                      : step.completed
                      ? "text-encre"
                      : "text-graphite/50"
                  }`}
                >
                  {step.label}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Estimated delivery */}
      {estimatedDelivery && currentStatus !== "DELIVERED" && (
        <div className="mt-5 flex items-center gap-2 rounded-lg bg-bleu/5 border border-bleu/10 px-4 py-3 text-sm text-bleu">
          <Clock className="h-4 w-4 shrink-0" />
          Entrega estimada: <strong>{estimatedDelivery}</strong>
        </div>
      )}

      {/* Download link */}
      {translationUrl && currentStatus === "DELIVERED" && (
        <a
          href={translationUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 flex items-center justify-center gap-2 rounded-lg bg-vert px-6 py-3 text-sm font-semibold text-white shadow-md hover:bg-vert/90 transition-colors"
        >
          <Download className="h-4 w-4" />
          Descargar traducción jurada firmada
        </a>
      )}

      {/* Consult link */}
      <div className="mt-4 text-center">
        <a
          href={`/area-cliente/pedido/${orderReference}`}
          className="inline-flex items-center gap-1 text-sm text-bleu hover:underline"
        >
          Ver detalles del pedido
          <ArrowRight className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}
