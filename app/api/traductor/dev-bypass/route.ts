import { NextResponse } from "next/server";
import { createVerifiedOtpToken, STAFF_OTP_VERIFIED_COOKIE } from "@/lib/staff-otp";
import { isStaffEmail } from "@/lib/staff-access";

export async function GET(req: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ ok: false, error: "Solo disponible en desarrollo." }, { status: 403 });
  }

  const url = new URL(req.url);
  const email = url.searchParams.get("email") || "juansilva@traduccionesjuradas.net";

  if (!isStaffEmail(email)) {
    return NextResponse.json({ ok: false, error: "Email no es staff." }, { status: 403 });
  }

  const token = createVerifiedOtpToken(email, 8 * 60 * 60 * 1000);
  const response = NextResponse.redirect(new URL("/zona-traductor", req.url));
  response.cookies.set({
    name: STAFF_OTP_VERIFIED_COOKIE,
    value: token,
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    path: "/",
    maxAge: 8 * 60 * 60,
  });
  return response;
}
