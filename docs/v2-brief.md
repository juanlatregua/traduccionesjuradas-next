# traduccionesjuradas.net — Brief v2

**Fecha:** 2026-05-19 · **Estado:** aprobado · **Fecha objetivo:** v2 en producción el **1 de septiembre 2026**

---

## La promesa (una sola frase)

> **El cliente sabe en 10 segundos si lo necesita, cuánto cuesta y cuándo lo tiene — y desde que paga hasta que descarga, no vuelve a preguntar nada.**

Toda tarea de v2 sirve a esta frase. Si no la sirve, no entra en v2.

---

## Por qué (origen)

En mayo 2026 se detectó que el webhook de Stripe llevaba 2,5 meses mal configurado:
pagos cobrados que no generaban pedido, y un cliente que descubrió el fallo por
WhatsApp un día tarde. El problema de fondo no fue el bug: fue que **la web podía
fallar en silencio y no había forma de saberlo**. v2 nace de ahí — convertir una
web que se gestiona a base de sustos en un producto medido y fiable.

---

## Objetivos (en orden de prioridad)

1. **Más pedidos** — mejorar la conversión del funnel. Métrica estrella.
2. **Menos trabajo manual** — automatizar reconciliación, avisos y seguimiento.
3. **Menos angustia / soporte** — que el cliente no tenga que escribir para saber dónde está su pedido.

## Alcance

- **Dentro:** la web traduccionesjuradas.net — captación, funnel de pedidos, post-venta.
- **Fuera, a propósito:**
  - Chatbot agéntico que cierra el pedido → **v2.1** (post-septiembre). La "puerta"
    de la Fase 1 ya entrega ~80 % de ese valor.
  - "Compañero de trámite" (guía del trámite completo) → **v3**.
  - Puente automático pedido web → TraduCAT y visión ecosistema → fuera de v2.

---

## El proceso — antes y después

### ANTES — el proceso hoy

```
  Google / SEO
      │
      ▼
  Landing  (solo en español)
      │
      ▼
  /start ─→ /upload ─→ /review ─→ /checkout ─→ /confirmation
    1          2          3           4             5
      │
      │   ¿Lo necesito?   ¿Cuánto?   ¿Llega a tiempo?
      │      → sin respuesta hasta el paso 4
      ▼
  Muchos abandonan aquí   (¿cuántos? — no se mide)
      │
      ▼
  PAGA  30,25 €
      │
      ▼
  AGUJERO NEGRO: el webhook puede fallar en silencio,
  ni email ni SMS al cliente
      │
      ▼
  Cliente angustiado  ──→  WhatsApp a Juan
  Juan se entera 1 día tarde, y lo arregla a mano
```

### DESPUÉS — el proceso v2

```
  Google / SEO
      │
      ▼
  Landing en el idioma del visitante     FR / ES / AR
      │
      ▼
  ┌─────────────────────────────────┐
  │   Suelta tu documento aquí      │
  └─────────────────────────────────┘
      │
      ▼   10 segundos
  DIAGNÓSTICO-IA INSTANTÁNEO
  tipo de documento · ¿necesita jurada? · precio · plazo · validez
      │
      ▼
  Pago en 1 paso  ──→  confirmado al instante
      │
      ▼
  WhatsApp automático:
  ✓ Pago recibido   ✓ En proceso   ✓ Lista — descárgala
      │
      ▼
  Cliente descarga. Cero preguntas.
  Juan lo ve todo en su panel · alerta si algo falla
```

### La pantalla clave — "la puerta"

Al entrar:

```
┌──────────────────────────────────────────────────────────┐
│  traduccionesjuradas.net           FR ▾        [ Acceder ] │
├──────────────────────────────────────────────────────────┤
│    Traducción jurada — sabe precio y plazo en 10 seg.    │
│       ┌────────────────────────────────────────┐         │
│       │      Suelta tu documento aquí          │         │
│       │      o haz clic para subir             │         │
│       └────────────────────────────────────────┘         │
│   Traductor jurado MAEC nº 3850    ·   Entrega 24-48 h   │
└──────────────────────────────────────────────────────────┘
```

10 segundos después de subir:

```
┌──────────────────────────────────────────────────────────┐
│  Documento analizado                                     │
│   Acta de nacimiento (Francia)                           │
│  ────────────────────────────────────────────────────   │
│   ¿Necesitas jurada?    Sí — para tu trámite oficial     │
│   Precio                30,25 €  (IVA incl.)             │
│   Entrega               mañana mié. 20 may. · 14:00      │
│   Idioma                Francés → Español                │
│                                                          │
│   Paga antes de las 18:00 y la tienes mañana             │
│             [   Continuar y pagar   →   ]                │
└──────────────────────────────────────────────────────────┘
```

---

## Las 4 fases

Cada fase se despliega a producción y vive. Nada de un "v2" monolítico de 6 meses.

### Fase 0 · Cimientos — semanas 1-2 (19 may – 1 jun)
Observabilidad. Prerrequisito de todo lo demás: sin línea base de métricas no se
puede demostrar que v2 mejora nada.
- Alerta cuando el webhook de Stripe falla.
- Cron de reconciliación diaria Stripe ↔ BD.
- Instrumentar los 5 pasos del funnel (analítica de conversión).
- **Entregable:** línea base de las 4 métricas.

### Fase 1 · La puerta — semanas 3-7 (2 jun – 5 jul) — *motor de crecimiento*
- Sacar el análisis-IA de documentos del backend a la entrada de la web.
- Diagnóstico en 10 s: tipo, ¿necesita jurada?, precio, plazo, validez.
- Reordenar el funnel: fecha de necesidad primero, cuenta atrás visible.
- **Entregable:** sube el % de visitantes que llegan a pago.

### Fase 2 · El acompañamiento — semanas 8-11 (6 jul – 2 ago) — *menos trabajo y soporte*
- WhatsApp Business con aviso por hito (pago → en proceso → lista).
- Página de estado del pedido en vivo.
- **Entregable:** caen los mensajes "¿dónde está mi pedido?".

### Fase 3 · Idioma + pulido + lanzamiento — semanas 12+ (septiembre)
- Funnel en francés (y árabe si da tiempo).
- QA, comparación de las 4 métricas contra la línea base.
- **v2 en producción: 1 de septiembre 2026.**

> Agosto es colchón (vacaciones, rinde poco). El grueso se construye mayo-julio
> y septiembre es lanzamiento + pulido, coincidiendo con la temporada alta de trámites.

---

## Métricas de éxito

Línea base medida en la Fase 0. Los objetivos numéricos se fijan **sobre la cifra
real**, no antes.

| # | Métrica | Mide |
|---|---|---|
| 1 | % de rebote en landing | Llegar |
| 2 | % de visitantes que llegan a pago | Decidir — *cifra estrella* |
| 3 | nº de mensajes "¿dónde está mi pedido?" | Esperar |
| 4 | reseñas / valoración post-entrega | Recibir |

---

## Principios de trabajo

- **Una capa cada vez.** No abrir dos frentes. Una fase se mide antes de pasar a la siguiente.
- **Las métricas se definen el día 1**, no al final.
- **`CONTEXT.md` es el cerebro del proyecto** — estado, fase actual, siguiente paso.
- **Cada fase se despliega y vive.** Mejoras pequeñas en producción, medidas.
- **El "fuera de alcance" es sagrado.** Una v2 que intenta hacerlo todo no sale el 1 de septiembre.
