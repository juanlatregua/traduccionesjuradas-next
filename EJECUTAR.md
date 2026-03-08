# EJECUTAR — Pendientes reales

> Actualizado 2026-03-08

---

## 1. Redirects legacy — verificar funcionamiento

Desplegados en producción (commit 2318a55 + deploy manual 2026-03-08).

| Redirect | Destino | Tipo | Verificar |
|---|---|---|---|
| `/palabra` | `/` | 301 | ⬜ |
| `/mapa-del-sitio` | `/sitemap.xml` | 301 | ⬜ |
| `/feed` | `/` | 301 | ⬜ |
| `/feed/` | `/` | 301 | ⬜ |
| `/wp-admin/admin-ajax.php` | `/` | 301 | ⬜ |
| `/?action=*` | — | 404 | ⬜ |

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

- ⬜ Verificar que las 50 URLs responden 200 en producción
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
for city in madrid barcelona valencia sevilla zaragoza malaga murcia palma las-palmas bilbao alicante cordoba valladolid vigo gijon granada santa-cruz-de-tenerife a-coruna vitoria-gasteiz oviedo pamplona santander almeria burgos albacete castellon-de-la-plana logrono badajoz huelva leon salamanca tarragona lleida girona jerez-de-la-frontera marbella fuengirola torremolinos benidorm calpe denia altea elche cartagena figueres terrassa badalona l-hospitalet-de-llobregat sabadell pontevedra; do
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
| Verificar redirects con curl | ⬜ Pendiente |
| Verificar 50 ciudades responden 200 | ⬜ Pendiente |
| Esperar indexación ciudades | ⬜ 4-8 semanas |
| Reindexación manual URLs prioritarias | ⬜ Cuando pase el período |
| Monitorizar cobertura en GSC | ⬜ Revisar semanalmente |

---

## 5. Notas

- **Seguridad del endpoint público de pedidos:** revisado 2026-03-08, el token HMAC-SHA256 se verifica correctamente en `app/api/orders/[reference]/public/route.ts:53`. Rate limit: 120 req/10min por IP. Sin bypass si `ORDER_TOKEN_SECRET` no está configurado (`verifyOrderToken` devuelve `false`). **No hay bug de seguridad.**
- **PayPal:** desactivado (`NEXT_PUBLIC_ENABLE_PAYPAL=false`), código presente por si se reactiva.
- **Google Vision / OCR.space:** env vars definidas pero no integradas en código actualmente.
