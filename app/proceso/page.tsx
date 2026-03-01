import type { Metadata } from "next";
import { MAIL_LINK, WHATSAPP_LINK } from "@/lib/contact";

export const metadata: Metadata = {
  title: "Cómo funciona la traducción jurada | Traductores jurados oficiales",
  description:
    "Descubre cómo funciona el proceso de la traducción jurada: envío de documentos, presupuesto cerrado, aceptación, traducción por traductores jurados oficiales y entrega en PDF firmado digitalmente o en papel.",
  alternates: { canonical: "https://www.traduccionesjuradas.net/proceso" },
};

export default function ComoFuncionaPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 lg:py-12">
      {/* CABECERA */}
      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-bleu">
          Cómo funciona
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-encre sm:text-4xl">
          Cómo funciona el proceso de la traducción jurada
        </h1>
        <p className="mt-3 text-sm text-sepia sm:text-base">
          Te explicamos paso a paso cómo trabajamos para que tu traducción
          jurada sea válida ante organismos oficiales en España y en el
          extranjero. Somos traductores jurados, no intermediarios: cada
          traducción la firma un traductor jurado oficial del idioma
          correspondiente.
        </p>
        <p className="mt-2 text-xs text-sepia">
          Este mismo proceso se aplica tanto a certificados y documentos
          individuales como a paquetes completos de documentación laboral,
          jurídica o de <strong>teletrabajo</strong>.
        </p>
      </header>

      {/* PASO A PASO */}
      <section className="mt-10 space-y-10">
        {/* PASO 1 */}
        <div>
          <h2 className="text-xl font-semibold text-encre">
            1. Envío de los documentos
          </h2>
          <p className="mt-2 text-sm text-sepia">
            Envíanos tu documento escaneado o en una foto nítida por email,
            WhatsApp o a través del formulario de presupuesto. No hace falta el
            original en papel para calcular el precio ni para empezar la
            traducción.
          </p>
          <ul className="mt-2 space-y-1 list-disc pl-5 text-sm text-sepia">
            <li>
              Certificados, documentos académicos, contratos, sentencias,
              escrituras, documentación laboral, mercantil o de extranjería.
            </li>
            <li>Formatos aceptados: PDF, JPG, PNG, HEIC.</li>
            <li>
              No es necesario que esté apostillado para pedir presupuesto; la
              apostilla se revisa de cara al trámite final.
            </li>
          </ul>
        </div>

        {/* PASO 2 */}
        <div>
          <h2 className="text-xl font-semibold text-encre">
            2. Presupuesto cerrado y plazo de entrega
          </h2>
          <p className="mt-2 text-sm text-sepia">
            Revisamos tus documentos y te indicamos el{" "}
            <strong>precio exacto</strong> y el <strong>plazo estimado</strong>{" "}
            de entrega. Si estás de acuerdo, confirmas el encargo por email o
            WhatsApp.
          </p>
          <ul className="mt-2 space-y-1 list-disc pl-5 text-sm text-sepia">
            <li>Precio cerrado sin sorpresas ni suplementos ocultos.</li>
            <li>Posibilidad de descuentos cuando hay varios documentos.</li>
            <li>
              Plazos adaptados a <strong>urgencias</strong> siempre que sea
              posible (citas de extranjería, notarías, universidades…).
            </li>
          </ul>
        </div>

        {/* PASO 3 */}
        <div>
          <h2 className="text-xl font-semibold text-encre">
            3. Traducción jurada por un traductor jurado oficial
          </h2>
          <p className="mt-2 text-sm text-sepia">
            Asignamos tu encargo a un <strong>traductor jurado</strong> del
            idioma correspondiente. Cada traducción incluye firma, sello
            oficial y declaración jurada de veracidad, según los requisitos del
            Ministerio de Asuntos Exteriores de España.
          </p>
          <ul className="mt-2 space-y-1 list-disc pl-5 text-sm text-sepia">
            <li>
              Traducción realizada por un traductor jurado especialista en ese
              idioma y tipo de documento.
            </li>
            <li>
              Revisión final antes de la entrega para evitar errores y
              discrepancias entre el original y la traducción.
            </li>
          </ul>
        </div>

        {/* PASO 4 */}
        <div>
          <h2 className="text-xl font-semibold text-encre">
            4. Entrega oficial en PDF y/o en papel
          </h2>
          <p className="mt-2 text-sm text-sepia">
            Te enviamos la traducción jurada en{" "}
            <strong>PDF firmado digitalmente</strong>. Si el organismo donde vas
            a presentarla exige el original en papel, también podemos
            enviártela por mensajería.
          </p>
          <ul className="mt-2 space-y-1 list-disc pl-5 text-sm text-sepia">
            <li>PDF válido para la mayoría de trámites en España y la UE.</li>
            <li>Envío físico disponible a cualquier punto de España.</li>
            <li>
              Posibilidad de copias adicionales si las necesitas para varios
              expedientes (por ejemplo, extranjería y universidad).
            </li>
          </ul>
        </div>

        {/* PASO 5 */}
        <div>
          <h2 className="text-xl font-semibold text-encre">
            5. Legalización o apostilla de la traducción (cuando procede)
          </h2>
          <p className="mt-2 text-sm text-sepia">
            Si el trámite exige <strong>legalización o apostilla</strong>, la traducción jurada
            debe ir en papel, firmada y sellada en original. Un PDF (aunque esté firmado digitalmente)
            <strong> no se puede legalizar</strong>.
          </p>
          <ul className="mt-2 space-y-1 list-disc pl-5 text-sm text-sepia">
            <li>Legalizar o apostillar <strong>primero</strong> el documento original (si aplica).</li>
            <li>Traducción jurada del documento y de la apostilla.</li>
            <li>Si el organismo lo exige, legalización de la traducción en papel.</li>
          </ul>
          <p className="mt-2 text-sm text-sepia">
            Antes de empezar, confirma con el organismo receptor si admite PDF o requiere el original
            en papel con legalización/apostilla. Te orientamos en el orden correcto para evitar retrasos.
          </p>
          <p className="mt-2 text-sm text-sepia">
            Más info oficial:{" "}
            <a
              href="https://www.exteriores.gob.es/es/ServiciosAlCiudadano/Paginas/Legalizacion-y-apostilla.aspx"
              className="text-bleu underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              legalización y apostilla (MAEC)
            </a>
            .
          </p>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="mt-12 rounded-3xl border border-cream bg-cream/70 p-6 text-sm">
        <h2 className="text-lg font-semibold text-bleu">
          ¿Quieres saber cuánto costaría tu traducción jurada?
        </h2>
        <p className="mt-1 text-encre">
          Adjunta tu documento o envíanoslo por email o WhatsApp. Te
          responderemos con un <strong>precio cerrado</strong> y un{" "}
          <strong>plazo de entrega orientativo</strong> según el volumen y el
          idioma.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <a
            href="/presupuesto"
            className="rounded-2xl bg-bleu px-5 py-2 text-xs font-semibold text-white hover:bg-bleu-dark"
          >
            Rellenar el formulario de presupuesto
          </a>
          <a
            href={MAIL_LINK}
            className="text-xs font-medium text-bleu underline-offset-2 hover:underline"
          >
            Enviar los documentos por email
          </a>
          <a
            href={WHATSAPP_LINK}
            className="text-xs font-medium text-bleu underline-offset-2 hover:underline"
          >
            O enviar fotos por WhatsApp
          </a>
        </div>
        <p className="mt-2 text-[11px] text-sepia">
          Damos prioridad a las consultas por email y WhatsApp para poder
          revisar tus documentos con calma y ofrecerte un presupuesto ajustado,
          sobre todo en expedientes con varios documentos o idiomas.
        </p>
      </section>
    </main>
  );
}

