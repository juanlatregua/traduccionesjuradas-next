import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contacto | Traducciones Juradas",
  description:
    "Contacta con nosotros por email o WhatsApp para solicitar un presupuesto de traducción jurada o resolver tus dudas.",
  alternates: { canonical: "https://www.traduccionesjuradas.net/contacto" },
};

export default function ContactoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
