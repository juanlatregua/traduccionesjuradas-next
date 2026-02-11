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

## Acceso cliente con Google (Auth.js)

Variables necesarias en Vercel:

- `NEXTAUTH_URL`: URL pública del sitio (ej. `https://www.traduccionesjuradas.net`).
- `NEXTAUTH_SECRET`: secreto aleatorio para firmar sesión.
- `GOOGLE_CLIENT_ID`: credencial OAuth de Google.
- `GOOGLE_CLIENT_SECRET`: secreto OAuth de Google.

Rutas implementadas:

- `/api/auth/[...nextauth]`: autenticación Google.
- `/acceso`: pantalla de acceso opcional.
- `/area-cliente`: área protegida por sesión.
