// Aviso de entregas llegadas por el puente lavori. La traducción NUNCA sale sola ni
// desde aquí: las entregas pendientes entran en el panel «Entregar al cliente» como
// archivos del traductor «Sin revisar». Este bloque solo avisa y recuerda la recogida
// del original cuando el pedido va en papel.

export type LavoriEntrega = {
  url: string;
  nombre: string;
  miembro: string;
  fecha: string; // ISO
  mimeType: string | null;
  recogida: string | null; // dirección + día/horario para la mensajería (papel)
  enviada: boolean;
};

export default function LavoriEntregasPanel({ entregas, paper }: { entregas: LavoriEntrega[]; paper: boolean }) {
  const recogidas = entregas.map((e) => e.recogida).filter(Boolean) as string[];
  return (
    <div className="mb-4 rounded-xl border border-[#D5DAE1] bg-[#F6F7F9] p-3">
      <p className="text-xs font-semibold text-[#1A2E4A]">
        {entregas.length} entrega{entregas.length === 1 ? "" : "s"} de lavori recibida{entregas.length === 1 ? "" : "s"}: revísala
        {entregas.length === 1 ? "" : "s"} abajo{paper ? " · pedido en PAPEL (no sale email al cliente)" : ""}
      </p>
      {recogidas.length > 0 && (
        <div className="mt-2 rounded-lg border border-[#E9D8A6] bg-[#FFF8E6] p-2">
          <p className="text-xs font-semibold text-[#7A5A10]">Recogida por mensajería</p>
          {recogidas.map((r, i) => (
            <p key={i} className="text-xs text-[#7A5A10]">{r}</p>
          ))}
        </div>
      )}
    </div>
  );
}
