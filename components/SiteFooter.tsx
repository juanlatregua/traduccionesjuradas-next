"use client";

// components/SiteFooter.tsx — Pie de página bilingüe. ES por defecto; FR compacto
// en las rutas francesas (useUiLang). Sustituye al <footer> del layout global.

import Link from "next/link";
import { useUiLang } from "@/lib/i18n/use-ui-lang";

export default function SiteFooter() {
  const lang = useUiLang();
  const year = new Date().getFullYear();

  if (lang === "fr") {
    return (
      <footer className="mt-16 bg-encre">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <div className="grid gap-8 sm:grid-cols-2">
            <div className="space-y-3">
              <p className="font-baskerville text-lg font-bold text-parchment">Traductions assermentées</p>
              <p className="text-xs tracking-[0.15em] text-cream/80">traduction officielle certifiée · espagne</p>
              <div className="space-y-1 text-xs text-cream/80">
                <p>HBTJ Consultores Lingüísticos S.L.</p>
                <p>Calle Esperanto, 9 · 29007 Málaga (Espagne)</p>
              </div>
              <div className="space-y-1 text-sm text-cream/80">
                <p>Email: <a href="mailto:hola@traduccionesjuradas.net" className="text-cream hover:text-or">hola@traduccionesjuradas.net</a></p>
                <p>Tél: <a href="tel:+34951333614" className="text-cream hover:text-or">+34 951 333 614</a></p>
              </div>
            </div>
            <div className="space-y-3">
              <p className="font-baskerville text-sm font-bold text-parchment">Liens</p>
              <div className="flex flex-col gap-2 text-sm text-cream/85">
                <Link href="/traduction-assermentee" className="hover:text-or" hrefLang="fr">Devis en ligne</Link>
                <Link href="/fr/acheter-bien-immobilier-espagne" className="hover:text-or" hrefLang="fr">Acheter un bien en Espagne</Link>
                <Link href="/fr/declaration-non-resident-espagne" className="hover:text-or" hrefLang="fr">Déclaration de non-résident</Link>
                <a href="https://wa.me/34951333614" className="hover:text-or" target="_blank" rel="noopener noreferrer">WhatsApp</a>
                <Link href="/area-cliente" className="hover:text-or">Espace client</Link>
                <Link href="/aviso-legal" className="hover:text-or">Mentions légales</Link>
              </div>
            </div>
          </div>
          <div className="mt-10 border-t border-cream/10 pt-8">
            <p className="font-caveat text-2xl text-cream/90">Juan Antonio Silva Moreno · Traducteur assermenté nº 3850 (MAEC)</p>
            <p className="mt-2 text-xs text-cream/70">© {year} HBTJ Consultores Lingüísticos S.L. · Tous droits réservés</p>
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer className="mt-16 bg-encre">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {/* Col 1 — Datos empresa */}
          <div className="space-y-3">
            <p className="font-baskerville text-lg font-bold text-parchment">traduccionesjuradas.net</p>
            <p className="text-xs tracking-[0.15em] text-cream/80">traducción oficial certificada · españa</p>
            <div className="space-y-1 text-xs text-cream/80">
              <p>HBTJ Consultores Lingüísticos S.L.</p>
              <p>Calle Esperanto, 9 · 29007 Málaga</p>
            </div>
            <div className="space-y-1 text-sm text-cream/80">
              <p>Email: <a href="mailto:hola@traduccionesjuradas.net" className="text-cream hover:text-or transition-colors">hola@traduccionesjuradas.net</a></p>
              <p>Tel: <a href="tel:+34951333614" className="text-cream hover:text-or transition-colors">951 333 614</a></p>
            </div>
          </div>
          {/* Col 2 — Links */}
          <div className="space-y-3">
            <p className="font-baskerville text-sm font-bold text-parchment">Enlaces</p>
            <div className="flex flex-col gap-2 text-sm text-cream/85">
              <Link href="/aviso-legal" className="hover:text-or transition-colors">Aviso legal</Link>
              <Link href="/privacidad" className="hover:text-or transition-colors">Privacidad</Link>
              <Link href="/politica-de-cookies" className="hover:text-or transition-colors">Cookies</Link>
              <Link href="/devoluciones" className="hover:text-or transition-colors">Devoluciones</Link>
              <Link href="/preguntas-frecuentes" className="hover:text-or transition-colors">Preguntas frecuentes</Link>
              <Link href="/como-escanear-bien" className="hover:text-or transition-colors">Cómo escanear bien</Link>
              <Link href="/expediente" className="font-semibold text-cream hover:text-or transition-colors">Subir expediente (4+ docs)</Link>
              <Link href="/traduction-assermentee" className="hover:text-or transition-colors" hrefLang="fr">Traduction assermentée (FR)</Link>
              <Link href="/traductor-jurado-frances" className="hover:text-or transition-colors">Traductor jurado de francés</Link>
              <Link href="/traduccion-jurada-frances-malaga" className="hover:text-or transition-colors">Traductor jurado de francés en Málaga</Link>
              <Link href="/traductor-jurado" className="hover:text-or transition-colors">Traductor jurado por ciudades</Link>
              <Link href="/traduccion-jurada-online" className="hover:text-or transition-colors">Traducción jurada online</Link>
              <Link href="/traduccion-jurada-permiso-de-conducir" className="hover:text-or transition-colors">Traducción jurada del permiso de conducir</Link>
              <Link href="/que-traducciones-necesito" className="hover:text-or transition-colors">¿Qué traducciones necesito?</Link>
              <Link href="/regularizacion-2026" className="font-semibold text-or hover:text-cream transition-colors">Regularización 2026 · 25 €/doc</Link>
            </div>
          </div>
          {/* Col 3 — Webs + Firma */}
          <div className="space-y-3 sm:col-span-2 lg:col-span-1">
            <p className="font-baskerville text-sm font-bold text-parchment">Nuestras webs</p>
            <div className="flex flex-col gap-2 text-sm text-cream/85">
              <a href="https://www.traduccionesjuradas.net" className="hover:text-or transition-colors">traduccionesjuradas.net</a>
              <a href="https://www.holabonjour.es" className="hover:text-or transition-colors">holabonjour.es</a>
            </div>
          </div>
        </div>
        <div className="mt-8 border-t border-cream/10 pt-6">
          <p className="font-baskerville text-sm font-bold text-parchment">Traductor jurado por idioma</p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-cream/85">
            {[
              ["frances", "Francés"],
              ["ingles", "Inglés"],
              ["aleman", "Alemán"],
              ["italiano", "Italiano"],
              ["portugues", "Portugués"],
              ["catalan", "Catalán"],
              ["neerlandes", "Neerlandés"],
              ["rumano", "Rumano"],
              ["sueco", "Sueco"],
              ["noruego", "Noruego"],
            ].map(([slug, label]) => (
              <Link key={slug} href={`/traductor-jurado-${slug}`} className="hover:text-or transition-colors">
                {label}
              </Link>
            ))}
          </div>
        </div>
        {/* Versiones del sitio en otros idiomas. Sin este bloque, las landings
            EN/DE/PT solo eran descubribles por el sitemap: cero enlaces internos
            y, por tanto, cero autoridad — el patrón clásico de "rastreada, no
            indexada". */}
        <div className="mt-8 border-t border-cream/10 pt-6">
          <p className="font-baskerville text-sm font-bold text-parchment">Este sitio en otros idiomas</p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-cream/85">
            {[
              ["/traduction-assermentee", "Français", "fr"],
              ["/sworn-translation", "English", "en"],
              ["/beglaubigte-uebersetzung", "Deutsch", "de"],
              ["/traducao-certificada", "Português", "pt"],
            ].map(([href, label, lang]) => (
              <Link key={href} href={href} hrefLang={lang} className="hover:text-or transition-colors">
                {label}
              </Link>
            ))}
          </div>
        </div>
        <div className="mt-10 border-t border-cream/10 pt-8">
          <p className="font-caveat text-2xl text-cream/90 animate-inkWrite">Juan Antonio Silva Moreno · Traductor jurado N.º 3850</p>
          <p className="mt-2 text-xs text-cream/70">© {year} HBTJ Consultores Lingüísticos S.L. · Todos los derechos reservados</p>
        </div>
      </div>
    </footer>
  );
}
