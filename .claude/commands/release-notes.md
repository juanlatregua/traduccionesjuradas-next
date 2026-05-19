---
description: Genera release notes desde git log — versión técnica + versión para traductores (staff) + versión para clientes
---

# /release-notes

Lee el historial git desde el último tag (o desde los últimos 30 commits si no hay tags) y genera notas de versión en **tres niveles** según la audiencia: equipo técnico, traductores/staff, y clientes. Pensado para anunciar mejoras sin escribir tres veces lo mismo.

## Uso

```
/release-notes                  # Desde el último tag
/release-notes <commit-sha>     # Desde un commit concreto
/release-notes --days 14        # Últimos 14 días
```

## 1. Determina el rango

Ejecuta en paralelo:

```bash
git describe --tags --abbrev=0 2>/dev/null               # Último tag (si existe)
git log -30 --pretty=format:'%h|%s|%an|%ai' --no-merges  # Fallback: últimos 30 commits
# Si hay tag:
git log <tag>..HEAD --pretty=format:'%h|%s|%an|%ai' --no-merges
```

Si el usuario pasa `--days N`, usa `git log --since="N days ago" --pretty=format:'%h|%s|%an|%ai' --no-merges`.

Reporta el rango antes de generar nada:
> *Rango: `<tag>..HEAD` (24 commits desde `v0.4.2` el 2026-04-15)* o *"últimos 30 commits"*.

## 2. Clasifica por tipo y por audiencia

Para cada commit, extrae el tipo del prefijo conventional commits:

| Prefijo | Grupo | Audiencia |
|---|---|---|
| `feat:` / `feat(...):` | ✨ Funcionalidades nuevas | Evaluar según área |
| `fix:` / `fix(...):` | 🐛 Correcciones | Evaluar según área |
| `chore:` / `docs:` / `refactor:` / `test:` / `ci:` | 🏗️ Mantenimiento | Solo técnica |
| `perf:` | ⚡ Rendimiento | Todas |
| Sin prefijo | Otros | Evalúa el mensaje |

Para decidir la audiencia, mira el `scope` y los archivos tocados:

- **Afecta a traductores/staff** → `zona-traductor`, `admin`, `lib/workflow`, `lib/order-actions`, colaboradores, bandeja, control, workspace.
- **Afecta a clientes** → funnel (`start/upload/review/checkout/confirmation`), `area-cliente`, `presupuesto-instantaneo`, blog, páginas SEO, chatbot, precios.
- **Solo técnico** → infra, tests, refactors internos, CI, schema sin efecto visible.

## 3. Genera 3 versiones

### Versión técnica (changelog interno)

Markdown plano, secciones por tipo, hash + título tal cual. Para CHANGELOG.md o release de GitHub.

```markdown
## v<X.Y.Z> — <YYYY-MM-DD>

### ✨ Funcionalidades nuevas
- `a1b2c3d` feat(orders): convertir OrderSession en Order al confirmar pago
- ...

### 🐛 Correcciones
- ...

### 🏗️ Mantenimiento
- ...

### Stats
- N commits · M autores · X archivos cambiados
```

### Versión para traductores / staff (email interno)

Tono profesional y directo. Solo cambios que afectan el trabajo de Juan Silva y los colaboradores: gestión de pedidos, zona-traductor, admin, workflow, asignación de colaboradores.

```markdown
# Novedades en la zona de trabajo

Hola,

Estas son las mejoras de la plataforma en este periodo:

**Lo más importante:**
- <1-2 líneas sobre el cambio operativo más relevante>

**También:**
- <bullet 1>
- <bullet 2>
- <bullet 3>

Si algo no funciona como esperas, avísame.

Juan Silva
HBTJ Consultores Lingüísticos
```

Reglas:
- Máximo 6 bullets.
- Sin jerga técnica (no "endpoint", "webhook", "Prisma" — usa "función", "aviso automático", "panel").
- Si un commit es interno sin impacto en el trabajo del staff, NO lo incluyas.

### Versión para clientes (email + en-app)

Tono claro y cercano, cero jerga. Solo cambios visibles para quien pide una traducción: funnel de pedidos, presupuestos, área de cliente, seguimiento, blog.

```markdown
# Novedades en traduccionesjuradas.net

Hola,

Hemos mejorado la plataforma para que pedir tu traducción jurada sea más fácil:

- <bullet 1>
- <bullet 2>
- <bullet 3>

Un saludo,
Juan Silva — Traductor jurado de francés (MAEC nº 3850)
HBTJ Consultores Lingüísticos
```

Reglas:
- Máximo 4 bullets.
- Sin emojis.
- Si no hay cambios visibles para clientes, devuelve: *"No hay cambios visibles para clientes en este rango. La versión técnica y la de staff siguen siendo útiles."*

## 4. Formato de salida

```markdown
# /release-notes — <rango>

---

## 1. Changelog técnico
<contenido>

---

## 2. Email a traductores / staff
<contenido>

---

## 3. Email a clientes
<contenido>

---

## Sugerencia de tag
Basándome en los cambios (X feat, Y fix), sugiero: `vA.B.C`

```bash
git tag -a vA.B.C -m "<resumen 1 línea>"
git push origin vA.B.C
```
```

## 5. Reglas duras

- **No inventes commits.** Si dudas de uno, omítelo antes que dar info falsa.
- **No incluyas hashes** en las versiones de staff/clientes — son ruido.
- **No exageres impacto** ("revolucionario", "totalmente nuevo") — describe lo que hace.
- **No incluyas commits con `WIP`, `wip`, `fixup!`, `squash!`**.
- **Sugerencia de tag** con SemVer: `MAJOR` si hay breaking change documentado, `MINOR` si hay ≥1 `feat:`, `PATCH` solo con `fix:`/`chore:`.
- **No menciones datos legales sin verificar** (fechas de convenios, tasas) — si un commit toca contenido YMYL, no lo conviertas en un claim sin fuente.
- **Si no hay commits relevantes** (todo chore/docs), devuelve: *"No hay novedades reseñables. No mandes email esta semana."*
