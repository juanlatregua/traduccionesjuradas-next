---
description: Arranque de sesión — lee CONTEXT.md y repasa estado del repo
---

# /arrancar

Protocolo de arranque para sesiones en `traduccionesjuradas-net`. Lee el handoff de la última sesión y entrega un resumen breve para continuar donde lo dejamos.

## 1. CONTEXT.md (handoff de la última sesión)

Lee `CONTEXT.md` en la raíz del repo. El primer bloque (`## Sesión …`) es el cierre de la sesión anterior, escrito por `/cerrar`. Contiene:

- **Completado** en la sesión previa
- **Pendiente para próxima sesión**
- **Prompt de arranque sugerido**

Si `CONTEXT.md` no existe (primera vez), salta este paso.

## 2. Estado del repo (paralelo)

Ejecuta en una sola tanda:

- `git branch --show-current` y `git log --oneline -10`
- `git log main..HEAD --oneline` (commits por delante de main)
- `git status --short | head -30`
- `gh pr list --head $(git branch --show-current) --json number,url,state,title`

## 3. Reconciliar CONTEXT.md con estado real

CONTEXT puede estar desfasado (commits hechos fuera de Claude, merges de otros, etc.). Verifica:

- ¿La rama del CONTEXT coincide con la actual? Si no → señalarlo.
- ¿El PR sigue abierto / mergeado / cerrado?
- Si el CONTEXT menciona un fichero o función concreta como pendiente, **comprobar que sigue existiendo** antes de proponer trabajar sobre él (regla CLAUDE.md).

## 4. Memoria persistente

Lee `MEMORY.md` (índice). No abras los archivos individuales salvo que algo del índice sea relevante a la sesión que se inicia.

## 5. Working tree

Si hay cambios sin commitear, filtra ruido (`.DS_Store`, filemode, binarios sin diff) y resume sólo lo que tenga contenido real.

## 6. Entrega al usuario

Salida concisa, en este orden:

1. **Última sesión** — fecha y 1-2 líneas de qué se hizo (de CONTEXT.md).
2. **Estado actual** — rama, commits ahead, PR abierto si hay.
3. **Pendiente declarado** — bullets de "Pendiente para próxima sesión" del CONTEXT.
4. **Discrepancias** — sólo si CONTEXT no cuadra con git.
5. **Working tree** — si hay algo no commiteado relevante.
6. **Propuesta de siguiente paso** — basada en el "Prompt de arranque sugerido" del CONTEXT, o pregunta abierta si no hay.

## Reglas

- **Conciso**: una pantalla. El usuario lee la salida en 30 segundos.
- **No editar nada** durante el arranque salvo que el usuario lo pida.
- **No proponer fixes** sin antes verificar rutas (regla `CLAUDE.md`).
- **No lanzar `npm run build`** ni tests durante el arranque.
- Si CONTEXT y git divergen, **fíate de git** y advierte al usuario del desfase.
