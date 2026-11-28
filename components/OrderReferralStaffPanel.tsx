import type { ReferralCode } from "@prisma/client";

const REWARD_LABEL: Record<string, string> = {
  NONE: "sin usar",
  PENDING: "usado, pedido del invitado sin pagar",
  EARNED: "crédito del dueño ganado (sin canjear)",
  REDEEMED: "crédito del dueño canjeado",
  VOID: "crédito anulado",
};

const eur = (c: number | null | undefined) => `${((c || 0) / 100).toFixed(2)} €`;
const day = (d: Date | null | undefined) => (d ? new Date(d).toLocaleDateString("es-ES") : "—");

export default function OrderReferralStaffPanel({
  issued,
  used,
  orderId,
  quoteId,
}: {
  issued: ReferralCode | null;
  used: ReferralCode | null;
  orderId: string;
  quoteId: string | null;
}) {
  if (!issued && !used) return null;
  const usedAsInvitee = !!used && (used.usedOnOrderId === orderId || (!!quoteId && used.usedOnQuoteId === quoteId));
  return (
    <section id="recomendacion" className="scroll-mt-20 rounded-3xl border border-[#D5DAE1] bg-[#fff] p-6 text-sm text-[#1F2933] shadow-sm">
      <h2 className="text-lg font-semibold">Código de recomendación</h2>
      {issued && (
        <p className="mt-2">
          Emitido por este pedido: <strong className="font-mono">{issued.code}</strong> · caduca {day(issued.expiresAt)} ·{" "}
          {issued.usedAt ? `usado el ${day(issued.usedAt)} (descuento ${eur(issued.discountCents)})` : "sin usar"} · {REWARD_LABEL[issued.rewardStatus]}
          {issued.rewardVoidReason ? ` (${issued.rewardVoidReason})` : ""}
        </p>
      )}
      {used && (
        <p className="mt-2">
          {usedAsInvitee
            ? `Este encargo usó el código ${used.code}: −${eur(used.discountCents)} sobre la base · ${REWARD_LABEL[used.rewardStatus]}`
            : `Este encargo canjeó el crédito por recomendar de ${used.code}: −${eur(used.rewardDiscountCents)} sobre la base`}
        </p>
      )}
      {used?.floorClamped && usedAsInvitee && <p className="mt-1 text-xs text-[#8A5A00]">Recortado al suelo del jurado: {used.floorNote}</p>}
    </section>
  );
}
