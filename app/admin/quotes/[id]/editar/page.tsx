import { redirect } from "next/navigation";

/** S1: editar vive en la zona traductor. Redirección para enlaces viejos. */
export default function AdminQuoteEditRedirect({ params }: { params: { id: string } }) {
  redirect(`/zona-traductor/presupuestos/${params.id}/editar`);
}
