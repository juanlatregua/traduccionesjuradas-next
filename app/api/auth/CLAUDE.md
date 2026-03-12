# Auth API — NextAuth + Google OAuth

## Cómo funciona
- Provider único: Google OAuth
- Strategy: JWT (stateless, sin tabla de sesiones en BD)
- Sesión en cookie `next-auth.session-token` (httpOnly, secure, sameSite=lax)

## Claims del JWT
```typescript
{ user: { email, name?, image? }, expires: string }
```
No hay roles en el JWT — los roles se determinan comparando email contra ENV vars (`STAFF_EMAILS`, `ADMIN_EMAILS`, `PM_EMAILS`).

## Archivos relacionados
- `lib/auth.ts` — configuración de NextAuth (providers, callbacks, JWT)
- `lib/auth-callback.ts` — allowlist de callbackUrls seguros
- `lib/staff-access.ts` — `isStaffEmail()`, `getStaffRole()`
- `lib/staff-auth.ts` — `requireStaffAccess()` para API routes
- `lib/staff-otp.ts` — OTP como segunda capa (zona-traductor)

## Qué NO modificar sin revisar
- **Providers:** cambiar/añadir providers invalida sesiones existentes
- **JWT strategy:** cambiar a "database" requiere crear tabla Session
- **Callback allowlist:** previene open redirect — no añadir URLs externas
- **NEXTAUTH_SECRET:** cambiar invalida TODOS los tokens (JWT + OTP)
