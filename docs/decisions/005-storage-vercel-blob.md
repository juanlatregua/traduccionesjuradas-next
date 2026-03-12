# 005 — Vercel Blob como almacenamiento de archivos

## Contexto
Se necesitaba almacenamiento de archivos para documentos de clientes, justificantes de pago, entregas de colaboradores y análisis IA. Los archivos deben ser accesibles via URL pública.

## Decisión
Vercel Blob (@vercel/blob 2.2.0) con acceso público y random suffix para URLs.

## Consecuencias
- **Positivo:** Integración nativa con Vercel (sin configurar bucket/IAM)
- **Positivo:** CDN global incluido, URLs directas sin proxy
- **Positivo:** Random suffix previene enumeración de archivos
- **Negativo:** Sin control granular de acceso (todos los archivos son públicos via URL)
- **Negativo:** Dependencia total de Vercel — migrar requiere re-upload de todos los archivos
- **Mitigación:** Limpieza GDPR automática (cron cada hora, retención 30 días)
- **Mitigación:** Validación de magic bytes + MIME + extensión en cada upload
