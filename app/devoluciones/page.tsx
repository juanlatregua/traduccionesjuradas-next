import type { Metadata } from "next";
import Link from "next/link";
import { WHATSAPP_LINK } from "@/lib/contact";

export const metadata: Metadata = {
  title: "Política de devoluciones y reembolsos · TraduccionesJuradas.net",
  description:
    "Política de devoluciones y reembolsos del servicio de traducción jurada de HBTJ Consultores Lingüísticos S.L. Casos en los que aplica reembolso, plazos y procedimiento.",
  alternates: { canonical: "https://www.traduccionesjuradas.net/devoluciones" },
};

export default function DevolucionesPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 text-encre">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
        Política de devoluciones y reembolsos
      </h1>
      <p className="mt-3 text-sm text-graphite">
        Última actualización: 27 de abril de 2026
      </p>

      <section className="mt-8 space-y-4 text-sepia">
        <p>
          Esta política se aplica a los servicios de traducción jurada
          contratados a <strong>HBTJ Consultores Lingüísticos S.L.</strong>{" "}
          (CIF B-93613890) a través del sitio{" "}
          <Link href="/" className="text-bleu hover:underline">
            traduccionesjuradas.net
          </Link>
          .
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">1. Naturaleza del servicio</h2>
        <p className="mt-3 text-sm leading-relaxed text-sepia">
          La traducción jurada es un servicio profesional personalizado, firmado
          por un traductor jurado nombrado por el Ministerio de Asuntos
          Exteriores, Unión Europea y Cooperación (MAEC). Una vez entregado el
          documento firmado, el servicio se considera ejecutado en su totalidad
          y no es susceptible de devolución en el sentido tradicional aplicable
          a productos físicos.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">
          2. Derecho de desistimiento (14 días)
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-sepia">
          De conformidad con el artículo 103.a) del Real Decreto Legislativo
          1/2007 (Ley General para la Defensa de los Consumidores y Usuarios),
          el derecho de desistimiento de 14 días naturales{" "}
          <strong>no es aplicable</strong> a los servicios cuya ejecución haya
          comenzado con el consentimiento expreso del consumidor, una vez
          ejecutado completamente el servicio. Al confirmar el pedido, el
          cliente autoriza expresamente el inicio inmediato del servicio y
          renuncia al derecho de desistimiento una vez la traducción esté
          firmada y entregada.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-sepia">
          Si el cliente desea cancelar el pedido <strong>antes</strong> de que
          el traductor haya iniciado el trabajo, recibirá un reembolso íntegro.
          Si la cancelación se solicita una vez iniciada la traducción, se
          reembolsará la parte proporcional al trabajo no ejecutado.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">3. Reembolso por error o defecto</h2>
        <p className="mt-3 text-sm leading-relaxed text-sepia">
          Si la traducción contiene errores imputables al traductor (omisiones,
          errores de transcripción, datos incorrectos respecto al documento
          original), el cliente tiene derecho a:
        </p>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-sepia">
          <li>
            <strong>Corrección sin coste</strong>: emitiremos una nueva versión
            corregida en un plazo máximo de 48 horas laborables.
          </li>
          <li>
            <strong>Reembolso íntegro</strong>: si el error invalida totalmente
            el documento ante el organismo destinatario y no es subsanable.
          </li>
        </ul>
        <p className="mt-3 text-sm leading-relaxed text-sepia">
          El plazo para reclamar errores es de <strong>30 días naturales</strong>{" "}
          desde la entrega de la traducción.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">4. Casos en los que NO procede reembolso</h2>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-sepia">
          <li>
            Cambio de criterio del cliente una vez entregada la traducción
            correcta.
          </li>
          <li>
            Rechazo del documento por el organismo destinatario por motivos
            ajenos a la traducción (apostilla incorrecta, plazos expirados,
            errores en el documento original).
          </li>
          <li>
            Diferencias de criterio sobre opciones terminológicas razonables
            cuando la traducción es fiel al documento original.
          </li>
          <li>
            Documentos originales ilegibles, incompletos o adulterados que el
            cliente no haya señalado antes del pedido.
          </li>
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">5. Cambios</h2>
        <p className="mt-3 text-sm leading-relaxed text-sepia">
          Por la naturaleza del servicio, no aceptamos cambios de una
          traducción por otra. Si necesitas una traducción adicional o de un
          documento distinto, deberás contratar un nuevo servicio.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">6. Procedimiento para solicitar reembolso</h2>
        <ol className="mt-3 space-y-2 text-sm leading-relaxed text-sepia">
          <li>
            <strong>Paso 1.</strong> Envía un correo a{" "}
            <a
              href="mailto:hola@traduccionesjuradas.net"
              className="text-bleu hover:underline"
            >
              hola@traduccionesjuradas.net
            </a>{" "}
            indicando la referencia del pedido y el motivo de la solicitud.
            También puedes contactar por{" "}
            <a
              href={WHATSAPP_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="text-bleu hover:underline"
            >
              WhatsApp
            </a>
            .
          </li>
          <li>
            <strong>Paso 2.</strong> Recibirás respuesta en un plazo máximo de
            48 horas laborables.
          </li>
          <li>
            <strong>Paso 3.</strong> Si procede el reembolso, se efectuará por
            el mismo medio de pago utilizado en la compra, en un plazo máximo
            de 14 días naturales desde la aceptación de la solicitud.
          </li>
        </ol>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">7. Resolución de conflictos</h2>
        <p className="mt-3 text-sm leading-relaxed text-sepia">
          En caso de desacuerdo, el cliente puede acudir a la{" "}
          <a
            href="https://ec.europa.eu/consumers/odr"
            target="_blank"
            rel="noopener noreferrer"
            className="text-bleu hover:underline"
          >
            Plataforma Europea de Resolución de Litigios en Línea
          </a>{" "}
          o a las Juntas Arbitrales de Consumo de la Junta de Andalucía.
        </p>
      </section>

      <section className="mt-10 rounded-xl border border-cream bg-card p-5 shadow-paper">
        <p className="text-sm text-sepia">
          ¿Tienes una consulta sobre tu pedido?{" "}
          <Link
            href="/contacto"
            className="font-semibold text-bleu hover:underline"
          >
            Contáctanos
          </Link>{" "}
          y te respondemos en menos de 48 horas laborables.
        </p>
      </section>
    </main>
  );
}
