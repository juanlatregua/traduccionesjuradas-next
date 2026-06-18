# Notificaciones por WhatsApp — activación

Las notificaciones al cliente salen por **SMS** por defecto. Para que salgan por
**WhatsApp** (con fallback automático a SMS si falla) hace falta, en este orden:

## 1. Sender + WABA (Twilio/Meta) — tarea manual
- Sender de WhatsApp dado de alta en Twilio: **+34 614619682** (número dedicado,
  sin cuenta de WhatsApp encima al darlo de alta).
- WABA `Traduccionesjuradas.net` **sin la restricción de Política de comercio**
  (apelar en Meta Business Suite → Calidad de la cuenta si vuelve a saltar).

## 2. Crear las 3 plantillas (Twilio Content Template Builder → categoría UTILITY)
Las **variables son posicionales y el orden importa** — debe coincidir EXACTO con
lo que envía el código (`lib/sms.ts`, tipo `WaTemplate`). Crea cada una en **es** y
(opcional) **fr**; si no hay fr, el código cae a la versión es.

| Clave | Variables | Texto sugerido (es) | Texto sugerido (fr) |
|---|---|---|---|
| **pago** | `{{1}}`=referencia · `{{2}}`=plazo · `{{3}}`=url | `Pago confirmado {{1}}. Entrega: {{2}}. Sigue el estado: {{3}}` | `Paiement confirmé {{1}}. Livraison : {{2}}. Suivez l'état : {{3}}` |
| **proceso** | `{{1}}`=referencia · `{{2}}`=url | `Tu traducción {{1}} ya está en proceso. Sigue el estado: {{2}}` | `Votre traduction {{1}} est en cours. Suivez l'état : {{2}}` |
| **lista** | `{{1}}`=referencia · `{{2}}`=url | `Tu traducción {{1}} está lista. Descárgala: {{2}}` | `Votre traduction {{1}} est prête. Téléchargez-la : {{2}}` |

Apunta el **ContentSid** (`HX…`) de cada plantilla/idioma una vez **aprobada por Meta**.

## 3. Variables de entorno en Vercel (Production) → luego **redeploy**
```
TWILIO_WHATSAPP_FROM=whatsapp:+34614619682
WHATSAPP_NOTIFICATIONS_ENABLED=1
WHATSAPP_TPL_PAGO_ES=HX...
WHATSAPP_TPL_PROCESO_ES=HX...
WHATSAPP_TPL_LISTA_ES=HX...
# opcionales (si no, cae a la versión ES):
WHATSAPP_TPL_PAGO_FR=HX...
WHATSAPP_TPL_PROCESO_FR=HX...
WHATSAPP_TPL_LISTA_FR=HX...
```

## 4. Probar
Un pedido real de prueba a tu móvil → confirma que llega el WhatsApp. Si falla,
el código manda el **SMS** automáticamente (nunca se pierde la notificación).

## Cómo está protegido (no se puede repetir el incidente)
- WhatsApp **solo** por plantilla aprobada (nunca texto libre business-initiated,
  que Meta descarta en silencio).
- Exige las **3 condiciones**: flag + sender + ContentSid. Si falta cualquiera → SMS.
- Si el envío por WhatsApp devuelve error → **fallback a SMS** en la misma llamada.
- Avisos al **staff** (Juan) siguen siempre por SMS (no dependen de plantillas).
