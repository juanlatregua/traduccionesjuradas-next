import { redirect } from "next/navigation";

/**
 * S1 de la auditoría de coherencia (27-ago-2026): la ficha del presupuesto vive
 * ahora en la zona traductor, en la MISMA cáscara que la lista. Esto queda como
 * redirección para no romper enlaces guardados, emails viejos ni marcadores.
 */
export default function AdminQuoteDetailRedirect({ params }: { params: { id: string } }) {
  redirect(`/zona-traductor/presupuestos/${params.id}`);
}
