import ZonaTraductorSubNav from "@/components/ZonaTraductorSubNav";

// Las tres pantallas fiscales son la MISMA etapa del ciclo: dejan de competir
// por sitio en el menú principal y se agrupan aquí. Ninguna se toca por dentro.
export default function ContabilidadSubNav() {
  return (
    <ZonaTraductorSubNav
      tabs={[
        { href: "/zona-traductor/contabilidad", label: "Resumen fiscal" },
        { href: "/zona-traductor/recurrentes", label: "Recurrentes" },
        { href: "/zona-traductor/periodos", label: "Periodos y cierre" },
      ]}
    />
  );
}
