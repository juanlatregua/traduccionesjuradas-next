import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Presupuesto de traducción jurada | Envíanos tus documentos",
  description:
    "Solicita un presupuesto de traducción jurada sin compromiso. Adjunta tus documentos y te respondemos con precio cerrado y plazo estimado.",
  alternates: { canonical: "https://www.traduccionesjuradas.net/presupuesto" },
};

export default function PresupuestoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
