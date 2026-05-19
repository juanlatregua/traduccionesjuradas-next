---
description: Genera una landing SEO completa (page.tsx) para un servicio o tipo de documento de traducción jurada
---

# /seo-page

Genera una página de aterrizaje SEO completa para `app/<slug>/page.tsx`, lista para soltar en el repo y desplegar. Sigue el patrón visual, de metadata y de schema de las landings ya existentes en traduccionesjuradas.net.

> Equivalente al `/seo-fr` de HolaBonjour, adaptado a este proyecto: aquí no hay vertical FLE, las landings son sobre traducción jurada (idiomas, tipos de documento, trámites por país, ciudades).

## Uso

```
/seo-page <slug-kebab-case> "<tema en una frase>"
```

Ejemplos:
- `/seo-page traduccion-jurada-certificado-defuncion "Traducción jurada de certificados de defunción"`
- `/seo-page traductor-jurado-aleman-malaga "Traductor jurado de alemán en Málaga"`

Si el usuario solo pega el tema sin slug, propón 2-3 slugs y deja que elija.

## 1. Calibra el patrón

Antes de escribir, lee:

- **2 landings existentes del tipo más cercano** como referencia estructural y de tono:
  - Idioma → `app/traductor-jurado-frances/page.tsx`
  - Tipo de documento → una de `app/documentos-oficiales/*/page.tsx`
  - Trámite por país → una de `app/regularizacion-2026/*/page.tsx`
- **`app/sitemap.ts`** — para entender el sistema de prioridades y `LAST_MODIFIED`.
- Un componente `components/Schema*.tsx` — para ver cómo se emite el JSON-LD.

Observa: estructura hero → secciones → CTA, metadata (title/description/canonical/openGraph), y la paleta Tailwind del proyecto (`bleu`, `encre`, `sepia`, `cream`, `parchment` — clases nombradas; **no inventes hex**, copia las clases de las landings reales).

## 2. Comprueba que el slug está libre

```bash
ls "app/<slug>/" 2>/dev/null
```

Si existe ya, **detente**: *"Ya existe `app/<slug>/page.tsx`. ¿Reemplazar o usar otro slug?"*

Verifica también que el slug no choque con un redirect de `next.config.mjs`, una regla del `middleware.ts`, ni un nombre reservado (`api`, `admin`, `blog`, `zona-traductor`, `area-cliente`).

## 3. Genera el archivo completo

Crea `app/<slug>/page.tsx` con esta estructura:

```tsx
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "<H1 SEO en español, 50-65 chars> | Traducciones Juradas",
  description:
    "<155 chars máx, keyword principal en los primeros 60>",
  alternates: { canonical: "/<slug>" },
  openGraph: {
    title: "<variante del título>",
    description: "<variante de la description, 120-155 chars>",
    url: "https://www.traduccionesjuradas.net/<slug>",
    siteName: "Traducciones Juradas",
    locale: "es_ES",
    type: "website",
  },
};

export default function Page() {
  return (
    <main>
      {/* JSON-LD: usa el componente Schema correspondiente (Service / FAQPage /
          BreadcrumbList). DEBE renderizarse en SSR — <script type="application/ld+json">
          plano, NUNCA next/script con strategy="afterInteractive" (lección PR #66). */}

      {/* Hero */}

      {/* Secciones de contenido (4-6) */}

      {/* CTA final → enlaza al funnel: /start o /presupuesto-instantaneo */}
    </main>
  );
}
```

## 4. Reglas de contenido

- **Longitud**: 250-350 líneas, en el rango de las landings existentes.
- **Secciones**: 4-6 entre hero y CTA. Mínimo: hero, en qué consiste el servicio, proceso/plazos, CTA. Recomendado: FAQ (3-5 preguntas) con su `FAQPage` schema.
- **Audiencia**: particulares y empresas que necesitan una traducción jurada oficial.
- **Tono**: profesional, claro, tranquilizador. Explica los términos técnicos (apostilla, legalización, jurada).
- **Sin emojis. Sin hashtags.**
- **CTAs internos**: enlaza solo a rutas que existen. Las habituales: `/start`, `/presupuesto-instantaneo`, `/documentos-oficiales`, `/proceso`, `/contacto`. Verifica con `find app -name 'page.tsx'` si dudas. **No inventes URLs.**
- **Datos concretos** (precios, plazos, idiomas): usa los reales del proyecto. Si no los conoces con certeza, pon `{/* TODO: confirmar precio */}` en vez de inventar.
- **Regla YMYL**: cualquier afirmación sobre apostilla, La Haya, normativa o tasas debe ser verificable (HCCH/BOE/MAEC). Si no puedes verificarla, no la pongas como hecho — o añade un disclaimer.
- **JSON-LD**: emítelo en SSR. Tipos válidos: `Service` (servicio de traducción), `FAQPage` (si hay FAQ ≥3), `BreadcrumbList`.

## 5. Después de generar

- Reporta el archivo creado: `app/<slug>/page.tsx`.
- **Recuerda el sitemap**: avisa al usuario *"Añade `/<slug>` al objeto `LAST_MODIFIED` de `app/sitemap.ts`"* — no lo edites tú salvo que lo pida (el sitemap tiene lógica de prioridades manual).
- **Verifica que ningún redirect/middleware pise la nueva URL** — si el slug contiene "frances" o empieza por `traduccion-jurada-` / `traductor-jurado-`, comprueba `next.config.mjs` y `middleware.ts` y avisa si hay que añadir el slug a una allowlist.
- **No instales paquetes nuevos.** Reusa `components/` existentes.
- **No toques** `globals.css`, `tailwind.config.*`, `next.config.mjs` ni `middleware.ts` desde este comando. Si crees que hace falta, dilo como nota separada al final.

## 6. Comprobaciones obligatorias

Tras escribir el archivo:

- [ ] Exporta `metadata` y `default function Page()`.
- [ ] El `canonical` empieza con `/` (no URL completa).
- [ ] Todos los `<Link href="...">` apuntan a rutas que existen.
- [ ] El JSON-LD es JSON válido (sin comas finales) y se renderiza en SSR, no con `next/script`.
- [ ] No hay imports sin usar.
- [ ] La nueva URL no es capturada por ningún redirect de `next.config.mjs` ni por `middleware.ts`.
