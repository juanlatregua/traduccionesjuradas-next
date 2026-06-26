import type { Metadata } from "next";
import { authZonaTraductorOrRedirect } from "@/lib/zona-traductor-data";
import { getStaffRole } from "@/lib/staff-access";
import { prisma } from "@/lib/prisma";
import RecurringInvoiceManager, { type RecurringRow } from "@/components/RecurringInvoiceManager";

export const metadata: Metadata = {
  title: "Zona traductor — Facturas recurrentes",
  robots: { index: false, follow: false },
};

type Line = { description: string; detail?: string; amountCents: number };

export default async function ZonaTraductorRecurrentesPage() {
  const email = await authZonaTraductorOrRedirect();
  const role = getStaffRole(email);
  const canManage = role === "ADMIN" || role === "PM";

  const raw = await prisma.recurringInvoice.findMany({ orderBy: [{ active: "desc" }, { createdAt: "desc" }] });
  const templates: RecurringRow[] = raw.map((t) => ({
    id: t.id,
    label: t.label,
    active: t.active,
    brand: t.brand,
    clientName: t.clientName,
    fiscalName: t.fiscalName,
    nif: t.nif,
    address: t.address,
    city: t.city,
    postalCode: t.postalCode,
    country: t.country,
    email: t.email,
    conceptTemplate: t.conceptTemplate,
    poNumber: t.poNumber,
    langPair: t.langPair,
    lines: Array.isArray(t.lineItemsJson) ? (t.lineItemsJson as unknown as Line[]) : [],
    vatRate: t.vatRate,
    dayOfMonth: t.dayOfMonth,
    lastGeneratedPeriod: t.lastGeneratedPeriod,
    notes: t.notes,
  }));

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-semibold text-white">Facturas recurrentes</h1>
        <p className="mt-1 text-sm text-slate-400">
          Plantillas que se repiten cada mes (p.ej. la cuota de Oracle). Cada mes se genera un <strong>borrador</strong>{" "}
          que revisas y emites a mano en Facturas. Usa <code>{"{MES} {AÑO}"}</code> en el concepto.
        </p>
        {canManage ? (
          <RecurringInvoiceManager templates={templates} />
        ) : (
          <p className="mt-6 text-slate-500">Solo ADMIN/PM puede gestionar plantillas recurrentes.</p>
        )}
      </div>
    </div>
  );
}
