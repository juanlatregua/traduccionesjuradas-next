# Plan de sunset — legado WordPress → v2

_Generado por auditoría multi-agente (workflow wp-legacy-sunset), verificado contra el código. 2 jun 2026._

All facts verified. The refutation holds on every disputed point. I now have everything needed to emit the consolidated sunset plan.

---

# PLAN DE SUNSET — LEGADO WORDPRESS → v2

**traduccionesjuradas.net · jun-2026 · accionable para Next.js 14 (`middleware.ts` + `next.config.mjs`)**

> Base de verdad re-verificada en este repo a fecha de hoy. La **refutación adversaria gana en los 4 puntos** y queda incorporada como hechos. El veredicto original aporta el marco y la clasificación por equity; donde chocan, manda la refutación porque coincide con el código.

## Hechos confirmados en código (no asumir lo del inventario)

| Afirmación | Estado real verificado | Fuente |
|---|---|---|
| Las 6 thin de documento **se sirven en 200** (no redirigen) | ✓ CIERTO. `page.tsx` existe para las 6; están en `VALID_LEGACY_PATHS` → `isLanguagePillar=true` → exentas del catch-all → `NextResponse.next()` → Next sirve 200 | `middleware.ts:78-92`, `app/traduccion-jurada-*/page.tsx` |
| Auto-canonicalización de las thin | ✓ CIERTO. `estatutos-sociales` y `antecedentes-penales` apuntan su canonical a sí mismas | `…estatutos-sociales/page.tsx:14`, `…antecedentes-penales/page.tsx:14` |
| **NO existe 301 en config** para los 6 slugs raíz | ✓ CIERTO. El único match es `/documentos/...seguridad-social` (ruta legacy distinta), no el slug raíz | `next.config.mjs:315,320` |
| `/fr/acheter-…` y `/fr/declaration-…` **SÍ existen** y son páginas FR de calidad | ✓ CIERTO. Existen, con `alternates.canonical` propio y `openGraph locale fr_FR`. **Sin `alternates.languages` (sin hreflang)** | `app/fr/*/page.tsx:8-9` |
| `/buscar` ya tiene noindex | ✓ CIERTO. `robots: { index:false, follow:true }` | `app/buscar/page.tsx:10` |
| `/q` no es buscador; es presupuesto por token, doble noindex | ✓ CIERTO. `app/q/[token]/page.tsx:27-28` + header `noindex` en `next.config.mjs:38` | — |
| `/feed` hoy hace **301→`/`**, no 410 | ✓ CIERTO. `next.config.mjs:157-160` (301) corre ANTES que el `isFeed` 410 del middleware. Next evalúa `redirects()` antes que middleware | `next.config.mjs:157`, `middleware.ts:46` |
| `ORDEN-AEX-…pdf` está **3 veces** | ✓ CIERTO. Líneas 259, 264, 581 (la 264 es la variante con trailing slash) | `next.config.mjs:259,264,581` |
| `poder-notarial` NO es duplicado | ✓ CIERTO. Son variantes con/sin slash (`:290` y `:390`). **NO tocar** | `next.config.mjs:290,390` |
| 18 ciudades retiradas → `/` | ✓ CIERTO. Patrón débil (riesgo soft-404), mejorable | `next.config.mjs:95-112` |
| `/como-escanear-bien` existe, con canonical | ✓ CIERTO. `app/como-escanear-bien/page.tsx:14`. Sin `robots` (indexable, correcto si tiene valor) | — |
| EN/PT/DE homepages existen | ✓ CIERTO. `sworn-translation`, `traducao-certificada`, `beglaubigte-uebersetzung` | `app/` |

---

## (a) CAMBIOS DE CÓDIGO

### A.1 — `next.config.mjs`: AÑADIR 6 redirects 301 (fusión de las thin)

Crear un bloque nuevo de 6 redirects 301 de slug-raíz → canónico v2. **Esto es el corazón de la fusión.** Mapeo definitivo:

| Slug origen (borrar `page.tsx`) | Destino 301 |
|---|---|
| `/traduccion-jurada-de-estatutos-sociales` | `/documentos-oficiales/documentos-mercantiles` |
| `/traduccion-jurada-antecedentes-penales` | `/documentos-oficiales/antecedentes-penales` |
| `/traduccion-jurada-permiso-de-conducir` | `/documentos-oficiales/documentos-laborales` |
| `/traduccion-jurada-sentencia-judicial` | `/documentos-oficiales/documentos-juridicos` |
| `/traduccion-jurada-de-escritura-notarial` | `/documentos-oficiales/documentos-juridicos` |
| `/traduccion-jurada-de-certificado-de-seguridad-social` | `/documentos-oficiales/documentos-laborales` |

Incluir las variantes con trailing slash de cada uno (patrón del resto del archivo), o confirmar que `skipTrailingSlashRedirect` lo cubre.

### A.2 — `middleware.ts`: NO sacar los 6 slugs de `VALID_LEGACY_PATHS` todavía

**Inversión crítica del veredicto original.** El orden obligatorio por slug es:
1. Borrar el `page.tsx` del slug.
2. Añadir el 301 explícito en config (A.1).
3. **Mantener el slug en `VALID_LEGACY_PATHS`** durante el cambio. Si se saca antes, el catch-all `/traduccion-jurada-* → /` (`middleware.ts:119-127`) pisa el 301 y manda el equity a home. Una vez el 301 de config está vivo y verificado, el slug en el set es inocuo (config corre primero) — se puede limpiar del set en un commit posterior, opcional, no urgente.

> Razón mecánica: config (`redirects()`) → luego middleware. Con el 301 en config, la petición nunca llega al middleware. El slug en el set solo importa como red de seguridad si el 301 fallara.

### A.3 — `next.config.mjs`: subir `/feed` a 410 (vía middleware)

- Borrar las reglas 301 de `/feed` (`:157-160`) y `/feed/` (`:162-165`).
- Entonces el `isFeed` del middleware (`middleware.ts:46`) toma control → 410. RSS muerto, equity nulo → 410 es correcto.

### A.4 — `next.config.mjs`: limpiar duplicado de `ORDEN-AEX`

- Mantener UNA regla (la que cubre con y sin slash). Borrar la copia redundante (3 ocurrencias → dejar 1–2 coherentes). **Mantener 301 → `/documentos-oficiales`, NO 410**: PDF de normativa MAEC potencialmente enlazado externamente, conserva equity de enlaces.

### A.5 — `middleware.ts`: subir `?action=` de 404 a 410

`middleware.ts:32-35` hoy responde 404 JSON. Cambiar a `gone()` (410). Son endpoints WP basura sin equity → 410 desindexa más rápido; 404 deja a Google reintentando.

### A.6 — `middleware.ts`: prefijos-fantasma WP a 410

Hoy el catch-all (`:119-127`) manda `/traduccion-jurada-*`, `/traductor-jurado-*`, `/traductor-*`, `/traducciones-*` no mapeados → 301 `/`. Para fragmentos de prefijo puros y rutas-fantasma WP (`/author/traducciones-juradas/`, `/wp-admin/admin-ajax.php`, `/palabra`) → preferible 410.
- ⚠ **Riesgo de orden:** ese catch-all es la red que captura legacy no mapeado. Cualquier cambio debe ejecutarse DESPUÉS de A.1 (con los 6 slugs ya con 301 en config). Distinguir "fragmento basura" (410) de "slug legacy con posible equity" (301 a destino real) — no convertir el catch-all entero en 410 a ciegas.

### A.7 — `next.config.mjs`: ciudades retiradas, mejorar 301 (NO urgente)

Las 18 ciudades → `/` (`:95-112`) es patrón débil (soft-404). Equity individual ~nulo, así que no es bloqueante. **Mejora opcional:** apuntar a `/traductor-jurado/[ciudad-activa-más-cercana]` o a un índice de ciudades. Decisión de Juan (mapeo geográfico).

### A.8 — Lo que NO se toca (confirmado)

- `poder-notarial` (`:290`, `:390`): variantes slash, NO duplicado.
- `/buscar`, `/q`: ya tienen noindex correcto. **Sacar de toda lista de pendientes.**
- Host-canon (http→https, www), funnel v1→`/presupuesto-instantaneo`, WooCommerce→hub, renames, catch-all francés, migración de esquema de ciudades: todos sólidos, dejar.
- Bloque 410 actual del middleware (`wp-json`, `wp-admin`, `wp-login`, `xmlrpc`, plugin endpoint, `route=` root): correcto, dejar.

---

## (b) ACCIONES DE CONTENIDO (priorizadas)

### PRIORIDAD 1 — Canibalización activa (fusionar las 6 thin)
Para cada una, ANTES del 301 (A.1): **trasladar contenido único al canónico v2**, luego borrar `page.tsx`.

| # | Página | Acción | Dato GSC | Nota de migración |
|---|---|---|---|---|
| 1 | `estatutos-sociales` | Volcar a `documentos-mercantiles` | **109 impr, pos 12.4, indexada** → tiene equity | MIGRAR TEXTO SÍ O SÍ antes del 301, o se pierde pos 12 |
| 2 | `escritura-notarial` | Volcar a `documentos-juridicos` | "Discovered – not indexed", 0 impr | 6 tipos de escritura → enriquece el canónico |
| 3 | `antecedentes-penales` | Volcar a `documentos-oficiales/antecedentes-penales` | "Unknown to Google", 0 impr | Trasladar apostilla + ref. regularización-2026 |
| 4 | `permiso-de-conducir` | Volcar a `documentos-laborales` | ⚠ sin snapshot GSC | Confirmar 0 impr antes; tiene schema que reaprovechar |
| 5 | `sentencia-judicial` | Volcar a `documentos-juridicos` | ⚠ sin snapshot GSC | Confirmar 0 impr antes; tiene schema |
| 6 | `certificado-de-seguridad-social` | Volcar a `documentos-laborales` | ⚠ sin snapshot GSC | El legacy `/documentos/...` ya apunta ahí; consolida |

### PRIORIDAD 2 — Equity en riesgo (subir-a-v2, SIN cambiar URL)
- **`/traducciones-juradas-baratas`** — 5 clics, 599 impr, pos 32.9, sin schema. La thin con más tráfico tras la home. Mantener URL y H1, enriquecer: PriceEstimator embebido + SchemaService/FAQ. Desde pos 33 hay margen grande.

### PRIORIDAD 3 — Problema de indexación, no de contenido (enlazar + schema)
- **`/teletrabajo`** (430 líneas, "unknown to Google") — añadir SchemaService/HowTo, enlazar desde hub + cross-link a `/marruecos`. ⚠ **Decisión Juan:** delimitar rol vs proyecto separado `/uge-ce` (handoff, no fusión — ver memoria `project_ugece_bridge`).
- **`/marruecos`** ("unknown to Google") — corredor #1 del negocio; el blog `documentos-marroquies-guia-completa` es la URL top del site (15 clics). Añadir schema, enlazar desde hub. ⚠ **Decisión Juan:** reparto de roles → blog = informacional, `/marruecos` = transaccional, para no canibalizar el post.

### PRIORIDAD 4 — Páginas FR reclasificadas (DEJAR, mejorar hreflang)
- **`/fr/acheter-bien-immobilier-espagne`** y **`/fr/declaration-non-resident-espagne`** — son landings FR transaccionales de calidad (NIE/hipoteca/escritura; modelo 210/IRNR), foco francés↔español del negocio. NO retirar. **Único pendiente:** añadir `alternates.languages` (hreflang recíproco con su par ES) para evitar duplicado cross-idioma.
- Aplicar el mismo chequeo de hreflang a `/sworn-translation`, `/traducao-certificada`, `/beglaubigte-uebersetzung`, `/traduction-assermentee` (homepages multiidioma del core): confirmar hreflang recíproco entre sí y con la home ES.

### PRIORIDAD 5 — Soporte
- **`/como-escanear-bien`** — utilidad de "banco de utilidades". Enlazar desde funnel/upload. Verificar contenido. Sin dato GSC pero encaje claro con v2.

### NO REQUIEREN ACCIÓN (cerradas)
- `/buscar`, `/q` — noindex correcto. No son gaps.
- Núcleo v2 (`/`, `/presupuesto-instantaneo`, `/expediente`, lector, hub + 9 subpáginas, idiomas-pilar, regularización-2026, legales): dejar.

---

## (c) CÓMO LIMPIA EL INFORME GSC

1. **410 → drop del índice (rápido):** `wp-json/*`, `wp-admin/*`, `wp-login`, `xmlrpc`, plugin-endpoints, `/feed` (tras A.3), `?action=` (tras A.5), prefijos-fantasma WP (tras A.6). 410 le dice a Google "borra esto ya" — es la vía rápida para purgar la morralla WP que infla "no indexadas". Estas URLs deberían salir del informe en 1–3 ciclos de crawl.
2. **Fusión 301 → consolida equity y elimina duplicados:** las 6 thin desaparecen como URLs separadas; su equity (sobre todo los 109 impr de `estatutos`) se redirige al canónico `/documentos-oficiales/*`. Esto resuelve la **canibalización** (dos URLs por misma keyword) y reduce el recuento de páginas en competencia interna.
3. **Cruce con las ~130 "no indexadas":** una parte significativa de esas 130 son exactamente (i) URLs WP basura que pasarán a 410, (ii) las thin "Discovered/Unknown" (escritura-notarial, antecedentes), y (iii) ciudades retiradas con 301 débil a `/`. Tras el sunset, esperar que el bloque de "Descubierta – no indexada" y "Rastreada – no indexada" baje notablemente. Lo que NO baja solo: `/teletrabajo` y `/marruecos` ("unknown") — esos salen de "no indexada" únicamente con enlazado interno + schema (Prioridad 3), no con 410/301.
4. **`/feed` 301→410** quita una URL que hoy responde 200-equivalente-via-redirect del flujo de equity hacia `/` (señal de ruido) y la marca como definitivamente muerta.

---

## (d) ⚠ DECISIONES QUE NECESITA JUAN (bloqueantes antes de ejecutar)

1. **Datos GSC faltantes (3 thin):** `permiso-de-conducir`, `sentencia-judicial`, `certificado-de-seguridad-social` no tienen snapshot. **No fusionar ni borrar hasta confirmar 0 impresiones + 0 enlaces externos.** Si alguna tuviera impresiones, migrar contenido primero (como `estatutos`). Regla inmutable: ningún 410/301-borrado sin equity ~nulo demostrado.
2. **`/teletrabajo` vs `/uge-ce`:** confirmar que enriquecer `/teletrabajo` no canibaliza el proyecto separado `/uge-ce` (handoff con `?p=uge-ce`, NO fusión). Definir qué cubre cada uno.
3. **`/marruecos` vs blog `documentos-marroquies-guia-completa`:** definir reparto transaccional/informacional explícito antes de añadir schema, o competirán por la misma keyword.
4. **Ciudades retiradas (A.7):** ¿301 a `/` (status quo) o mapeo a ciudad activa cercana? Necesita el criterio geográfico de Juan. No bloqueante para el resto.
5. **`/como-escanear-bien`:** validar contenido y decidir si subir-a-v2 o dejar como está.
6. **Hreflang multiidioma:** confirmar el árbol de equivalencias ES↔FR↔EN↔PT↔DE para poblar `alternates.languages` correctamente (qué página ES corresponde a cada home de idioma).

---

## (e) ORDEN DE EJECUCIÓN Y RIESGOS

**Fase 0 — Pre-flight (sin tocar nada)**
- Confirmar datos GSC de los 3 thin sin snapshot (decisión Juan #1). 
- `bash scripts/project-map.sh` (protocolo obligatorio CLAUDE.md).

**Fase 1 — Higiene de config (bajo riesgo, sin dependencias de contenido)**
- A.3 (`/feed`→410), A.4 (dedup `ORDEN-AEX`), A.5 (`?action=`→410).
- Riesgo: bajo. Solo morralla. Verificar con `curl -I` que `/feed` devuelve 410 y `?action=x` devuelve 410.

**Fase 2 — Fusión de las thin (la parte delicada)** — por slug, una a una:
1. Migrar contenido único → canónico v2 (empezar por `estatutos-sociales`, la de equity).
2. Borrar `page.tsx`.
3. Añadir 301 en config (A.1) + variante slash.
4. **Mantener slug en `VALID_LEGACY_PATHS`** (A.2).
5. `curl -I` el slug → debe dar **301 al canónico v2 en UN salto** (no a `/`).
- ⚠ **Riesgo máximo:** si se invierte el orden (sacar del set antes de poner el 301) → catch-all manda a `/` → se pierde el equity de `estatutos` (109 impr). Verificar 1 salto en cada slug antes de pasar al siguiente.

**Fase 3 — Catch-all / prefijos (A.6)** — DESPUÉS de Fase 2:
- Solo cuando los 6 slugs ya tengan 301 en config. Distinguir fragmento-basura (410) de slug-con-equity (301). Probar que no se rompe ningún 301 específico existente.
- ⚠ Riesgo: alto si se toca a ciegas. El catch-all es la red de seguridad de TODO el legacy no mapeado.

**Fase 4 — Contenido v2 (sin riesgo de redirect)**
- Subir-a-v2 `/traducciones-juradas-baratas` (sin cambiar URL).
- Schema + enlazado `/teletrabajo`, `/marruecos` (tras decisiones #2, #3).
- Hreflang FR + multiidioma (tras decisión #6).

**Fase 5 — Mejoras opcionales**
- A.7 (ciudades), limpieza de los 6 slugs del `VALID_LEGACY_PATHS` (ya inocua), `/como-escanear-bien`.

**Verificación final (cada fase):** `npm run build` + `npx tsc --noEmit --skipLibCheck` + matriz `curl -I` de muestras (un 410, un 301-fusión de 1 salto, una página viva 200). Tras deploy: re-inspección en GSC de URLs clave + "Validar corrección" en los informes de cobertura para acelerar el reprocesado.

**Riesgo transversal #1:** orden config→middleware. Todo el plan depende de que `redirects()` corre antes que el middleware. Confirmado en código y comportamiento de Next 14. No invertir.
**Riesgo transversal #2:** un solo salto. Verificar que ninguna fusión encadena 301→301 (el catch-all `→/` no debe quedar en la ruta de los 6 slugs).

**Archivos de verdad:** `/Users/juan/Code/HBTJ/traduccionesjuradas-net/next.config.mjs`, `/Users/juan/Code/HBTJ/traduccionesjuradas-net/middleware.ts`, `/Users/juan/Code/HBTJ/traduccionesjuradas-net/app/documentos-oficiales/`, `/Users/juan/Code/HBTJ/traduccionesjuradas-net/app/traduccion-jurada-*/`, `/Users/juan/Code/HBTJ/traduccionesjuradas-net/app/fr/`.
