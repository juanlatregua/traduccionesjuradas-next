import { redirect } from "next/navigation";

/** S1: la lista de presupuestos es la de la zona traductor. */
export default function AdminQuotesRedirect() {
  redirect("/zona-traductor/presupuestos");
}
