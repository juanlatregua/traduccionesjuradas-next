---
description: Convierte un artículo SEO largo en hilos X, post LinkedIn, nota para clientes, intro newsletter y títulos alternativos
---

# /repurpose

Toma un artículo largo (post del blog, página de landing, documento) y genera 5 piezas de contenido derivadas en la voz de **Juan Silva Moreno**, traductor jurado de francés (HBTJ Consultores Lingüísticos, MAEC nº 3850). El objetivo es reusar un trabajo de 1.500 palabras en formatos cortos sin perder el tono ni el rigor.

## Uso

```
/repurpose <ruta-al-archivo>
```

Ejemplos:
- `/repurpose content/blog/documentos-marfilenos-espana.mdx`
- `/repurpose app/regularizacion-2026/marruecos/page.tsx`
- `/repurpose docs/borrador-nueva-pagina.md`

## 1. Lee la fuente

- Si es un `.mdx` del blog (Velite), úsalo tal cual (ignora el frontmatter).
- Si es un componente `page.tsx`, extrae solo el texto (ignora JSX, imports, componentes `Schema*`).
- Si es Markdown, úsalo directamente.
- Si la ruta contiene varios artículos, pide al usuario cuál antes de continuar.

## 2. Aprende la voz de Juan Silva

Antes de generar nada, lee **al menos 2 posts publicados** del blog (`content/blog/` o donde Velite los tenga) para calibrar la voz. Estilo clave:

- **Audiencia**: particulares con documentos oficiales (certificados civiles, académicos, penales) y empresas con documentación corporativa. Mucha gente en trámites de extranjería, estudios o nacionalidad.
- Tono **profesional, riguroso y tranquilizador** — el cliente suele estar estresado con un trámite y un plazo.
- **Trato de usted** moderado o neutro; claridad por encima de cercanía forzada. Sin tuteo coloquial.
- **Cero jerga innecesaria.** Explica "apostilla", "legalización consular", "traducción jurada" como si el lector no supiera la diferencia — porque normalmente no la sabe.
- Consejos **concretos y accionables** ("La apostilla se pone en el país que emitió el documento, no en España" > "Infórmate bien").
- **Autoridad real**: Juan Silva es traductor jurado nombrado por el MAEC. Puede afirmar con seguridad lo que sabe, pero **nunca inventa fechas, tasas ni normativa**.
- Sin emojis. Sin hashtags spam. Firma como **Juan Silva** o **HBTJ Consultores Lingüísticos**, nunca "el equipo".

## 3. Genera 5 piezas — formato exacto

```markdown
# /repurpose — <título del artículo original>
_Fuente: <ruta>_

## 1. Hilo para X (3 tuits, ≤280 chars cada uno)

**Tuit 1 (gancho):**
<texto>

**Tuit 2 (contenido):**
<texto>

**Tuit 3 (CTA o cierre):**
<texto>

## 2. Post LinkedIn (100-150 palabras)

<texto>

— Juan Silva Moreno
Traductor jurado de francés · MAEC nº 3850 · HBTJ Consultores Lingüísticos

## 3. Nota para clientes (WhatsApp / email corto, 60-90 palabras)

<texto claro y útil, como respuesta a una duda frecuente de un cliente real>

## 4. Intro newsletter (1 párrafo, 80-120 palabras)

<texto de apertura de newsletter; engancha y enlaza al artículo completo>

[Leer el artículo completo →](<URL del post si la conoces, si no: "[link]">)

## 5. Cinco títulos alternativos SEO

1. <título 1>
2. <título 2>
3. <título 3>
4. <título 4>
5. <título 5>
```

## 4. Reglas duras

- **Tuits**: cuenta los caracteres. Si te pasas, recorta. Sin "1/3" (la plataforma numera).
- **LinkedIn**: párrafos cortos con línea en blanco entre ellos. No empieces con "Me complace compartir...".
- **Nota para clientes**: tono de mensaje real, primera persona. "Si vas a apostillar un certificado marroquí, recuerda que..." funciona; "En HBTJ ofrecemos..." no.
- **Newsletter**: el CTA al final es un enlace inline, no un botón.
- **Títulos SEO**: cada uno con una keyword distinta; mezcla intención (cómo, qué, cuándo, cuánto cuesta, lista). Sin clickbait.
- **No inventes datos.** Si el artículo no menciona un porcentaje, una fecha de convenio, una tasa o un nombre, no lo añadas. Regla YMYL del proyecto: fechas/tasas/normativa solo si están verificadas en la fuente.
- **No menciones competidores** (agencias, otros traductores) salvo que aparezcan en el original.
- **No prometas plazos ni precios** que no estén en el artículo fuente.

## 5. Si el artículo es muy corto

Si la fuente tiene menos de 400 palabras, avisa antes: *"El texto fuente es corto (X palabras). Genero igual, pero LinkedIn y newsletter pueden quedar repetitivos. ¿Continúo?"*
