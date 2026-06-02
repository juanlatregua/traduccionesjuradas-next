// Envuelve toda la zona-traductor en #zona-traductor-root para que el tema (oscuro
// cómodo por defecto + toggle claro) aplique a todas sus páginas, no solo a algunas.
export default function ZonaTraductorLayout({ children }: { children: React.ReactNode }) {
  return <div id="zona-traductor-root">{children}</div>;
}
