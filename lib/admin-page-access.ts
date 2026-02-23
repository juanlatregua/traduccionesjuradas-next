import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isStaffEmail } from "@/lib/staff-access";

export async function requireAdminPageAccess(callbackPath: string) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.trim().toLowerCase() || null;
  if (!email || !isStaffEmail(email)) {
    redirect(`/acceso?callbackUrl=${encodeURIComponent(callbackPath)}`);
  }
  return email;
}
