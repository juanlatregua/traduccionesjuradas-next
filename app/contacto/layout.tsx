import type { Metadata } from "next";
import { SchemaLocalBusiness } from "@/components/SchemaLocalBusiness";
import { SchemaBreadcrumbs } from "@/components/SchemaBreadcrumbs";

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
  return (
    <>
      <SchemaBreadcrumbs
        id="breadcrumbs-contacto"
        items={[
          { name: "Inicio", url: "https://www.traduccionesjuradas.net/" },
          { name: "Contacto", url: "https://www.traduccionesjuradas.net/contacto" },
        ]}
      />
      <SchemaLocalBusiness />
      {children}
    </>
  );
}
