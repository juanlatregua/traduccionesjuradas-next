import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isStaffEmail } from "@/lib/staff-access";
import {
  readVerifiedOtpToken,
  STAFF_OTP_VERIFIED_COOKIE,
} from "@/lib/staff-otp";
import StaffOtpGate from "@/components/StaffOtpGate";

export const metadata: Metadata = {
  title: "Verificar acceso traductor",
  description: "Codigo OTP para acceder a zona traductor.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function VerificarZonaTraductorPage() {
  const session = await getServerSession(authOptions);
  const sessionEmail = session?.user?.email?.trim().toLowerCase() || null;
  const verifiedCookie = cookies().get(STAFF_OTP_VERIFIED_COOKIE)?.value;
  const verified = readVerifiedOtpToken(verifiedCookie);

  if (verified?.email && isStaffEmail(verified.email)) {
    redirect("/zona-traductor");
  }

  // Dev bypass: redirect to auto-verify route
  if (process.env.NODE_ENV === "development") {
    const devEmail = sessionEmail && isStaffEmail(sessionEmail)
      ? sessionEmail
      : "juansilva@traduccionesjuradas.net";
    redirect(`/api/traductor/dev-bypass?email=${encodeURIComponent(devEmail)}`);
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <StaffOtpGate initialEmail={sessionEmail && isStaffEmail(sessionEmail) ? sessionEmail : ""} />
    </main>
  );
}
