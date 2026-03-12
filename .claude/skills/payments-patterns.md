# Payments — Stripe, Redsys, webhooks e idempotencia

## Gateways activos
- **Stripe** (principal) — tarjeta internacional
- **Redsys** (redsys-easy 5.3.2) — tarjeta española
- **Bizum/Transferencia** — manual con justificante
- PayPal — configurado pero **desactivado**

## Archivos clave
- `lib/stripe.ts` — `createCheckoutSession()`, `verifyWebhookSignature()`
- `lib/redsys.ts` — `buildRedsysFormData()`, `verifyRedsysNotification()`
- `lib/paypal.ts` — `createPayPalOrder()`, `capturePayPalOrder()`
- `lib/payment-config.ts` — `getPaymentCapabilities()`, `resolveCardProvider()`
- `lib/payment-gating.ts` — `hasUploadedSourceDocument()`
- `lib/payment-stripe-webhook.ts` — `handleStripeOrderWebhook()`
- `lib/order-payment-idempotency.ts` — deduplicación por sha256

## API routes

### Inicio de pago
| Ruta | Método | Gateway |
|------|--------|---------|
| `/api/payment/card` | POST | Stripe o Redsys (auto-detecta) |
| `/api/payment/stripe` | POST | Stripe directo |
| `/api/payment/redsys` | POST | Redsys directo |
| `/api/payment/paypal` | POST | PayPal (crear orden) |
| `/api/payment/paypal/capture` | POST | PayPal (capturar) |

### Webhooks
| Ruta | Origen |
|------|--------|
| `/api/payment/stripe/webhook` | Stripe events |
| `/api/payment/redsys/notification` | Redsys callbacks |

### Manual
| Ruta | Uso |
|------|-----|
| `/api/orders/[ref]/payment-proof` | Subida justificante (Bizum/transferencia) |
| `/api/orders/[ref]/confirm-payment` | Confirmación manual staff |

## Flujo Stripe
```
POST /api/payment/card → createCheckoutSession() → redirect Stripe
→ checkout.session.completed → POST /api/payment/stripe/webhook
→ verifyWebhookSignature() → updateOrderPayment(STRIPE) → workflow PAGO_VALIDADO
→ sendPaymentConfirmedEmail() + SMS
```

## Flujo Redsys
```
POST /api/payment/card → buildRedsysFormData() → form auto-submit a Redsys
→ POST /api/payment/redsys/notification → verifyRedsysNotification()
→ decode Ds_MerchantData → referencia → updateOrderPayment(REDSYS)
```

## Flujo manual (Bizum/Transferencia)
```
POST /api/orders/{ref}/payment-proof → validar archivo (5MB, JPG/PNG/WebP/PDF)
→ upload Blob orders/{ref}/comprobantes/ → updateOrderPayment() → PAGO_VALIDADO
```

## Idempotencia de pagos
```
Key = opay_{sha256(reference|provider|providerEventId)}
→ Unique constraint en OrderPaymentEvent.idempotencyKey
→ P2002 = duplicado → crear event payment.duplicate_ignored
```

Pagos manuales: `providerEventId = manual:{reference}:{method}`

## Validación pre-pago
1. Pedido existe
2. `paymentStatus !== PAID`
3. Workflow en: PENDIENTE_PAGO | JUSTIFICANTE_SUBIDO | PRESUPUESTO_ENVIADO
4. Documento fuente subido (`hasUploadedSourceDocument()`)
5. Rate limit no excedido (30 req/10min para gateways)

## Rate limits
| Endpoint | Límite | Ventana |
|----------|--------|---------|
| Card/Stripe/Redsys | 30 req | 10 min |
| PayPal create/capture | 30 req | 10 min |
| Payment proof upload | 10 req | 10 min |
| Document payment | 10 req | 24h |

## Variables de entorno
```
STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
REDSYS_SECRET_KEY, REDSYS_MERCHANT_CODE, REDSYS_TERMINAL, REDSYS_ENV
PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, NEXT_PUBLIC_PAYPAL_CLIENT_ID, PAYPAL_ENV
ENABLE_CARD_PAYMENTS, CARD_PROVIDER
```

## Qué NO tocar sin entender el flujo completo
- `lib/order-payment-idempotency.ts` — romper deduplicación = cobros dobles
- `STRIPE_WEBHOOK_SECRET` — si no coincide, los webhooks se rechazan silenciosamente
- Orden de operaciones en webhook: **primero** actualizar BD, **luego** enviar emails/SMS
- `verifyRedsysNotification()` — la firma usa el secreto del merchant, no el de Stripe
