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
    <div className="mb-4 rounded-xl border border-violet-500/30 bg-violet-500/10 p-3">
      <p className="text-xs font-semibold text-violet-300">
        {entregas.length} entrega{entregas.length === 1 ? "" : "s"} de lavori recibida{entregas.length === 1 ? "" : "s"}: revísala
        {entregas.length === 1 ? "" : "s"} abajo{paper ? " · pedido en PAPEL (no sale email al cliente)" : ""}
      </p>
      {recogidas.length > 0 && (
        <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2">
          <p className="text-xs font-semibold text-amber-300">Recogida por mensajería</p>
          {recogidas.map((r, i) => (
            <p key={i} className="text-xs text-amber-200/90">{r}</p>
          ))}
        </div>
      )}
    </div>
  );
}
