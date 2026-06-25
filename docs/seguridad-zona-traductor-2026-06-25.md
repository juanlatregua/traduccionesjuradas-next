# Informe de seguridad — zona traductor (2026-06-25)

Auditoría multi-agente (read-only) + verificación adversarial, con criterio humano aplicado encima (el verificador sobre-rateó dos "críticos"; se señalan). **Todo es código pre-existente en producción**, no introducido por las ramas de esta tanda.

Leyenda: ✅ arreglado en `fix/seguridad-hardening` · 🔧 pendiente (decisión de producto) · ❌ descartado (falso positivo).

---

## 🔴 ALTO — prioridad

### A. Infracobro: el precio lo pone el cliente — `POST /api/orders` 🔧 (decisión)
`app/api/orders/route.ts`: el endpoint es **público** (guests vía `guestEmail`, L162-166) y solo valida `amountCents >= 100` (L176); el importe llega del body del cliente (L225) y `POST /api/payment/card` lo pasa tal cual a Stripe **sin recalcular**. Un atacante puede crear un pedido a 1 € y pagar 1 € por una traducción de 50 €.

**Confirmado explotable.** El fix depende de una pregunta de producto:
- **¿`POST /api/orders` (camino guest) es vía VIVA del funnel, o legacy?** El funnel v2 usa `/api/puerta/checkout` (precio server-side). 
  - Si es **legacy** → el fix es trivial: exigir sesión/staff (cerrar el camino guest).
  - Si es **viva** → recalcular el precio en servidor con el pricing-engine y rechazar (422) si el importe del cliente queda por debajo del estimado (mismo espíritu que el gate `isAutoPriceable`). Ojo: `words` también lo pone el cliente, así que el recálculo debe partir de fuentes fiables (documento analizado / presupuesto), no del body.

No se parchea a ciegas por tocar el camino de pago. **Pendiente: confirmar el flujo.**

### B. Lookup de pedidos sin token → PII + URLs de documentos 🔧
`/api/orders/lookup` y `/api/documents/lookup`: con email+referencia (sin token firmado, rate-limit solo por IP) devuelven datos del pedido **y `translatedFileUrl`** (blob público). Encadenado con (D) = descarga de documentos jurados ajenos por enumeración. Riesgo RGPD.
- **Fix recomendado:** exigir token firmado (`verifyOrderToken`, ya existe y se usa en `orders/[reference]/public`) y/o rate-limit por (email, referencia), no solo IP. Reducir los campos devueltos.

### C. `payment-proof` marca PAID sin verificación 🔧 (decisión)
`app/api/orders/[reference]/payment-proof/route.ts`: auth solo por email coincidente (sin token, L96-108); subir un comprobante llama a `updateOrderPayment` → **PAID automático** + producción (L198-236). Cualquiera con la referencia + el email puede dar por pagado un pedido con una imagen falsa → traducción jurada gratis; el staff nunca verifica el comprobante.
- **Decisión:** ¿es trade-off deliberado (confías y reconcilias con el banco después) o debe pasar a *"pendiente de verificar"* y que el staff confirme (`confirm-payment`) tras mirar el banco? Recomendación: **desacoplar** "el cliente dice que pagó" de "lo confirmamos" + exigir token.
- *El "case-insensitive email bypass" que el verificador marcó como crítico aparte es el MISMO problema (auth solo-email), no uno nuevo. La parte de caja se mitigó normalizando el email (ver ✅).*

### D. Documentos en Vercel Blob PÚBLICOS 🔧 (decisión documentada)
`documents/route.ts:142` `access:"public"`; las URLs de PII (pasaportes, partidas, extractos) son públicas si se filtran (van en emails de entrega). **Es decisión consciente** (`docs/decisions/005-storage-vercel-blob.md`), mitigada con sufijo aleatorio + limpieza RGPD.
- **Recomendación (RGPD, negocio YMYL):** proxy de descarga con autorización / URLs firmadas con caducidad. Es rediseño, no quick-win.

---

## 🟡 MEDIO/BAJO — defensa en profundidad

### E. Faltan gates de rol en finanzas/facturas ✅ ARREGLADO
- `finance/supplier-invoice`: ahora exige **ADMIN/PM** (antes cualquier staff, incl. COLLABORATOR, podía marcar facturas de proveedor PAID y cerrar finanzas).
- `invoices/[id]` DELETE: el rol **COLLABORATOR** ya no borra facturas (antes solo se gateaba ISSUED; podía borrar borradores).

### F. Tokens de `/encargo/[token]` sin caducidad ✅ ARREGLADO (parcial)
- El POST ahora caduca el enlace a **90 días** (el GET solo cubría 30d para DELIVERED/REJECTED). Un token filtrado no permite enviar presupuesto/entrega indefinidamente.
- *Rechazado el "brute-force de UUID = crítico" del verificador: inconsistente (descartó bien un token de 224 bits y marcó como crítico un UUID de 122 bits, igual de inviable). El riesgo real era la no-caducidad, ya cubierto.*

### Normalización de email ✅ ARREGLADO
`POST /api/orders` normaliza el email de sesión a minúsculas (el guest ya lo hacía) → evita el mismatch de caja en la comparación de `payment-proof`.

---

## ✅ Descartados (falsos positivos bien verificados)
- **Validación de importe en el webhook de quotes:** protegido por la firma HMAC de Stripe + gate de estado (no se puede editar `quote.total` una vez PAID).
- **PII en URLs públicas de presupuesto:** tokens de 224 bits (`crypto.randomBytes(28)`), no enumerables ni con rotación de IP.

---

## Estado y siguientes pasos
- **Arreglado y pusheado** (`fix/seguridad-hardening`): E, F, email-norm.
- **Pendiente de decisión tuya:** A (¿POST /api/orders vivo o legacy?), C (¿payment-proof auto-PAID intencional?), D (¿proxy/firmadas para blobs PII?).
- **Fix directo cuando decidas:** B (token en lookup) — no requiere decisión de producto, solo confirmar que no rompe `/consulta-pedido`.

> Nota de proceso: el primer run del audit se degradó por errores de conexión (cayeron *pagos* y *PII* y la verificación). Este informe es del re-run focalizado, completo.
