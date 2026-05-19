---
description: Auditoría semanal de deuda técnica — TODOs viejos, archivos hinchados, rutas sin auth, any en TS
---

# /rot

Escanea el repo y devuelve un inventario priorizado de deuda técnica en `traduccionesjuradas-net`. No arregles nada, solo lista. El objetivo es triarlo el lunes por la mañana.

## 1. Recolección (en paralelo)

Ejecuta estos comandos y guarda la salida bruta:

```bash
# TODO/FIXME/HACK en código de app
git grep -nE "TODO|FIXME|HACK|XXX" -- 'app/' 'lib/' 'components/'

# Archivos largos (>300 líneas) — app/, lib/, components/
find app lib components -type f \( -name '*.ts' -o -name '*.tsx' \) -exec wc -l {} + | awk '$1 > 300' | sort -rn

# Uso de `any` (por archivo)
git grep -nE ": any( |\)|\]|,|;|>)|<any>|as any" -- 'app/**/*.ts' 'app/**/*.tsx' 'lib/**/*.ts' 'components/**/*.tsx'

# console.log en producción (excluye scripts/ y tests/)
git grep -n "console\.\(log\|debug\)" -- 'app/' 'lib/' 'components/'

# Rutas API (para cruzar con auth)
find app/api -name 'route.ts' | sed 's|app||; s|/route.ts||'
```

Para los TODO/FIXME, calcula la edad real con `git blame` sobre la línea y descarta los <30 días.

## 2. Cruce de auth en API routes

Para cada `route.ts` de `app/api/` que **no** sea cron (`/api/cron/*`), **no** sea webhook (Stripe/Redsys), y **no** sea un endpoint público intencional (`/api/estimador`, `/api/documents/analyze`, `/api/chat`, `/api/session/*`), abre el archivo y verifica:

- ¿Llama a `getServerSession` (NextAuth 4) o valida la sesión OTP de staff?
- Si es un endpoint público de pedido (`/api/orders/[reference]/public`, `/q/*`, `/encargo/*`): ¿llama a `verifyOrderToken`?
- Si es mutante y público: ¿aplica rate-limit?

Si una ruta que mueve datos sensibles no tiene ninguna de estas protecciones → **CRÍTICO**.

## 3. Reglas de exclusión

No marques como "para refactorizar" estas zonas:

- `prisma/schema.prisma` — cambios van por `prisma db push` (ver `/migration`).
- `middleware.ts` y `next.config.mjs` — solo se añaden paths/redirects.
- Contenido generado por Velite (`.velite/`, `@/content`).
- `node_modules/`, `.next/`.

Si hay hallazgos en estas zonas, ponlos en una sección aparte "Solo informativo (zona congelada)".

## 4. Salida — tabla Markdown priorizada

```markdown
# /rot — Inventario de deuda técnica
_Fecha: YYYY-MM-DD · Rama: <branch>_

## 🔴 CRÍTICO (auth, secrets, regresiones)
| Hallazgo | Archivo:línea | Esfuerzo | Notas |
|---|---|---|---|

## 🟠 ALTA (archivos hinchados, deuda con coste de mantenimiento)
| Hallazgo | Archivo:línea | Esfuerzo | Notas |
|---|---|---|---|

## 🟡 MEDIA (any, console.log, TODO 30-90 días)
| Hallazgo | Archivo:línea | Esfuerzo | Notas |
|---|---|---|---|

## 🟢 BAJA (TODO >90 días, microajustes)
| Hallazgo | Archivo:línea | Esfuerzo | Notas |
|---|---|---|---|

## ℹ️ Zona congelada (solo informativo)
| Hallazgo | Archivo:línea |
|---|---|

## Resumen
- N hallazgos críticos, M altos, X medios, Y bajos
- Top 3 sugerencias para el sprint
```

Esfuerzo: **S** (<1h) · **M** (1-4h) · **L** (>4h).

## 5. Reglas de redacción

- Una fila por hallazgo, no agrupar.
- "Notas" es de UNA frase. Razón breve, no fix sugerido.
- No inventes hallazgos. Si una sección está vacía, escribe "_Sin hallazgos._" debajo del encabezado.
- Nunca incluyas archivos de `node_modules/`, `.next/`, `.velite/`.
- No propongas cambios en este output. `/rot` solo lista.
- Los errores `tsc --noEmit` preexistentes (`@prisma/client`, `@anthropic-ai/sdk`, `@/content`) y el fallo conocido de `tests/unit/order-actions.test.ts` **no** son deuda — no los listes.
