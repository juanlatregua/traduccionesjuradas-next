# 006 — Stripe (principal) + Redsys para pagos con tarjeta

## Contexto
Clientes internacionales (Stripe) y españoles (Redsys, preferido por bancos locales). También se necesitaba soporte para pagos manuales (Bizum, transferencia).

## Decisión
- Stripe como gateway principal (Checkout Sessions)
- Redsys como alternativa española (redsys-easy SDK)
- Bizum/transferencia como pago manual con subida de justificante
- PayPal configurado pero desactivado

## Consecuencias
- **Positivo:** Cobertura total: internacional (Stripe) + local (Redsys) + informal (Bizum)
- **Positivo:** Idempotencia por sha256(reference|provider|providerEventId) previene cobros dobles
- **Positivo:** Feature flag `ENABLE_CARD_PAYMENTS` permite activar/desactivar gateways
- **Negativo:** Tres flujos de pago = tres puntos de fallo + complejidad en webhooks
- **Negativo:** Redsys SDK tiene documentación pobre — debugging difícil
- **Negativo:** PayPal desactivado añade código muerto (candidato a eliminar)
