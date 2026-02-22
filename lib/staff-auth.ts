import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isStaffEmail } from "@/lib/staff-access";
import { readVerifiedOtpToken, STAFF_OTP_VERIFIED_COOKIE } from "@/lib/staff-otp";

type StaffAccessResult =
  | { ok: true; email: string; mode: "session" | "otp" }
  | { ok: false; error: string };

function readCookie(req: Request, name: string) {
  const raw = req.headers.get("cookie") || "";
  const token = raw
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${name}=`));
  if (!token) return null;
  return token.slice(name.length + 1) || null;
}

export async function requireStaffAccess(req: Request): Promise<StaffAccessResult> {
  const session = await getServerSession(authOptions);
  const sessionEmail = session?.user?.email?.trim().toLowerCase() || null;
  if (sessionEmail && isStaffEmail(sessionEmail)) {
    return { ok: true, email: sessionEmail, mode: "session" };
  }

  const verifiedCookie = readCookie(req, STAFF_OTP_VERIFIED_COOKIE);
  const verified = readVerifiedOtpToken(verifiedCookie);
  if (verified?.email && isStaffEmail(verified.email)) {
    return { ok: true, email: verified.email, mode: "otp" };
  }

  return { ok: false, error: "Acceso denegado." };
}

