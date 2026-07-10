import { redirect } from "next/navigation";

// El cockpit de proyecto se consolidó en el detalle canónico del pedido.
export default function ProyectoCockpitPage({ params }: { params: { reference: string } }) {
  redirect(`/zona-traductor/pedido/${params.reference}`);
}
