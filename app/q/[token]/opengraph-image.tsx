import { prisma } from "@/lib/prisma";
import { brandOgImage, OG_SIZE } from "@/lib/og-brand";
import { quoteShare, quoteShareText } from "@/lib/q-share";

export const runtime = "nodejs";
export const alt = "Traducciones Juradas";
export const size = OG_SIZE;
export const contentType = "image/png";

// Sin nombre del cliente ni documentos: la imagen la ve cualquiera con el enlace.
export default async function Image({ params }: { params: { token: string } }) {
  const row = await prisma.quote
    .findUnique({
      where: { publicToken: params.token },
      select: { quoteNumber: true, status: true, pdfLang: true, tokenExpiresAt: true, total: true, balanceAmount: true, vatRate: true },
    })
    .catch(() => null);
  const share = quoteShare(
    row ? { ...row, total: Number(row.total), balanceAmount: row.balanceAmount == null ? null : Number(row.balanceAmount), vatRate: Number(row.vatRate) } : null
  );
  const text = quoteShareText(share);
  return brandOgImage({ tag: text.tag, amount: share?.amount, amountNote: text.amountNote, line: text.line });
}
