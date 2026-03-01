import type { Metadata, Viewport } from "next";
import Script from "next/script";
import dynamic from "next/dynamic";
import "./globals.css";
import { CookieBanner } from "@/components/CookieBanner";
import { Header } from "@/components/Header";
import WhatsAppFloat from "@/components/WhatsAppFloat";
import Link from "next/link";
import { TrustStrip } from "@/components/TrustStrip";

const ChatWidget = dynamic(() => import("@/components/ChatWidget"), {
  ssr: false,
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
  themeColor: "#1E3A5F",
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

      <body className="min-h-screen bg-parchment text-sepia">
        <Header />
        <TrustStrip />

        {/* ================= CONTENIDO ================= */}
        {children}

        {/* ================= CHATBOT IA ================= */}
        <ChatWidget />

        {/* ================= WHATSAPP FLOTANTE ================= */}
        <WhatsAppFloat />

        {/* ================= BANNER COOKIES ================= */}
        <CookieBanner />

        {/* ================= FOOTER — EL PIE DE FIRMA ================= */}
        <footer className="mt-16 bg-encre">
          <div className="mx-auto max-w-6xl px-4 py-12">
            {/* Columnas */}
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {/* Col 1 — Datos empresa */}
              <div className="space-y-3">
                <p className="font-baskerville text-lg font-bold text-parchment">
                  traduccionesjuradas.net
                </p>
                <p className="text-sm text-cream/80">
                  Traducciones juradas oficiales online, válidas en España y en el
                  extranjero.
                </p>
                <div className="space-y-1 text-xs text-cream/60">
                  <p>HBTJ Consultores Lingüísticos S.L.</p>
                  <p>Calle Esperanto, 9 · 29007 Málaga</p>
                </div>
                <div className="space-y-1 text-sm text-cream/80">
                  <p>
                    Email:{" "}
                    <a
                      href="mailto:hola@traduccionesjuradas.net"
                      className="text-cream hover:text-or transition-colors"
                    >
                      hola@traduccionesjuradas.net
                    </a>
                  </p>
                  <p>
                    Tel:{" "}
                    <a
                      href="tel:+34951333614"
                      className="text-cream hover:text-or transition-colors"
                    >
                      951 333 614
                    </a>
                  </p>
                </div>
              </div>

              {/* Col 2 — Links */}
              <div className="space-y-3">
                <p className="font-baskerville text-sm font-bold text-parchment">
                  Enlaces
                </p>
                <div className="flex flex-col gap-2 text-sm text-cream/70">
                  <Link
                    href="/aviso-legal"
                    className="hover:text-or transition-colors"
                  >
                    Aviso legal
                  </Link>
                  <Link
                    href="/privacidad"
                    className="hover:text-or transition-colors"
                  >
                    Privacidad
                  </Link>
                  <Link
                    href="/politica-de-cookies"
                    className="hover:text-or transition-colors"
                  >
                    Cookies
                  </Link>
                  <Link
                    href="/preguntas-frecuentes"
                    className="hover:text-or transition-colors"
                  >
                    Preguntas frecuentes
                  </Link>
                  <Link
                    href="/traductor-jurado-frances"
                    className="hover:text-or transition-colors"
                  >
                    Traductor jurado de francés
                  </Link>
                </div>
              </div>

              {/* Col 3 — Webs + Firma */}
              <div className="space-y-3 sm:col-span-2 lg:col-span-1">
                <p className="font-baskerville text-sm font-bold text-parchment">
                  Nuestras webs
                </p>
                <div className="flex flex-col gap-2 text-sm text-cream/70">
                  <a
                    href="https://www.traduccionesjuradas.net"
                    className="hover:text-or transition-colors"
                  >
                    traduccionesjuradas.net
                  </a>
                  <a
                    href="https://www.holabonjour.es"
                    className="hover:text-or transition-colors"
                  >
                    holabonjour.es
                  </a>
                </div>
              </div>
            </div>

            {/* Separador */}
            <div className="mt-10 border-t border-cream/10 pt-8">
              {/* Firma manuscrita */}
              <p className="font-caveat text-2xl text-cream/90 animate-inkWrite">
                Juan Antonio Silva Moreno · Traductor jurado N.º 3850
              </p>
              <p className="mt-2 text-xs text-cream/40">
                © {new Date().getFullYear()} HBTJ Consultores Lingüísticos S.L.
                · Todos los derechos reservados
              </p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
