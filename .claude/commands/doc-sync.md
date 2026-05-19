---
description: Sincroniza CLAUDE.md con cambios recientes en API, schema o estructura del repo
---

# /doc-sync

Audita si `CLAUDE.md` sigue siendo fiel al estado real del repo y propone un diff exacto cuando ha quedado desfasado. Pensado para correr después de sesiones que tocaron API routes, schema Prisma o estructura de `app/`.

## Uso

```
/doc-sync                # Compara CLAUDE.md con últimos 20 commits
/doc-sync --since <sha>  # Compara contra un commit base concreto
/doc-sync --last 50      # Compara con últimos 50 commits
```

## 1. Detecta cambios relevantes

Ejecuta en paralelo:

```bash
git log --since="14 days ago" --pretty=format:'%h %s' --no-merges
git diff --name-only HEAD~20 HEAD 2>/dev/null

find app -name 'page.tsx' | wc -l                 # Total de páginas (CLAUDE.md menciona "~70")
find app/api -name 'route.ts' | wc -l             # Total de routes (CLAUDE.md menciona "~77")
grep -c "^model " prisma/schema.prisma            # Total de modelos (CLAUDE.md menciona "20")
grep -cE "^enum " prisma/schema.prisma            # Total de enums (CLAUDE.md menciona "15")
ls lib/ components/                               # Estructura para el bloque WHAT
```

Identifica si los siguientes elementos están desfasados en CLAUDE.md:

| Sección de CLAUDE.md | Cuándo se desfasa |
|---|---|
| Estructura `app/` (bloque WHAT) | Si aparecen carpetas nuevas en `app/`, `lib/` o `components/` |
| Conteo "~70 páginas" / "~77 API routes" | Si el total real se desvía >10% |
| Conteo "20 modelos, 15 enums" | Si `prisma/schema.prisma` cambia el número |
| Stack | Si `package.json` añade/quita dependencias mayores (Stripe, Redsys, NextAuth, Prisma, Velite…) |
| Reglas inmutables / NO usar | Si se introduce o retira una herramienta del stack |
| Precios | Si `lib/pricing-engine/` o `lib/session-pricing.ts` cambian tarifas que CLAUDE.md cita |
| Errores preexistentes | Si un error listado ya no aplica o aparece uno nuevo recurrente |
| Detalle por módulo | Si un skill de `.claude/skills/` se añade, renombra o elimina |

## 2. Lee CLAUDE.md completo

```bash
cat CLAUDE.md
```

No asumas — comprueba párrafo por párrafo qué dice exactamente. Revisa también si los precios citados coinciden con el código real.

## 3. Diff propuesto

Para cada desfase detectado, propón un diff exacto en formato unified:

```markdown
## /doc-sync — desfase detectado

### Cambio 1: <descripción>
**Razón:** <commit X tocó Y, CLAUDE.md menciona Z que ya no es cierto>

```diff
--- a/CLAUDE.md
+++ b/CLAUDE.md
@@
- línea actual
+ línea corregida
```

### Cambio 2: ...

---

## Resumen
- N cambios propuestos
- Severidad: <alta si menciona archivos/herramientas inexistentes / baja si es solo un conteo desfasado>

¿Aplico los cambios? Confirma y los hago.
```

## 4. Cambios típicos a buscar

- **Nueva carpeta `lib/X/` o `app/(grupo)/`** con varios archivos → posiblemente toca el bloque WHAT.
- **Cambio de stack** (ej. se reemplaza un proveedor) → actualizar bloque HOW / Reglas inmutables.
- **Modelo o enum Prisma renombrado/eliminado** → buscar referencias en CLAUDE.md y en `.claude/skills/prisma-patterns.md`.
- **Tarifa cambiada** en el pricing engine → CLAUDE.md y la memoria (`project_pricing_architecture.md`) deben cuadrar.
- **Convención nueva** confirmada por feedback del usuario → si está en `memory/feedback_*.md`, es autoritativa y debe reflejarse en CLAUDE.md.
- **Skill `.claude/skills/` nuevo o eliminado** → actualizar la sección "Detalle por módulo".

## 5. Reglas duras

- **No reescribas CLAUDE.md de arriba abajo.** Solo edita lo factualmente incorrecto. El estilo telegráfico (WHY/WHAT/HOW) se respeta.
- **No añadas secciones nuevas** salvo que el usuario lo pida. Si crees que falta una, dilo como sugerencia al final, no como diff.
- **No elimines la sección "PROTOCOLO OBLIGATORIO"** ni "Reglas inmutables" — son protecciones explícitas del usuario.
- **No cambies la sección WHY** (modelo de negocio) sin confirmar — requiere decisión de Juan Silva.
- **No edites en la misma corrida.** Presenta el diff, espera confirmación, luego aplica.

## 6. Casos especiales

- **CLAUDE.md tiene un fact claramente FALSO** (menciona un archivo/herramienta inexistente) → severidad **ALTA**, recomienda aplicar ya.
- **CLAUDE.md tiene un fact OUTDATED pero no falso** (ej. "~77 routes" cuando ya son 81) → severidad **BAJA**, aplicar solo si toca otra cosa.
- **No hay cambios relevantes en el rango** → devuelve: *"CLAUDE.md sigue siendo fiel al repo en este rango. No hay desfases."*
