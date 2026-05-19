---
description: Auditor pre-merge para API routes — auth-gate, Prisma, zod, rate-limit, manejo de errores
---

# /audit-route

Checklist de seguridad y consistencia para un `route.ts` de `app/api/`. Pensado para correr **antes de mergear** una API nueva o modificada. No arregla nada — solo audita y reporta OK/FAIL/WARN con número de línea.

## Uso

```
/audit-route <ruta-al-route.ts>
```

Ejemplos:
- `/audit-route app/api/orders/[reference]/route.ts`
- `/audit-route app/api/estimador/route.ts`

Si el path no termina en `route.ts`, falla y avisa: *"Esperaba un archivo `route.ts`. Recibí: <X>."*

## 1. Lee el archivo y su contexto

- Abre `<ruta>` completo con `Read`.
- Abre `middleware.ts` (raíz del repo) — el middleware actual gestiona redirecciones y `410 Gone` de URLs WP legacy, **no** una whitelist de auth. La protección de API real vive dentro de cada `route.ts`.
- Abre `prisma/schema.prisma` solo si el route usa `prisma.*` (búsqueda rápida con `grep "prisma\\." <ruta>`).
- Identifica el tipo de ruta:
  - **Cron**: `app/api/cron/*` → debe validar un secreto de cron (header `Authorization` con `CRON_SECRET` o equivalente).
  - **Webhook**: `app/api/**/webhook*` o rutas de Stripe/Redsys → debe verificar la firma del provider (`STRIPE_WEBHOOK_SECRET`, firma Redsys) antes de procesar el body.
  - **Pública sin pedido** (`/api/estimador`, `/api/documents/analyze`, `/api/chat`, `/api/session/*`): no requiere sesión, pero sí rate-limit.
  - **Pública con pedido** (`/api/orders/[reference]/public`, `/q/*`, `/encargo/*`): debe verificar el token firmado con `verifyOrderToken` de `lib/order-token.ts`.
  - **Protegida** (admin, zona-traductor): debe llamar `getServerSession` (NextAuth 4) o validar la sesión OTP de staff antes de tocar DB.

## 2. Ejecuta los 10 chequeos

Para cada uno: ✅ OK / ❌ FAIL / ⚠️ WARN / ➖ N/A. Anota línea concreta.

### Chequeo 1 — Method handlers
- Exporta al menos uno de `GET | POST | PUT | PATCH | DELETE`.
- Cada handler devuelve `NextResponse` / `Response`.

### Chequeo 2 — Auth-gate
- **Cron**: primera operación valida el secreto de cron.
- **Webhook**: verifica firma del provider antes de procesar el body.
- **Pública con pedido**: llama `verifyOrderToken` y rechaza si el token es inválido o caducado, antes de devolver datos del pedido.
- **Protegida**: llama `getServerSession` (o valida la cookie OTP de staff) AND verifica que la sesión existe antes de tocar DB.
- **Pública sin pedido**: anótalo y pasa al chequeo 3.

### Chequeo 3 — Rate limit (públicas)
- Toda ruta pública con efectos (`POST/PUT/PATCH/DELETE`) o que llama a un servicio de pago (Stripe/Redsys) o IA (Claude) debe aplicar rate-limit por IP.
- Busca el helper real del repo con `grep -rl -i "ratelimit\|rate-limit" lib/`.
- FAIL si una ruta pública mutante o de pago no tiene rate-limit. WARN si falta en una GET pública.

### Chequeo 4 — Modelos Prisma reales
- Para cada `prisma.<modelo>.<método>`, verifica que `model <Modelo>` exista en `prisma/schema.prisma` (camelCase del modelo).
- FAIL si referencia un modelo inexistente (típico tras rebase o rename sin propagar).

### Chequeo 5 — Validación de input (POST/PUT/PATCH)
- Body parseado con zod (`<Schema>.parse(body)` / `.safeParse(body)`) **O** validación manual explícita con type guards.
- WARN si solo se hace `await req.json()` sin validación.

### Chequeo 6 — Manejo de errores
- Bloque `try/catch` alrededor de I/O (DB, fetch externo, Stripe, Redsys, Microsoft Graph, Twilio).
- `catch` devuelve `NextResponse.json({ error: ... }, { status: 4xx|5xx })`, **no** propaga ni devuelve `new Response("Error")`.
- FAIL si el catch silencia con `try { ... } catch {}` vacío.

### Chequeo 7 — SMS y email fire-and-forget
- Las llamadas a SMS (Twilio) deben ser fire-and-forget (`.catch(console.error)`) — **nunca** bloquean la respuesta (convención CLAUDE.md).
- WARN si un `await sendSms(...)` bloquea la respuesta del handler.

### Chequeo 8 — Logging consistente
- En `catch`: `console.error("[<contexto>]", err)` con prefijo identificable (ej. `[api/orders/reference]`).
- WARN si usa `console.log` en lugar de `console.error` para errores.

### Chequeo 9 — Type safety
- Sin `as any` (FAIL).
- Sin `// @ts-ignore` / `// @ts-expect-error` sin comentario explicativo (WARN).
- Sin `: any` en parámetros o tipos de retorno públicos (FAIL).

### Chequeo 10 — Respuesta y env vars
- Usa `NextResponse.json(...)`, no `new Response(JSON.stringify(...))`.
- Códigos coherentes: 200/201 éxito, 400 input inválido, 401 sin auth, 403 sin permiso, 404 no encontrado, 409 conflicto, 429 rate-limit, 500 error servidor.
- Para cada `process.env.<VAR>`, verifica que aparezca en >1 archivo (`git grep "<VAR>"`). WARN si solo está aquí (posible typo).

## 3. Formato de salida

```markdown
# /audit-route — <ruta>
_Tipo: <Cron | Webhook | Pública con pedido | Pública sin pedido | Protegida>_

| # | Chequeo | Estado | Línea | Detalle |
|---|---|---|---|---|
| 1 | Method handlers | ✅ | 12 | Exporta GET, POST |
| 2 | Auth-gate | ❌ | — | No verifica verifyOrderToken siendo ruta pública de pedido |
| ... | ... | ... | ... | ... |

## Veredicto
- **N FAIL · M WARN · X OK**
- ¿Mergeable?: **NO** porque chequeo 2 está rojo. Arreglar antes:
  1. <fix concreto con línea aproximada>

## Notas
- <nota libre sobre cualquier cosa rara fuera de los 10 chequeos>
```

## 4. Reglas duras

- **No edites el archivo auditado.** `/audit-route` es read-only.
- **No propongas refactors** (renombrar handlers, mover código a libs). Solo señala fallos.
- **No abras más de 5 archivos** para auditar (route + middleware + schema + 2 de contexto). Si necesitas más, di que la ruta es demasiado compleja y sugiere dividirla.
- **Si la ruta es trivial** (<30 líneas, sin DB, sin auth nontrivial), salta los N/A y emite veredicto rápido.
- **Veredicto NO mergeable** solo con ≥1 FAIL. Los WARN se listan pero no bloquean.

## 5. Excepciones conocidas (CLAUDE.md)

- Las rutas de pago públicas validan estado del pedido + rate-limit por diseño — el chequeo 2 pasa si lo hacen, aunque no llamen `getServerSession`.
- El webhook de Stripe no usa sesión: el chequeo 2 pasa si verifica `STRIPE_WEBHOOK_SECRET` antes de procesar.
- `app/api/auth/[...nextauth]` lo gestiona NextAuth. Si el usuario lo pasa, responde: *"Esta ruta la gestiona NextAuth directamente. No aplica `/audit-route`."*
