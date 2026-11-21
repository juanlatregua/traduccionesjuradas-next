/** MESA_V2=on (exacto) abre la mesa del gestor (/zona-traductor/hoy, /zona-traductor/caso/[id]) y su menú; cualquier otro valor deja la zona como estaba. */
export function mesaV2On(env: Record<string, string | undefined> = process.env): boolean {
  return env.MESA_V2 === "on";
}
