# Arquitectura del sistema

## Diagrama general

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENTES                             │
│  Web pública  │  Área cliente  │  Presupuesto instantáneo   │
└───────┬───────┴───────┬────────┴──────────┬─────────────────┘
        │               │                   │
        ▼               ▼                   ▼
┌─────────────────────────────────────────────────────────────┐
│                    Next.js App Router                        │
│  10 idiomas │ 50 ciudades │ 9 docs │ Blog │ Funnel │ Admin  │
├─────────────────────────────────────────────────────────────┤
│                      API Routes (~77)                       │
│  /orders  /payment  /documents  /quotes  /encargo  /cron    │
├──────┬──────┬──────┬──────┬──────┬──────┬───────────────────┤
│Prisma│Stripe│Redsys│S.Grid│Twilio│Claude│  Vercel Blob      │
│  +   │      │      │      │      │  AI  │  (storage)        │
│ PG   │      │      │      │      │      │                   │
└──────┴──────┴──────┴──────┴──────┴──────┴───────────────────┘
```

## Flujo de un pedido (inicio a fin)

```
1. SOLICITUD
   Cliente accede a presupuesto-instantaneo/ o contacto/
   └→ Opción A: IA analiza documento → precio instantáneo
   └→ Opción B: Formulario manual → email a staff

2. CREACIÓN DEL PEDIDO
   Funnel: start → upload → review → checkout
   └→ OrderSession (cookie tj_session) → OrderDocument[]
   └→ Se genera Order con reference único

3. PAGO
   ├→ Stripe Checkout (tarjeta internacional)
   ├→ Redsys (tarjeta española)
   ├→ Bizum/Transferencia (subida justificante)
   └→ Webhook/upload → OrderPaymentEvent (idempotente)
       └→ workflow: PENDIENTE_PAGO → PAGO_VALIDADO
       └→ Email confirmación + SMS

4. ASIGNACIÓN
   Admin asigna traductor (interno o colaborador externo)
   ├→ Interno: asigna en zona-traductor
   └→ Externo: CollaboratorAssignment
       └→ Email con link /encargo/[token]
       └→ Colaborador envía presupuesto
       └→ Admin acepta/rechaza/pide revisión
       └→ Colaborador acepta → sube traducción

5. TRADUCCIÓN
   Traductor trabaja en zona-traductor/workspace/[reference]
   └→ Editor dos columnas (original + traducción)
   └→ workflow: EN_TRADUCCION

6. ENTREGA
   ├→ Subida de archivo traducido
   ├→ Email al cliente con link de descarga
   ├→ Solicitud de reseña Google
   └→ workflow: TRADUCIDO → ENTREGADO

7. FACTURACIÓN
   └→ BillingData → generación PDF factura
   └→ Cierre financiero (margen, reconciliación)
```

## Flujo de pago (detalle)

```
                    ┌──────────────┐
                    │   Cliente    │
                    │  elige pago  │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │  Stripe  │ │  Redsys  │ │  Manual  │
        │ Checkout │ │   Form   │ │  Upload  │
        └────┬─────┘ └────┬─────┘ └────┬─────┘
             │            │            │
             ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │ Webhook  │ │ Notific. │ │ Validate │
        │ verify   │ │ verify   │ │ file     │
        └────┬─────┘ └────┬─────┘ └────┬─────┘
             │            │            │
             └────────────┼────────────┘
                          ▼
                 ┌─────────────────┐
                 │  Idempotency    │
                 │  sha256 check   │
                 └────────┬────────┘
                          ▼
                 ┌─────────────────┐
                 │ Update Order    │
                 │ PAID + workflow │
                 │ + Email + SMS   │
                 └─────────────────┘
```

## Capas del sistema

### App Layer (app/)
- Server Components para páginas (SEO + Prisma directo)
- Client Components para interactividad (formularios, uploads)
- Route Handlers para API REST

### Business Logic (lib/)
- `workflow.ts` + `workflow-server.ts` — máquina de estados del pedido
- `pricing.ts` + `pricing-engine/` — cálculo de precios por idioma/par
- `collaborators.ts` — gestión colaboradores externos
- `email.ts` — 18 tipos de email transaccional
- `stripe.ts`, `redsys.ts` — integración gateways de pago

### Data Layer (prisma/)
- 20 modelos PostgreSQL via Prisma ORM
- Singleton client en `lib/prisma.ts`
- Migraciones manuales (shadow DB no funciona)

### External Services
- **Stripe** — pagos con tarjeta (checkout sessions + webhooks)
- **Redsys** — pagos con tarjeta española (form redirect + notification)
- **SendGrid** — todos los emails transaccionales
- **Twilio** — SMS/WhatsApp (fire-and-forget)
- **Claude AI** — análisis de documentos + chat
- **Vercel Blob** — almacenamiento de archivos
