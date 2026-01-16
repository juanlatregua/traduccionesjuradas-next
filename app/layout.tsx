import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";
import "./globals.css";
import { CookieBanner } from "@/components/CookieBanner";

export const metadata: Metadata = {
  metadataBase: new URL("https://traduccionesjuradas.net"),
  title: {
    default:
      "Traducciones Juradas de Francés y otros idiomas | traduccionesjuradas.net",
    template: "%s | traduccionesjuradas.net",
  },
  description:
    "Traducción jurada oficial de francés y otros idiomas para trámites en España y en el extranjero. Traductores jurados reales, no intermediarios.",
  robots: {
    index: true,
    follow: true,
  },
};

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-500 shadow-md shadow-emerald-500/40">
        <span className="text-xs font-black tracking-tight text-white">
          TJ
        </span>
      </div>
      <div className="flex flex-col leading-tight">
        <span className="text-sm font-semibold text-slate-900">
          TraduccionesJuradas.Net
        </span>
        <span className="text-[11px] text-slate-500">
          Soluciones de Traducción Jurada
        </span>
      </div>
    </div>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      {/* SCHEMA ORG / PROFESSIONAL SERVICE */}
      <Script
        id="schema-organization"
        type="application/ld+json"
        strategy="afterInteractive"
      >
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "ProfessionalService",
          name: "TraduccionesJuradas.net",
          url: "https://traduccionesjuradas.net",
          description:
            "Traducción jurada oficial de francés y otros idiomas realizada por traductores jurados acreditados para trámites en España y en el extranjero.",
          telephone: "+34 951 333 614",
          email: "hola@traduccionesjuradas.net",
          areaServed: {
            "@type": "Country",
            name: "España",
          },
          address: {
            "@type": "PostalAddress",
            addressCountry: "ES",
            addressLocality: "Málaga",
          },
          serviceType: [
            "Traducción jurada de francés",
            "Traducción jurada de alemán",
            "Traducción jurada de inglés",
            "Traducción jurada de documentos oficiales",
          ],
        })}
      </Script>

      <body className="min-h-screen bg-slate-50 text-slate-900">
        {/* ================= HEADER ================= */}
        <header className="relative z-40 overflow-visible border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
            {/* LOGO */}
            <Link href="/" className="flex items-center gap-2">
              <Logo />
            </Link>

            {/* NAV */}
            <nav className="flex items-center gap-4 text-xs font-medium text-slate-700 sm:text-sm">
              {/* CÓMO FUNCIONA */}
              <Link href="/proceso" className="hover:text-emerald-600">
                Cómo funciona
              </Link>

              {/* ===== TRADUCTOR JURADO (DESPLEGABLE) ===== */}
              <div className="relative group">
                <button
                  type="button"
                  className="flex items-center gap-1 hover:text-emerald-600"
                >
                  <span>Traductor jurado</span>
                  <span className="text-[10px]">▼</span>
                </button>

                <div className="pointer-events-none absolute right-0 top-full w-72 rounded-2xl border border-slate-200 bg-white p-3 text-xs text-slate-700 shadow-lg opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100">
                  {/* Idiomas principales */}
                  <p className="mb-2 text-[11px] font-semibold text-slate-500">
                    Idiomas principales
                  </p>

                  <div className="space-y-1">
                    <Link
                      href="/traductor-jurado-frances"
                      className="block rounded-lg px-2 py-1 hover:bg-slate-50"
                    >
                      Traductor jurado de francés
                    </Link>
                    <Link
                      href="/traductor-jurado-aleman"
                      className="block rounded-lg px-2 py-1 hover:bg-slate-50"
                    >
                      Traductor jurado de alemán
                    </Link>
                    <Link
                      href="/traductor-jurado-ingles"
                      className="block rounded-lg px-2 py-1 hover:bg-slate-50"
                    >
                      Traductor jurado de inglés
                    </Link>
                  </div>

                  {/* Otros idiomas */}
                  <p className="mt-3 text-[11px] font-semibold text-slate-500">
                    Otros idiomas
                  </p>
                  <div className="mt-1 grid grid-cols-2 gap-1 text-[11px]">
                    <Link
                      href="/traductor-jurado-neerlandes"
                      className="rounded-lg px-2 py-1 hover:bg-slate-50"
                    >
                      Neerlandés
                    </Link>
                    <Link
                      href="/traductor-jurado-italiano"
                      className="rounded-lg px-2 py-1 hover:bg-slate-50"
                    >
                      Italiano
                    </Link>
                    <Link
                      href="/traductor-jurado-portugues"
                      className="rounded-lg px-2 py-1 hover:bg-slate-50"
                    >
                      Portugués
                    </Link>
                    <Link
                      href="/traductor-jurado-catalan"
                      className="rounded-lg px-2 py-1 hover:bg-slate-50"
                    >
                      Catalán
                    </Link>
                    <Link
                      href="/traductor-jurado-sueco"
                      className="rounded-lg px-2 py-1 hover:bg-slate-50"
                    >
                      Sueco
                    </Link>
                    <Link
                      href="/traductor-jurado-noruego"
                      className="rounded-lg px-2 py-1 hover:bg-slate-50"
                    >
                      Noruego
                    </Link>
                  </div>
                </div>
              </div>

              {/* ===== DOCUMENTOS OFICIALES (DESPLEGABLE) ===== */}
              <div className="relative group">
                <Link
                  href="/documentos-oficiales"
                  className="flex items-center gap-1 hover:text-emerald-600"
                >
                  <span>Documentos oficiales</span>
                  <span className="text-[10px]">▼</span>
                </Link>

                <div className="pointer-events-none absolute left-0 top-full w-72 rounded-2xl border border-slate-200 bg-white p-3 text-xs text-slate-700 shadow-lg opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100">
                  <p className="mb-2 text-[11px] font-semibold text-slate-500">
                    Más consultados
                  </p>

                  <div className="space-y-1">
                    <Link
                      href="/documentos-oficiales/certificados-registro-civil"
                      className="block rounded-lg px-2 py-1 hover:bg-slate-50"
                    >
                      Certificados del Registro Civil
                    </Link>
                    <Link
                      href="/documentos-oficiales/antecedentes-penales"
                      className="block rounded-lg px-2 py-1 hover:bg-slate-50"
                    >
                      Antecedentes penales
                    </Link>
                    <Link
                      href="/teletrabajo"
                      className="block rounded-lg px-2 py-1 hover:bg-slate-50"
                    >
                      Documentos para teletrabajar en España
                    </Link>
                    <Link
                      href="/documentos-oficiales/documentos-mercantiles"
                      className="block rounded-lg px-2 py-1 hover:bg-slate-50"
                    >
                      Documentos mercantiles y empresariales
                    </Link>
                  </div>

                  <p className="mt-3 text-[11px] text-slate-500">
                    Ver listado completo en{" "}
                    <Link
                      href="/documentos-oficiales"
                      className="font-semibold text-emerald-700 hover:underline"
                    >
                      Documentos oficiales
                    </Link>
                    .
                  </p>
                </div>
              </div>

              <Link
                href="/preguntas-frecuentes"
                className="hover:text-emerald-600"
              >
                Preguntas frecuentes
              </Link>

              <Link
                href="/precios-traduccion-jurada"
                className="hover:text-emerald-600"
              >
                Precios
              </Link>

              {/* CTA PRESUPUESTO */}
              <Link
                href="/presupuesto"
                className="rounded-2xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700"
              >
                Solicitar presupuesto
              </Link>
            </nav>
          </div>
        </header>

        {/* ================= CONTENIDO ================= */}
        {children}

        {/* ================= BANNER COOKIES ================= */}
        <CookieBanner />

        {/* ================= FOOTER ================= */}
        <footer className="mt-16 border-t border-slate-200 bg-white">
          <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 text-xs text-slate-600 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <p className="font-semibold text-slate-800">
                traduccionesjuradas.net
              </p>
              <p>Traducciones juradas oficiales online, válidas en España y en el extranjero.</p>
              <p>
                Email:{" "}
                <a
                  href="mailto:hola@traduccionesjuradas.net"
                  className="hover:underline"
                >
                  hola@traduccionesjuradas.net
                </a>{" "}
                · Tel:{" "}
                <a href="tel:+34951333614" className="hover:underline">
                  951 333 614
                </a>
              </p>
            </div>

            <div className="flex flex-wrap gap-4">
              <Link
                href="/aviso-legal"
                className="hover:text-emerald-600 hover:underline"
              >
                Aviso legal
              </Link>
              <Link
                href="/privacidad"
                className="hover:text-emerald-600 hover:underline"
              >
                Privacidad
              </Link>
              <Link
                href="/politica-de-cookies"
                className="hover:text-emerald-600 hover:underline"
              >
                Cookies
              </Link>
              <Link
                href="/preguntas-frecuentes"
                className="hover:text-emerald-600 hover:underline"
              >
                Preguntas frecuentes
              </Link>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}

