# Deploy — Proceso de deploy a producción

## Deploy automático (principal)
Cada push a `main` dispara auto-deploy en Vercel.

```bash
git push origin main    # → Vercel auto-deploy
```

El build en Vercel ejecuta:
1. `npm install`
2. `prisma generate` + `prisma-deploy-safe.mjs` (migración segura)
3. `next build` (incluye Velite para blog MDX)

## Deploy manual
```bash
vercel --prod --yes     # Desde la raíz del proyecto
```
Útil para deployar sin push a git (hotfixes urgentes).

## Verificación pre-deploy
```bash
npm run build                      # Debe pasar sin errores
npm run test:unit                  # Tests unitarios
npx tsc --noEmit --skipLibCheck    # Type-check (ignorar errores Prisma/Velite/Anthropic)
```

## Script prisma-deploy-safe.mjs
Ubicación: `scripts/prisma-deploy-safe.mjs`

Flujo:
1. Ejecuta `prisma migrate deploy`
2. Si falla con P3005 (migration already applied) → ejecuta `prisma db push`
3. Siempre ejecuta `prisma generate` al final

## Variables de entorno en Vercel
- Configuradas en Vercel Dashboard → Settings → Environment Variables
- ~80 variables (ver `.env.example` para listado completo)
- Críticas: `DATABASE_URL`, `NEXTAUTH_SECRET`, `STRIPE_SECRET_KEY`, `SENDGRID_API_KEY`

## Rollback
Vercel mantiene deployments anteriores. Para rollback:
1. Ir a Vercel Dashboard → Deployments
2. Encontrar el deployment anterior
3. Click "Promote to Production"

## Smoke test post-deploy
```bash
bash scripts/go-no-go-smoke.sh
```

## Notas
- No hay staging environment — se trabaja directo contra producción
- Los cron jobs (`/api/cron/*`) requieren `CRON_SECRET` header para ejecutarse
- Las URLs de Stripe webhook deben apuntar al dominio de producción
