# traduccionesjuradas-next

## WHY
Web comercial + plataforma de pedidos de **traducción jurada** (10 idiomas, foco francés↔español).
Negocio real: HBTJ Consultores Lingüísticos S.L., Málaga — https://www.traduccionesjuradas.net

## WHAT
Next.js 14 App Router + TypeScript | Tailwind (bleu/encre/sepia/cream/parchment)
Prisma 6 + PostgreSQL | NextAuth 4 (Google OAuth) + OTP (SMS) | Stripe + Redsys
Microsoft Graph (email) | Twilio | Claude AI | Vercel Blob | Velite + MDX (blog)

```
app/                              # 120 páginas + 161 API routes
├── traductor-jurado-*/            # 10 idiomas (PaginaIdioma)
├── traductor-jurado/[ciudad]/     # 50 ciudades SEO local
├── documentos-oficiales/          # Hub + 9 tipos de documento
├── blog/                          # 24 artículos MDX (tramites/paises/faq/profesion)
├── (funnel)/                      # start → upload → review → checkout → confirmation
├── zona-traductor/                # Bandeja + Workspace (acceso OTP)
├── admin/                         # Orders + Quotes + Collaborators
├── encargo/[token]/               # Página pública colaborador
├── area-cliente/                  # Zona cliente
└── api/                           # 161 endpoints REST
components/   # 120 componentes (Schema*, OrderAction*, Collaborator*, ia/*)
lib/          # 130 módulos (+48 en subcarpetas: ai/, emails/, verifactu/, pricing-engine/)
prisma/       # 34 modelos, 19 enums — ver .claude/skills/prisma-patterns/SKILL.md
```

## HOW
```bash
npm run dev                        # desarrollo local
npm run build                      # prisma generate + next build
npm run test:unit                  # tests unitarios (node --test)
npx tsc --noEmit --skipLibCheck    # type-check
vercel --prod --yes                # deploy manual a producción
npx tsx --env-file=.env.local scripts/vigia-pedidos.ts   # agenda de hoy + qué recuperar (agente vigia-pedidos; cron 8:00 = /api/cron/vigia-agenda)
npx tsx --env-file=.env.local scripts/tarifario.ts       # tarifario aprendido: lista | semillas | backfill | aprobar <id> | vetar <id> | fijar <id> (agente agente-precios; UI /zona-traductor/tarifario; kill-switch LEARNED_RATES_LIVE=off)
prisma db push                     # aplicar schema (NO migrate dev — shadow DB falla)
```

## Convenciones
- Código en inglés, UI/contenido en español
- Commits: `fix:`, `feat:`, `feat(scope):`
- SMS: fire-and-forget (`.catch(console.error)`), nunca bloquea respuesta
- Pagos: validar estado pedido + rate limit en endpoints públicos
- Zsh: comillas en rutas con brackets → `git add "app/api/orders/[reference]/route.ts"`

## Reglas inmutables
- **Stack fijo:** Tailwind, Vercel Blob, NextAuth, Microsoft Graph (email), Prisma+PG, Stripe+Redsys, Velite
- **NO usar:** CSS modules, S3, Resend, SendGrid, Drizzle, Supabase, CMS externo
- Admin pages: Server Components + Prisma directo (no API routes para lectura)
- No sobreingeniería: solo lo pedido, sin docstrings/comments innecesarios
- Deploy: Vercel auto-deploy desde `main`

## Detalle por módulo
Las skills de `.claude/skills/*/SKILL.md` se cargan solas (frontmatter). Hooks en `.claude/settings.json`: `protect.sh` pide confirmación en auth/pagos/webhooks/migraciones, `post-edit.sh` pasa prettier solo si existe `.prettierrc` (hoy no hay: el código nunca se formateó con prettier). `CONTEXT.md` (3 últimas sesiones) se commitea; histórico en `CONTEXT.archive.md` local.
→ `.claude/skills/prisma-patterns/SKILL.md` · `.claude/skills/auth-patterns/SKILL.md` · `.claude/skills/email-patterns/SKILL.md`
→ `.claude/skills/payments-patterns/SKILL.md` · `.claude/skills/storage-patterns/SKILL.md` · `.claude/skills/seo-patterns/SKILL.md`
→ `docs/architecture.md` · `docs/decisions/` (7 ADRs) · `docs/runbooks/` (setup, migraciones, deploy)

## Errores preexistentes
- `tsc --noEmit`: errores de `@prisma/client` (→ `prisma generate`), `@anthropic-ai/sdk`, `@/content` (→ Velite en build)

## PROTOCOLO OBLIGATORIO — Verificación antes de proponer fixes

1. **Siempre ejecutar `bash scripts/project-map.sh`** al inicio de cualquier sesión de audit o fixes.
2. **Verificar archivos antes de editarlos.** Si no existe donde se supone → buscarlo.
3. **Todo prompt de fixes debe incluir "Rutas verificadas"** con ✓ al inicio.
4. **Formato obligatorio:**
   ```
   ## Rutas verificadas (fecha)
   ## BLOQUE 1 — ALTA
   ## BLOQUE 2 — MEDIA
   ## AL TERMINAR — build + checklist en dev
   ```
