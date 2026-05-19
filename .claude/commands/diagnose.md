---
description: Bug hunter — lee un stacktrace, identifica causa raíz en 1 frase, propone diff mínimo y sugiere test de regresión
---

# /diagnose

Senior debugger para traduccionesjuradas-net. El usuario pega un stacktrace o error de **Vercel Functions logs**, **build logs** o **navegador**. Tu trabajo: causa raíz en una frase, fix mínimo como diff, y test de regresión si tiene sentido.

## Uso

```
/diagnose
<pega el stacktrace o el mensaje de error aquí>
```

Si el usuario no pega nada, pídelo: *"Pégame el stacktrace o el output de Vercel logs y voy."*

## 1. Identifica los frames útiles

Filtra del stacktrace:

- **Ignora** frames de `node_modules/`, `.next/`, `/var/task/node_modules/`, `node:internal`, runtimes (`/runtime/index.mjs`), rutas de Vercel `/vercel/path0/`.
- **Mantén** frames de `app/`, `lib/`, `components/`, `prisma/`, `tests/`, `scripts/`, archivos raíz (`middleware.ts`, `next.config.mjs`).
- Si solo hay un mensaje sin stacktrace (ej. `PrismaClientKnownRequestError: P2002`), salta este paso y trata el mensaje como pista.

## 2. Abre los archivos referenciados

Para cada frame útil:

- Lee el archivo con `Read`, acotado a ±30 líneas de la línea del frame.
- Si el frame es un `route.ts` de `app/api/`, lee también `middleware.ts` y los modelos Prisma usados (`grep "prisma\\." <ruta>` → `prisma/schema.prisma`).
- Si el error es de **NextAuth 4** (`[next-auth][error]`, `JWT`, `OAuthCallback`, `Session`), lee la config de NextAuth (`grep -rl "NextAuth\|authOptions" app/api/auth lib/`).
- Si el error es de **Stripe/Redsys**, lee el módulo de pagos (`grep -rl "stripe\|redsys" lib/`) y el webhook si aplica.
- Si el error es de **Prisma** (P2002, P2003, P2025…), lee la sección del schema correspondiente.
- Si el error es de **Velite / `@/content`** (build), recuerda que el contenido MDX se genera en build — un EISDIR/ENOENT suele ser un `.mdx` mal ubicado o frontmatter inválido.

## 3. Diagnóstico

Devuelve este formato exacto:

```markdown
# /diagnose

## Causa raíz
<UNA frase. Sin "creo que" ni "podría ser". Si no estás seguro al 80%, di "hipótesis principal" y añade "hipótesis alternativa">

## Contexto
- **Archivo:** `<ruta>:<línea>`
- **Trigger:** <qué petición / cron / acción del usuario lo dispara>
- **Impacto:** <crítico/medio/bajo — explica en media línea>

## Fix propuesto
```diff
--- a/app/.../route.ts
+++ b/app/.../route.ts
@@
-  línea original
+  línea corregida
```

## Test de regresión
<Si tiene sentido: archivo + esqueleto con `node:test` (framework del repo: `npm run test:unit`).
Si no procede — error de config o env vars — di "No procede: <razón>".>

```ts
// tests/unit/<nombre>.test.ts
import test from "node:test";
import assert from "node:assert/strict";

test("<descripción del caso que reproduciría el bug>", () => {
  // arrange / act / assert
});
```

## Comprobaciones manuales antes de mergear
- [ ] <paso 1>
- [ ] <paso 2>
```

## 4. Reglas duras

- **No modifiques zonas sensibles sin avisar:**
  - `prisma/schema.prisma` — un cambio de schema se aplica con `prisma db push` (ver `/migration`); descríbelo, no lo apliques en el diff.
  - `middleware.ts` y `next.config.mjs` — solo se añaden paths/redirects, no se reestructuran.
- **No propongas refactors** (mover archivos, renombrar exports, extraer hooks). Solo el fix más pequeño que resuelve el bug.
- **No añadas dependencias.** Si la solución parece pedirlo, verifica primero que no exista algo equivalente en `lib/`.
- **No silencies el error** con `try/catch` vacío salvo que la causa raíz sea literalmente "este error no debe propagarse".
- **No uses `as any`** para tapar tipos.
- **Errores Prisma comunes** — interpreta el código antes de leer código:
  - `P2002` → constraint único violado (duplicado en `INSERT`).
  - `P2003` → foreign key falla (falta el registro padre o la cascada está mal).
  - `P2025` → registro no existe (en `UPDATE`/`DELETE`).
  - `P1001` → no conecta a la DB (probable env var `DATABASE_URL`).
  - `P3009` → migración previa en estado `failed` bloquea el build (ver `/migration`, sección legacy).
- **Errores NextAuth 4 comunes**:
  - `OAuthCallback` → mismatch de `redirect_uri` o credenciales Google OAuth.
  - `JWT_SESSION_ERROR` / `decryption operation failed` → `NEXTAUTH_SECRET` cambió o falta.
- **Stripe webhook 400** → casi siempre `STRIPE_WEBHOOK_SECRET` desincronizado con el endpoint del Stripe Dashboard.
- **Errores preexistentes conocidos (no son regresión):** `tsc --noEmit` con `@prisma/client` / `@anthropic-ai/sdk` / `@/content` (se resuelven con `prisma generate` y build de Velite). No los diagnostiques como bug nuevo.

## 5. Si no puedes localizar el archivo

> No encuentro `<ruta>:<línea>` en el repo actual. ¿Es de una rama distinta o un deploy viejo? Si tienes el SHA del deploy, dímelo y reviso con `git show <sha>:<ruta>`.

Sin el archivo no inventes el fix. Pide aclaración.
