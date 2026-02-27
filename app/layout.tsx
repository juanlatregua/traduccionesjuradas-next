import type { Metadata, Viewport } from "next";
import { Inter, Merriweather } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { CookieBanner } from "@/components/CookieBanner";
import { Header } from "@/components/Header";
import WhatsAppFloat from "@/components/WhatsAppFloat";
import Link from "next/link";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const merriweather = Merriweather({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-merriweather",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.traduccionesjuradas.net"),
  title: {
    default: "Traducciones juradas oficiales online | traduccionesjuradas.net",
    template: "%s | traduccionesjuradas.net",
  },
  description:
    "Traducción jurada oficial para trámites en España y en el extranjero. Traductores jurados reales por especialidad e idioma, sin intermediarios opacos.",
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: "/brand/favicon.svg",
    shortcut: "/brand/favicon.svg",
    apple: "/brand/isotipo.svg",
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
    <html lang="es" className={`${inter.variable} ${merriweather.variable}`}>
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
          url: "https://www.traduccionesjuradas.net",
          description:
            "Traducción jurada oficial de francés y otros idiomas realizada por traductores jurados acreditados para trámites en España y en el extranjero.",
          telephone: "+34 951 333 614",
          email: "hola@traduccionesjuradas.net",
          image: "https://www.traduccionesjuradas.net/brand/logo-horizontal.svg",
          priceRange: "€€",
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

      <body className={`${inter.className} min-h-screen bg-slate-50 text-slate-900`}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-xl focus:bg-emerald-600 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
        >
          Saltar al contenido
        </a>

        <Header />

        {/* ================= CONTENIDO ================= */}
        <main id="main-content">
          {children}
        </main>

        {/* ================= WHATSAPP FLOTANTE ================= */}
        <WhatsAppFloat />

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
              <Link
                href="/traductor-jurado-frances"
                className="hover:text-emerald-600 hover:underline"
              >
                Traductor jurado de francés
              </Link>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
