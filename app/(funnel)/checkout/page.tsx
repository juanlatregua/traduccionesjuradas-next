import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import CheckoutPaymentActions from "@/components/funnel/CheckoutPaymentActions";
import { TrackEvent } from "@/components/TrackEvent";
import { authOptions } from "@/lib/auth";
import { getSessionOrRedirect } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Pago seguro | Traducción jurada",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage() {
  const session = await getSessionOrRedirect("CHECKOUT");
  if (session.docs.length < 1) {
    await prisma.orderSession.update({
      where: { id: session.id },
      data: { step: "UPLOAD" },
    });
    redirect("/upload?reason=missing_doc");
  }
  if (session.totalCents <= 0) {
    await prisma.orderSession.update({
      where: { id: session.id },
      data: { step: "REVIEW" },
    });
    redirect("/review");
  }

  const auth = await getServerSession(authOptions);
  const authEmail = auth?.user?.email?.trim().toLowerCase() || null;
  if (authEmail && (session.authState !== "AUTHENTICATED" || session.userId !== authEmail)) {
    await prisma.orderSession.update({
      where: { id: session.id },
      data: {
        authState: "AUTHENTICATED",
        userId: authEmail,
      },
    });
  }

  return (
    <>
      <TrackEvent name="checkout_started" />
      <CheckoutPaymentActions
        reference={session.reference}
        totalCents={session.totalCents}
        currency={session.currency}
        authState={authEmail ? "AUTHENTICATED" : session.authState}
      />
    </>
  );
}
