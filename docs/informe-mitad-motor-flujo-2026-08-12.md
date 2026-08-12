# Informe (mitad motor) — flujo completo tj.net ↔ lavori · 12-ago-2026

Mitad del informe conjunto correspondiente al motor (tj.net). La mitad del tablón
vive en el repo lavori: `research/informe-mitad-tablon-flujo-2026-08-12.md`.
Contrato de la Fase 2 propuesta: `research/contrato-fase2-eventos-2026-08-12.md` (repo lavori).

## 1. Construido y EN PROD hoy (12-ago)

| Commit | Qué |
|---|---|
| d3648ac | Solicitud de precio vía lavori para LEADS WhatsApp sin pedido (`LavoriPriceRequest`, ref `LEAD-<hash>`, panel violeta en el builder) + carriles ro→Maria y en→Vanessa |
| 7cea5b3 | Campo `especificaciones` (≤2000, sin PII, fuera de la huella de idempotencia) + textarea en el builder — adenda desplegada por lavori (su 19acad8) |
| 3694f56 | Acuse SMS/WhatsApp al lead cuando sus docs salen hacia el traductor (solo si hay teléfono) |
| db3228c | **Fix del acuse**: el envío era fire-and-forget y la lambda se congelaba antes de que la petición saliera hacia Twilio (cero llamadas en su log). Ahora con `await`; un fallo de Twilio no tumba la solicitud |
| 1b96e2a | Revert del carril temporal no→demo (55153aa) — escenario E2E desmontado |

## 2. Validado E2E en prod (con la cuenta demo de lavori, carril noruego temporal)

- **Ida**: lead → encargo dirigido en lavori con doc y especificaciones concatenadas ✓
- **Vuelta precio_propuesto**: 201 en ~1,8s, persistido (35 €/2d) ✓ · **corrección** 35→40 € actualizada ✓
- **encargo_aceptado / factura_subida sobre LEAD**: 201 + email a staff "gestionar a mano", sin persistencia (diseño) ✓
- **Acuse SMS**: entregado al 5º lead tras el fix ✓ (Twilio verificado: cuenta active, saldo 12,89 USD)
- **SIN validar aún**: caminos ricos de PEDIDO (asignación automática de Collaborator + Expense con factura) — se validan con el primer pedido real (previsto: Haylen). Secret v3 en runtime prod incluido.

## 3. Fase 2 — alcance del motor y estimaciones (contrato ya ajustado con lavori)

1. **Emisor `precio_aceptado`** (motor→lavori, ~media sesión): hook donde el presupuesto
   del lead/pedido se acepta o paga → POST a `lavori.es/api/motor/precio-aceptado` con
   `{ref, precioParaTi, nota?}`. **La cifra es la del propio traductor** (priceCents de la
   solicitud), nunca el precio de venta. Necesita vínculo persistido presupuesto↔solicitud
   (columna nueva, migración pequeña). 409 → email a staff con `estado`/`aceptadoPor`.
2. **Receptor `entrega_subida`** (lavori→motor, ~2h): calco de `factura_subida`; un evento
   por fichero, idempotencia `(evento, encargoId, adjuntoId)`, tope 15MB/fichero (la factura
   conserva 10MB), blob a `orders/<ref>/entregas-lavori/`, OrderEvent + email staff.
   **Opción B decidida por Juan**: la entrega NO va sola al cliente — botón "revisar y
   enviar al cliente" en la ficha. Opción A (automático, quizá por-traductor con rodaje)
   queda como evolución futura.

## 4. Directrices de Juan para el flujo de cara al cliente (backlog motor)

1. La respuesta con la cotización debe llevar el mejor precio + **nombre del traductor
   jurado y su nº MAEC** ("da seriedad").
2. El enlace del SMS/email debe ser el **link directo a su presupuesto** (`/q/<token>`),
   no la página general.

## 5. Pendientes / decisiones abiertas

- **OK de Juan para construir la Fase 2** (con este informe y el del tablón delante).
- Acuse por WhatsApp real: prod no tiene `TWILIO_WHATSAPP_FROM`; hoy el acuse sale como
  SMS ("Tjuradasnet"). Alta del canal WhatsApp en Twilio + plantillas = tarea aparte si se quiere.
- Hallazgo trasladado a lavori (arreglado por ellos, 6199f49): corregir precio ya no borra
  la nota del candidato. Anti-doble-tap del mini-form (e7e45d8) también suyo.
- Primer pedido real (Haylen) validará: secret v3 runtime, asignación automática, Expense.
