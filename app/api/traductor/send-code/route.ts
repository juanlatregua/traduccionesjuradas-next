import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isStaffEmail } from "@/lib/staff-access";
import { sendStaffOtpEmail } from "@/lib/email";
import { createPendingOtpToken, generateOtpCode, STAFF_OTP_PENDING_COOKIE } from "@/lib/staff-otp";

export async function POST() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email || null;

  if (!isStaffEmail(email)) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 403 });
  }

  try {
    const code = generateOtpCode();
    const pendingToken = createPendingOtpToken(email!, code, 10 * 60 * 1000);
    await sendStaffOtpEmail({ toEmail: email!, code });

    const response = NextResponse.json({ ok: true });
    response.cookies.set({
      name: STAFF_OTP_PENDING_COOKIE,
      value: pendingToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 10 * 60,
    });
    return response;
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "No se pudo enviar el codigo." },
      { status: 500 }
    );
  }
}
