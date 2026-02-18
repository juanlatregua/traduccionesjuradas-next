import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isStaffEmail } from "@/lib/staff-access";
import {
  isVerifiedOtpTokenValid,
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
  const email = session?.user?.email || null;

  if (!email) {
    redirect("/acceso?callbackUrl=/zona-traductor/verificar");
  }

  if (!isStaffEmail(email)) {
    redirect("/acceso?callbackUrl=/zona-traductor/verificar");
  }

  const verifiedCookie = cookies().get(STAFF_OTP_VERIFIED_COOKIE)?.value;
  const isValid = isVerifiedOtpTokenValid(verifiedCookie, email);
  if (isValid) {
    redirect("/zona-traductor");
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <StaffOtpGate />
    </main>
  );
}
