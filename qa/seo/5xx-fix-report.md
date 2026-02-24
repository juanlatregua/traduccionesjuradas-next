# 5xx Fix Report

Verificación ejecutada en local con Next.js 14.2.5:
- `npm run dev -- --hostname 127.0.0.1 --port 4010`
- `SEO_BASE_URL=http://127.0.0.1:4010 SEO_OVERRIDE_ORIGIN=1 node seo/check_urls.mjs`

| URL | status inicial | location | status final | saltos | regla aplicada | archivo |
| --- | --- | --- | --- | --- | --- | --- |
| `https://www.traduccionesjuradas.net/inicio/` | `308` | `/` | `200` | `1` | legacy `/inicio/*` -> home | `middleware.ts` |
| `https://www.traduccionesjuradas.net/traduccion-jurada-de-registro-mercantil/` | `308` | `/` | `200` | `1` | slug legacy masivo no-francés -> home | `middleware.ts` + `next.config.mjs` |
| `https://www.traduccionesjuradas.net/categoria-producto/notarial/` | `308` | `/` | `200` | `1` | `/categoria-producto/*` -> home (prioridad alta) | `next.config.mjs` |
| `https://www.traduccionesjuradas.net/traductor-jurado-irun/` | `308` | `/` | `200` | `1` | slug legacy `traductor-jurado-*` no-francés -> home | `middleware.ts` + `next.config.mjs` |
| `https://www.traduccionesjuradas.net/wp-json/` | `410` | `-` | `410` | `0` | endpoint WordPress obsoleto -> Gone | `middleware.ts` |
| `https://www.traduccionesjuradas.net/wp-content/plugins/burst-statistics/endpoint.php` | `410` | `-` | `410` | `0` | plugin endpoint legacy -> Gone | `middleware.ts` |
| `https://www.traduccionesjuradas.net/traductor-jurado-frances-irun/` | `308` | `/traductor-jurado-frances` | `200` | `1` | slug con `frances` -> pilar | `middleware.ts` + `next.config.mjs` |

Resultado: `PASS` para las URLs de `seo/urls_5xx.txt` en entorno local (sin `5xx`, máximo `1` salto).
