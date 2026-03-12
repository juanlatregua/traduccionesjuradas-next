# Payment API — Stripe, Redsys, webhooks

## Flujo exacto

### Stripe (principal)
```
POST /payment/card → createCheckoutSession() → redirect Stripe
Stripe → POST /payment/stripe/webhook → verifyWebhookSignature()
→ checkout.session.completed → updateOrderPayment(STRIPE) → PAGO_VALIDADO
```

### Redsys (tarjeta española)
```
POST /payment/card → buildRedsysFormData() → form submit a Redsys
Redsys → POST /payment/redsys/notification → verifyRedsysNotification()
→ decode Ds_MerchantData → referencia → updateOrderPayment(REDSYS)
```

### Manual (Bizum/Transferencia)
```
POST /orders/{ref}/payment-proof → upload justificante → PAGO_VALIDADO
POST /orders/{ref}/confirm-payment → staff confirma manualmente
```

## Eventos que se escuchan
- **Stripe:** `checkout.session.completed` (pago exitoso)
- **Redsys:** Notification POST con `Ds_MerchantParameters` (codificado base64)

## Idempotencia
Cada pago genera un `OrderPaymentEvent` con `idempotencyKey = sha256(reference|provider|providerEventId)`.
Constraint unique previene cobros dobles. Duplicados crean event `payment.duplicate_ignored`.

## NUNCA modificar sin leer esto
- `STRIPE_WEBHOOK_SECRET` — si no coincide, webhooks rechazados silenciosamente
- Orden en webhook: **primero BD**, luego email/SMS
- `lib/order-payment-idempotency.ts` — romper = cobros dobles
- La firma de Redsys usa `REDSYS_SECRET_KEY`, NO el secret de Stripe
- Rate limit: 30 req/10min por IP en endpoints de pago

## Archivos clave
- `lib/stripe.ts` — client + checkout session + verify webhook
- `lib/redsys.ts` — form data + verify notification
- `lib/payment-config.ts` — capabilities + provider resolution
- `lib/payment-stripe-webhook.ts` — handler del webhook Stripe
- `lib/order-payment-idempotency.ts` — deduplicación sha256
