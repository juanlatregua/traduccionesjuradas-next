import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isStaffEmail } from "@/lib/staff-access";
import {
  createVerifiedOtpToken,
  readPendingOtpToken,
  STAFF_OTP_PENDING_COOKIE,
  STAFF_OTP_VERIFIED_COOKIE,
} from "@/lib/staff-otp";

type VerifyBody = {
  code?: string;
};

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email || null;

  if (!isStaffEmail(email)) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 403 });
  }

  try {
    const body = (await req.json()) as VerifyBody;
    const code = (body.code || "").trim();
    if (!code) {
      return NextResponse.json({ ok: false, error: "Codigo requerido." }, { status: 400 });
    }

    const pendingCookie = req.headers
      .get("cookie")
      ?.split(";")
      .map((item) => item.trim())
      .find((item) => item.startsWith(`${STAFF_OTP_PENDING_COOKIE}=`))
      ?.split("=")[1];

    const pending = readPendingOtpToken(pendingCookie);
    if (!pending) {
      return NextResponse.json(
        { ok: false, error: "No hay codigo pendiente. Solicita uno nuevo." },
        { status: 400 }
      );
    }
    if (pending.exp < Date.now()) {
      return NextResponse.json({ ok: false, error: "Codigo caducado." }, { status: 400 });
    }
    if (pending.email !== email?.trim().toLowerCase()) {
      return NextResponse.json({ ok: false, error: "Codigo no valido para esta cuenta." }, { status: 400 });
    }
    if (pending.code !== code) {
      return NextResponse.json({ ok: false, error: "Codigo incorrecto." }, { status: 400 });
    }

    const verifiedToken = createVerifiedOtpToken(email!, 8 * 60 * 60 * 1000);
    const response = NextResponse.json({ ok: true });
    response.cookies.set({
      name: STAFF_OTP_VERIFIED_COOKIE,
      value: verifiedToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 8 * 60 * 60,
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
