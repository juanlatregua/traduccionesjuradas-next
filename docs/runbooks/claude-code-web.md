# Runbook — Claude Code on the web (sesiones desde móvil/navegador)

Una sesión iniciada desde el móvil o `claude.ai/code` corre en un **contenedor
efímero en la nube**: clona el repo de cero, sin `.env.local`, sin base de datos y
sin la config de usuario del Mac. Este runbook deja escrito qué se puede recuperar
de ahí y cómo.

## 1. Hook de arranque (ya hecho)

`.claude/hooks/session-start.sh`, registrado en `.claude/settings.json`. Corre
**solo en remoto** (`$CLAUDE_CODE_REMOTE = true`); en local sale sin hacer nada.

Deja el contenedor con:
- `npm install` → `node_modules` + `postinstall` dispara `prisma generate`
- `npx velite build` → genera `@/content` (blog MDX)

Con eso funcionan `npm test`, `npm run test:unit`, `next lint` y `tsc --noEmit`
sin los errores preexistentes que documenta `CLAUDE.md`.

Modo **síncrono**: la sesión no arranca hasta que termina (~40 s). Se puede pasar a
asíncrono si molesta la espera, a cambio de que el agente pueda intentar correr
tests antes de que estén las dependencias.

> Empieza a aplicarse cuando el hook llegue a la rama por defecto.

## 2. Variables de entorno del entorno remoto

Se configuran en el entorno de Claude Code (hoy solo existe `Predeterminado`), no
en el repo. Lo que falta para que una sesión remota sea útil de verdad:

| Variable | Para qué | Riesgo |
|---|---|---|
| `DATABASE_URL` | Consultar pedidos, presupuestos, `LearnedRate`, `OrderEvent` | **Alto — ver abajo** |
| `ANTHROPIC_API_KEY` | `messages.countTokens`, medir prompts, evals | Medio |
| `ADMIN_EMAIL` | Scripts que resuelven destinatarios | Bajo |

También hay que revisar la **política de red** del entorno: si no permite la salida
al host de Postgres, la variable no sirve de nada.

### AVISO sobre `DATABASE_URL`

La base de datos contiene actas de nacimiento, certificados de penales, nóminas y
NIEs de clientes reales. **Nunca la credencial de propietario de producción.**

Usar una credencial **de solo lectura**:

```sql
CREATE ROLE claude_ro LOGIN PASSWORD '...';
GRANT CONNECT ON DATABASE <db> TO claude_ro;
GRANT USAGE ON SCHEMA public TO claude_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO claude_ro;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO claude_ro;
```

En lavori (Neon) la alternativa mejor es una **rama de solo lectura**: aislamiento
real, y ninguna sesión puede escribir en producción ni por accidente.

## 3. Los dos repos como fuentes del entorno

Si el entorno solo lista `traduccionesjuradas-next`, adjuntar `lavori` a mitad de
sesión **no carga su configuración**: sus 21 agentes y sus skills (`consejo`,
`entrega`) se quedan en disco sin registrar. Pasó el 5-sep.

Para trabajar el puente o convocar `/consejo` desde el móvil, el entorno tiene que
listar **los dos repos como fuentes desde el arranque**.

## 4. Lo que no se puede replicar

- **`~/nlp-projects/`** (corpus de TraduCAT) — no está en git, no se clona.
- **`~/.claude` de usuario** — settings, agentes y permisos de la máquina.
- **Persistencia** — lo que no se commitea muere con el contenedor.
  `CONTEXT.md` está gitignorado (`.gitignore:42`): en remoto **siempre** se pierde.
- **CLIs ausentes**: `gh` (se usa el MCP de GitHub), `vercel`, `tsx` global.

## 5. La salida rápida

```bash
claude --teleport     # trae al terminal una sesión empezada en web/móvil
/desktop              # continúa la sesión del terminal en la app de escritorio
claude --cloud        # empieza en local, sigue en el móvil
```

Para trabajo que necesite base de datos o los agentes de otro repo, teletransportar
es más barato que replicar el entorno.
