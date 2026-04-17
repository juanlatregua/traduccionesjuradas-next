import type { Metadata } from "next";
import Link from "next/link";
import { Smartphone, Printer, Search, FileCheck, AlertTriangle, Info } from "lucide-react";
import FlowMicroBanner from "@/components/FlowMicroBanner";

const CANONICAL = "https://www.traduccionesjuradas.net/como-escanear-bien";
const TITLE = "Cómo escanear un documento correctamente";
const DESCRIPTION =
  "Guía rápida para escanear documentos desde iPhone, Android o escáner de oficina. Cómo crear un PDF buscable que cualquier sistema pueda leer, para presentar en registros, solicitar traducciones juradas o archivar.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: CANONICAL },
  openGraph: {
    title: `${TITLE} | Guía móvil y escáner`,
    description: DESCRIPTION,
    url: CANONICAL,
    type: "article",
    images: [
      {
        url: "/api/og?title=C%C3%B3mo+escanear+bien&subtitle=Gu%C3%ADa+r%C3%A1pida+iPhone+Android+y+esc%C3%A1ner",
        width: 1200,
        height: 630,
        alt: `${TITLE} — TraduccionesJuradas.net`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: [
      "/api/og?title=C%C3%B3mo+escanear+bien&subtitle=Gu%C3%ADa+r%C3%A1pida+iPhone+Android+y+esc%C3%A1ner",
    ],
  },
};

const howToJsonLd = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: TITLE,
  description: DESCRIPTION,
  totalTime: "PT2M",
  step: [
    {
      "@type": "HowToStep",
      position: 1,
      name: "Escanear desde iPhone",
      text: "Instala Adobe Scan (gratis), apunta al documento, deja que detecte los bordes y guarda el PDF. Evita la app Notas: genera PDF de imagen sin texto buscable.",
      url: `${CANONICAL}#iphone`,
    },
    {
      "@type": "HowToStep",
      position: 2,
      name: "Escanear desde Android",
      text: "Abre Google Drive, pulsa + y elige Escanear. Google detecta bordes y guarda el PDF con texto buscable automáticamente.",
      url: `${CANONICAL}#android`,
    },
    {
      "@type": "HowToStep",
      position: 3,
      name: "Escanear desde un escáner de oficina",
      text: "En el software del escáner (Canon, HP, Epson, Brother) activa la opción 'PDF buscable', 'OCR' o 'Texto reconocible' antes de escanear. Si admite PDF/A, úsalo.",
      url: `${CANONICAL}#escaner`,
    },
  ],
};

export default function ComoEscanearBienPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }}
      />

      <FlowMicroBanner />

      <section className="mx-auto max-w-5xl px-4 py-10 sm:py-14">
        {/* Hero tutorial */}
        <header className="text-center mb-10 sm:mb-14">
          <h1 className="font-baskerville text-3xl sm:text-4xl md:text-5xl font-bold text-bleu leading-tight">
            {TITLE}
          </h1>
          <p className="mt-4 text-base sm:text-lg text-sepia max-w-2xl mx-auto">
            <strong className="text-sepia">2 minutos.</strong> Para que el
            presupuesto sea instantáneo y la traducción jurada te llegue en PDF
            firmado electrónicamente, válido ante registros y administraciones.
          </p>
        </header>

        {/* 3 tarjetas */}
        <section
          aria-label="Guías por dispositivo"
          className="grid gap-6 md:grid-cols-3 mb-14"
        >
          <TarjetaIPhone />
          <TarjetaAndroid />
          <TarjetaEscaner />
        </section>

        <ComoVerificar />
        <CallToAction />
      </section>
    </>
  );
}

function Card({
  id,
  icon,
  title,
  badge,
  children,
}: {
  id: string;
  icon: React.ReactNode;
  title: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <article
      id={id}
      className="rounded-xl border border-bleu/10 bg-card p-6 shadow-paper"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-bleu/10 text-bleu">
          {icon}
        </div>
        <h2 className="font-baskerville text-xl font-bold text-encre">
          {title}
        </h2>
      </div>
      {badge && (
        <p className="mb-3 inline-block rounded-full bg-vert/10 px-3 py-1 text-xs font-semibold text-vert">
          {badge}
        </p>
      )}
      <div className="text-sm text-sepia space-y-3 leading-relaxed">
        {children}
      </div>
    </article>
  );
}

function TarjetaIPhone() {
  return (
    <Card
      id="iphone"
      icon={<Smartphone className="h-5 w-5" />}
      title="iPhone"
      badge="Recomendado: Adobe Scan"
    >
      <p>
        <strong>Adobe Scan</strong> es gratuita y genera PDFs buscables
        automáticamente.
      </p>
      <ol className="list-decimal pl-5 space-y-1.5">
        <li>Descarga Adobe Scan desde la App Store.</li>
        <li>Ábrela y apunta la cámara al documento.</li>
        <li>
          La app detecta los bordes. Pulsa el disparador o espera la
          auto-captura.
        </li>
        <li>Al terminar pulsa «Guardar PDF».</li>
        <li>Súbelo a nuestra web.</li>
      </ol>
      <div className="flex items-start gap-2 rounded-lg bg-rouge/5 p-3 text-xs text-rouge">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
        <p>
          <strong>Evita la app Notas.</strong> Sus PDF parecen buenos pero son
          solo imágenes: Google, registros públicos y nuestras herramientas
          automáticas no pueden leer el texto.
        </p>
      </div>
      <p className="text-xs text-sepia">
        Alternativa válida: Microsoft Lens.
      </p>
    </Card>
  );
}

function TarjetaAndroid() {
  return (
    <Card
      id="android"
      icon={<Smartphone className="h-5 w-5" />}
      title="Android"
      badge="Recomendado: Google Drive"
    >
      <p>
        Google Drive ya está instalado en casi todos los Android y añade texto
        buscable automáticamente.
      </p>
      <ol className="list-decimal pl-5 space-y-1.5">
        <li>Abre la app Google Drive.</li>
        <li>
          Pulsa el botón <kbd className="rounded border border-bleu/20 bg-white px-1.5 py-0.5 text-xs">+</kbd>{" "}
          abajo a la derecha y elige «Escanear».
        </li>
        <li>Apunta al documento. La app captura automáticamente.</li>
        <li>Pulsa «Guardar». El PDF queda con texto buscable incluido.</li>
        <li>Descárgalo y súbelo a nuestra web.</li>
      </ol>
      <p className="text-xs text-sepia">
        Alternativa válida: Samsung Notes o la app nativa Samsung Scan.
      </p>
    </Card>
  );
}

function TarjetaEscaner() {
  return (
    <Card
      id="escaner"
      icon={<Printer className="h-5 w-5" />}
      title="Escáner de oficina"
      badge="Activa OCR en el driver"
    >
      <p>
        En el software de tu escáner busca la opción{" "}
        <strong>«PDF buscable»</strong>, <strong>«OCR»</strong> o{" "}
        <strong>«Texto reconocible»</strong> antes de escanear.
      </p>
      <ul className="space-y-1.5">
        <li>
          <strong>Canon</strong> (IJ Scan Utility / ScanGear): «PDF (Compacto)»
          o «PDF (Texto reconocible)».
        </li>
        <li>
          <strong>HP</strong> (HP Smart): «Guardar como → PDF → Texto
          reconocible».
        </li>
        <li>
          <strong>Epson</strong> (Epson Scan 2): «Opciones de imagen → Añadir
          texto reconocible al PDF».
        </li>
        <li>
          <strong>Brother / Ricoh</strong>: busca «searchable PDF» en el menú
          del driver.
        </li>
      </ul>
      <div className="flex items-start gap-2 rounded-lg bg-or/10 p-3 text-xs text-sepia">
        <Info className="h-4 w-4 shrink-0 mt-0.5 text-or-dark" aria-hidden="true" />
        <p>
          Si tu escáner permite <strong>PDF/A</strong>, úsalo. Es el formato
          archivístico que prefieren los registros públicos.
        </p>
      </div>
    </Card>
  );
}

function ComoVerificar() {
  const checks = [
    {
      icon: <Search className="h-5 w-5 text-vert" aria-hidden="true" />,
      text: (
        <>
          <strong>Selecciona texto con el cursor</strong> en el PDF. Si puedes
          marcar palabras → está bien.
        </>
      ),
    },
    {
      icon: <FileCheck className="h-5 w-5 text-vert" aria-hidden="true" />,
      text: (
        <>
          <strong>Pulsa Ctrl+F</strong> (o Cmd+F) y busca una palabra que veas
          en el documento. Si la encuentra → está bien.
        </>
      ),
    },
    {
      icon: <AlertTriangle className="h-5 w-5 text-rouge" aria-hidden="true" />,
      text: (
        <>
          <strong>Si no puedes hacer nada de eso</strong> → tu PDF es una
          imagen. Vuelve a escanear con las apps de arriba.
        </>
      ),
    },
  ];

  return (
    <section
      aria-labelledby="como-verificar-title"
      className="rounded-xl border border-bleu/10 bg-cream/50 p-6 sm:p-8 mb-14"
    >
      <h2
        id="como-verificar-title"
        className="font-baskerville text-2xl font-bold text-encre mb-4"
      >
        Cómo saber si tu PDF está bien
      </h2>
      <ul className="space-y-3">
        {checks.map((c, i) => (
          <li key={i} className="flex items-start gap-3 text-sm text-sepia">
            <span className="mt-0.5 shrink-0">{c.icon}</span>
            <span className="leading-relaxed">{c.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CallToAction() {
  return (
    <div className="text-center">
      <p className="text-base sm:text-lg text-sepia mb-4">
        ¿Listo? Sube tu PDF y recibe presupuesto automático en segundos.
      </p>
      <Link
        href="/presupuesto-instantaneo"
        className="inline-flex items-center justify-center rounded-xl bg-bleu px-6 py-3 text-sm sm:text-base font-semibold text-parchment shadow-paper transition-colors hover:bg-bleu-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-or"
      >
        Ir al presupuesto instantáneo
      </Link>
    </div>
  );
}
