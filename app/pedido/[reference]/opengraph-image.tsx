import { brandOgImage, OG_SIZE } from "@/lib/og-brand";

export const runtime = "nodejs";
export const alt = "Traducciones Juradas";
export const size = OG_SIZE;
export const contentType = "image/png";

// Genérica: el enlace del pedido no enseña nada del pedido en la vista previa.
export default function Image() {
  return brandOgImage({ line: "Estado de tu pedido" });
}
