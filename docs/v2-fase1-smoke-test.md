# v2 · Fase 1 — Smoke test de la puerta (producción)

**Fecha:** 2026-05-25 · **Para:** Juan · **Entorno:** https://www.traduccionesjuradas.net
**Bloque:** 1.5 (integración, QA y lanzamiento)

Marca cada casilla `[x]` al pasarla. Si algo falla, anota qué viste debajo del paso.
Necesitas: un documento FR de prueba (p. ej. un acta o un penal), un documento ES,
y opcionalmente una tarjeta real para el flujo de pago completo (último bloque).

---

## 0 · Redirects del colapso — ya verificado ✅

Verificado automáticamente el 2026-05-25 (308 → `/presupuesto-instantaneo`):
`/start`, `/upload`, `/review`, `/puerta`, y `/start?p=regularizacion-2026`
(preserva el query). No hace falta repetir salvo que cambie `next.config.mjs`.

---

## 1 · Camino FR automático (el más común)

- [ ] Abre https://www.traduccionesjuradas.net/presupuesto-instantaneo
- [ ] Aparece la **cuenta atrás** (corte 18:00 Madrid) y la pregunta "¿Para cuándo lo necesitas?"
- [ ] Sube un documento **en francés**. Acepta el consentimiento GDPR.
- [ ] Pasa a "Analizando…" y en ~pocos segundos al **diagnóstico**
- [ ] El diagnóstico muestra las 5 cosas: tipo · ¿necesita jurada? (frase de validez **inbound**, doc extranjero→ES) · precio · **plazo** (FR 1-2p = 24h / >2p = 48h) · validez (jurada no caduca + caducidad orientativa del original)
- [ ] **No** pide idioma de destino (origen FR, destino ES por defecto)
- [ ] El botón "Continuar al pago" está **activo**

**Mide el "10 s":** anota cuánto tarda el análisis. (Logs en Vercel: `[documents/analyze] analysisMs=…`)

Tiempo observado: ________

---

## 2 · Original en español → elegir idioma de destino

- [ ] "Empezar de nuevo" y sube un documento **en español**
- [ ] El diagnóstico muestra un **selector de idioma de destino** inline
- [ ] El botón "Continuar al pago" está **deshabilitado** con el aviso "Indica el idioma de destino…"
- [ ] Al elegir un idioma (p. ej. francés), el **precio y el plazo se recalculan** y el botón se activa
- [ ] La frase de validez cambia a **outbound** (doc español → idioma extranjero, válida en destino)

---

## 3 · Multi-documento

- [ ] Sube un documento, llega al diagnóstico
- [ ] Pulsa "**Añadir otro documento**" y sube un segundo
- [ ] Vuelve al diagnóstico con **las dos tarjetas** y una fila **"Total (2 documentos)"** con la suma
- [ ] Si uno es ES sin idioma elegido, el botón sigue **bloqueado** hasta resolverlo

---

## 4 · Baja confianza / fallo de análisis

- [ ] Sube un documento malo (foto borrosa, captura de pantalla, PDF no-documento)
- [ ] Si la confianza es baja: el diagnóstico lo refleja (precio orientativo / "a confirmar"), **no** un callejón sin salida
- [ ] Si el análisis falla: pantalla de **error** con "Intentar de nuevo" + botón **WhatsApp** (wa.me/34951333614)

---

## 5 · Preset regularización 2026 (25 €/doc FR)

- [ ] Abre https://www.traduccionesjuradas.net/presupuesto-instantaneo?p=regularizacion-2026
- [ ] Sube un **penal/acta en francés**
- [ ] Llega al diagnóstico (puede mostrar el precio del **engine**, p. ej. ~75 € para penal FR — esto es lo esperado por el plan)
- [ ] "Continuar al pago" → en **/checkout** el documento FR se cobra a **25 €** (pre-IVA) plano
- [ ] (Opcional) En la misma sesión añade un documento **no-FR**: ese va al precio del **engine**, no a 25 €

> ⚠️ Decisión abierta: hoy el diagnóstico muestra el precio del engine y el 25 € se ve solo en checkout. Si quieres que el diagnóstico ya muestre 25 € cuando aplica, dímelo y lo cambio.

---

## 6 · Pago completo → webhook → Order (el de más valor) 💳

Este es el gap histórico que se cerró: que el pago del funnel cree un `Order` en `/admin/orders`.

- [ ] Desde cualquiera de los caminos anteriores, llega a **/checkout** con un pedido real
- [ ] Completa un **pago real** (tarjeta/Bizum). Confirma que llegas a **/confirmation**
- [ ] Recibes el **email** de confirmación (buzón corporativo)
- [ ] En **/admin/orders** aparece el pedido nuevo (source = "funnel"), con el par de idiomas correcto
- [ ] El **plazo/ETA** y la **auto-asignación de colaborador** se dispararon según el idioma (FR = Juan Silva; EN/DE/PT/IT = Juan Amor)
- [ ] (Verificación DB opcional) el `Order` se creó vía `createOrderFromSession`, idempotente por `reference`

> Recuerda el [[project_funnel_sms_gap]]: el funnel **no captura teléfono** → al cliente solo le llega email, no SMS. El SMS al staff sí.

---

## 7 · Conversión en /admin/funnel

- [ ] Abre **/admin/funnel**: el embudo `analizado → presupuesto → lead → pedido → pagado` (ventanas 7/30/90 d)
- [ ] Tras el smoke test, el contador de **"pagado"** debería subir respecto a la línea base (era ≈ 0)

> Recordatorio: este funnel mide sobre `DocumentAnalysis`. `FunnelEvent` es **legacy** y no se toca (decisión 2026-05-25).

---

## Resultado

- Caminos OK: ____ / 7
- Bloqueantes encontrados: ________________________________
- ¿Fase 1 lista para dar por lanzada?  [ ] Sí  [ ] No, pendiente: __________
