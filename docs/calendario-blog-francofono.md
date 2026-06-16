# Calendario editorial — blog francófono

> Motor real de tráfico de traduccionesjuradas.net. Cadencia objetivo: **2 artículos/semana** (~6-8 semanas).
> Creado 2026-06-16. Todos los borradores nacen con `published: false` y NO se publican sin revisión humana (regla YMYL).
>
> Plantilla canónica: `content/blog/documentos-marroquies-guia-completa.mdx`.
> Frontmatter válido (Velite): `velite.config.ts:8-23` → `title`(≤120), `description`(≤300), `date`, `dateModified?`, `category`('tramites'|'paises'|'faq'|'profesion'), `keywords[]`, `faq[]` ({question,answer}), `published`.
> El `faq[]` genera FAQPage server-side (`app/blog/[slug]/page.tsx:123-125`). El Article schema con autor MAEC nº 3850 ya es server-side (`app/blog/[slug]/page.tsx:80-121`).

## Principio de priorización

1. **Francés DIRECTO** = la oportunidad histórica. `/traductor-jurado-frances` está en pos ~67 con ~380 impr y 0 clics. Necesita masa de contenido francófono que lo enlace con anchor exact-match y que capture la *query del francés en Francia/España que hace un trámite*.
2. **Magreb francófono ya cubierto** (8 guías de país) → NO duplicar. Los nuevos temas son **trámites FR↔ES de ciudadanos franceses/francófonos**, no más países.
3. Cada artículo debe enlazar a `/traductor-jurado-frances` (anchor "traductor jurado de francés") y a 2-3 posts del cluster existente.

## Aviso de verificación factual (aplicado a todo el calendario)

- **Permiso de conducir francés**: VERIFICADO que NO sirve como tema de "traducción". Francia es UE/EEE → el canje se hace SIN examen y **sin traducción jurada** (marco UE, no convenio bilateral). Fuente: [DGT — países con convenio de canjes](https://www.dgt.es/nuestros-servicios/permisos-de-conducir/permisos-extranjeros-y-de-fuerzas-y-cuerpos-de-seguridad/canjes-de-permisos/paises-con-convenio-de-canjes/). → **NO escribir como captación de traducción.** Como mucho, un post "por qué tu permiso francés NO necesita traducción" (honestidad = autoridad AEO), bajo categoría faq.
- **Reglamento (UE) 2016/1191** (en vigor 16-feb-2019): entre Francia y España suprime apostilla y, con impreso estándar multilingüe adjunto, **puede eximir la traducción** de ciertos documentos públicos (estado civil, antecedentes, etc.). Fuente: [BOE/DOUE](https://www.boe.es/buscar/doc.php?id=DOUE-L-2016-81317). → Todo artículo de estado civil FR↔ES DEBE explicar esta excepción y aclarar CUÁNDO sigue haciendo falta traducción jurada (sin impreso multilingüe, o si la autoridad lo exige). Esto nos diferencia de la competencia que copia el flujo "apostilla + jurada" del Magreb sin matizar.
- **Convenio CIEC nº 16 (Viena, 1976)**: actas plurilingües NO requieren traducción jurada. Fuente: [BOE-A-1983-22432](https://www.boe.es/buscar/doc.php?id=BOE-A-1983-22432).

---

## Tanda 1 (semanas 1-2) — borradores YA escritos en este lote

| # | Fecha pub. | Título tentativo | Intención / keyword | Cat. | Ángulo francófono / por qué | Estado |
|---|---|---|---|---|---|---|
| 1 | Sem 1 (mar) | Casarse en España siendo francés: documentos y traducción jurada | "documentos boda francés España", "certificat de coutume traducción", "se marier en Espagne traduction" | tramites | Trámite franco-español puro de alto volumen (bodas mixtas FR-ES). Certificat de coutume + capacité matrimoniale + acte de naissance. Matiz UE 2016/1191. | ✅ borrador `boda-en-espana-documentos-franceses.mdx` |
| 2 | Sem 1 (jue) | Casier judiciaire francés (Bulletin n°3): cómo pedirlo y traducirlo para España | "casier judiciaire traducción español", "bulletin n°3 España", "antecedentes penales francés España" | tramites | El doc francés más pedido en extranjería/nacionalidad. Gratis, online, 24h. Cuándo SÍ y cuándo NO hace falta jurada. | ✅ borrador `casier-judiciaire-frances-traduccion.mdx` |
| 3 | Sem 2 (mar) | Nacionalidad española para franceses: qué documentos traducir y cuáles no | "nacionalidad española francés", "nationalité espagnole français documents", "documentos nacionalidad francés traducción" | tramites | Captura al francés residente que lleva años en ES. 10 años de residencia, pero foco en QUÉ se traduce (acte naissance, casier) y qué exime UE 2016/1191. | ✅ borrador `nacionalidad-espanola-para-franceses.mdx` |

## Tanda 2 (semanas 2-4) — siguientes a redactar

| # | Fecha pub. | Título tentativo | Intención / keyword | Cat. | Ángulo francófono / por qué |
|---|---|---|---|---|---|
| 4 | Sem 2 (jue) | Acta de nacimiento plurilingüe vs. traducción jurada: cuándo necesitas cada una | "acta nacimiento plurilingüe traducción", "extrait plurilingue acte naissance Espagne" | faq | Tema-trampa: el francés cree que necesita jurada y a veces no. CIEC nº16 + UE 2016/1191. Honestidad = autoridad AEO + sigue captando los casos en que SÍ hace falta. |
| 5 | Sem 3 (mar) | Reagrupación familiar en España para franceses y francófonos: documentos y traducción | "reagrupación familiar francés", "regroupement familial Espagne documents" | tramites | Reagrupante UE vs no-UE. Enlaza al post de reagrupación existente y al cluster magrebí (cónyuges marroquíes/argelinos de franceses). |
| 6 | Sem 3 (jue) | Homologar un título universitario francés en España: documentos y traducción jurada | "homologación título francés España", "homologation diplôme français Espagne" | tramites | Diploma + relevé de notes franceses. Enlaza a guía de homologación existente. Matiz: reconocimiento profesional UE vs homologación académica. |
| 7 | Sem 4 (mar) | Montar una empresa o ser autónomo en España siendo francés: documentos a traducir | "autoentrepreneur français Espagne", "crear empresa francés España documentos", "NIE autónomo francés" | tramites | Captación B2B francófona. Estatutos, poderes, certificado de existencia de sociedad francesa, certificat de coutume societaire. |
| 8 | Sem 4 (jue) | Comprar una vivienda en España siendo francés: qué documentos hay que traducir | "acheter bien immobilier Espagne français documents", "comprar casa España francés traducción" | tramites | Enlaza a `/fr/acheter-bien-immobilier-espagne` (landing FR ya existente). Poder notarial, justificantes de origen de fondos, NIE. |

## Tanda 3 (semanas 5-8) — banco de temas (priorizar según GSC)

| # | Título tentativo | Intención / keyword | Cat. | Ángulo / por qué |
|---|---|---|---|---|
| 9 | Divorcio francés reconocido en España: traducción jurada de la sentencia | "divorcio francés España", "jugement divorce français Espagne traduction" | tramites | Sentencia de divorcio francesa + reconocimiento. Reglamento Bruselas II ter. Estado civil para nuevo matrimonio. |
| 10 | PACS francés en España: validez y documentos | "PACS français Espagne", "PACS pareja de hecho España" | faq | Tema poco cubierto, query francófona específica. Equivalencia PACS ↔ pareja de hecho española. |
| 11 | Certificat de coutume: qué es y cuándo lo pide la administración española | "certificat de coutume Espagne", "certificado de costumbre traducción" | faq | Tema-pilar que alimenta el post de bodas y el de empresas. Buen candidato a cita IA por definición autónoma. |
| 12 | TIE / certificado de registro de ciudadano de la UE para franceses en España | "certificado registro UE francés", "TIE français Espagne", "NIE francés residencia" | tramites | Francés UE → certificado de registro (no TIE de no-UE). Aclara qué documentos SÍ se traducen (pocos) y cuáles no. |
| 13 | Por qué tu permiso de conducir francés NO necesita traducción jurada en España | "canje permiso conducir francés España traducción" | faq | Anti-tema honesto: captura la query, da la respuesta correcta (UE = sin traducción), redirige a lo que SÍ vendemos. Fuerte para AEO. |
| 14 | Pensión / jubilación francesa cobrada en España: justificantes y traducción | "justificante pensión francesa España", "attestation retraite française Espagne" | tramites | Jubilados franceses en Costa del Sol (Málaga = sede HBTJ). Attestation de paiement, certificat de vie. |
| 15 | Adoptar en España con documentación francesa: traducción jurada | "adopción documentos franceses España" | tramites | Nicho de alto valor por documento (expediente extenso). |
| 16 | Declaración de la renta de no residente francés con bien en España | "declaración no residente francés España", "impôt non-résident Espagne français" | tramites | Enlaza a `/fr/declaration-non-resident-espagne` (landing FR existente). Justificantes franceses de ingresos. |

---

## Cómo sostener el ritmo 2/semana (recomendación)

Ver bloque "Recomendación de cadencia" en la entrega. Resumen: **lote mensual de borradores + revisión humana obligatoria antes de `published: true`**. NO publicar YMYL automáticamente.
