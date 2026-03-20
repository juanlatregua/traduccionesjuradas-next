# 004 — ~~SendGrid como proveedor de email~~ SUPERSEDED

**Estado: SUPERSEDED** — Reemplazado por Microsoft Graph API (marzo 2026).

## Contexto original
Se necesitaba un servicio de email transaccional fiable para ~24 tipos de email (confirmaciones, notificaciones, OTP, colaboradores).

## Decisión original
SendGrid (@sendgrid/mail 8.1.6) con templates HTML inline (no sistema de plantillas externo).

## Superseded por
Microsoft Graph API via Azure AD (OAuth2 client_credentials). Misma app registration que mitraductorjurado.
- `lib/azure-mail.ts` — cliente Graph con token cache en memoria
- Sin dependencia npm adicional (raw fetch)
- Env vars: `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `EMAIL_FROM`
