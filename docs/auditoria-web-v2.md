# Auditoría ultracode — web + plan V2

> 2026-06-11. 58 agentes · 11 dimensiones web + 5 lentes V2 · 130 hallazgos, 40 verificados adversarialmente, 35 confirmados. Director técnico: síntesis priorizada. Evidencias con archivo:línea verificadas contra el código real.

## 1. Resumen ejecutivo

La web está **mejor construida de lo que factura**: la puerta (diagnóstico-IA en 5 idiomas), la contabilidad (IVA en céntimos, conciliación bancaria) y la seguridad base (firmas de webhook, OTP staff) son sólidas. Pero el producto entero está optimizado para un **funnel de pago propio que cierra ~0 pedidos**, mientras el dinero real entra por **WhatsApp con inbound mayoritariamente PORTUGUÉS** — el segmento peor servido del sistema (checkout que lo degrada a español, "desde 35 €" falso en PT, cero campaña). El plan V2 está bien planificado pero **mide y mejora el carril vacío**: su "cifra estrella" (% que llega a pago) no es el negocio. Y la capa anti-incidente que originó V2 **sigue con agujeros idénticos al fallo de 2,5 meses** (reconciliación solo Stripe; observabilidad colgando de un único email). El 1-sept-2026 es alcanzable para el alcance literal, pero **el alcance literal no cumple la promesa para el cliente real**: hay que reordenar.

## 2. TOP 5 — lo que mueve la aguja

1. **El canal que factura (WhatsApp/PT) es invisible y maltratado.** 1 solo `track("whatsapp_click")` de ~16+ salidas; checkout degrada PT→ES; cero campaña lusófona; sin botón WhatsApp en el pico de intención (la DiagnosisCard).
2. **La red anti-incidente sigue rota para Redsys/PayPal.** El cron de reconciliación solo mira Stripe (0 referencias a redsys/paypal). Redsys ni alerta si cobra sin pedido. **Es el mismo fallo en silencio que creó V2, vivo hoy.**
3. **Toda la observabilidad cuelga de un email.** Heartbeat, alertas de webhook y reconciliación van por Microsoft Graph. Si caduca el secret de Azure: cero avisos, en silencio.
4. **Riesgo SEO/legal barato de cerrar:** robots bloquea TODA la AEO salvo /uge-ce/, y hay reviews inventadas (4,8/46) en ~19 páginas → riesgo de *manual action* que borra todos los rich snippets.
5. **Dinero en la mesa + RGPD:** urgencia (+25%) y papel (+12€) calculados pero nunca cobrados; documentos jurados con PII (penales) en blobs **públicos permanentes** sin auth, sin declarar a Anthropic como encargado en /privacidad.

## 3. Plan priorizado

### P0 — imprescindible / sangra riesgo ahora
| Qué | Por qué | Dónde | Esfuerzo |
|---|---|---|---|
| **Reconciliación Redsys + PayPal + Quotes** + alerta en `throw "Pedido no encontrado"` | Reincidencia del incidente origen V2 | `cron/payment-reconciliation/route.ts`, `payment/redsys/notification/route.ts:135`, `paypal/capture/route.ts:181` | 2-3 d |
| **try/catch en el cron de reconciliación que alerte de su propio fallo** | La red de seguridad puede morir en silencio | `payment-reconciliation/route.ts` (patrón `staff-digest:30-43`) | 2 h |
| **Segundo canal de alerta (SMS) + dead-man's-switch externo** (healthchecks.io) | Si cae el email Azure cae TODA la observabilidad | `lib/email.ts:864,911`; ping en los 9 crons | 1 d |
| **payment-proof: NO marcar PAID al subir comprobante** + token firmado de invitado | Cualquiera con referencia+email regala trabajo y ensucia contabilidad | `orders/[reference]/payment-proof/route.ts:98,198` (usar `verifyOrderToken`) | 1 d |
| **Blobs de documentos privados + retención** | PII art.10 RGPD público y permanente; cleanup solo cubre DocumentAnalysis | rutas `access:"public"` (4); extender `cron/document-cleanup` | 2-3 d |
| **FailedEmail + FailedSms con contexto** (kind, recipient, reference) | "3 emails fallaron" es inaccionable; un cliente que pagó puede quedarse sin confirmación | `schema.prisma:658`, `lib/email-retry.ts`, `lib/sms.ts:124` | 1 d |

### P1 — mueve pedidos / reduce trabajo manual
| Qué | Por qué | Dónde | Esfuerzo |
|---|---|---|---|
| **Propagar clientLocale real (pt/en/de)** | El inbound PT recibe todo en español | `puerta/checkout/route.ts:70` | 30 min |
| **Botón WhatsApp en la DiagnosisCard** + `track` con lang/docType | Carril de cierre real en el pico de intención; medir el canal que factura | `components/puerta/DiagnosisCard.tsx`, `PuertaClient.tsx` | 1 d |
| **Instrumentar TODOS los `wa.me`** con source/page/lang | Mapa de qué idioma/página genera el negocio → decidir SEO FR vs PT | ~16 archivos | 1 d |
| **Detección Accept-Language en `/` + `<html lang>`** | El francófono/lusófono ve español; la promesa "idioma del visitante" no existe | `middleware.ts`, `app/layout.tsx:88` | 1-2 d |
| **Cobrar urgencia (+25%) y papel (+12€)** | Ingreso ya codificado, regalado en cada pedido | `checkout/route.ts:226` (`urgentPrice`/`PAPER_SHIPPING_BASE_EUR` existen) | 1 d |
| **Atribución lector→pedido**: CTA a `/presupuesto-instantaneo?p=lector` | El flagship es inmedible y mete fricción de re-subida | `components/ia/RequirementsResult.tsx:42` | 0,5 d |
| **1 landing PT/Brasil** (homologación, nacionalidad) con CTA WhatsApp | Clonar lo que funciona en FR hacia la demanda real | nuevo `app/regularizacion-2026/` | 1 d |
| **Facturas rectificativas/abonos para REFUNDED** | Un reembolso no revierte el IVA repercutido | `lib/client-invoice.ts`, `schema.prisma:190` | 2 d |

### P2 — higiene / deuda
- **303/130 en Europe/Madrid** (hoy `getUTCMonth()` descuadra en borde de trimestre) — `ContabilidadClient.tsx:90-93,138`. 0,5 d.
- **No quemar nº fiscal en la descarga de PDF del cliente** + `issueWithRetry` + `issuedAt=paidAt` — `orders/[reference]/invoice-pdf/route.ts:56`. 1 d.
- **Quitar aggregateRating/reviews inventados** — `SchemaProduct.tsx:76`, `layout.tsx:214`. 2 h.
- **Invertir robots.ts** (abrir AEO en `/`,`/blog/`,`/documentos-oficiales/`) — `app/robots.ts:37`. 1 h.
- **JSON-LD a SSR** (hoy `afterInteractive`, no sale en HTML) — `layout.tsx:90`, `blog/[slug]:78`. 1 d.
- **Fuentes a next/font + borrar Inter/Merriweather muertas** (LCP) — `globals.css:1`. 0,5 d.
- **zod en el camino crítico** (0/108 routes lo usan). 2 d.
- **a11y DiagnosisCard** (`aria-live`, foco al resultado). 1 d.
- **Backoffice**: no añadir más a `/admin`; consolidar el detalle de pedido (4 superficies). Fase aparte.
- **Limpieza**: `quoteState` (0 refs), `fixed-prices.ts`, `LanguageOfferPanel`, `EstimadorCarrito`. 2 h.

## 4. Veredicto sobre V2

**Ataca los problemas reales solo a medias, con la prioridad invertida.** Tres fallos de encuadre:
1. **Mide el canal equivocado.** La "cifra estrella" (% que llega a pago) cubre ~0% del negocio. Reescribirla como *conversaciones WhatsApp desde la web → pedidos cerrados*, con stage `whatsapp_iniciado` en `/admin/funnel`.
2. **La Fase 0 ("prerrequisito de todo") está incompleta en producción.** Solo cubrió Stripe. No se puede declarar V2 fiable sin cerrar Redsys/PayPal + dead-man's-switch + segundo canal. **Ese es el P0 real de V2, no la puerta.**
3. **El idioma del visitante (Fase 3, septiembre) es la palanca de "más pedidos" y está al final.** Adelantarlo a Fase 1 (al menos PT + FR). El árabe no existe como UI (retirar del brief o planificar RTL). **El canal real es PT, que el brief ni nombra.**

**Añadir al brief:** lector de requerimientos (sin tracking/atribución), blobs PII privados, limpieza reviews/robots, upsells urgencia/papel.

**¿Realista el 1-sept?** Sí para el alcance **reordenado** (P0 fiabilidad + idioma PT/FR + WhatsApp medido). No para "todo el funnel perfecto en todos los idiomas + AR con RTL".

## 5. Quick wins (<1 día, ya)
1. `checkout/route.ts:70` — propagar pt/en/de (1 línea).
2. `robots.ts:37` — abrir AI crawlers en `/` y `/blog/` (1 h).
3. `SchemaProduct.tsx:76` + `layout.tsx:214` — quitar el 4,8/46 inventado (2 h).
4. `RequirementsResult.tsx:42` — CTA del lector con atribución (15 min).
5. `payment-reconciliation/route.ts` — try/catch con alerta (2 h).
6. `globals.css:1` — borrar fuentes muertas (15 min).
7. `schema.prisma:135` — borrar columna `quoteState` (0 refs) (10 min).

**Línea de fondo:** la mayor inversión pendiente de V2 **no es más IA**, es alinear el esfuerzo con el canal real (WhatsApp/PT/francés) y cerrar la fiabilidad que originó el proyecto. Las dos cosas que más mueven la aguja —**medir WhatsApp y reconciliar los 3 proveedores**— son baratas y están sin hacer.
