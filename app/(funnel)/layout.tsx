import type { ReactNode } from "react";
import FunnelStepper from "@/components/FunnelStepper";

export default function FunnelLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:py-10">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
          Encargo de traducción jurada
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Proceso oficial guiado
        </h1>
        <p className="mt-2 text-sm text-slate-700">
          Completa los pasos en orden. El sistema conserva tu sesión y evita pagos sin documento original.
        </p>
        <FunnelStepper />
      </section>

      <div className="mt-6">{children}</div>
    </div>
  );
}
