# Diario de sesiones — traduccionesjuradas.net

Bitácora estratégica del proyecto. Cada entrada combina **lo hecho** con análisis cruzado desde 4 perspectivas: **UX**, **CEO/estrategia**, **marketing/SEO**, **SaaS/producto**.

Diferencia con `CONTEXT.md`: aquí no se anota cada commit, sino **lo que mueve la aguja**, los riesgos detectados y las decisiones pendientes con su trade-off.

---

## 2026-04-30 · Fase A bot AI (tool use + Vision)

### Lo entregado
- **PR #59 (mergeado)**: tool use loop en `app/api/chat/route.ts` + 3 tools (`get_quote_estimate`, `recommend_path`, `verify_translator_credentials`). El bot deja de improvisar precios y URLs.
- **PR #60 (abierto)**: Vision nativo del modelo (Sonnet 4) — el chat acepta imágenes adjuntas (≤5 MB JPG/PNG/WEBP), las describe en una frase y enruta a las tools.

### UX — qué cambia para el usuario
- **Antes**: el bot estimaba precios "de memoria" y a veces inventaba URLs de blog. Inconsistencia con la web → fricción en el handoff a funnel.
- **Ahora**: precios = motor real, URLs = mapa canónico. Vision cierra el bucle "no sé describir mi documento" → el usuario simplemente lo fotografía.
- **Pendiente UX que sigue abierto**:
  - **Zona traductor (9 tabs, formularios duplicados, flujo fragmentado)** — detectado el 2026-03-31, sin abordar. Coste alto de refactor; valoración: esperar a tener volumen real antes de rediseñar.
  - **OrderTracker en `/presupuesto-instantaneo` no persiste en sessionStorage** — el cliente que refresca pierde sus pedidos previos. Quick win.
  - **`/como-escanear-bien` poco visible**: aparece solo en el system prompt como redirect. Debería linkarse desde el botón de adjuntar imagen del chat ("¿imagen borrosa? Mira cómo escanear bien").
  - **Welcome message del chat** menciona "Teletrabajo Marruecos" como quick reply pero no menciona "Sube una foto del documento" — actualizar ahora que Vision está vivo.

### CEO — por qué esto antes que otra cosa
- **Diferenciación**: la mayoría de competidores (sworn translators directories) o no tienen chat o tienen FAQ scripts. **AI específica del dominio + análisis visual del documento dentro del chat** = posicionamiento difícil de copiar a corto plazo.
- **Honestidad sobre el ROI**: el chat aún no es lo que más conversiones genera (datos GSC del 27/04 dicen que el funnel directo + paginas SEO de país + GBP son los drivers). Pero **es el que menos coste marginal por mejora tiene** (cambios en system prompt vs construir 50 ciudades nuevas) y **es el que se cierra solo en una sesión** (vs. SEO que tarda semanas en mover indexación).
- **Lo que NO se hizo y fue correcto**: no se construyó RAG sobre la biblioteca jurídica. El plan maestro (`docs/biblioteca-juridica-fr-es/00-plan-maestro.md`) está en esqueleto. Decisión pragmática: las tools cubren el 80% de las consultas reales (precio + ruteo + credibilidad). RAG es Fase B.

### Marketing/SEO — alineación con el resto del funnel
- El bot ahora cita los **mismos precios** que `pricing-engine` (mín FR 35 €, otros 50 €, AR 55 €, paquete penales FR 75 €, MA tarifa fija). Antes podía haber drift entre lo que el bot decía y lo que el funnel cobraba — fuente de fricción y de quejas de "el chat me dijo 35 € y luego me cobran 50 €".
- Cluster blog (Marruecos, Argelia, Túnez, UK, Italia, Brasil, Senegal + hub) **ya está completo** y referenciado por `recommend_path`. El bot cita la guía correcta automáticamente cuando detecta país.
- **Pendiente marketing**:
  - **Costa de Marfil, Alemania, Rumanía** — completar cluster francófono y EU. Costa de Marfil: alta diáspora en España, baja competencia SEO. Alemania: volumen alto, competencia alta — entrar solo si nicho diferenciador (ej: documentos académicos DE→ES con homologación). Rumanía: nicho específico, alineado con UE.
  - **Backlinks** sigue siendo el gap real. APTIJ + LinkedIn personal del titular son los que más ROI dan según patrones del sector. Skipped esta sesión.
  - **GBP video verificación SAB**: 2 reseñas retenidas pendientes — desbloquearlas suma autoridad inmediata. Skipped.

### SaaS/producto — métricas que faltan
Hoy NO sabemos:
- **Tasa de conversión chat → pedido**. Necesario: tag UTM en URLs que devuelve `recommend_path` cuando vienen de chat (`?utm_source=chat&utm_medium=bot`). Sin esto, atribución del bot al revenue es imposible.
- **Frecuencia de tool calls**. ¿El modelo realmente usa `get_quote_estimate` o sigue improvisando? Loggear `tool_use` events en `ChatSession` (campo `toolCallsCount` o JSON con desglose) para verificar adopción del cambio.
- **Vision adoption**. ¿Cuántos usuarios suben imagen? Métrica esperada: <5% al principio. Si supera 15% → reduce significativamente las preguntas del bot, gran win.
- **Tasa de "rate limit" alcanzada (20/h por sesión, 100/24h por IP)**. Hoy se sabe sólo si revisa logs de Vercel — debería ser visible en dashboard.
- **Cost per session**. Con tool use el coste/turn sube ligero (input tokens crecen por las tools en cada round-trip). Prompt caching mitiga. **Vigilar invoice de Anthropic en mayo** — si sube >2× respecto a abril, revisar si max_tokens=1024 es suficiente o si hay rounds de tool degenerados.
- **A/B testing de prompts**: hoy hay un único system prompt. Sin telemetría de "tool call hit rate" no se puede iterar.

**Acción concreta sugerida**: añadir campo `toolCalls JSON` a `ChatSession` con `[{name, durationMs}]` para empezar a medir. ROI: 1 hora de trabajo, datos para 3 meses de decisiones.

### Riesgos detectados esta sesión
1. **Cache TTL del system prompt = 5 min**. Tras cambios de prompt, primera llamada paga el coste completo. En horas valle pueden ser muchos cache misses. Aceptable, pero documentar.
2. **`verify_translator_credentials` solo conoce a Juan Silva**. Si entran consultas sobre Juan Amor (colaborador EN/DE/PT/IT) o el resto del equipo, devuelve "no podemos verificar". Es honesto pero subóptimo. **Decisión pendiente**: ¿añadir el equipo a la tool? Requiere obtener números MAEC del resto y consentimiento.
3. **Vision sin OCR**. El modelo describe la imagen pero no extrae texto estructurado. Para el caso de uso del chat es suficiente (queremos estimar precio, no entregar la traducción). Si en algún momento se quiere "vista previa de traducción" en el chat → llamar a `lib/ai/analyze-document.ts` desde una tool nueva `analyze_document`.

### Próximas sesiones — orden propuesto por ROI/esfuerzo
1. **Mergear PR #60 (Vision)** tras smoke test. 5 min.
2. **Logging de tool calls** (`ChatSession.toolCalls`). 1 h. Sin datos no se mejora.
3. **GBP video verificación SAB** + 3 categorías secundarias + 10 servicios. 2 h. Desbloquea reseñas, suma autoridad.
4. **Backlinks APTIJ + LinkedIn**. 2 h del titular. ROI alto en autoridad de dominio.
5. **GSC reindex 16 URLs pendientes**. 30 min. Cuota agotada el 27/04.
6. **Welcome message del chat con sugerencia de adjuntar imagen**. 10 min.
7. **OrderTracker persistente en sessionStorage**. 30 min.
8. **Costa de Marfil pillar post**. 3 h. Cierra cluster francófono.
9. **Renovar token Notion**. Bloquea automatización docs.
10. **Bug Velite EISDIR** al crear `guia-traduccion-jurada-espana.mdx`. Pendiente desde 2026-04-30.

### Pendiente declarado anteriormente que sigue abierto
- Endpoint público `/api/orders/[ref]/public` sin token firmado — riesgo de seguridad medio.
- Auditoría completa de `zona-traductor` — riesgo UX, esperando volumen.
- API GBP — esperando aprobación Google (solicitada 27/04, plazo 5-10 días).
- Merchant Center — verificar dominio para subir productos a Google Shopping.
- Fase B bot (RAG biblioteca jurídica) — bloqueada por contenido de la biblioteca.
- Fase C bot (productos AI directos) — visión más larga, sin priorizar.

---

## Plantilla para futuras sesiones

Copiar al inicio de cada nueva entrada:

```markdown
## YYYY-MM-DD · Título corto

### Lo entregado
- PR #X (estado): qué resuelve
- ...

### UX — qué cambia para el usuario
- Antes / ahora
- Pendiente UX que sigue abierto

### CEO — por qué esto antes que otra cosa
- Diferenciación / ROI / lo que no se hizo y fue correcto

### Marketing/SEO — alineación con el resto del funnel
- Cómo encaja con cluster, GSC, GBP
- Pendiente marketing

### SaaS/producto — métricas que faltan
- Qué no se mide
- Acción concreta sugerida

### Riesgos detectados esta sesión
1. ...

### Próximas sesiones — orden propuesto por ROI/esfuerzo
1. ...
```

---

## Notas de uso

- **Una entrada por sesión sustantiva**, no por commit.
- **Mantener el formato de los 4 lentes** aunque alguno quede vacío esa sesión (anotar "sin novedad" para no perderlo).
- **No duplicar `CONTEXT.md`**: ese archivo lleva el handoff táctico (rama, commits, prompt de arranque). Este lleva el análisis estratégico.
- **No es público**: este archivo se queda en repo (`docs/`) y se espeja en Notion (subpágina de "🌐 traduccionesjuradas.net" en NLP Journey).
