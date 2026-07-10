import { redirect } from "next/navigation";

// El detalle admin se consolidó en el detalle canónico del pedido
// (facturación fiscal, envío postal y timeline completo ya viven allí).
export default function AdminOrderDetailPage({ params }: { params: { reference: string } }) {
  redirect(`/zona-traductor/pedido/${params.reference}`);
}
