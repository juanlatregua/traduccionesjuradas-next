# v2 · Fase 2 — El acompañamiento (WhatsApp por hito) · Plan detallado

**Fecha:** 2026-05-25 · **Estado:** borrador para revisión · **Ventana:** semanas 8-11 (brief: 6 jul – 2 ago)
**Depende de:** Fase 1 (la puerta) + captura de teléfono/email (PR #74, ya en prod).

---

## Hallazgo que da forma a esta fase (2026-05-25)

Al minar el código, la Fase 2 **no es construir el envío desde cero** — gran parte ya existe:

- **`lib/sms.ts` ya soporta WhatsApp.** `sendNotification()` envía por WhatsApp si
  `TWILIO_WHATSAPP_FROM` está configurado, y cae a SMS si no. El canal ya conmuta solo.
- **Los hitos ya disparan notificación.** 6 puntos llaman a `sendNotification` +
  `getOrderPhone`: pago (Stripe webhook · Redsys · confirm-payment), presupuesto
  (quote), revisión (review-request) y entrega/lista (delivery).
- **El teléfono del cliente ya se captura** (PR #74): `Order.clientPhone`, leído por
  `getOrderPhone`. Antes esto era el bloqueante; ya está resuelto.
- **Hay páginas de estado del pedido**: `/pedido/[reference]`, `/consulta-pedido`,
  `/area-cliente/pedido/[reference]`.

Lo que falta de verdad es lo de abajo.

## El verdadero trabajo de la Fase 2

1. **Activar el canal WhatsApp Business** — número remitente verificado en Twilio/Meta
   + **plantillas de mensaje aprobadas**. Hoy `TWILIO_WHATSAPP_FROM` (presumiblemente)
   no está seteado, así que todo sale por SMS.
2. **Cumplir las reglas de WhatsApp** — los mensajes *business-initiated* (los nuestros:
   los disparamos nosotros, no responde el cliente) **exigen plantilla pre-aprobada por
   Meta** fuera de la ventana de 24 h. No se puede mandar texto libre. El código actual
   manda `Body` libre (vale para SMS, **no** para WhatsApp business-initiated). Hay que
   migrar el envío WhatsApp a la **Content API de Twilio** (plantilla por Content SID +
   variables), conservando SMS con el body actual como fallback.
3. **El hito "en proceso"** — `DeliveryState.EN_PROCESO` **no notifica hoy**. El brief
   pide "pago → en proceso → lista"; pago y lista existen, falta "en proceso".
4. **Estado en vivo** — que cada mensaje lleve deep-link a la página de estado del
   pedido y que esa página muestre el hito actual con claridad.

## Decisión de arquitectura

El mensaje se bifurca por canal:
- **WhatsApp**: plantilla aprobada (Content SID) + variables. Categoría **utility**
  (transaccional) — pago/proceso/entrega encajan; no es marketing.
- **SMS (fallback)**: el `body` de texto de `lib/sms-templates.ts` actual.

`sendNotification` recibe un identificador de plantilla lógico (p. ej. `"pago_confirmado"`)
que mapea a (Content SID WhatsApp, función de texto SMS). Un solo punto de verdad.

## Hitos y plantillas

| Hito | Estado/disparo | SMS hoy | Plantilla WhatsApp (nueva) | ¿Notifica hoy? |
|---|---|---|---|---|
| **Pago confirmado** | webhook pago | `smsPagoConfirmado` | `pago_confirmado` (ref, plazo) | ✅ (SMS) |
| **En proceso** | `DeliveryState→EN_PROCESO` | — | `en_proceso` (ref) | ❌ **falta disparo** |
| **Lista / descárgala** | `DeliveryState→TRADUCIDO` | `smsTraduccionLista` | `traduccion_lista` (ref, url) | ✅ (SMS) |
| Presupuesto listo | quote enviada | `smsPresupuestoListo` | (opcional) | ✅ (SMS) |
| Recordatorio pago | cron/manual | `smsRecordatorioPago` | (opcional) | ✅ (SMS) |
| Reseña | post-entrega | `smsReviewRequest` | (opcional, marketing → cuidado) | ✅ (SMS) |

**Alcance (decidido 2026-05-25):** WhatsApp solo para los **3 hitos del núcleo**
(pago → en proceso → lista). Menos plantillas que aprobar = setup más rápido, y cubre
el recorrido esencial post-pago. Presupuesto, recordatorio y reseña **siguen por SMS**
(la reseña además es marketing → opt-in más estricto, mejor fuera por ahora).

## Reglas de negocio / WhatsApp Business (a verificar)

- **Plantillas utility** se aprueban rápido y se pueden enviar sin ventana de 24 h
  abierta (al ser transaccionales con opt-in). Confirmar categoría con Twilio.
- **Opt-in**: el cliente da su número en la puerta para recibir avisos del pedido → es
  opt-in funcional. Añadir microcopy explícito ("te avisamos por WhatsApp del estado").
- **Coste**: WhatsApp factura por conversación (24 h). 3 hitos por pedido ≈ controlable.
- **Número (decidido 2026-05-25):** el WhatsApp Business reusa el **número de atención
  +34 951 333 614**. El cliente ve un número conocido y puede responder al mismo sitio.
  Implica registrarlo como sender de WhatsApp en Twilio (y no usarlo en paralelo en una
  app de WhatsApp personal/Business del móvil, que entraría en conflicto).

## Desglose por bloques

| Bloque | Qué se hace | Entregable |
|---|---|---|
| **2.1 · Setup WhatsApp Business** | Alta del sender en Twilio + verificación Meta. Redactar y **enviar a aprobar** las 3 plantillas utility (pago/proceso/lista). Setear `TWILIO_WHATSAPP_FROM`. *Gating externo: aprobación Meta tarda días.* | Canal WhatsApp activo + plantillas aprobadas |
| **2.2 · Envío por plantilla** | Migrar el envío WhatsApp de `sendNotification` a la Content API (Content SID + variables), con SMS de fallback intacto. Mapa lógico hito→(WA template, SMS fn). | Los hitos existentes salen por WhatsApp cuando hay número |
| **2.3 · Hito "en proceso"** | Disparar notificación en la transición a `EN_PROCESO` (en `lib/workflow-server.ts` o donde se cambie deliveryState). Plantilla `en_proceso`. | Los 3 hitos del brief completos |
| **2.4 · Estado en vivo** | Deep-link a `/pedido/[reference]` en cada mensaje; pulir esa página para que muestre el hito actual (pago → en proceso → lista) con timeline claro. | El cliente ve el estado sin preguntar |
| **2.5 · QA + lanzamiento** | Probar los 3 hitos end-to-end con un número real, en WhatsApp y en fallback SMS. Verificar coste y entrega. Desplegar. | Fase 2 en producción |

## Riesgos

- **Aprobación de plantillas por Meta (2.1) es el gating real** — es externo y puede
  tardar días/semana. Arrancar 2.1 cuanto antes; 2.2-2.4 se pueden codear en paralelo
  contra plantillas en estado "pending".
- **Ventana de 24 h y categoría de plantilla** — si Meta clasifica mal una plantilla
  como marketing, requiere opt-in más estricto. Redactar como utility puro.
- **Coste por conversación** — vigilar con volumen real.

## Métrica

- **% de pedidos con WhatsApp entregado** por hito (vs fallback SMS).
- **Reducción de mensajes entrantes de soporte** tipo "¿cómo va lo mío?" — el objetivo
  del brief (menos soporte). Comparar contra el baseline de consultas a Juan.

## Decisiones (2026-05-25)

1. **Número WhatsApp:** el de atención **+34 951 333 614** (no dedicado).
2. **Alcance:** solo los **3 hitos del núcleo** (pago → en proceso → lista).
3. **Idioma:** por ahora **ES** (el idioma del visitante llega en Fase 3).

## Primer paso (cuando se arranque la fase)

Bloque **2.1** es el camino crítico por la aprobación de Meta. Acción concreta de Juan:
dar de alta +34 951 333 614 como sender WhatsApp en Twilio y enviar a aprobar las 3
plantillas utility (`pago_confirmado`, `en_proceso`, `traduccion_lista`). Mientras Meta
aprueba, se codean 2.2-2.4 contra plantillas en estado pending.
