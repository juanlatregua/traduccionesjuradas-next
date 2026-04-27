import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pedido recibido",
  robots: { index: false, follow: false },
};

export default function PedidoRecibidoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
