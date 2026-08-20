import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireAdminPageAccess } from "@/lib/admin-page-access";
import { AdminNav } from "@/components/AdminNav";
import AdminInboxPanel, { type InboxRow } from "@/components/AdminInboxPanel";

export const metadata: Metadata = {
  title: "Admin · Bandeja de entrada",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Props = { searchParams?: { vista?: string; canal?: string } };

export default async function AdminInboxPage({ searchParams }: Props) {
  await requireAdminPageAccess("/admin/inbox");

  const vista = searchParams?.vista || "pendientes";
  const canal = searchParams?.canal === "whatsapp" ? "WHATSAPP" : searchParams?.canal === "email" ? "EMAIL" : null;
  const where = {
    ...(vista === "respondidos"
      ? { status: "REPLIED" as const }
      : vista === "archivados"
        ? { status: "ARCHIVED" as const }
        : vista === "todos"
          ? {}
          : { status: { in: ["NEW", "DRAFTED"] as ("NEW" | "DRAFTED")[] } }),
    ...(canal ? { channel: canal as "EMAIL" | "WHATSAPP" } : {}),
  };

  const emails = await prisma.inboundEmail.findMany({
    where,
    orderBy: { receivedAt: "desc" },
    take: 100,
  });

  const counts = await prisma.inboundEmail.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  const countMap = Object.fromEntries(counts.map((c) => [c.status, c._count._all]));

  const rows: InboxRow[] = emails.map((e) => ({
    id: e.id,
    channel: e.channel,
    isManual: e.graphId.startsWith("manual:"),
    fromPhone: e.fromPhone,
    media: Array.isArray(e.mediaJson) ? (e.mediaJson as InboxRow["media"]) : [],
    fromEmail: e.fromEmail,
    fromName: e.fromName,
    subject: e.subject,
    bodyPreview: e.bodyPreview,
    bodyText: e.bodyText,
    receivedAt: e.receivedAt.toISOString(),
    status: e.status,
    customerId: e.customerId,
    quoteId: e.quoteId,
    orderReference: e.orderReference,
    draftSubject: e.draftSubject,
    draftBody: e.draftBody,
    replySubject: e.replySubject,
    replyBody: e.replyBody,
    repliedAt: e.repliedAt ? e.repliedAt.toISOString() : null,
    brief: e.briefJson && typeof e.briefJson === "object" ? (e.briefJson as InboxRow["brief"]) : null,
  }));

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <AdminNav />
      <AdminInboxPanel
        initialRows={rows}
        vista={vista}
        canal={canal === "WHATSAPP" ? "whatsapp" : canal === "EMAIL" ? "email" : "todos"}
        counts={{
          pendientes: (countMap.NEW || 0) + (countMap.DRAFTED || 0),
          respondidos: countMap.REPLIED || 0,
          archivados: countMap.ARCHIVED || 0,
        }}
      />
    </main>
  );
}
