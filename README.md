# traduccionesjuradasweb2025

## Pago online (Stripe Checkout)

Variables necesarias en Vercel:

- `STRIPE_SECRET_KEY`: clave secreta de Stripe.
- `NEXT_PUBLIC_SITE_URL`: URL pública del sitio (ej. `https://www.traduccionesjuradas.net`).

Flujo implementado:

- `POST /api/checkout` crea sesión de pago en Stripe.
- `components/PriceEstimator.tsx` añade botón `Pagar y confirmar pedido`.
- Retornos:
  - `/pago/exito`
  - `/pago/cancelado`
