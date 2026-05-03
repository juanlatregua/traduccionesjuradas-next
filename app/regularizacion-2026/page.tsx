import type { Metadata } from "next";
import Link from "next/link";
import { SchemaService } from "@/components/SchemaService";
import { SchemaBreadcrumbs } from "@/components/SchemaBreadcrumbs";
import { SchemaFAQ } from "@/components/SchemaFAQ";
import { WHATSAPP_LINK } from "@/lib/contact";

export const metadata: Metadata = {
  title:
    "Regularización Extraordinaria 2026 · Traducción jurada de francés · MAEC nº 3850",
  description:
    "Plazo hasta 30-junio-2026 (RD 316/2026). Traducción jurada francés-español de antecedentes penales y documentos de Marruecos, Senegal, Costa de Marfil, Mali, Guinea y otros países africanos francófonos. MAEC nº 3850.",
  alternates: {
    canonical: "https://www.traduccionesjuradas.net/regularizacion-2026",
  },
};

const FAQ_ITEMS = [
  {
    question: "¿Hasta cuándo puedo presentar la solicitud?",
    answer:
      "El plazo es improrrogable hasta el 30 de junio de 2026 (Real Decreto 316/2026, BOE-A-2026-8284). Las solicitudes telemáticas se abrieron el 16 de abril de 2026 y las presenciales el 20 de abril.",
  },
  {
    question: "¿Qué documentos del país de origen necesitan traducción jurada?",
    answer:
      "Como mínimo el certificado de antecedentes penales del país de origen y de cualquier país donde haya residido en los últimos cinco años. Según la vía y la situación familiar también pueden exigirse acta de nacimiento, certificado de matrimonio y libro de familia. Todos los documentos en idioma distinto al español deben ir traducidos por traductor jurado nombrado por el MAEC.",
  },
  {
    question: "¿El certificado de antecedentes penales tiene fecha de caducidad?",
    answer:
      "Sí. La práctica administrativa exige que tenga menos de tres meses desde su emisión para ser presentado. Si tu expediente tarda en resolverse y caducan, hay que volver a pedirlos y traducirlos. Por eso conviene no apostillar y traducir hasta tener la cita confirmada.",
  },
  {
    question: "¿Necesito apostilla o legalización consular?",
    answer:
      "Depende del país emisor. Marruecos (desde 14-08-2016), Senegal (desde 23-03-2023), Túnez (desde 30-03-2018) y Brasil aplican Apostilla de La Haya. Argelia se adhirió en 2025 con entrada en vigor el 09-07-2026, por lo que hoy todavía requiere legalización consular. Verifica siempre con la Subdelegación o el consulado.",
  },
  {
    question: "¿Qué pasa si las autoridades de mi país no me entregan los antecedentes?",
    answer:
      "El reglamento prevé que si pasado un mes desde la solicitud no se han recibido, la Unidad de Tramitación de Extranjería los reclamará por vía diplomática. Conserva el justificante de solicitud y aporta declaración responsable.",
  },
  {
    question: "¿Cuánto cuesta traducir mis documentos para la regularización?",
    answer:
      "25 € por documento (tarifa especial regularización 2026, francés). Aplica a antecedentes penales, acta de nacimiento y acta de matrimonio de Marruecos, Senegal, Costa de Marfil, Mali, Guinea, Camerún, Burkina Faso, Togo, Benín, RD Congo. Entrega 24h en PDF firmado digitalmente. Pago con Bizum, tarjeta, PayPal o transferencia.",
  },
];

export default function Regularizacion2026Page() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 lg:py-12">
      <SchemaService
        id="service-regularizacion-2026"
        serviceName="Traducción jurada para la regularización extraordinaria 2026"
        serviceDescription="Traducción jurada oficial de antecedentes penales y documentos del país de origen para la regularización extraordinaria abierta por el RD 316/2026, hasta el 30 de junio de 2026."
        serviceUrl="https://www.traduccionesjuradas.net/regularizacion-2026"
        brand={{ "@type": "Brand", name: "HBTJ Consultores Lingüísticos" }}
        provider={{
          "@type": "Person",
          name: "Juan Silva Moreno",
          jobTitle: "Traductor Jurado Oficial MAEC nº 3850",
        }}
      />
      <SchemaBreadcrumbs
        id="breadcrumbs-regularizacion-2026"
        items={[
          { name: "Inicio", url: "https://www.traduccionesjuradas.net/" },
          {
            name: "Regularización extraordinaria 2026",
            url: "https://www.traduccionesjuradas.net/regularizacion-2026",
          },
        ]}
      />
      <SchemaFAQ id="faq-regularizacion-2026" items={FAQ_ITEMS} />

      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-bleu">
          Regularización extraordinaria · plazo hasta 30-junio-2026
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-encre sm:text-4xl">
          Traducción jurada para la regularización extraordinaria 2026
        </h1>
        <p className="mt-3 text-sm text-sepia sm:text-base">
          El{" "}
          <a
            href="https://www.boe.es/buscar/doc.php?id=BOE-A-2026-8284"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-bleu hover:underline"
          >
            Real Decreto 316/2026
          </a>{" "}
          (BOE 15-abr-2026) ha abierto dos vías extraordinarias de regularización
          que finalizan el <strong>30 de junio de 2026</strong>. Ambas exigen
          traducción jurada del certificado de antecedentes penales del país de
          origen y, según el caso, otros documentos civiles. Estamos
          especializados en la traducción jurada francés-español de documentos
          de Marruecos, Senegal, Costa de Marfil, Mali, Guinea y otros países
          africanos francófonos, firmada por traductor jurado oficial MAEC nº
          3850.
        </p>
      </header>

      <section className="mt-8 rounded-2xl border border-bleu/30 bg-bleu/5 p-5 text-sm text-encre">
        <h2 className="text-lg font-semibold text-bleu">Plazo improrrogable</h2>
        <ul className="mt-2 space-y-1 text-sepia">
          <li>
            <strong>16-abr-2026:</strong> apertura de solicitudes telemáticas.
          </li>
          <li>
            <strong>20-abr-2026:</strong> apertura de citas presenciales.
          </li>
          <li>
            <strong>30-jun-2026:</strong> cierre del plazo (improrrogable).
          </li>
          <li>
            <strong>3 meses:</strong> plazo de resolución; el silencio es
            negativo.
          </li>
        </ul>
        <p className="mt-3 text-xs text-sepia">
          Fuente: RD 316/2026 (BOE-A-2026-8284), disposiciones adicionales
          vigésima y vigesimoprimera del Reglamento de Extranjería.
        </p>
      </section>

      <section className="mt-10 space-y-4 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          Las dos vías abiertas hasta el 30 de junio
        </h2>
        <div className="space-y-4">
          <article className="rounded-2xl border border-cream bg-card p-5">
            <h3 className="text-base font-semibold text-encre">
              Vía 1 · Arraigo extraordinario (DA 21ª)
            </h3>
            <p className="mt-2">
              Para personas extranjeras que se encuentren en España{" "}
              <strong>antes del 1 de enero de 2026</strong> y acrediten al menos
              uno de estos supuestos:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                Relación laboral de al menos 90 días dentro de los 12 meses
                anteriores.
              </li>
              <li>Convivencia con menores a cargo (familia con menores).</li>
              <li>
                Situación de vulnerabilidad acreditada por servicios sociales.
              </li>
            </ul>
          </article>
          <article className="rounded-2xl border border-cream bg-card p-5">
            <h3 className="text-base font-semibold text-encre">
              Vía 2 · Solicitantes de protección internacional (DA 20ª)
            </h3>
            <p className="mt-2">
              Para quienes presentaron solicitud de protección internacional{" "}
              <strong>antes del 1 de enero de 2026</strong> y acrediten:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Permanencia continuada en España de al menos 5 meses.</li>
              <li>
                Resolución firme denegatoria o archivo del expediente de
                protección.
              </li>
            </ul>
          </article>
        </div>
        <p className="text-xs">
          Ambas vías permiten obtener autorización provisional de trabajo desde
          la comunicación de inicio del expediente, sin esperar a la resolución
          definitiva.
        </p>
      </section>

      <section className="mt-10 space-y-4 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          Documentos del país de origen que necesitan traducción jurada
        </h2>
        <p>
          La documentación exacta varía según la Subdelegación del Gobierno y la
          situación personal, pero los documentos extranjeros que casi siempre
          se exigen son:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Certificado de antecedentes penales</strong> del país de
            origen <em>y</em> de cualquier país donde se haya residido en los
            últimos 5 años antes de entrar en España (artículo 130 RD 1155/2024
            y disposiciones adicionales del RD 316/2026).
          </li>
          <li>
            <strong>Acta de nacimiento</strong> (extrait d&apos;acte de naissance,
            partida de nacimiento) cuando se acredite filiación con menores o
            cónyuge.
          </li>
          <li>
            <strong>Certificado de matrimonio</strong> o libro de familia si se
            invoca arraigo familiar.
          </li>
          <li>
            <strong>Pasaporte</strong> (vigente o caducado) — no requiere
            traducción si está en alfabeto latino.
          </li>
        </ul>
        <p className="text-xs">
          Todos los documentos en idioma distinto al español deben presentarse
          con traducción jurada firmada por traductor habilitado por el
          Ministerio de Asuntos Exteriores y de Cooperación (MAEC).
        </p>
      </section>

      <section className="mt-10 space-y-4 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          Antecedentes penales: el cuello de botella del expediente
        </h2>
        <p>
          El certificado de antecedentes penales es el documento que más retrasa
          los expedientes de regularización. Tres motivos:
        </p>
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            <strong>Validez corta.</strong> La administración exige que tenga
            menos de 3 meses desde su emisión.
          </li>
          <li>
            <strong>Apostilla previa.</strong> Para países firmantes del Convenio
            de La Haya hay que apostillar antes de traducir.
          </li>
          <li>
            <strong>Lookback de 5 años.</strong> Si has residido en varios
            países en los últimos 5 años, necesitas un certificado de cada uno.
          </li>
        </ol>
        <p>
          Por eso recomendamos coordinar la apostilla y la traducción jurada
          cuando ya tengas la cita confirmada o el expediente en marcha. Si los
          tradujiste demasiado pronto y caducan, hay que repetir todo el ciclo.
        </p>
      </section>

      <section className="mt-10 space-y-4 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          Países francófonos cubiertos · entrega 24-48h
        </h2>
        <p>
          Como traductor jurado oficial de francés (MAEC nº 3850), traducimos
          directamente sin intermediarios todos los documentos en francés. Este
          es el flujo más rápido y económico para los expedientes de la
          regularización 2026:
        </p>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <li>
            <Link
              href="/regularizacion-2026/marruecos"
              className="font-semibold text-bleu hover:underline"
            >
              Marruecos →
            </Link>{" "}
            <span className="text-xs">
              casier judiciaire bulletin nº 3, apostille.ma
            </span>
          </li>
          <li>
            <Link
              href="/regularizacion-2026/senegal"
              className="font-semibold text-bleu hover:underline"
            >
              Senegal →
            </Link>{" "}
            <span className="text-xs">
              casier judiciaire, Hague desde 23-03-2023
            </span>
          </li>
          <li>
            <Link
              href="/regularizacion-2026/costa-de-marfil"
              className="font-semibold text-bleu hover:underline"
            >
              Costa de Marfil →
            </Link>{" "}
            <span className="text-xs">
              Bulletin nº 3, e-justice.ci, legalización consular
            </span>
          </li>
          <li>
            <Link
              href="/regularizacion-2026/mali"
              className="font-semibold text-bleu hover:underline"
            >
              Mali →
            </Link>{" "}
            <span className="text-xs">
              casier judiciaire, legalización consular
            </span>
          </li>
          <li>
            <Link
              href="/regularizacion-2026/guinea"
              className="font-semibold text-bleu hover:underline"
            >
              Guinea-Conakry →
            </Link>{" "}
            <span className="text-xs">
              casier judiciaire, legalización consular
            </span>
          </li>
          <li>
            <Link
              href="/regularizacion-2026/camerun"
              className="font-semibold text-bleu hover:underline"
            >
              Camerún →
            </Link>{" "}
            <span className="text-xs">
              Bulletin nº 3 (francés), legalización consular
            </span>
          </li>
          <li>
            <span className="font-semibold text-encre">
              Burkina Faso, Togo, Benín, RD Congo
            </span>{" "}
            <span className="text-xs">— mismo flujo francés-español, consultar</span>
          </li>
          <li>
            <span className="font-semibold text-encre">Argelia</span>{" "}
            <span className="text-xs">
              — Hague en vigor 09-07-2026; hoy aún requiere legalización
              consular
            </span>
          </li>
        </ul>
        <p className="text-xs">
          Para documentos exclusivamente en árabe trabajamos con colaborador
          jurado externo, con plazos y precios distintos al flujo automatizado
          francés. Si tu documento está en versión bilingüe árabe/francés
          (habitual en Marruecos), traducimos del francés directamente: es el
          camino más rápido y económico.
        </p>
      </section>

      <section className="mt-10 rounded-2xl border border-cream bg-card p-5 text-sm text-encre shadow-sm">
        <h2 className="text-lg font-semibold text-encre">
          Tarifa regularización 2026 · 25 € por documento
        </h2>
        <p className="mt-2 text-sepia">
          Tarifa especial para expedientes de regularización extraordinaria
          2026 de países francófonos. Documentos legibles (PDF o foto). Firma y
          sello de traductor jurado MAEC nº 3850.
        </p>
        <ul className="mt-3 space-y-2 text-sepia">
          <li>
            <strong>Antecedentes penales (francés):</strong> 25 € — entrega 24h
          </li>
          <li>
            <strong>Acta de nacimiento (francés / bilingüe árabe-francés):</strong>{" "}
            25 € — entrega 24h
          </li>
          <li>
            <strong>Acta de matrimonio (francés):</strong> 25 € — entrega 24-48h
          </li>
          <li>
            <strong>Pack expediente</strong> (varios documentos): mismo precio
            unitario, sin recargo
          </li>
        </ul>
        <p className="mt-3 text-xs">
          Entrega en PDF firmado digitalmente <strong>incluida</strong>. Envío
          del original en papel por mensajería: a coste de mensajería. Apostilla
          o sellos consulares del documento original: traducimos sin coste
          adicional.
        </p>
      </section>

      <section className="mt-6 rounded-2xl border border-bleu/30 bg-bleu/5 p-5 text-sm text-encre">
        <h2 className="text-lg font-semibold text-bleu">
          Pago fácil: Bizum, tarjeta o transferencia
        </h2>
        <p className="mt-2 text-sepia">
          Aceptamos pago con <strong>Bizum</strong>, tarjeta (Stripe / Redsys),
          PayPal o transferencia bancaria. Recibo electrónico inmediato.
          Empezamos a tramitar en cuanto recibimos el pago.
        </p>
      </section>

      <section className="mt-12 rounded-2xl border border-cream bg-cream p-6 text-sm">
        <h2 className="text-lg font-semibold text-bleu">
          Sube tus documentos y obtén presupuesto en minutos
        </h2>
        <p className="mt-1 text-encre">
          Adjunta el certificado de antecedentes penales (apostillado o no), el
          acta de nacimiento y cualquier otro documento del país de origen. Te
          respondemos con un precio cerrado y un plazo de entrega realista
          adaptado a tu cita en Extranjería.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link
            href="/presupuesto-instantaneo"
            className="rounded-2xl bg-bleu px-5 py-2 text-xs font-semibold text-white hover:bg-bleu-dark"
          >
            Solicitar presupuesto
          </Link>
          <a
            href={WHATSAPP_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-bleu underline-offset-2 hover:underline"
          >
            Consultar por WhatsApp
          </a>
        </div>
      </section>

      <p className="mt-6 text-xs text-sepia">
        Ver también:{" "}
        <Link
          href="/traduccion-jurada-antecedentes-penales"
          className="font-semibold text-bleu hover:underline"
        >
          Traducción jurada de antecedentes penales
        </Link>
        {" · "}
        <Link
          href="/marruecos"
          className="font-semibold text-bleu hover:underline"
        >
          Documentos marroquíes
        </Link>
        {" · "}
        <Link
          href="/blog/residencia-permanente-espana-documentos"
          className="font-semibold text-bleu hover:underline"
        >
          Residencia permanente
        </Link>
      </p>

      <section className="mt-10 rounded-2xl border border-sepia/20 bg-parchment p-4 text-xs text-sepia">
        <p>
          <strong>Aviso legal.</strong> Esta página tiene carácter informativo y
          se basa en la lectura del Real Decreto 316/2026 (BOE-A-2026-8284) y
          del Reglamento de Extranjería (RD 1155/2024). No constituye
          asesoramiento jurídico. Para la tramitación del expediente,
          recomendamos consultar con un abogado de extranjería o con su
          Subdelegación del Gobierno. La información sobre plazos, validez de
          documentos y vías de regularización puede ser modificada por
          instrucciones de la Secretaría de Estado de Migraciones; verifica
          siempre la última versión antes de presentar la solicitud.
        </p>
      </section>
    </main>
  );
}
