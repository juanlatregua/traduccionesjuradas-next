# 002 — Prisma 6 + PostgreSQL (Vercel Postgres)

## Contexto
Se necesitaba un ORM con tipado fuerte para TypeScript y una base de datos relacional para pedidos, presupuestos, pagos y colaboradores.

## Decisión
Prisma como ORM + PostgreSQL alojado en Vercel (Prisma Postgres).

## Consecuencias
- **Positivo:** Tipado end-to-end, generación automática de client, migraciones versionadas
- **Positivo:** Integración nativa con Vercel (connection pooling, edge-ready)
- **Negativo:** Shadow database no funciona con Prisma Postgres → `prisma migrate dev` falla (P3006)
- **Workaround:** Usar `prisma db push` + crear SQL manual en `prisma/migrations/`. Script `prisma-deploy-safe.mjs` maneja P3005 en producción
- **Negativo:** No se puede usar Prisma Studio remoto fácilmente (requiere tunnel)
