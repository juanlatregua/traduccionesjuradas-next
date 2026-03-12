# Local Setup — Arrancar desde cero

## Requisitos
- Node.js 18+ (recomendado 20 LTS)
- PostgreSQL local o acceso a Prisma Postgres
- Cuentas: Google Cloud (OAuth), SendGrid, Stripe (test mode)

## Pasos

### 1. Clonar y dependencias
```bash
git clone <repo> && cd traduccionesjuradas
npm install
```

### 2. Variables de entorno
```bash
cp .env.example .env.local
```
Editar `.env.local` con valores reales. Mínimo necesario para desarrollo:
```
DATABASE_URL=postgresql://...
NEXTAUTH_SECRET=<random-string>
NEXTAUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=<desde Google Cloud Console>
GOOGLE_CLIENT_SECRET=<id>
ORDER_TOKEN_SECRET=<random-string>
STAFF_EMAILS=tu@email.com
```

### 3. Base de datos
```bash
npx prisma db push       # Aplica schema a la BD
npx prisma generate      # Genera el client
```

### 4. Verificar
```bash
npm run dev               # http://localhost:3000
npx prisma studio         # http://localhost:5555 (inspector BD)
```

### 5. Tests
```bash
npm run test:unit          # Tests unitarios
npm run test:e2e           # Tests e2e (requiere BD)
```

## Opcional: Stripe webhooks en local
```bash
stripe listen --forward-to http://localhost:3000/api/payment/stripe/webhook
# Copiar el webhook signing secret a STRIPE_WEBHOOK_SECRET en .env.local
```

## Notas
- El test `order-actions.test.ts` falla con ERR_MODULE_NOT_FOUND — es preexistente, ignorar
- `tsc --noEmit` mostrará errores de @prisma/client y @anthropic-ai/sdk — ejecutar `prisma generate` para los primeros; los de Anthropic son por tipos no instalados localmente
- Velite genera contenido en build — los imports `@/content` fallan en tsc pero funcionan en `next build`
