# 003 — NextAuth 4 (Google OAuth) + OTP por email

## Contexto
Dos tipos de usuario: clientes (área-cliente) y staff/traductores (zona-traductor). Los clientes necesitan login simple; el staff necesita seguridad reforzada.

## Decisión
- NextAuth 4 con Google OAuth como provider único (JWT stateless)
- OTP por email (6 dígitos, HMAC-SHA256) como segunda capa para zona-traductor
- Roles definidos por listas de emails en variables de entorno

## Consecuencias
- **Positivo:** Sin tabla de sesiones en BD (JWT stateless = menos queries)
- **Positivo:** Doble verificación para staff (OAuth + OTP) mitiga riesgos
- **Positivo:** Gestión de roles sin RBAC complejo (listas de email en ENV)
- **Negativo:** Cambiar de provider requiere re-implementar auth
- **Negativo:** OTP por email depende de Microsoft Graph — si falla, staff no puede acceder
- **Negativo:** No hay recuperación automática si un email sale de la lista ENV
