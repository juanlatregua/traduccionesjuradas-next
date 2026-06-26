import type { Metadata } from "next";
import ExpedientePublicIntake from "@/components/ExpedientePublicIntake";

export const metadata: Metadata = {
  title: "Subir un expediente de varios documentos | Traducciones Juradas",
  description:
    "¿Necesitas traducir varios documentos a la vez? Súbelos todos juntos y te preparamos un presupuesto único con descuento por volumen.",
  alternates: { canonical: "https://www.traduccionesjuradas.net/expediente" },
};

const STEPS = [
  { n: "1", t: "Sube tus documentos", d: "Arrastra todos los archivos del expediente de una vez (PDF, fotos o escaneos)." },
  { n: "2", t: "Lo revisamos", d: "Analizamos cada documento (tipo, idioma y extensión) y preparamos el presupuesto." },
  { n: "3", t: "Recibes el presupuesto", d: "Te lo enviamos por email con descuento por volumen y formas de pago." },
];

export default function ExpedientePage({
  searchParams,
}: {
  searchParams?: { email?: string; name?: string; phone?: string };
}) {
  // Prefill cuando se llega desde el área-cliente (cliente identificado): no le
  // pedimos otra vez sus datos. El intake sigue avisando a Juan igual.
  const initialEmail = (searchParams?.email || "").trim();
  const initialName = (searchParams?.name || "").trim();
  const initialPhone = (searchParams?.phone || "").trim();
  return (
    <main className="min-h-screen bg-parchment">
      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <header className="text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-bleu">Expediente · 4+ documentos</p>
          <h1 className="mt-2 font-baskerville text-3xl text-encre sm:text-4xl">
            Traduce varios documentos a la vez
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-graphite">
            Sube todos los documentos de tu expediente —de una o varias personas, en uno o varios idiomas— y te
            preparamos <strong>un presupuesto único</strong> con descuento por volumen. Sin rellenar uno por uno.
          </p>
        </header>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-xl border border-cream bg-card p-4 shadow-paper">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-bleu/10 font-semibold text-bleu">
                {s.n}
              </div>
              <p className="mt-3 font-semibold text-encre">{s.t}</p>
              <p className="mt-1 text-sm text-graphite">{s.d}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-bleu/15 bg-card p-6 shadow-paper sm:p-8">
          <h2 className="mb-4 font-baskerville text-xl text-bleu">Sube tu expediente</h2>
          <ExpedientePublicIntake initialName={initialName} initialEmail={initialEmail} initialPhone={initialPhone} />
        </div>

        <p className="mt-6 text-center text-sm text-graphite">
          ¿Prefieres hablar con nosotros?{" "}
          <a href="https://wa.me/34951333614" className="text-bleu underline">Escríbenos por WhatsApp</a>.
        </p>
      </section>
    </main>
  );
}
