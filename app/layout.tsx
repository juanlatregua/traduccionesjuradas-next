import type { Metadata, Viewport } from "next";
import { Inter, Merriweather } from "next/font/google";
import Script from "next/script";
import dynamic from "next/dynamic";
import "./globals.css";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { CookieBanner } from "@/components/CookieBanner";
import { Header } from "@/components/Header";
import SiteFooter from "@/components/SiteFooter";
import SiteTopBars from "@/components/SiteTopBars";
import { SITE_SEARCH_INDEX } from "@/lib/search/site-index";
import WhatsAppFloat from "@/components/WhatsAppFloat";
import { OfflineBanner } from "@/components/OfflineBanner";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

const ChatWidget = dynamic(() => import("@/components/ChatWidget"), {
  ssr: false,
});

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
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "TJ Juradas",
  },
  icons: {
    icon: "/brand/favicon.svg",
    shortcut: "/brand/favicon.svg",
    apple: "/icons/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    locale: "es_ES",
    siteName: "TraduccionesJuradas.net",
    title: "Traducciones juradas oficiales online",
    description:
      "Traducción jurada oficial para trámites en España y en el extranjero. Precio cerrado al instante. Traductor jurado N.º 3850.",
    url: "https://www.traduccionesjuradas.net",
    images: [
      {
        url: "https://www.traduccionesjuradas.net/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "TraduccionesJuradas.net — Traducciones juradas oficiales online",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Traducciones juradas oficiales online",
    description:
      "Traducción jurada oficial para trámites en España y en el extranjero. Precio cerrado al instante.",
    images: ["https://www.traduccionesjuradas.net/opengraph-image.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#B8922A",
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
          "@id": "https://www.traduccionesjuradas.net/#organization",
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
          hasOfferCatalog: {
            "@type": "OfferCatalog",
            name: "Traducciones juradas por idioma",
            itemListElement: [
              {
                "@type": "Offer",
                itemOffered: {
                  "@type": "Service",
                  name: "Traducción jurada de francés",
                  url: "https://www.traduccionesjuradas.net/traductor-jurado-frances",
                  provider: { "@id": "https://www.traduccionesjuradas.net/#organization" },
                },
              },
              {
                "@type": "Offer",
                itemOffered: {
                  "@type": "Service",
                  name: "Traducción jurada de inglés",
                  url: "https://www.traduccionesjuradas.net/traductor-jurado-ingles",
                  provider: { "@id": "https://www.traduccionesjuradas.net/#organization" },
                },
              },
              {
                "@type": "Offer",
                itemOffered: {
                  "@type": "Service",
                  name: "Traducción jurada de alemán",
                  url: "https://www.traduccionesjuradas.net/traductor-jurado-aleman",
                  provider: { "@id": "https://www.traduccionesjuradas.net/#organization" },
                },
              },
              {
                "@type": "Offer",
                itemOffered: {
                  "@type": "Service",
                  name: "Traducción jurada de portugués",
                  url: "https://www.traduccionesjuradas.net/traductor-jurado-portugues",
                  provider: { "@id": "https://www.traduccionesjuradas.net/#organization" },
                },
              },
              {
                "@type": "Offer",
                itemOffered: {
                  "@type": "Service",
                  name: "Traducción jurada de italiano",
                  url: "https://www.traduccionesjuradas.net/traductor-jurado-italiano",
                  provider: { "@id": "https://www.traduccionesjuradas.net/#organization" },
                },
              },
              {
                "@type": "Offer",
                itemOffered: {
                  "@type": "Service",
                  name: "Traducción jurada de neerlandés",
                  url: "https://www.traduccionesjuradas.net/traductor-jurado-neerlandes",
                  provider: { "@id": "https://www.traduccionesjuradas.net/#organization" },
                },
              },
              {
                "@type": "Offer",
                itemOffered: {
                  "@type": "Service",
                  name: "Traducción jurada de catalán",
                  url: "https://www.traduccionesjuradas.net/traductor-jurado-catalan",
                  provider: { "@id": "https://www.traduccionesjuradas.net/#organization" },
                },
              },
              {
                "@type": "Offer",
                itemOffered: {
                  "@type": "Service",
                  name: "Traducción jurada de rumano",
                  url: "https://www.traduccionesjuradas.net/traductor-jurado-rumano",
                  provider: { "@id": "https://www.traduccionesjuradas.net/#organization" },
                },
              },
              {
                "@type": "Offer",
                itemOffered: {
                  "@type": "Service",
                  name: "Traducción jurada de sueco",
                  url: "https://www.traduccionesjuradas.net/traductor-jurado-sueco",
                  provider: { "@id": "https://www.traduccionesjuradas.net/#organization" },
                },
              },
              {
                "@type": "Offer",
                itemOffered: {
                  "@type": "Service",
                  name: "Traducción jurada de noruego",
                  url: "https://www.traduccionesjuradas.net/traductor-jurado-noruego",
                  provider: { "@id": "https://www.traduccionesjuradas.net/#organization" },
                },
              },
            ],
          },
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: "4.8",
            bestRating: "5",
            ratingCount: "46",
          },
        })}
      </Script>

      {/* SCHEMA ORG / WEBSITE + SEARCH ACTION */}
      <Script
        id="schema-website"
        type="application/ld+json"
        strategy="afterInteractive"
      >
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "TraduccionesJuradas.net",
          url: "https://www.traduccionesjuradas.net",
          potentialAction: {
            "@type": "SearchAction",
            target: "https://www.traduccionesjuradas.net/buscar?q={search_term_string}",
            "query-input": "required name=search_term_string",
          },
        })}
      </Script>

      <body className="min-h-screen bg-parchment text-sepia">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-xl focus:bg-bleu focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
        >
          Saltar al contenido
        </a>

        <Header searchIndex={SITE_SEARCH_INDEX} />
        <SiteTopBars />

        {/* ================= CONTENIDO ================= */}
        <main id="main-content">
          {children}
        </main>

        {/* ================= CHATBOT IA ================= */}
        <ChatWidget />

        {/* ================= WHATSAPP FLOTANTE ================= */}
        <WhatsAppFloat />

        {/* ================= BANNER COOKIES ================= */}
        <CookieBanner />

        {/* ================= OFFLINE BANNER ================= */}
        <OfflineBanner />

        {/* ================= PWA (service worker) ================= */}
        <ServiceWorkerRegister />

        {/* ================= ANALYTICS ================= */}
        <Analytics />
        <SpeedInsights />

        {/* ================= FOOTER — EL PIE DE FIRMA (bilingüe) ================= */}
        <SiteFooter />
      </body>
    </html>
  );
}
