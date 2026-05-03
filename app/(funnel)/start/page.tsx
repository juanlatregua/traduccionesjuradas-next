import { redirect } from "next/navigation";
import type { Metadata } from "next";
import StartSessionForm from "@/components/funnel/StartSessionForm";
import { getSessionById, getSessionIdFromCookie } from "@/lib/session";
import { routeForStep } from "@/lib/step";
import { prisma } from "@/lib/prisma";
import {
  PURPOSE_REGULARIZACION_2026,
  computeSessionPricing,
} from "@/lib/session-pricing";

export const metadata: Metadata = {
  title: "Inicio de encargo | Traducción jurada",
  robots: { index: false, follow: false },
};

const PURPOSE_PRESETS: Record<string, string> = {
  "regularizacion-2026": PURPOSE_REGULARIZACION_2026,
};

type StartPageProps = {
  searchParams?: { p?: string };
};

export default async function StartPage({ searchParams }: StartPageProps) {
  const presetKey = searchParams?.p?.toLowerCase().trim();
  const presetPurpose = presetKey ? PURPOSE_PRESETS[presetKey] : undefined;

  const sessionId = getSessionIdFromCookie();
  let session = sessionId ? await getSessionById(sessionId) : null;

  if (session && presetPurpose && session.purpose !== presetPurpose) {
    const pricing = await computeSessionPricing(session.id);
    await prisma.orderSession.update({
      where: { id: session.id },
      data: {
        purpose: presetPurpose,
        subtotalCents: pricing.subtotalCents,
        vatCents: pricing.vatCents,
        totalCents: pricing.totalCents,
      },
    });
    session = await getSessionById(session.id);
  }

  if (session && session.step !== "START") {
    redirect(routeForStep(session.step));
  }

  return (
    <StartSessionForm
      hasSession={Boolean(session)}
      defaultPurpose={session?.purpose ?? (presetPurpose === PURPOSE_REGULARIZACION_2026 ? "Regularización extraordinaria 2026" : undefined)}
      existingDocsCount={session?.docs.length || 0}
      isRegularizacion2026={presetPurpose === PURPOSE_REGULARIZACION_2026}
    />
  );
}
