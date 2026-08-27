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

  // Traducciones ya entregadas del pedido casado (por referencia o por presupuesto):
  // la respuesta las adjunta por defecto y el panel lo enseña.
  const refs = Array.from(new Set(emails.map((e) => e.orderReference).filter(Boolean))) as string[];
  const quoteIds = Array.from(new Set(emails.filter((e) => !e.orderReference && e.quoteId).map((e) => e.quoteId))) as string[];
  const ordersForFiles =
    refs.length || quoteIds.length
      ? await prisma.order.findMany({
          where: { OR: [...(refs.length ? [{ reference: { in: refs } }] : []), ...(quoteIds.length ? [{ quoteId: { in: quoteIds } }] : [])] },
          select: { reference: true, quoteId: true, deliveryFilesJson: true, translatedFileUrl: true },
        })
      : [];
  const countFiles = (o: (typeof ordersForFiles)[number]) =>
    Array.isArray(o.deliveryFilesJson)
      ? (o.deliveryFilesJson as unknown as { url?: string }[]).filter((f) => f?.url).length
      : o.translatedFileUrl
        ? 1
        : 0;
  const filesByRef = new Map(ordersForFiles.map((o) => [o.reference, countFiles(o)]));
  const filesByQuote = new Map(ordersForFiles.filter((o) => o.quoteId).map((o) => [o.quoteId as string, countFiles(o)]));

  const rows: InboxRow[] = emails.map((e) => ({
    id: e.id,
    deliveredFileCount: e.orderReference ? filesByRef.get(e.orderReference) || 0 : e.quoteId ? filesByQuote.get(e.quoteId) || 0 : 0,
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
