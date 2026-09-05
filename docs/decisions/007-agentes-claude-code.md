# 007 — Agentes de Claude Code: subagentes, no "agent teams"

Fecha: 2026-09-05

## Contexto

Auditoría de `.claude/` a raíz de la pregunta de si conviene montar un "equipo de
agentes" (modelo Agent Teams: tablón compartido, identidad persistente, handoffs
entre agentes, canales conjuntos con otras empresas — p. ej. Raft).

### Estado auditado (05-sep-2026)

**Agentes — 4, todos correctos** (frontmatter `name` + `description` + `tools` + `model`):

| Agente | Modelo | Tools | Escribe |
|---|---|---|---|
| `guardian-flujos` | opus | Read, Grep, Glob, Bash | no (read-only) |
| `vigia-pedidos` | sonnet | Bash, Read, Glob, Grep | no (read-only) |
| `agente-precios` | sonnet | Bash, Read, Glob, Grep | no (CLI solo si se pide) |
| `seo-aeo` | sonnet | + WebSearch, WebFetch, Edit, Write | sí |

**Comandos — 10, funcionan:** `arrancar`, `cerrar`, `audit-route`, `diagnose`,
`doc-sync`, `migration`, `release-notes`, `repurpose`, `rot`, `seo-page`.

**Skills — 0 reales.** `.claude/skills/` contiene 6 `.md` sueltos
(`auth-patterns`, `email-patterns`, `payments-patterns`, `prisma-patterns`,
`seo-patterns`, `storage-patterns`) sin frontmatter y sin carpeta propia. Una
skill válida es `.claude/skills/<nombre>/SKILL.md` con `name:` y `description:`.
Tal como están, Claude NO puede invocarlos solo: funcionan como documentación
que hay que abrir a mano (es lo que hace el pie de `CLAUDE.md`).

**Hooks — 3 escritos, 0 cableados.** `post-edit.sh` (prettier), `pre-commit.sh`
(checks antes de commit) y `protect.sh` (zonas protegidas) existen, pero no hay
`.claude/settings.json` en el repo, que es el único sitio donde se declaran.
Hoy solo corren si se les llama a mano.

**Memoria entre sesiones — ausente.** `/arrancar` lee `CONTEXT.md` y `/cerrar` lo
escribe, pero `CONTEXT.md` no existe en la raíz. Cada sesión arranca en blanco.

## Decisión

**No se monta una capa de agent teams (Raft o equivalente) por ahora.** Se cierran
antes los tres huecos del propio repo.

Motivos:

1. **El "equipo de agentes con memoria compartida" ya está construido — dentro del
   producto, no en Claude Code.** El puente lavori es exactamente esa arquitectura:
   identidad persistente (`Collaborator`, `lavoriMiembroId`), memoria compartida en
   Postgres (`LearnedRate`, `OrderEvent`, `LavoriPriceRequest`), tablón de estados
   (`CANDIDATE → APPROVED`, `SENT → PRICED → ACCEPTED`), handoffs asíncronos por
   webhook, despertares programados (11 crons) y revisión previa al humano (gates de
   margen ≥10 %, `price_risk`, tope 600 €, jurado libre).
2. **Un tablón compartido resuelve colisiones que no tenemos.** 3 de los 4 agentes
   son read-only por diseño: dictaminan o proponen, no se pisan. Los agent teams
   pagan cuando varios agentes ESCRIBEN a la vez sobre lo mismo.
3. **El cuello de botella real es la memoria entre sesiones, no el paso de contexto
   entre agentes.** Eso se arregla con un commit en este repo, no con producto nuevo.
4. **El canal conjunto entre empresas tiene coste RGPD aquí.** Se manejan actas de
   nacimiento, penales, nóminas y NIEs de clientes reales; una sala compartida con
   el servidor de otra empresa es superficie de datos personales.
5. Las cifras de adopción que cita ese tipo de producto (miles de builders, N agentes
   por humano) son del propio vendedor y sin verificación externa.

**Revisión:** si tras cerrar los tres huecos sigue notándose que el humano es el
pegamento entre plataformas del ecosistema HBTJ (TJ.net, TraduCAT,
mitraductorjurado, holabonjour), reevaluar entonces — ese sí es el caso legítimo de
"el agente 2 no ve lo que descubrió el agente 1".

## Consecuencias

- **Positivo:** cero migración, cero capa nueva entre los agentes y el modelo.
- **Positivo:** los 4 agentes siguen siendo aislados y auditables (el read-only es
  una garantía, no una limitación).
- **Negativo:** el contexto entre sesiones se sigue perdiendo hasta que se cree
  `CONTEXT.md`.
- **Negativo:** los patrones (`prisma`, `pagos`, `auth`…) no se cargan solos; un
  subagente arranca sin ellos salvo que se le pasen a mano.

## Pendiente (no ejecutado en esta sesión)

1. Convertir los 6 `.md` de `.claude/skills/` en skills reales
   (`<nombre>/SKILL.md` + frontmatter `name`/`description`).
2. Crear `.claude/settings.json` para cablear los 3 hooks.
3. Primer `CONTEXT.md` en la raíz vía `/cerrar`.
