import { redirect } from "next/navigation";

// El "nuevo presupuesto" se unificó en /zona-traductor/presupuesto (un único
// builder manual, mismo tema). Esta ruta redirige preservando el prefill de los
// deep-links (PMQuickCreatePanel, bandeja, pm-create, lista de admin).
export default function AdminQuoteNewPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams || {})) {
    const v = Array.isArray(value) ? value[0] : value;
    if (typeof v === "string" && v) qs.set(key, v);
  }
  const query = qs.toString();
  redirect(`/zona-traductor/presupuesto${query ? `?${query}` : ""}`);
}
