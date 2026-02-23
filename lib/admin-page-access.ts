import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import { authOptions } from "@/lib/auth";
import { isStaffEmail } from "@/lib/staff-access";
import { readVerifiedOtpToken, STAFF_OTP_VERIFIED_COOKIE } from "@/lib/staff-otp";

export async function requireAdminPageAccess(callbackPath: string) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.trim().toLowerCase() || null;
  if (!email || !isStaffEmail(email)) {
    const verifiedCookie = cookies().get(STAFF_OTP_VERIFIED_COOKIE)?.value;
    const verified = readVerifiedOtpToken(verifiedCookie);
    const verifiedEmail = verified?.email?.trim().toLowerCase() || null;
    if (!verifiedEmail || !isStaffEmail(verifiedEmail)) {
      redirect(`/acceso?callbackUrl=${encodeURIComponent(callbackPath)}`);
    }
    return verifiedEmail;
  }
  return email;
}
