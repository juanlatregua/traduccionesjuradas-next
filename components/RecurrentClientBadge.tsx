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
      ? "border-[#E9D8A6] bg-[#FFF8E6] text-[#7A5A10]"
      : "border-[#D5DAE1] bg-[#F6F7F9] text-[#1F2933]";
  return (
    <p className={`mt-2 rounded-lg border px-3 py-2 text-sm ${tone}`}>
      <strong>{recurrentLabel(match)}</strong>
      {" · "}
      <Link href={`/zona-traductor/clientes/${encodeURIComponent(match.email)}`} className="underline hover:text-[#1A2E4A]">
        Ver historial
      </Link>
      {titulares?.kind === "multiple" && (
        <span className="mt-1 block font-semibold text-[#A12B2B]">
          Varios titulares de facturación ({titulares.holders}): no se han copiado datos; confirma a quién se factura.
        </span>
      )}
      {titulares?.kind === "company" && (
        <span className="mt-1 block font-semibold text-[#A12B2B]">
          Posible titular: {titulares.name}. No se han copiado datos de facturación; confirma a quién se factura.
        </span>
      )}
    </p>
  );
}
