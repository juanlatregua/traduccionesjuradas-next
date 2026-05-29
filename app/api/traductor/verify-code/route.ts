import { NextResponse } from "next/server";
import { isStaffEmail } from "@/lib/staff-access";
import {
  createVerifiedOtpToken,
  readPendingOtpToken,
  STAFF_OTP_PENDING_COOKIE,
  STAFF_OTP_VERIFIED_COOKIE,
} from "@/lib/staff-otp";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

type VerifyBody = {
  code?: string;
};

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const pendingCookie = req.headers
    .get("cookie")
    ?.split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${STAFF_OTP_PENDING_COOKIE}=`))
    ?.split("=")[1];
  const pending = readPendingOtpToken(pendingCookie);
  const pendingEmail = pending?.email || "unknown";

  const rl = await checkRateLimit({
    key: `staff:verify-code:${pendingEmail}:${ip}`,
    limit: 12,
    windowMs: 10 * 60 * 1000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Demasiados intentos de verificacion. Espera unos minutos." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  try {
    const body = (await req.json()) as VerifyBody;
    const code = (body.code || "").trim();
    if (!code) {
      return NextResponse.json({ ok: false, error: "Codigo requerido." }, { status: 400 });
    }
    if (!pending) {
      return NextResponse.json(
        { ok: false, error: "No hay codigo pendiente. Solicita uno nuevo." },
        { status: 400 }
      );
    }
    if (pending.exp < Date.now()) {
      return NextResponse.json({ ok: false, error: "Codigo caducado." }, { status: 400 });
    }
    if (!isStaffEmail(pending.email)) {
      return NextResponse.json({ ok: false, error: "Correo no autorizado." }, { status: 403 });
    }
    if (pending.code !== code) {
      return NextResponse.json({ ok: false, error: "Codigo incorrecto." }, { status: 400 });
    }

    // Sesión persistente: 60 días en dispositivo de confianza. Sigue siendo
    // fuerte (token firmado HMAC, httpOnly, secure, SameSite=lax) — el OTP solo
    // se pide en el primer acceso del dispositivo o al caducar/cerrar sesión.
    const SESSION_MS = 60 * 24 * 60 * 60 * 1000;
    const verifiedToken = createVerifiedOtpToken(pending.email, SESSION_MS);
    const response = NextResponse.json({ ok: true });
    response.cookies.set({
      name: STAFF_OTP_VERIFIED_COOKIE,
      value: verifiedToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MS / 1000,
    });
    response.cookies.set({
      name: STAFF_OTP_PENDING_COOKIE,
      value: "",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    return response;
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "No se pudo verificar el codigo." },
      { status: 500 }
    );
  }
}
