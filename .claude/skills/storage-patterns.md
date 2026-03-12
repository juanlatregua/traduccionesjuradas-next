# Storage — Vercel Blob, validación y límites

## Backend: Vercel Blob (@vercel/blob 2.2.0)

Variable de entorno: `BLOB_READ_WRITE_TOKEN`
Acceso público via URL directa. Random suffix habilitado (anti-enumeración).

## Archivos clave
- `lib/file-security.ts` — validación MIME, magic bytes, sanitización filename
- `lib/payment-config.ts` → `isBlobConfigured()` — check si storage está activo

## Endpoints de subida

| Endpoint | Max | Tipos | Pathname | Auth |
|----------|-----|-------|----------|------|
| `/api/documents/upload` | 20 MB | PDF, JPG, PNG, HEIC, TIFF, WebP | `ia-documents/` | Público (GDPR consent) |
| `/api/session/upload` | 12 MB | PDF, DOC, DOCX, JPG, PNG, WebP, TXT | `funnel/{ref}/` | Session cookie |
| `/api/orders/[ref]/documents` | 12 MB | PDF, DOC, DOCX, JPG, PNG, WebP, TXT | `orders/{ref}/documentos/` | Staff/cliente/guest |
| `/api/orders/[ref]/payment-proof` | 5 MB | JPG, PNG, WebP, PDF | `orders/{ref}/comprobantes/` | Staff/cliente/guest |
| `/api/encargo/[token]/upload` | 20 MB | PDF, DOC, DOCX | `collaborator-deliveries/{ref}/` | Token colaborador |
| `/api/upload` | 10 MB | PDF, DOC, DOCX, JPG, PNG, WebP, TXT | `orders/{ref}/` o `uploads/` | Staff only |

## Validación de seguridad

### Magic bytes (file-security.ts)
```
PDF  → 0x25 0x50 0x44 0x46
JPEG → 0xFF 0xD8 0xFF
PNG  → 0x89 0x50 0x4E 0x47
WebP → RIFF + WEBP (12 bytes)
ZIP  → 0x50 0x4B 0x03 0x04 (para DOCX)
```

### Funciones de validación
- `validatePaymentProofFile()` — MIME debe coincidir con extensión (estricto)
- `validateGeneralUploadFile()` — flexible: DOCX=ZIP ok, DOC=sin check, TXT=no binario

### Sanitización de filename
```
→ Elimina caracteres no alfanuméricos: [^\w.\- ]+ → _
→ Colapsa espacios → _
→ Deduplica underscores → _
→ Máx 120 caracteres
```

## Rate limits por endpoint
| Endpoint | Límite | Ventana | Clave |
|----------|--------|---------|-------|
| Documents upload (IA) | 15 | 24h | IP |
| Session upload | 15 | 10 min | SessionID:IP |
| Order documents | 12 | 10 min | IP |
| Payment proof | 10 | 10 min | IP |
| Collaborator upload | 10 | 10 min | Token:IP |
| Staff upload | 30 | 10 min | Email:IP |
| IA analyses (global) | 200 | 24h | Global |

## Limpieza automática (GDPR)

**Cron:** `/api/cron/document-cleanup` (cada hora)
**Retención:** 30 días

### Fase A — Documentos no pagados → borrado completo
Targets: UPLOADED, ANALYZING, ANALYZED, ANALYSIS_FAILED, QUOTE_GENERATED, PAYMENT_PENDING
Acción: `del(fileUrl)` + borrar registro DB

### Fase B — Documentos pagados → solo blob
Targets: PAID, IN_TRANSLATION, TRANSLATED, DELIVERED
Acción: `del(fileUrl)` + `fileUrl = "[DELETED-GDPR]"` (mantiene registro contable)

## Cómo subir un archivo
```typescript
import { put } from "@vercel/blob";

const blob = await put(`orders/${ref}/documentos/${timestamp}-${filename}`, file, {
  access: "public",
  addRandomSuffix: true,
});
// blob.url → URL pública del archivo
// blob.pathname → ruta interna
```

## Cómo borrar un archivo
```typescript
import { del } from "@vercel/blob";
await del(fileUrl); // Si ya no existe, no lanza error
```

## Modelos de BD para archivos
- `OrderDocument` — fileKey, fileUrl, filename, mimeType, sizeBytes
- `DocumentAnalysis` — fileName, fileUrl, fileSize, mimeType
- `CollaboratorAssignment` — deliveredFileUrl, deliveredFileKey, deliveredFilename
- `Order` — translatedFileUrl, paymentProofFileKey, finalDeliveryFileUrl, draftFileUrl
- `OrderEvent` — payload JSON con fileUrl, fileKey, fileName

## Qué NO hacer
- **NUNCA** borrar blobs de pedidos pagados sin marcar `[DELETED-GDPR]`
- **NUNCA** subir sin validar magic bytes — previene archivos maliciosos
- **NUNCA** exponer `BLOB_READ_WRITE_TOKEN` al cliente — solo server-side
- Si `isBlobConfigured()` es false → retornar 503, no intentar subir
