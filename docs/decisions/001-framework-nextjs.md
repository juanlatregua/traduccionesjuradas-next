# 001 — Next.js 14 con App Router

## Contexto
Se necesitaba un framework fullstack para una web comercial con SEO crítico, panel admin, APIs REST y procesamiento de pagos. El proyecto combina landing pages estáticas con funcionalidad dinámica compleja.

## Decisión
Next.js 14 con App Router (no Pages Router). TypeScript 5.5.4.

## Consecuencias
- **Positivo:** SSR/SSG para SEO, API routes integradas, Server Components para admin (Prisma directo sin API)
- **Positivo:** Deploy trivial en Vercel (auto-deploy desde main)
- **Negativo:** App Router era relativamente nuevo al inicio — algunas APIs inestables
- **Negativo:** Middleware limitado (no soporta Node.js APIs completas)
