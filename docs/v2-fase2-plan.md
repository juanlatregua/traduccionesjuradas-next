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
- **Número (REVISADO 2026-05-28):** número **DEDICADO +34 616 547 161**, NO el de atención.
  El +34 951 333 614 es el WhatsApp humano de Juan; convertirlo a la API lo inutilizaría como
  app y desviaría las respuestas de clientes a un webhook. El 616 547 161 está libre y se trae
  a Twilio (no hay que comprarlo). Solo necesita un móvil para recibir el código de verificación
  una vez; luego vive en la nube (NO instalar WhatsApp en él). Trade-off: el cliente ve un número
  distinto → mitigar con display name verificado ("Traducciones Juradas") + microcopy
  "no respondas aquí, escríbenos al 951 333 614".

## Desglose por bloques

| Bloque | Qué se hace | Entregable |
|---|---|---|
| **2.1 · Setup WhatsApp Business** | Alta del sender en Twilio + verificación Meta. Redactar y **enviar a aprobar** las 3 plantillas utility (pago/proceso/lista). Setear `TWILIO_WHATSAPP_FROM`. *Gating externo: aprobación Meta tarda días.* | Canal WhatsApp activo + plantillas aprobadas |
| **2.2 · Envío por plantilla** | Migrar el envío WhatsApp de `sendNotification` a la Content API (Content SID + variables), con SMS de fallback intacto. Mapa lógico hito→(WA template, SMS fn). | Los hitos existentes salen por WhatsApp cuando hay número |
| **2.3 · Hito "en proceso"** ✅ HECHO (#83) | Disparo de notificación al asignar traductor (transición a `EN_PROCESO`, en la ruta de assign). Plantilla `smsEnProceso`. Sale por SMS hoy. | Los 3 hitos del brief completos |
| **2.4 · Estado en vivo** ✅ HECHO (#84) | La página `/pedido/[reference]` ya estaba construida (stepper + tarjetas + timeline); añadido el deep-link a ella en `smsPagoConfirmado` y `smsEnProceso` (ya lo tenía `smsTraduccionLista`). | El cliente ve el estado sin preguntar |
| **2.5 · QA + lanzamiento** | Probar los 3 hitos end-to-end con un número real, en WhatsApp y en fallback SMS. Verificar coste y entrega. Desplegar. | Fase 2 en producción |

## Riesgos

- **🚫 BLOQUEO ACTIVO (2026-05-28): restricción de comercio de Meta.** Al intentar el alta del
  sender en Twilio, el portfolio comercial **TraduccionesJuradas.net** sale restringido ("no
  cumple la Política de comercio de WhatsApp") → bloquea crear la WABA/sender y añadir método de
  pago. Es falso positivo (traducción jurada no encaja en ninguna categoría prohibida; la web ya
  tiene /privacidad, /aviso-legal, /contacto). **Acción: apelar en
  `business.facebook.com/accountquality` → "Solicitar revisión" + completar el perfil de empresa.
  Lo resuelve Meta en días. Hasta que se levante, NO se puede avanzar el alta.** El "no puedo
  añadir método de pago" es síntoma de esto, no la causa (y vía Twilio el cobro va por Twilio).
- **⚠️ Regla dura — `TWILIO_WHATSAPP_FROM`:** NO setear hasta tener sender real registrado + las
  3 plantillas approved + 2.2 (Content API) desplegado. Un número de WhatsApp no registrado
  devuelve Twilio **63007** y, sin fallback, se tragaba TODOS los avisos en silencio (incidente
  detectado y resuelto 2026-05-28; ya hay fallback WA→SMS en `sendNotification`, PR #82).
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

## Decisiones

1. **Número WhatsApp (REVISADO 2026-05-28):** número **dedicado +34 616 547 161**. Antes
   (2026-05-25) se pensó reusar el de atención +34 951 333 614 — descartado porque es el
   WhatsApp humano de Juan y la API lo inutilizaría como app.
2. **Alcance (2026-05-25):** solo los **3 hitos del núcleo** (pago → en proceso → lista).
3. **Idioma (2026-05-25):** por ahora **ES** (el idioma del visitante llega en Fase 3).

## Primer paso (cuando se arranque la fase)

Bloque **2.1** es el camino crítico. **Ahora mismo BLOQUEADO por la restricción de comercio
de Meta (ver Riesgos) → primero apelar.** Una vez levantada: dar de alta **+34 616 547 161**
como sender WhatsApp en Twilio (conectar el portfolio Meta TraduccionesJuradas.net), verificar
el número con el código, fijar display name "Traducciones Juradas", y enviar a aprobar las 3
plantillas utility (`pago_confirmado`, `en_proceso`, `traduccion_lista`). **2.3 y 2.4 ya están
hechas** (#83 y #84); **2.2 (Content API)** se codea cuando haya plantillas approved + Content
SIDs, y recién entonces se re-pone `TWILIO_WHATSAPP_FROM=616547161`.
