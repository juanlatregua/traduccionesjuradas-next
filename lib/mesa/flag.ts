/** Kill-switch: la mesa del gestor (/zona-traductor/hoy, /zona-traductor/caso/[id]) está activa salvo MESA_V2=off (exacto). */
export function mesaV2On(env: Record<string, string | undefined> = process.env): boolean {
  return env.MESA_V2 !== "off";
}
