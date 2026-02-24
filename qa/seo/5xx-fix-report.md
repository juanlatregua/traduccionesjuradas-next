# 5xx Fix Report

Estado de ejecución del checker: `NO_VERIFICADO` en runtime porque falta `seo/urls_5xx.txt`.
Comando ejecutado: `node seo/check_urls.mjs`.

| URL | clase | regla | archivo | verificación |
| --- | --- | --- | --- | --- |
| `http://www.traduccionesjuradas.net/:path*` | canonicalización protocolo | `301` a `https://www.traduccionesjuradas.net/:path*` | `next.config.mjs` | `CONFIG_VERIFICADO`, `RUNTIME_NO_VERIFICADO (falta seo/urls_5xx.txt)` |
| `https://traduccionesjuradas.net/:path*` | canonicalización host | `301` a `https://www.traduccionesjuradas.net/:path*` | `next.config.mjs` | `CONFIG_VERIFICADO`, `RUNTIME_NO_VERIFICADO (falta seo/urls_5xx.txt)` |
| `/wp-json`, `/wp-json/*` | basura WordPress | `410 Gone` | `middleware.ts` | `CONFIG_VERIFICADO`, `RUNTIME_NO_VERIFICADO (falta seo/urls_5xx.txt)` |
| `/wp-admin/*`, `/wp-login.php`, `/xmlrpc.php` | basura WordPress | `410 Gone` | `middleware.ts` | `CONFIG_VERIFICADO`, `RUNTIME_NO_VERIFICADO (falta seo/urls_5xx.txt)` |
| `/wp-content/plugins/*/endpoint.php` | endpoint legacy | `410 Gone` | `middleware.ts` | `CONFIG_VERIFICADO`, `RUNTIME_NO_VERIFICADO (falta seo/urls_5xx.txt)` |
| `/feed/`, `*/feed/` | feeds legacy | `410 Gone` | `middleware.ts` | `CONFIG_VERIFICADO`, `RUNTIME_NO_VERIFICADO (falta seo/urls_5xx.txt)` |
| `/index.php?route=*`, `/?route=*` | query route legacy | `410 Gone` | `middleware.ts` | `CONFIG_VERIFICADO`, `RUNTIME_NO_VERIFICADO (falta seo/urls_5xx.txt)` |
| `/*frances*` (excepto `/traductor-jurado-frances`) | legacy francés | `301` a `/traductor-jurado-frances` | `next.config.mjs` | `CONFIG_VERIFICADO`, `RUNTIME_NO_VERIFICADO (falta seo/urls_5xx.txt)` |
| `/traductor-jurado-*` sin `frances` | slug legacy masivo | `301` a `/` | `next.config.mjs` | `CONFIG_VERIFICADO`, `RUNTIME_NO_VERIFICADO (falta seo/urls_5xx.txt)` |
| `/traduccion-jurada-*`, `/traductor-*`, `/traducciones-*` sin `frances` | slug roto legacy | `301` a `/` | `next.config.mjs` | `CONFIG_VERIFICADO`, `RUNTIME_NO_VERIFICADO (falta seo/urls_5xx.txt)` |
| `/inicio/*`, `/agencia/*` | slugs legacy marca | `301` a `/` | `next.config.mjs` | `CONFIG_VERIFICADO`, `RUNTIME_NO_VERIFICADO (falta seo/urls_5xx.txt)` |
| `/contacto/page/:n` | paginación legacy | `301` a `/contacto` | `next.config.mjs` | `CONFIG_VERIFICADO`, `RUNTIME_NO_VERIFICADO (falta seo/urls_5xx.txt)` |

