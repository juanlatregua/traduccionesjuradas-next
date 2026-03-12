# 004 — SendGrid como proveedor de email

## Contexto
Se necesitaba un servicio de email transaccional fiable para ~24 tipos de email (confirmaciones, notificaciones, OTP, colaboradores).

## Decisión
SendGrid (@sendgrid/mail 8.1.6) con templates HTML inline (no sistema de plantillas externo).

## Consecuencias
- **Positivo:** API simple, alta deliverabilidad, buen free tier
- **Positivo:** Templates inline permiten control total sobre diseño sin dependencia externa
- **Positivo:** Click tracking deshabilitado globalmente (privacidad)
- **Negativo:** Templates hardcoded en funciones TypeScript — cambiar diseño requiere deploy
- **Negativo:** Sin gestión de bounces/complaints via webhook (TODO)
- **Negativo:** `lib/email.ts` ha crecido a 1191 líneas — candidato a refactor
