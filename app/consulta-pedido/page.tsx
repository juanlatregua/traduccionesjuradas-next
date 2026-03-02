import type { Metadata } from "next";
import ConsultaPedidoClient from "./ConsultaPedidoClient";

export const metadata: Metadata = {
  title: "Consulta tu pedido",
  description:
    "Introduce tu email y referencia de pedido para ver el estado de tu traducción jurada.",
};

export default function ConsultaPedidoPage() {
  return (
    <section className="mx-auto max-w-lg px-4 py-12">
      <div className="text-center mb-8">
        <h1 className="font-baskerville text-3xl font-bold text-bleu">
          Consulta tu pedido
        </h1>
        <p className="mt-2 text-graphite">
          Introduce tu email y el número de referencia que recibiste por email
          para ver el estado de tu traducción jurada.
        </p>
      </div>
      <ConsultaPedidoClient />
    </section>
  );
}
