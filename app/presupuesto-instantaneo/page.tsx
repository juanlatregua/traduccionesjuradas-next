import type { Metadata } from "next";
import PresupuestoInstantaneoClient from "./PresupuestoInstantaneoClient";

export const metadata: Metadata = {
  title: "Presupuesto instantáneo de traducción jurada",
  description:
    "Sube tu documento y recibe un presupuesto de traducción jurada en segundos. Sin esperas, sin formularios. Precio cerrado al instante.",
  alternates: { canonical: "https://www.traduccionesjuradas.net/presupuesto-instantaneo" },
  openGraph: {
    images: [
      {
        url: "/api/og?title=Presupuesto+instant%C3%A1neo&subtitle=Sube+tu+documento+y+recibe+precio+cerrado+en+segundos",
        width: 1200,
        height: 630,
        alt: "Presupuesto instantáneo de traducción jurada — TraduccionesJuradas.net",
      },
    ],
  },
};

export default function PresupuestoInstantaneoPage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-12">
      {/* Hero */}
      <div className="text-center mb-10">
        <h1 className="font-baskerville text-3xl sm:text-4xl font-bold text-bleu leading-tight">
          Presupuesto instantáneo
        </h1>
        <p className="mt-3 text-lg text-graphite max-w-xl mx-auto">
          Sube tu documento y recibe el precio de tu traducción jurada en
          segundos. Sin esperar respuesta manual, disponible 24/7.
        </p>

        {/* Trust badges */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-xs text-graphite">
          <span className="flex items-center gap-1.5 rounded-full bg-cream px-3 py-1.5">
            <span className="h-2 w-2 rounded-full bg-vert" />
            Traductor jurado N.º 3850
          </span>
          <span className="flex items-center gap-1.5 rounded-full bg-cream px-3 py-1.5">
            <span className="h-2 w-2 rounded-full bg-bleu" />
            Análisis automático
          </span>
          <span className="flex items-center gap-1.5 rounded-full bg-cream px-3 py-1.5">
            <span className="h-2 w-2 rounded-full bg-or" />
            Precio cerrado
          </span>
        </div>
      </div>

      {/* Client component with the full flow */}
      <PresupuestoInstantaneoClient />

      {/* How it works */}
      <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6">
        {[
          {
            step: "1",
            title: "Sube tu documento",
            desc: "PDF, foto o escaneo. Lo analizamos al instante.",
          },
          {
            step: "2",
            title: "Recibe el precio",
            desc: "Presupuesto cerrado en segundos. Sin sorpresas ni letra pequeña.",
          },
          {
            step: "3",
            title: "Paga y recibe",
            desc: "Traducción jurada oficial firmada en 24-48h por email.",
          },
        ].map((item) => (
          <div
            key={item.step}
            className="text-center rounded-xl border border-bleu/10 bg-card p-6"
          >
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-bleu text-cream font-baskerville text-lg font-bold">
              {item.step}
            </div>
            <h3 className="mt-3 font-baskerville text-lg text-encre">
              {item.title}
            </h3>
            <p className="mt-1 text-sm text-graphite">{item.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
