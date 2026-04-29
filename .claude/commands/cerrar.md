---
description: Cierre de sesión — commitea, pushea, actualiza CONTEXT.md y prepara el prompt para /arrancar
argument-hint: [nota libre opcional sobre lo trabajado]
---

# /cerrar $ARGUMENTS

Protocolo de cierre para sesiones en `traduccionesjuradas-net`. Deja el repo limpio, los cambios subidos, registra lo completado en `CONTEXT.md` y emite el prompt listo para arrancar la siguiente sesión.

`$ARGUMENTS` (opcional): nota libre del usuario sobre la sesión, contexto extra o pendientes para próxima vez. Si está presente, va literal al bloque `Notas de cierre` del CONTEXT.

## 1. Estado actual (paralelo)

- `git branch --show-current`
- `git status --short`
- `git log main..HEAD --oneline`
- `gh pr list --head $(git branch --show-current) --json number,url,state,title`

## 2. Working tree

Si hay cambios sin commitear:

- **Filtra ruido**: `.DS_Store`, cambios de modo, binarios sin diff real. Si `core.filemode=true` produce ruido, ejecutar `git config core.filemode false`.
- **Untracked**: decide entre `.gitignore`, borrar (si es script puntual cumplido), o stagear.
- **Cambios reales**: agrupa por tema y commitea con `feat:` / `fix:` / `chore:` siguiendo el estilo del repo. Mensajes en español, *por qué* > *qué*.
- **Co-author** obligatorio: `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.

## 3. Push

- `git push origin <rama>`
- Si la rama tiene PR abierto, basta con el push (se actualiza solo).
- Si **no** tiene PR y los commits son cerrables, **preguntar al usuario** antes de abrir PR. No abrir PRs automáticamente.

## 4. Actualizar `CONTEXT.md`

Vive en la raíz del repo. Está gitignorado — es estado local de sesión, no código.

Si no existe, crearlo. Antepone (no append) un bloque al inicio con el formato exacto:

```markdown
## Sesión {{YYYY-MM-DD HH:MM}} — cierre

**Rama:** {{rama actual}}
**PR:** {{#número + url, o "—"}}
**Commits de la sesión:**
- {{hash corto}} {{mensaje primera línea}}
- ...

**Completado:**
- {{bullets resumiendo el trabajo, derivados de los commits + del flujo de la sesión}}

**Notas de cierre:**
{{$ARGUMENTS literal si se pasó; si no, omitir esta línea}}

**Pendiente para próxima sesión:**
- {{bullets con lo que quedó en el aire — bugs detectados pero no atacados, refactors propuestos pero no hechos, decisiones bloqueadas, etc.}}

**Prompt de arranque sugerido:**
> {{una frase corta lista para pegar en /arrancar de la próxima sesión, p.ej. "retomar refactor zona-traductor — punto de partida: 9 tabs reducidos a 4"}}

---
```

Mantén el archivo recortado a las **últimas 10 sesiones**. Si el archivo crece más, trunca las más antiguas.

## 5. Memoria persistente

Lee el índice `MEMORY.md` y actualiza/añade memorias **sólo si hay algo no obvio** que valga la pena recordar entre sesiones (decisiones, feedback explícito del usuario, estado de iniciativas con fecha absoluta). No guardes detalles del commit ni recetas de fixes.

## 6. Notion (si aplica)

Si la sesión cerró tareas en Notion, actualizar estado. Referencia en `reference_notion.md`.

## 7. Entrega al usuario

Salida en este orden, **conciso, una pantalla**:

1. **Commits hechos** (oneline).
2. **Push/PR**: URL si aplica.
3. **CONTEXT.md actualizado**: confirmar bloque añadido.
4. **Memoria**: qué entradas se tocaron, si alguna.
5. **Prompt de arranque sugerido**: el mismo que quedó en CONTEXT, en bloque cite, listo para pegar.

## Reglas

- **No force-push** a `main` nunca; a ramas feature sólo si el usuario lo pide.
- **No commitear nada que el usuario no haya pedido implícita o explícitamente**.
- **No abrir PRs automáticamente**: pregunta primero.
- **No ejecutar tests/build extra**: el hook pre-commit ya valida. Si pre-commit falla, investigar la causa, **nunca usar `--no-verify`**.
- **Verificar antes de borrar** archivos untracked desconocidos.
- Si el working tree ya está limpio y no hay nada que cerrar, sólo actualiza `CONTEXT.md` con un bloque mínimo + prompt de arranque y termina.
