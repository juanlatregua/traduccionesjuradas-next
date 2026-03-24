# EJECUTAR — Pendientes reales

> Actualizado 2026-03-24

---

## 1. Redirects legacy — ✅ Completado

Desplegados en producción (commit 2318a55, 2026-03-08). Verificados con curl (2026-03-09).
Google Search Console confirma que las URLs legacy devuelven 301 correctamente (2026-03-12).

---

## 2. Páginas de ciudad — esperando indexación

32 páginas activas en `/traductor-jurado/[ciudad]` (18 ciudades eliminadas con 301 → home).

- ✅ 32 URLs responden 200 en producción
- ✅ 18 ciudades sin clics eliminadas + redirects 301 (2026-03-10)
- ✅ Sitemap enviado a Google Search Console
- ⬜ Esperar indexación (4-8 semanas desde 8 marzo → revisar ~5 abril)
- ⬜ Solicitar reindexación manual de URLs prioritarias si no indexan

**URLs prioritarias:**
`/traductor-jurado/madrid`, `/traductor-jurado/barcelona`, `/traductor-jurado/valencia`,
`/traductor-jurado/sevilla`, `/traductor-jurado/malaga`, `/traductor-jurado/bilbao`

---

## 3. SEO Audit — ✅ Completado (2026-03-12 + 2026-03-24)

Todas las acciones de `EJECUTAR-SEO.md` implementadas + auditoría GSC completa:

| Acción | Estado |
|---|---|
| Redirect 301 /traducciones-juradas-baratas (slash) | ✅ |
| Eliminar 18 ciudades sin clics + redirects | ✅ |
| Redirect /traductor-jurado-japones → / | ✅ |
| Metadata home (MAEC nº 3850, 35€) | ✅ |
| Metadata /traducciones-juradas-baratas (35€) | ✅ |
| Metadata /traduccion-jurada-frances-malaga | ✅ |
| Metadata /traduccion-jurada-online | ✅ |
| Metadata francés + alemán | ✅ |
| Metadata /marruecos + blog marroquí | ✅ |
| 6 páginas dedicadas de documentos | ✅ (ya existían con contenido específico) |
| Legacy URLs (categoria-producto, contacto/page) | ✅ |
| Precio body 40€→35€ en /traducciones-juradas-baratas | ✅ (2026-03-12) |
| **Trailing slash: eliminar skipTrailingSlashRedirect** | ✅ (2026-03-24) |
| **Redirect loop /traducciones-juradas-baratas eliminado** | ✅ (2026-03-24) |
| **Middleware: ?route= en paths no-root → 301** | ✅ (2026-03-24) |
| **Internal link /marruecos → /traductor-jurado-frances** | ✅ (2026-03-24) |
| **Auditoría GSC completa (190+ URLs)** | ✅ (2026-03-24) |

### GSC pendiente (Juan — cuando renueve cuota):
- ⬜ Validar corrección en: 5xx (54), redirects (33), canonical (5)
- ⬜ Solicitar indexación manual de ciudades prioritarias (madrid, barcelona, valencia, sevilla, malaga, bilbao)
- ⬜ 58 páginas "descubiertas sin indexar" — se resolverá con crawl budget liberado

---

## 4. Subdominio SendGrid

`url9254.traduccionesjuradas.net` — subdominio de tracking de SendGrid.
- Google confirma "Error de DNS: Host desconocido" (2026-03-12)
- No requiere acción — desaparecerá solo
- Click tracking deshabilitado globalmente con `NO_CLICK_TRACKING`

---

## 5. Solicitud de reseña Google — ✅ Completado (2026-03-09)

CTA en email de entrega, email independiente, SMS/WhatsApp template, botones admin.

---

## 6. Adquisición de tráfico — 3 canales pendientes

### 6a. Google Ads (⬜ pendiente — Juan primero)

**Juan hace:**
- Crear cuenta en ads.google.com
- Campaña de búsqueda → keywords: "traducción jurada", "traductor jurado online", "traducción jurada barata", "traducción jurada francés"
- Presupuesto: 10€/día para empezar
- Landing: `/presupuesto-instantaneo` o `/traducciones-juradas-baratas`

**En código (⬜ cuando tenga la cuenta):**
- Añadir tag de conversión Google Ads (gtag)
- Necesita: ID de conversión de Google Ads

### 6b. Google Business Profile (⬜ pendiente — Juan primero)

**Juan hace:**
- Ir a business.google.com → reclamar "HBTJ Consultores Lingüísticos" en Málaga
- Categoría: "Servicio de traducción"
- Fotos, horario, descripción con keywords

**En código (⬜ cuando tenga el perfil):**
- Verificar que `SchemaLocalBusiness` coincide con datos del perfil

### 6c. Comunidades de expatriados (⬜ manual)

Facebook: "Français à Malaga", "Expatriés français en Espagne", "Marroquíes en España"
Foros: expatforum.com, expat.com (sección España)
Estrategia: responder preguntas sobre trámites, mencionar servicio cuando sea relevante.

---

## 7. Notas

- **Seguridad endpoint público:** revisado 2026-03-08, HMAC-SHA256 correcto, rate limit 120 req/10min.
- **PayPal:** desactivado, código presente por si se reactiva.
- **Repo memory structure:** documentación reorganizada (2026-03-12) — ver `.claude/skills/`, `docs/`, CLAUDE.md locales.
