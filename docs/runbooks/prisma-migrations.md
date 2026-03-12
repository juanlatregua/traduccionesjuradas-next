# Prisma Migrations — Crear y aplicar sin romper datos

## Problema conocido
`prisma migrate dev` requiere shadow database, que **no funciona** con Prisma Postgres (error P3006). Nunca usar este comando.

## Flujo correcto

### 1. Editar schema
```bash
# Editar prisma/schema.prisma
```

### 2. Aplicar a la BD de desarrollo
```bash
npx prisma db push
```
Esto aplica el schema directamente sin crear migración.

### 3. Crear migración SQL manual
```bash
mkdir -p prisma/migrations/$(date +%Y%m%d%H%M%S)_descripcion_corta
```
Escribir el SQL equivalente en `migration.sql`:
```sql
-- prisma/migrations/YYYYMMDDHHMMSS_descripcion_corta/migration.sql
ALTER TABLE "Order" ADD COLUMN "newField" TEXT;
```

### 4. Registrar la migración como aplicada
```bash
npx prisma migrate resolve --applied YYYYMMDDHHMMSS_descripcion_corta
```

## En producción

El script `scripts/prisma-deploy-safe.mjs` se ejecuta en el build de Vercel:
1. Intenta `prisma migrate deploy`
2. Si falla con P3005 → ejecuta `prisma db push` automáticamente
3. Siempre ejecuta `prisma generate`

## Qué NO hacer
- **NUNCA** `prisma migrate dev` — falla con Prisma Postgres
- **NUNCA** borrar carpetas de `prisma/migrations/` — rompe el historial
- **NUNCA** renombrar campos sin migración explícita — Prisma lo interpreta como drop+create
- **NUNCA** cambiar tipos de campo con datos existentes sin verificar compatibilidad

## Comandos útiles
```bash
npx prisma db push         # Aplica schema (desarrollo)
npx prisma generate        # Regenera client
npx prisma studio          # Inspector visual (localhost:5555)
npx prisma validate        # Valida schema sin aplicar
npx prisma format          # Formatea schema.prisma
```
