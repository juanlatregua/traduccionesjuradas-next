// Una entrada cuyo email nunca se verificó no es de nadie: a los ENTRADA_ANON_DIAS se borran sus archivos (blob y
// fila) y la entrada. Nunca toca una entrada verificada ni ninguna con caso o lectura.
export const ENTRADA_ANON_DIAS = 3;

export type CaducarDeps = {
  expiradas(before: Date, limit: number): Promise<{ id: string; files: { id: string; url: string }[] }[]>;
  deleteBlob(url: string): Promise<void>;
  /** Deletes the file rows and the entrada only if it is still unverified, without caso and without lote. */
  borrar(entradaId: string, fileIds: string[]): Promise<boolean>;
};

export async function caducarEntradas(deps: CaducarDeps, now: Date, limit = 200): Promise<{ entradas: number; archivos: number }> {
  const before = new Date(now.getTime() - ENTRADA_ANON_DIAS * 864e5);
  let entradas = 0;
  let archivos = 0;
  for (const e of await deps.expiradas(before, limit)) {
    if (!(await deps.borrar(e.id, e.files.map((f) => f.id)))) continue;
    for (const f of e.files) await deps.deleteBlob(f.url).catch(() => {});
    entradas += 1;
    archivos += e.files.length;
  }
  return { entradas, archivos };
}
