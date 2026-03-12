# Auth — OAuth, OTP, roles y sesiones

## Arquitectura

Sistema híbrido con dos vías de autenticación:
1. **Google OAuth** (NextAuth 4, JWT stateless) — clientes + staff
2. **OTP por email** (HMAC-SHA256, 6 dígitos) — zona-traductor (staff)

Sesión de funnel (`tj_session` cookie) es independiente de auth.

## Archivos clave
- `lib/auth.ts` — config NextAuth (Google provider, JWT strategy)
- `lib/auth-callback.ts` — allowlist de callbacks seguros
- `lib/staff-access.ts` — roles por email (ADMIN, PM, COLLABORATOR, STAFF)
- `lib/staff-otp.ts` — generación/validación tokens OTP (HMAC-SHA256)
- `lib/staff-auth.ts` — `requireStaffAccess()` para API routes
- `lib/admin-page-access.ts` — `requireAdminPageAccess()` para Server Components

## Roles (por email, en ENV)
```
ADMIN_EMAILS     → getAdminEmails()     — acceso total
PM_EMAILS        → getPmEmails()        — project manager
COLLABORATOR_EMAILS → getCollaboratorEmails() — traductores externos
STAFF_EMAILS     → isStaffEmail()       — staff genérico (+ defaults hardcoded)
```

## Flujo Google OAuth
```
/acceso → GoogleSignInButton → signIn("google", { callbackUrl })
→ Google consent → /api/auth/callback/google → JWT cookie → redirect
```
- Callback URLs validadas contra allowlist en `auth-callback.ts`
- JWT en cookie `next-auth.session-token` (httpOnly, secure, sameSite=lax)

## Flujo OTP (zona-traductor)
```
/zona-traductor → redirect /zona-traductor/verificar
→ email + "Enviar código" → POST /api/traductor/send-code
  - Valida staff email, rate limit 6/10min
  - Genera código 6 dígitos, cookie staff_otp_pending (10 min)
  - Envía código por email (SendGrid)
→ código + "Validar" → POST /api/traductor/verify-code
  - Rate limit 12/10min
  - Valida código vs pending token
  - Cookie staff_otp_verified (8 horas)
→ redirect /zona-traductor
```

## Leer sesión

### Server Components
```typescript
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
const session = await getServerSession(authOptions);
const email = session?.user?.email?.trim().toLowerCase() || null;
```

### Client Components
```typescript
import { signIn, signOut } from "next-auth/react";
// No useSession() — solo signIn/signOut
```

## Proteger API routes
```typescript
import { requireStaffAccess } from "@/lib/staff-auth";

export async function POST(req: Request) {
  const access = await requireStaffAccess(req);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: 403 });
  // access.email, access.mode ("session" | "otp")
}
```

## Proteger páginas admin
```typescript
import { requireAdminPageAccess } from "@/lib/admin-page-access";

export default async function Page() {
  const email = await requireAdminPageAccess("/admin/orders");
  // Si no auth → redirect a /acceso?callbackUrl=...
}
```

## Zona-traductor: doble verificación
Requiere Google OAuth **Y** OTP verificado. Si OTP no coincide con sesión → re-verificar.

## Qué NO modificar sin revisar
- `lib/auth.ts` — cambiar providers o strategy rompe todas las sesiones
- `lib/staff-otp.ts` — tokens firmados con NEXTAUTH_SECRET
- `middleware.ts` — NO maneja auth (solo redirects legacy WordPress)
- Callbacks allowlist en `auth-callback.ts` — previene open redirect

## Variables de entorno
```
NEXTAUTH_SECRET, NEXTAUTH_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
STAFF_EMAILS, PM_EMAILS, ADMIN_EMAILS, COLLABORATOR_EMAILS
```
