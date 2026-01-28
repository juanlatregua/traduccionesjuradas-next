import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import { CookieBanner } from "@/components/CookieBanner";
import { Header } from "@/components/Header";
import Link from "next/link";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.traduccionesjuradas.net"),
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#10b981",
};

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
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: "5.0",
            reviewCount: 4,
          },
          review: [
            {
              "@type": "Review",
              author: { "@type": "Person", name: "Gabriella Calderón" },
              reviewBody:
                "Servicio rápido y eficiente para documentos desde Brasil. Muy recomendables.",
              reviewRating: { "@type": "Rating", ratingValue: "5" },
            },
            {
              "@type": "Review",
              author: { "@type": "Person", name: "Nazarith Rodríguez" },
              reviewBody:
                "Amables y cumplen su trabajo a tiempo. Traducción jurada de inglés.",
              reviewRating: { "@type": "Rating", ratingValue: "5" },
            },
            {
              "@type": "Review",
              author: { "@type": "Person", name: "Jacob Malka" },
              reviewBody:
                "Excelente servicio de traducción. Profesional, puntual y a buen precio.",
              reviewRating: { "@type": "Rating", ratingValue: "5" },
            },
            {
              "@type": "Review",
              author: { "@type": "Person", name: "Carmina Martín" },
              reviewBody:
                "Envío rápido, precio razonable y cumplen su palabra. Muy recomendables.",
              reviewRating: { "@type": "Rating", ratingValue: "5" },
            },
          ],
          areaServed: {
            "@type": "Country",
            name: "España",
          },
          address: {
            "@type": "PostalAddress",
            addressCountry: "ES",
            addressLocality: "Málaga",
            streetAddress: "Calle Esperanto, 9",
            postalCode: "29007",
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
        <Header />

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
