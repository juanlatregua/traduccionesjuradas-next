# Auditoría cross-repo TJ.net ↔ lavori — 5-sep-2026

Sesión remota (Claude Code on the web), contenedor **sin `.env.local` ni `DATABASE_URL`**:
todo lo de abajo es **lectura de código y de la documentación de la API de Claude**,
nunca de datos de producción. Cada hallazgo trae el comando para verificarlo en el Mac.

Repos leídos: `juanlatregua/traduccionesjuradas-next` (HEAD `33c8928`),
`juanlatregua/lavori` (HEAD `7248a67`), `anthropics/commerce-agents` (`fd4d592`),
`anthropics/claude-quickstarts` (`3313e97`).

---

## A. HALLAZGOS VERIFICABLES

### A1 — El caché de Haiku no cachea (y nadie puede notarlo)

`lib/ai/analyze-document.ts` marca el mismo prompt con `cache_control` en dos llamadas:

| Línea | Modelo | Mínimo cacheable | Prompt | ¿Cachea? |
|---|---|---|---|---|
| 177 + 183 | `claude-haiku-4-5-20251001` | **4.096 tokens** | ~3.300 est. | ❌ NO |
| 299 + 305 | `claude-sonnet-4-6` | 1.024 tokens | ~3.300 est. | ✅ sí |

El mínimo cacheable NO es monótono entre generaciones (512 en Opus 5; 1.024 en
Sonnet 5/4.6; 2.048 en Opus 4.7; **4.096 en Haiku 4.5 y Opus 4.6/4.5**). Por debajo
del mínimo no hay error: el marcador se ignora y `cache_creation_input_tokens` = 0.

Agravante: **`cache_read_input_tokens` no se lee en NINGUNO de los 9 sitios** donde
se cachea. No hay forma de saber si el caché funciona en ninguno.

```bash
# 1) tokens reales del prompt (mi cifra es estimación por caracteres)
npx tsx --env-file=.env.local -e '
import Anthropic from "@anthropic-ai/sdk";
import { DOCUMENT_ANALYSIS_PROMPT } from "./lib/ai/prompts";
const c = new Anthropic();
const r = await c.messages.countTokens({
  model: "claude-haiku-4-5",
  system: [{ type: "text", text: DOCUMENT_ANALYSIS_PROMPT }],
  messages: [{ role: "user", content: "x" }],
});
console.log("tokens del system:", r.input_tokens, "— mínimo Haiku 4.5: 4096");
'
# 2) los 9 sitios que cachean sin verificar
grep -rn "cache_control" --include="*.ts" lib/ app/
grep -rn "cache_read_input_tokens" --include="*.ts" lib/ app/   # → 0 resultados
```

**Arreglo:** o alargar el prompt por encima de 4.096, o mover esa llamada a un modelo
con mínimo más bajo. Y en cualquier caso, loguear `usage.cache_read_input_tokens`.

---

### A2 — `presupuestado_fuera` devuelve 400 y quema la alarma del puente

lavori emite **5** tipos de evento; TJ.net acepta **4**.

```
lavori   src/lib/motor-eventos.ts:29
  "precio_propuesto" | "encargo_aceptado" | "factura_subida" | "entrega_subida" | "presupuestado_fuera"

tj.net   app/api/lavori/eventos/route.ts:25
  ["precio_propuesto", "encargo_aceptado", "factura_subida", "entrega_subida"]
  → route.ts:66  { error: "evento desconocido" }  HTTP 400
```

Está **documentado como pendiente** en `motor-eventos.ts:20` ("El receptor de tj.net
AUN no lo admite"). Lo que quizá no se ha valorado es el coste: la regla madre del
emisor dice que un evento perdido es dinero parado, así que cada fallo **audita
`motor_evento_fallo` y manda email a Juan**. Desde el 27-ago, cada vez que una jurada
marca "presupuestado fuera" llega una alerta de fallo del puente por algo que no está
roto — entrenando a ignorar la única alarma que avisa cuando el puente se cae de verdad.

lavori ya manda `miembroId` + nombre para poder decirle al cliente "tu solicitud ya la
atiende Olga K.". Idempotencia esperada: `(evento, encargoId, datos.miembroId)`.

```bash
# contar cuántas alertas falsas se han disparado (requiere DB de lavori)
psql "$DATABASE_URL" -c "select count(*), min(creado_en), max(creado_en)
  from auditoria where accion = 'motor_evento_fallo';"
```

**Arreglo:** ~4 líneas en TJ.net (añadir el tipo + decidir qué hace con `miembroId`).

---

### A3 — CLAUDE.md describe un proyecto que es la mitad del real

| CLAUDE.md dice | Real | Deriva |
|---|---|---|
| 77 API routes | **161** | 2,1× |
| 74 componentes | **120** | 1,6× |
| 66 módulos `lib/` | **130** | 2,0× |
| 20 modelos Prisma | **34** | 1,7× |
| 15 enums | **19** | 1,3× |

Es lo primero que lee cada sesión **y cada subagente**. Hace que "busca si ya existe"
falle más de lo que debería — justo lo que `guardian-flujos` existe para evitar.

```bash
find app/api -name route.ts | wc -l
ls lib/*.ts | wc -l
grep -c '^model ' prisma/schema.prisma
grep -c '^enum ' prisma/schema.prisma
```

**Arreglo:** `/doc-sync`.

---

### A4 — La ruta del dinero parsea JSON por regex y no tipa errores

`lib/ai/analyze-document.ts:136` extrae el JSON con una regex sobre los ``` del
markdown y hace `JSON.parse`. De esa salida sale `price_risk`, que es el freno del
presupuesto automático (`lib/learned-rates.ts:430`). Es el patrón anterior a
structured outputs: hoy `output_config: {format: {...}}` garantiza que la respuesta
valide contra el esquema, sin regex ni fences.

Además: **`instanceof Anthropic.*` aparece 0 veces en TJ.net** — no se distingue un 429
(reintentable) de un 400 (no lo es). lavori sí lo hace (`src/lib/lector.ts:350`).

```bash
grep -n "jsonMatch\|JSON.parse" lib/ai/analyze-document.ts
grep -rn "instanceof Anthropic\." --include="*.ts" lib/ app/ | wc -l   # → 0
```

---

### A5 — Modelos: TJ.net va una generación por detrás; sufijos mezclados

```
lib/ai/email-reply.ts:10                 claude-sonnet-4-6
lib/ai/email-brief.ts:9                  claude-sonnet-4-6
lib/ai/extract-expense.ts:6              claude-sonnet-4-6
lib/ai/analyze-document.ts:10            claude-sonnet-4-6
app/api/chat/route.ts:53                 claude-sonnet-4-6
app/api/traduccion-automatica/route.ts:15 claude-sonnet-4-6
lib/ai/analyze-document.ts:14            claude-haiku-4-5-20251001   ← sufijo fechado
```

- El Sonnet actual es **`claude-sonnet-5`**: $2/$10 por millón frente a $3/$15, y mejor.
- El alias sin fecha es el correcto. El fechado ya dio un 404 en junio con Sonnet 4
  (está en tus propios comentarios). lavori mezcla los dos estilos también.

**ORDEN IMPORTA.** Cambiar el modelo de `analyze-document.ts` cambia el conteo de
palabras → mueve `price_risk` y el margen. Ese va el ÚLTIMO y no sin evals.
Seguros primero: `email-reply`, `email-brief`, `extract-expense`.

---

### A6 — Asimetría de configuración: cada repo tiene la mitad que al otro le falta

| | TJ.net | lavori |
|---|---|---|
| Agentes | 4 | **21** (10 personas, 6 deptos, dirección, 2 vigías) |
| Skills reales | **0** (6 `.md` sueltos sin frontmatter) | 2 (`consejo`, `entrega`) |
| `.claude/settings.json` | **NO EXISTE** → 3 hooks muertos | ✅ `PreToolUse`/Bash → `guardia-deploy.sh` |
| `CONTEXT.md` | gitignorado (`.gitignore:42`) → se pierde | commiteado → sobrevive |
| Errores tipados | ❌ | ✅ |
| `output_config` / effort | ❌ | ✅ |
| Prompt caching | ✅ 9 sitios (sin verificar) | ❌ 0 |

Los 3 arreglos de TJ.net no hay que diseñarlos: **se copian de lavori**.
`.claude/skills/consejo/SKILL.md` es la plantilla exacta para convertir los 6 patterns.

**CORRECCIÓN a lo dicho en sesión:** afirmé que lavori no tiene contexto de proyecto
para sus agentes. Falso. No tiene `CLAUDE.md`, pero su `CONTEXT.md` ES el contexto
canónico ("Léelo antes de tocar nada": tesis, rail Visa, tamaño del universo, lugar en
el ecosistema). Cumple la función con otro nombre. **Ese punto queda retirado.**

---

## B. LO QUE NO PUDE VERIFICAR (necesita el Mac)

1. **Tokens reales del prompt de análisis** — mi ~3.300 es estimación por caracteres
   (chars/4). Comando en A1.
2. **Cuántos `motor_evento_fallo` reales** ha habido desde el 27-ago. Comando en A2.
   Mi "llevas una semana recibiendo alertas falsas" es deducción del código, no conteo.
3. **El presupuesto NL** — sigue sin comprobar desde el arranque de la sesión:
   `adminCreatedBy = "system:tarifario"` + `autoPricedBy = "tarifario"` → salió solo;
   `status`/`sentAt`/`adminSentBy` + `MessageLog EMAIL/PAY_LINK/SENT` → el email salió.
   Atajo sin BD: buscar en la bandeja el asunto `🤖 Presupuesto automático <nº>`.
4. **La opinión del equipo de lavori.** Sus 21 agentes están en disco pero NO cargados
   en esta sesión (arrancó en TJ.net; lavori se adjuntó después). Los he leído; no los
   he convocado. `/consejo` no se ha ejecutado.

Otras carencias del contenedor: sin `gh`, sin `vercel`, sin `~/.claude/settings.json`
de usuario, sin agentes de usuario, y es efímero.

---

## C. SESIONES DEL 4-SEP (del registro de sesiones; horas en local, UTC+2)

| Hora | Sesión | Repo | Modelo | Resultado |
|---|---|---|---|---|
| 09:10–17:13 | 4 de Verifactu | lavori | Fable 5.1 | Sprint: tests 140–173 verdes, VeriFactu en sandbox, backlog 78 tickets, 1:1 fundador + vacaciones → **5 decisiones** |
| 09:35–13:05 | Referencia de autoría en pie | bechtraducciones-web | Fable 5.1 | Google Business resuelto, crédito del pie en prod (ES/EN), 2 emails, propuesta de mantenimiento |
| 10:03–12:55 | Cliente no dado de alta | traduccionesjuradas-next | Fable 5.1 | Factura agrupada (Barbara), autorización de crédito, tarifa directa → **4 decisiones** |
| 13:30–14:15 | Despliegue e información | circulr | Opus 5 | Guía dashboard desplegada (3 bloques onboarding, 12 tests), prod `f1f703f`, para Miguel |
| cierre 13:02 | A los 3 | circulr | Opus 5 xhigh | Prod verificada (988 tests), lunes listo con tanda de emails B |

Commits que cuadran: lavori `7248a67` (17:04), TJ.net `33c8928` (12:53).

### Pendientes de decisión (9)
- **lavori (5)** — del recap del sprint, con 1:1 del fundador y tanda de vacaciones.
- **TJ.net (4)** — tarifas, hoja de Margarita, revisar dirección de Barbara.
- **Arrastres TJ.net**: pago de Vanessa, recibos, modelo 111, VeriFactu.

### Acción tuya parada desde el 3-sep
```bash
cd ~/nlp-projects/traducat && git push    # rama feature/prototipo-v1, 1 commit sin subir
```

### Observación
Trabajas en **6 repos**, no en 4: además de los del ecosistema, ayer tocaste `circulr`
y `bechtraducciones-web`, que NO están en la skill `hbtj-ecosystem`.

---

## D. SOBRE LOS DOS REPOS DE ANTHROPIC

- **`anthropics/commerce-agents`** — Python. Código NO reutilizable (TJ.net es TS; el
  `StorefrontBackend` asume catálogo con SKUs y tú vendes servicio a medida). Sí vale
  como referencia: su `MerchantBackend` (`stage_* → get_pending_changes → apply/discard`)
  es el patrón del tarifario `CANDIDATE → aprobar/vetar`, ya inventado a mano. Encaja
  mejor en lavori que en TJ.net. Lo más aprovechable: `/author-commerce-evals`.
- **`anthropics/claude-quickstarts`** — `customer-support-agent` y
  `financial-data-analyst` SON Next.js 14 + TS + Tailwind, el stack de TJ.net. Pero
  pinan `@anthropic-ai/sdk` 0.27/0.29 frente a tu 0.78: **leer la arquitectura,
  escribir tú las llamadas**.

---

## E. ORDEN PROPUESTO

1. `presupuestado_fuera` en TJ.net (~4 líneas) — apaga una alarma falsa de una semana.
2. Log de `cache_read_input_tokens` en los 9 sitios — sin esto, todo lo de caché es a ciegas.
3. `/doc-sync` — barato, mejora todas las sesiones futuras.
4. Portar `settings.json` + skills reales de lavori → TJ.net.
5. Errores tipados + structured outputs en la ruta del dinero.
6. Migración a `claude-sonnet-5` — seguros primero, `analyze-document` al final con evals.

Nada de esto se ha ejecutado. Este documento es solo el informe.
