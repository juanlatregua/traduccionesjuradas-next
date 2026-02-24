import { redirect } from "next/navigation";
import type { Metadata } from "next";
import StartSessionForm from "@/components/funnel/StartSessionForm";
import { getSessionById, getSessionIdFromCookie } from "@/lib/session";
import { routeForStep } from "@/lib/step";

export const metadata: Metadata = {
  title: "Inicio de encargo | Traducción jurada",
  robots: { index: false, follow: false },
};

export default async function StartPage() {
  const sessionId = getSessionIdFromCookie();
  const session = sessionId ? await getSessionById(sessionId) : null;

  if (session && session.step !== "START") {
    redirect(routeForStep(session.step));
  }

  return (
    <StartSessionForm
      hasSession={Boolean(session)}
      defaultPurpose={session?.purpose}
      existingDocsCount={session?.docs.length || 0}
    />
  );
}

