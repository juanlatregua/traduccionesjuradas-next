# v2 · Fase 1 — La puerta · Plan detallado

**Fecha:** 2026-05-19 · **Estado:** aprobado · **Ventana:** semanas 3-7
**Depende de:** brief en `docs/v2-brief.md`. La línea base **ya existe** en el histórico — no hay espera.

---

## Hallazgo que da forma a esta fase (2026-05-19)

El minado de la BD reveló que hay **dos funnels**, y el que importa no es el que parecía:

- El funnel `OrderSession` (`/start → upload → review → checkout`) está **muerto**: 3 sesiones en 30 días.
- El funnel **real** es `/presupuesto-instantaneo → DocumentAnalysis → Order`: **~72 análisis/mes**.
- Conversión real de ese funnel: de **78 documentos analizados en 90 días, 1 generó pedido y 0 llegaron a pago**.

Es decir: ~72 personas al mes suben un documento, reciben un precio en segundos… y se van.
El presupuesto instantáneo es hoy un callejón sin salida. **Eso es exactamente lo que arregla
la Fase 1** — y por eso es la prioridad, no un lujo.

## Decisión de arquitectura: Opción A

El análisis-IA **es** la entrada del funnel. El documento deja de ser un paso
intermedio y pasa a ser el input.

El motor de análisis ya existe y es potente: `lib/ai-document.ts`, `app/api/estimador`,
la página `/presupuesto-instantaneo` y el modelo `DocumentAnalysis` (tipo, categoría,
idiomas, palabras, complejidad, confianza, precio normal/urgente, plazo). La Fase 1
**no construye IA** — recablea y reencuadra lo que hay para convertirlo en la puerta,
y le añade lo único que hoy le falta: una salida hacia el pago.

Retirar el funnel `OrderSession` es de bajo riesgo precisamente porque ya nadie lo usa.

## El recorrido nuevo

```
  Pantalla 1 — LA PUERTA
  ┌─────────────────────────────────────────┐
  │  Suelta tu(s) documento(s)               │
  │  → si el original está en español:       │
  │     pide idioma de salida                │
  │  → ¿para cuándo lo necesitas? (fecha)    │
  └────────────────────┬────────────────────┘
                       ▼  10 segundos
  ┌─────────────────────────────────────────┐
  │  DIAGNÓSTICO                             │
  │  tipo · ¿necesita jurada? · precio ·     │
  │  plazo · validez · ✓ llega a tu fecha    │
  └────────────────────┬────────────────────┘
                       ▼
  Pantalla 2 — PAGAR (1 paso)  →  Confirmación
```

`/start`, `/upload` y `/review` desaparecen como pasos separados.

## Reglas de negocio (decididas)

### Plazos de entrega (a partir del pago)

| Idioma | Plazo |
|---|---|
| Francés · 1-2 páginas | 24 h |
| Francés · más de 2 páginas | 48 h |
| Alemán, inglés, portugués, italiano | 48 h |
| Árabe | 72 h (3 días) |

El plazo es determinista por (idioma, nº de páginas). La pregunta de fecha límite
se hace **antes** del diagnóstico; el diagnóstico muestra el plazo calculado y si
cumple la fecha que pide el cliente.

### Idioma de salida

- Original en español → la puerta **pide el idioma de salida** (es ambiguo).
- Original en cualquier otro idioma → destino = español por defecto, no se pregunta.

### Multi-documento

La puerta acepta varios documentos de golpe (drop múltiple), un diagnóstico por documento.

## Desglose semana a semana

| Bloque | Sem. | Qué se hace | Entregable |
|---|---|---|---|
| **1.1 · El diagnóstico completo** | 3 | Auditar el motor (`estimador` + `ai-document` + `DocumentAnalysis`). Ampliar el output a las 5 cosas: tipo, ¿necesita jurada?, precio, plazo, validez. Implementar la tabla de plazos. Medir el tiempo real (¿son 10 s? OCR vs visión de Claude). | El motor devuelve el diagnóstico completo, medido |
| **1.2 · La pantalla puerta** | 4 | Construir la entrada: drop múltiple + pregunta de idioma de salida (si original ES) + pregunta de fecha límite + tarjeta de diagnóstico. Casos especiales en UI: baja confianza, idioma no automatizado, multi-documento. | La puerta funciona como pantalla, con diagnóstico real, sin pago |
| **1.3 · El puente de datos** | 5 | *Pieza delicada.* Que el diagnóstico (`DocumentAnalysis`) cree/alimente la `OrderSession` que el checkout espera. Conservar el preset regularización 2026. | Desde la puerta se llega a checkout con documento, precio y plazo correctos |
| **1.4 · Colapso del funnel + cuenta atrás** | 6 | Retirar `/start`, colapsar `/upload`+`/review`, redirigir enlaces inbound (incluidos los CTA de las landings de regularización). Cuenta atrás "paga antes de las X y la tienes mañana". | El funnel nuevo de 2 pantallas, end-to-end en preview |
| **1.5 · Integración, QA y lanzamiento** | 7 | Pruebas de todos los caminos (FR auto, idioma colaborador, baja confianza, multi-doc, preset). Actualizar la instrumentación `FunnelEvent` a los pasos nuevos. Comparar conversión contra la línea base. Desplegar. | Fase 1 en producción |

## Riesgos

- **El puente de datos (1.3) es el riesgo real.** Hoy hay dos modelos paralelos:
  el funnel usa `OrderSession` + `OrderDocument`; el estimador usa `DocumentAnalysis`.
  La Fase 1 los une sin romper el checkout, acoplado a `OrderSession`. Día de colchón previsto.
- **Rendimiento de los "10 segundos"** — 1.1 lo mide pronto, a propósito.
- **Retirar `/start`** sin romper SEO ni enlaces entrantes (las landings de
  regularización 2026 apuntan a `/start?p=regularizacion-2026`).

## Casos especiales a cubrir

- **Preset regularización 2026** (25 €/doc) — la puerta debe aceptar el preset y conservarlo hasta el pago.
- **Idiomas no automatizados** (árabe, inglés → colaborador) — precio cerrado igualmente si la confianza es alta; "presupuesto a confirmar" solo si la confianza es baja.
- **Documentos que la IA no analiza bien** (baja confianza o fallo) — degradar con elegancia a un camino de presupuesto manual; nunca un callejón sin salida.

## Métrica y línea base

La estrella es **% de personas que, tras recibir el presupuesto instantáneo, acaban pagando**.

La línea base **ya existe** en el histórico — no hubo que esperar a recoger datos: de
~78 documentos analizados en los últimos 90 días, 1 generó pedido y **0 llegaron a pago**.
El presupuesto instantáneo convierte hoy a pago **≈ 0 %**. Cualquier cosa que la Fase 1
mueva por encima de cero es ganancia neta. La vista `/admin/funnel` mide este recorrido
en vivo (ventanas de 7/30/90 días) para validar el progreso.
