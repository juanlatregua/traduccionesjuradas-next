import type { Metadata } from "next";
import Link from "next/link";
import PresupuestoSelector from "./PresupuestoSelector";

export const metadata: Metadata = {
  title: "Presupuesto de traducción jurada | Precio en 2 minutos",
  description:
    "Calcula el precio estimado de tu traducción jurada, añade los documentos que necesites y envía tu solicitud. Respuesta en menos de 2 horas laborables.",
  alternates: {
    canonical: "https://www.traduccionesjuradas.net/presupuesto",
  },
};

export default function PresupuestoPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10 lg:py-12">
      <h1 className="text-2xl font-bold tracking-tight text-encre sm:text-3xl">
        Calcula tu presupuesto de traducción jurada
      </h1>
      <p className="mt-2 text-sm text-sepia">
        Elige el idioma, selecciona el tipo de documento, indica las palabras
        aproximadas y obtén un precio estimado al instante. Puedes añadir
        varios documentos y enviarnos la solicitud en un solo paso.
      </p>

      <PresupuestoSelector />

      {/* Mini FAQ */}
      <section className="mt-12 space-y-3 rounded-2xl border border-cream bg-card p-4 text-sm text-sepia shadow-sm">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-graphite">
          Preguntas frecuentes
        </h2>
        <details className="rounded-xl border border-cream bg-parchment px-3 py-2">
          <summary className="cursor-pointer text-sm font-semibold text-encre">
            ¿Vale la traducción en PDF o necesito papel?
          </summary>
          <p className="mt-2 text-sm text-sepia">
            El PDF firmado digitalmente por el traductor jurado es válido
            para la mayoría de trámites. Si tu organismo pide papel,
            también podemos enviarlo por mensajería.
          </p>
        </details>
        <details className="rounded-xl border border-cream bg-parchment px-3 py-2">
          <summary className="cursor-pointer text-sm font-semibold text-encre">
            ¿Puedo mandar fotos en lugar de escaneo?
          </summary>
          <p className="mt-2 text-sm text-sepia">
            Sí, siempre que sean nítidas, sin recortes y con sellos/márgenes
            visibles. Si hiciera falta, podemos pedir un escaneo mejor
            antes de entregar.
          </p>
        </details>
        <details className="rounded-xl border border-cream bg-parchment px-3 py-2">
          <summary className="cursor-pointer text-sm font-semibold text-encre">
            ¿Cómo se paga?
          </summary>
          <p className="mt-2 text-sm text-sepia">
            Te enviaremos el presupuesto con las opciones de pago:
            transferencia, tarjeta, Bizum o PayPal. Para encargos urgentes
            solemos pedir el pago antes de empezar.
          </p>
        </details>
        <details className="rounded-xl border border-cream bg-parchment px-3 py-2">
          <summary className="cursor-pointer text-sm font-semibold text-encre">
            ¿Qué pasa con mis datos y documentos?
          </summary>
          <p className="mt-2 text-sm text-sepia">
            Usamos tus archivos solo para preparar el presupuesto y la
            traducción. Viajan por HTTPS y se eliminan pasados 30 días
            desde la entrega, salvo obligación legal. Si quieres, puedes
            pedir el borrado inmediato tras recibir la traducción.
          </p>
        </details>
      </section>

      <p className="mt-6 text-xs text-graphite">
        Si prefieres, también puedes enviar tus documentos por email a{" "}
        <a
          href="mailto:hola@traduccionesjuradas.net"
          className="text-bleu hover:underline"
        >
          hola@traduccionesjuradas.net
        </a>{" "}
        o por{" "}
        <Link
          href="https://wa.me/34951333614"
          className="text-bleu hover:underline"
        >
          WhatsApp
        </Link>
        .
      </p>
    </main>
  );
}
