# EJECUTAR — Pendientes reales

> Actualizado 2026-03-11

---

## 1. Redirects legacy — verificar funcionamiento

Desplegados en producción (commit 2318a55 + deploy manual 2026-03-08).

| Redirect | Destino | Tipo | Verificar |
|---|---|---|---|
| `/palabra` | `/` | 308 | ✅ |
| `/mapa-del-sitio` | `/sitemap.xml` | 308 | ✅ |
| `/feed` | `/` | 308 | ✅ |
| `/feed/` | `/` | 308 | ✅ |
| `/wp-admin/admin-ajax.php` | `/` | 308 | ✅ |
| `/?action=*` | — | 404 | ✅ |

**Cómo verificar:**
```bash
curl -sI https://www.traduccionesjuradas.net/palabra | grep -E "HTTP|location"
curl -sI https://www.traduccionesjuradas.net/mapa-del-sitio | grep -E "HTTP|location"
curl -sI https://www.traduccionesjuradas.net/feed | grep -E "HTTP|location"
curl -sI https://www.traduccionesjuradas.net/feed/ | grep -E "HTTP|location"
curl -sI https://www.traduccionesjuradas.net/wp-admin/admin-ajax.php | grep -E "HTTP|location"
curl -sI "https://www.traduccionesjuradas.net/?action=rest-nonce" | grep "HTTP"
```

---

## 2. Páginas de ciudad — verificar indexación

50 páginas desplegadas en `/traductor-jurado/[ciudad]`.

- ✅ Verificado: las 50 URLs responden 200 en producción (2026-03-09)
- ✅ Sitemap enviado a Google Search Console (2026-03-08)
- ⬜ Esperar indexación (4-8 semanas)
- ⬜ Solicitar reindexación de URLs prioritarias cuando se agote el período de espera

**URLs prioritarias para reindexación manual:**
- `/traductor-jurado/madrid`
- `/traductor-jurado/barcelona`
- `/traductor-jurado/valencia`
- `/traductor-jurado/sevilla`
- `/traductor-jurado/malaga`
- `/traductor-jurado/bilbao`

**Verificar masivamente:**
```bash
for city in madrid barcelona valencia sevilla zaragoza malaga murcia palma las-palmas bilbao alicante cordoba valladolid vigo gijon granada tenerife a-coruna vitoria oviedo pamplona santander almeria burgos albacete castellon logrono badajoz huelva leon salamanca tarragona lleida girona jerez marbella fuengirola torremolinos benidorm calpe denia altea elche cartagena figueres terrassa badalona hospitalet sabadell pontevedra; do
  STATUS=$(curl -sI "https://www.traduccionesjuradas.net/traductor-jurado/$city" -o /dev/null -w "%{http_code}")
  echo "$city: $STATUS"
done
```

---

## 3. Subdominio SendGrid

`url9254.traduccionesjuradas.net` — subdominio de tracking de SendGrid.
- ⬜ No requiere acción en código
- Google dejará de rastrearlo solo
- Si persiste en Search Console → solicitar eliminación manual

---

## 4. SEO — seguimiento

| Acción | Estado |
|---|---|
| Sitemap enviado a GSC | ✅ Hecho (2026-03-08) |
| Redirects legacy desplegados | ✅ Hecho (2026-03-08) |
| Verificar redirects con curl | ✅ Hecho (2026-03-09) |
| Verificar 50 ciudades responden 200 | ✅ Hecho (2026-03-09) |
| Esperar indexación ciudades | ⬜ 4-8 semanas |
| Reindexación manual URLs prioritarias | ⬜ Cuando pase el período |
| Monitorizar cobertura en GSC | ⬜ Revisar semanalmente |

---

## 5. Solicitud de reseña Google — ✅ Implementado (2026-03-09)

- CTA "Dejar valoración en Google" en email de entrega (`sendTranslationReadyEmail`)
- Email independiente de solicitud de reseña (`sendReviewRequestEmail`)
- SMS/WhatsApp template de reseña (`smsReviewRequest`)
- Endpoint POST `/api/orders/[reference]/review-request` (staff auth)
- Botones en admin: "Copiar mensaje reseña" + "Enviar solicitud reseña" (pestaña Notificar, solo DELIVERED/CLOSED)
- Variable: `NEXT_PUBLIC_GOOGLE_REVIEWS_URL_TJ` (ya configurada en Vercel)

---

## 6. Adquisición de tráfico — 3 canales prioritarios

### 6a. Google Ads (⬜ pendiente)

**Juan hace (fuera del código):**
- Crear cuenta en ads.google.com
- Campaña de búsqueda → keywords: "traducción jurada", "traductor jurado online", "traducción jurada barata", "traducción jurada francés"
- Presupuesto: 10€/día para empezar
- Landing: `/presupuesto-instantaneo` o `/traducciones-juradas-baratas`

**En código (⬜ pendiente):**
- Añadir tag de conversión Google Ads (gtag) para trackear presupuestos solicitados
- Necesita: ID de conversión de Google Ads (lo da la cuenta una vez creada)

### 6b. Google Business Profile (⬜ pendiente)

**Juan hace:**
- Ir a business.google.com → reclamar "HBTJ Consultores Lingüísticos" en Málaga
- Categoría: "Servicio de traducción"
- Fotos, horario, descripción con keywords
- La URL de reseñas (`NEXT_PUBLIC_GOOGLE_REVIEWS_URL_TJ`) ya está configurada

**En código (⬜ verificar):**
- Comprobar que `SchemaLocalBusiness` coincide con los datos del perfil de Google Business

### 6c. Comunidades de expatriados (⬜ pendiente — manual)

**Facebook:**
- "Français à Malaga", "Expatriés français en Espagne", "Marroquíes en España"

**Foros:**
- expatforum.com, expat.com (sección España)

**Estrategia:** No vender directamente — responder preguntas sobre trámites (legalización, casier judiciaire, reagrupación) y mencionar el servicio cuando sea relevante.

---

## 7. Notas

- **Seguridad del endpoint público de pedidos:** revisado 2026-03-08, el token HMAC-SHA256 se verifica correctamente en `app/api/orders/[reference]/public/route.ts:53`. Rate limit: 120 req/10min por IP. Sin bypass si `ORDER_TOKEN_SECRET` no está configurado (`verifyOrderToken` devuelve `false`). **No hay bug de seguridad.**
- **PayPal:** desactivado (`NEXT_PUBLIC_ENABLE_PAYPAL=false`), código presente por si se reactiva.
- **Google Vision / OCR.space:** env vars definidas pero no integradas en código actualmente.
