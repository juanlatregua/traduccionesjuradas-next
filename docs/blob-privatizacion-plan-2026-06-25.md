# Plan — Privatización de documentos en Vercel Blob (hallazgo D del audit)

Estado: **PLANIFICADO, no iniciado.** Es una migración por fases, no un parche. Mapa hecho por workflow (read-only) + criterio aplicado encima.

## El problema
Los documentos subidos (PII: pasaportes, partidas, antecedentes, extractos, traducciones juradas) se guardan con `access: "public"`. La URL es accesible por cualquiera que la tenga (van en emails y páginas). `addRandomSuffix` evita enumerar, pero no cierra el acceso directo.

## ⚠️ Bloqueante técnico (corrige el diseño del agente)
- **`@vercel/blob@2.2.0` (instalado) SOLO admite `access: "public"`** — su tipo lo dice: *"access (Required) Must be 'public'"*. No hay opción privada en esta versión.
- El "proxy que sirve un blob público con token" **NO privatiza**: la URL pública sigue abierta → seguridad de pega.
- La plataforma Vercel **sí ofrece blobs privados ahora**, pero requiere **subir la versión** del paquete (`@vercel/blob` > 2.2.0) y usar la API privada. **Prerrequisito real de D = upgrade del paquete + spike que confirme que el acceso privado funciona en este proyecto Vercel.**

## Superficie (8 subidas, todas públicas hoy)
| # | Subida | Path | PII | Consumidores |
|---|---|---|---|---|
| 1 | Entrega traductor | `translator-deliveries/` | ALTA | email entrega + página estado + `Order.translatedFileUrl` |
| 2 | Documentos fuente (cliente) | `orders/{ref}/documentos/` | **CRÍTICA** | generador borrador, detalle pedido, extract-pages |
| 3 | Comprobante de pago | `orders/{ref}/comprobantes/` | MEDIA | email a staff |
| 4 | Entrega colaborador | `collaborator-deliveries/` | ALTA | respuesta API |
| 5 | Borrador DOCX (IA) | `drafts/` | ALTA | staff (workspace) |
| 6 | Subida general staff | `uploads/`,`expenses/` | VARIABLE | respuesta API |
| 7 | PDF presupuesto final | `quotes/` | MEDIA | email (token de quote) |
| 8 | Intake expediente público | `expedientes/` | **CRÍTICA** | /api/expediente/submit |

## Arquitectura objetivo
**Proxy autorizado** `app/api/documents/download/...` que sirve el blob privado tras validar por audiencia:
- **Staff** → `requireStaffAccess` (+ rol para borradores/finanzas).
- **Cliente** → `verifyOrderToken(reference, token)` (token firmado que ya va en email/SMS de entrega).
- **Colaborador** → `getAssignmentByToken(accessToken)`.
- **Server-to-server** (análisis IA) → `BLOB_READ_WRITE_TOKEN` directo, sin proxy.

Plantilla existente reutilizable: `app/api/documents/extract-pages` (ya es un proxy staff-gated que hace fetch+stream con `Cache-Control: private, no-store`).

## Orden de migración (seguro, con feature flag `BLOB_PRIVATE_MODE`)
0. **Prerrequisito:** upgrade `@vercel/blob` + spike de acceso privado (rama aislada). *Si el acceso privado no funciona como se espera, D se replantea.*
1. **Proxy + helper** `buildDownloadUrl()` (aditivo, no rompe nada).
2. Subidas leen el flag → `access: private` cuando esté ON (default OFF). Persistir `blob.pathname` en BD (hoy se descarta).
3. Reescribir **consumidores cara-cliente** (emails de entrega, páginas de pedido/consulta, respuesta de `documents/lookup`) para usar el proxy.
4. Reescribir **consumidores staff** (workspace/cockpit/contabilidad, respuesta borrador IA).
5. **Migrar blobs públicos ya subidos** (re-subir como privados) — con ventana de gracia para los enlaces de emails viejos.
6. Limpieza: quitar patrones de URL directa, regla ESLint, dashboard de auditoría de descargas.

**Rollback:** `BLOB_PRIVATE_MODE=false` + revertir reescrituras → todo vuelve a funcionar (< 1h).

## Riesgos principales
- Emails ya enviados con URL pública directa dejan de funcionar tras la migración (Fase 5) → ventana de gracia + aviso.
- Bug en la auth del proxy → clientes no descargan → tickets. Mitiga: staging + monitor de errores la 1ª semana.
- El acceso privado de Vercel puede no comportarse como se asume → spike en Fase 0 obligatorio.

## Decisiones de Juan (las que importan; el resto tienen default razonable)
1. **¿Seguimos con Vercel Blob (upgrade) o se valora otro storage?** El stack fijo dice Vercel Blob → upgrade.
2. **Privacidad del PDF de presupuesto (#7):** ¿privado con token (recomendado: lleva nombre/email/precio) o compartible?
3. **Retención del borrador IA (#5) y del intake de expediente (#8):** ¿auto-borrado (p.ej. 14-30d) por RGPD?
4. **Migrar los blobs públicos viejos** (re-subir) o aceptar que los antiguos quedan públicos hasta su limpieza por retención.
5. **Caducidad de los enlaces de descarga:** ¿sin caducidad (auth basta) u opción de enlace temporal para auditores/abogados?

## Mientras tanto (mitigaciones ya vivas)
- `addRandomSuffix` en todas las subidas (no enumerable).
- Rate-limit por email en los lookups (PR #151) → corta el barrido.
- Limpieza RGPD por retención (crons existentes).

> Recomendación: tratar D como su propia tanda — empezar por la **Fase 0** (upgrade + spike), y solo si el acceso privado funciona, seguir con el proxy y la migración por fases. No mezclar con features de producto.
