// app/api/cron/recurring-invoices/route.ts — cron diario: genera borradores de
// facturas Y gastos de las plantillas recurrentes cuyo día del mes ya llegó.
// Nunca emite; los gastos variables nacen needsReview=true.
import { NextResponse } from "next/server";
import { runMonthlyRecurringDrafts } from "@/lib/recurring-invoice";
import { generateRecurringExpensesDue } from "@/lib/recurring-expense";
import { hasCronSecret } from "@/lib/cron-auth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!hasCronSecret(req, process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 403 });
  }
  try {
    const invoices = await runMonthlyRecurringDrafts();
    const expenses = await generateRecurringExpensesDue();
    return NextResponse.json({ ok: true, invoices, expenses });
  } catch (err: any) {
    console.error("[cron-recurring-invoices] error", err);
    return NextResponse.json({ ok: false, error: err?.message || "error" }, { status: 500 });
  }
}
