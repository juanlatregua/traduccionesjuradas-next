// Envuelve toda la zona-traductor en #zona-traductor-root para que el tema (azul
// oscuro por defecto + toggle claro opcional) aplique a todas sus páginas.
export default function ZonaTraductorLayout({ children }: { children: React.ReactNode }) {
  return <div id="zona-traductor-root">{children}</div>;
}
