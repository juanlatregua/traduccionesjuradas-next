# traduccionesjuradasweb2025

## Pago online (Stripe Checkout)

Variables necesarias en Vercel:

- `STRIPE_SECRET_KEY`: clave secreta de Stripe.
- `STRIPE_WEBHOOK_SECRET`: secreto del endpoint webhook de Stripe.
- `STRIPE_QUOTES_WEBHOOK_SECRET` (opcional): secreto dedicado para webhook de presupuestos.
- `NEXT_PUBLIC_SITE_URL`: URL pública del sitio (ej. `https://www.traduccionesjuradas.net`).
- `DATABASE_URL`: conexión PostgreSQL para guardar pedidos y estado de pago.
- `RATE_LIMIT_STORE=db` (recomendado): rate limit distribuido usando la base de datos.

Flujo implementado:

- `POST /api/checkout` crea pedido y sesión de pago en Stripe.
- `POST /api/payment/stripe/webhook` confirma el pago y actualiza estado en base de datos (endpoint canónico).
- `POST /api/payment/webhook` queda como alias legacy del endpoint canónico.
- `GET /api/pedido/:reference` devuelve estado público de un pedido.
- `components/PriceEstimator.tsx` añade botón `Pagar y confirmar pedido`.
- Retornos:
  - `/pago/exito`
  - `/pago/cancelado`

Persistencia:

- `prisma/schema.prisma` define `Order` y `OrderEvent`.
- `lib/orders.ts` gestiona creación y actualización de pagos.

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
