import Link from "next/link";
import { billingHistoryForEmail, findRecurrentClient } from "@/lib/recurrent-client-db";
import { pickBillingToInherit, recurrentLabel } from "@/lib/recurrent-client";

// Marca para staff (Server Component): «Cliente recurrente · N pedidos · último … · importe».
// Solo en la zona de staff; jamás en pantallas públicas.
export default async function RecurrentClientBadge({ email, phone }: { email?: string | null; phone?: string | null }) {
  const match = await findRecurrentClient({ email, phone });
  if (match.kind === "none") return null;
  // Despacho vs particular con el mismo email: los datos de facturación NO se copian solos.
  const titulares =
    match.kind === "recurrent" ? pickBillingToInherit(await billingHistoryForEmail(match.email).catch(() => [])) : null;
  const tone =
    match.kind === "recurrent"
      ? "border-amber-400/40 bg-amber-400/10 text-amber-100"
      : "border-slate-500/40 bg-slate-500/10 text-slate-200";
  return (
    <p className={`mt-2 rounded-lg border px-3 py-2 text-sm ${tone}`}>
      <strong>{recurrentLabel(match)}</strong>
      {" · "}
      <Link href={`/zona-traductor/clientes/${encodeURIComponent(match.email)}`} className="underline hover:text-white">
        Ver historial
      </Link>
      {titulares?.kind === "multiple" && (
        <span className="mt-1 block font-semibold text-rose-200">
          Varios titulares de facturación ({titulares.holders}): no se han copiado datos; confirma a quién se factura.
        </span>
      )}
    </p>
  );
}
