---
description: Aplica un cambio de schema Prisma con prisma db push de forma segura — preview del SQL, aviso de destructivo, generate
---

# /migration

Aplica un cambio en `prisma/schema.prisma` siguiendo el protocolo de CLAUDE.md: este proyecto usa **`prisma db push`**, NO `prisma migrate dev` (la shadow DB falla). `db push` sincroniza la base de datos PostgreSQL con el schema sin crear migraciones versionadas.

Este comando previsualiza el cambio, avisa de operaciones destructivas y aplica el push de forma controlada.

## Uso

```
/migration                       # Aplica los cambios pendientes en schema.prisma
/migration "<descripción corta>"  # Igual, con una etiqueta para el resumen
```

## 1. Pre-flight checks

Antes de tocar nada, verifica en paralelo:

```bash
# 1. Hay cambios sin commitear en el schema?
git diff --stat prisma/schema.prisma

# 2. Qué va a cambiar exactamente
git diff prisma/schema.prisma

# 3. A qué DB apunta el push (no la imprimas entera, solo confirma cuál env)
grep -n "DATABASE_URL\|DIRECT_URL" .env.local 2>/dev/null | sed 's/=.*/=<oculto>/'
```

Si **no hay cambios** en `prisma/schema.prisma`, para: *"No hay cambios sin sincronizar en `schema.prisma`. Edita el schema primero y vuelve a llamar /migration."*

⚠️ **`db push` apunta a la DB de `DATABASE_URL`.** Si esa URL es la de producción, el cambio impacta producción de inmediato. Confírmalo con el usuario antes de aplicar si el diff toca tablas con datos.

## 2. Previsualiza el SQL (sin aplicar)

`prisma migrate diff` calcula el SQL que `db push` ejecutaría, **sin** tocar la DB ni necesitar shadow DB:

```bash
npx prisma migrate diff \
  --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma \
  --script
```

Esto compara el estado real de la DB (`--from-schema-datasource`) contra el schema deseado (`--to-schema-datamodel`) y emite el SQL. Léelo entero antes de continuar.

Si el comando falla, **detente y reporta el error tal cual** — no inventes SQL. Lo habitual:
- Schema no parsea → arregla la sintaxis Prisma primero.
- `P1001` → no conecta a la DB (revisa `DATABASE_URL`).
- `P3009` → hay una migración legacy en estado `failed` (ver §6).

## 3. Revisa el SQL y avisa de lo destructivo

Comprueba el SQL generado:

- [ ] Tipos PostgreSQL correctos (`TEXT`, `INTEGER`, `TIMESTAMP`, `JSONB`…).
- [ ] **`DROP TABLE` / `DROP COLUMN`** → destructivo, pérdida de datos.
- [ ] **`ALTER COLUMN ... SET NOT NULL`** sobre tabla con datos → falla salvo que haya `DEFAULT` o backfill previo.
- [ ] Renombrados: Prisma no detecta renames, los ve como `DROP` + `ADD` → pérdida de datos. Si es un rename real, hay que hacerlo a mano con `ALTER TABLE ... RENAME`.

Reporta al usuario:

```markdown
## Cambio de schema — preview

**SQL que aplicará `db push`:**
- ✅ ADD COLUMN `notifiedAt` TIMESTAMP NULL en `Order`
- ⚠️ DROP COLUMN `legacyField` en `Quote` — PÉRDIDA DE DATOS

**¿Destructivo?:** SÍ / NO

¿Aplico el push? <Si es destructivo, pide confirmación explícita.>
```

## 4. Aplica el push

Solo cuando el usuario confirme:

```bash
# Cambio no destructivo:
npx prisma db push

# Cambio destructivo (solo con confirmación explícita del usuario):
npx prisma db push --accept-data-loss
```

`prisma db push` regenera el cliente Prisma automáticamente al terminar. Si quieres forzarlo:

```bash
npx prisma generate
```

## 5. Después de aplicar

Resume al usuario:

```markdown
✅ Schema sincronizado con `prisma db push`.

- Cambio: <descripción>
- Cliente Prisma regenerado.

**Recuerda:** commitea `prisma/schema.prisma` para que el repo refleje el estado real de la DB.
Si el cambio afecta a un modelo documentado, considera `/doc-sync` y revisar `.claude/skills/prisma-patterns.md`.
```

## 6. Migraciones legacy y P3009

El repo conserva una carpeta `prisma/migrations/` de cuando se usaba `migrate`. Si un **build de Vercel falla con `P3009`** ("migration failed"), una migración antigua quedó en estado `failed` en la tabla `_prisma_migrations` y bloquea el deploy. Solución (no la apliques sin confirmar con el usuario):

```bash
# Ver qué migración está en failed
# (consultar la tabla _prisma_migrations en la DB)

# Marcar las migraciones legacy como aplicadas para desbloquear el build
npx prisma migrate resolve --applied "<nombre_de_la_migracion>"
```

Esto solo escribe metadatos en `_prisma_migrations`; no toca el schema real (que ya está sincronizado vía `db push`).

## 7. Reglas duras

- **Nunca `prisma migrate dev`** — la shadow DB falla en este setup. Si alguien lo ejecutó por error y aparece `P3006`, recuérdalo.
- **`migrate diff` es solo lectura** — úsalo para previsualizar, nunca para generar migraciones que luego se apliquen con `migrate deploy`.
- **Cambios destructivos** (`--accept-data-loss`) requieren confirmación explícita del usuario. Nunca lo pongas por defecto.
- **No edites `prisma/schema.prisma`** desde este comando. Asume que el usuario ya lo editó; tu trabajo es previsualizar y aplicar.
- **No commitees por tu cuenta** — recuérdale al usuario que commitee el schema.
