// lib/verifactu/aeat-response.ts — Respuesta de la AEAT a RegFactuSistemaFacturacion.
//
// PURO. Estructura según RespuestaSuministro.xsd: CSV, DatosPresentacion, Cabecera,
// TiempoEsperaEnvio, EstadoEnvio (Correcto|ParcialmenteCorrecto|Incorrecto) y N
// RespuestaLinea con EstadoRegistro (Correcto|AceptadoConErrores|Incorrecto),
// CodigoErrorRegistro, DescripcionErrorRegistro y, si el rechazo es por duplicado,
// RegistroDuplicado. Se lee por nombre local de etiqueta (el prefijo de namespace varía).

import type { ProviderSendResult } from "./provider.ts";

export type AeatLine = {
  numSerie: string | null;
  emitterNif: string | null;
  issueDate: string | null;
  operacion: string | null; // Alta | Anulacion
  refExterna: string | null;
  estadoRegistro: "Correcto" | "AceptadoConErrores" | "Incorrecto" | string;
  codigoError: string | null;
  descripcionError: string | null;
  duplicado: { estado: string | null; codigo: string | null; descripcion: string | null; idPeticion: string | null } | null;
};

export type AeatResponse = {
  fault: string | null; // SOAP Fault
  csv: string | null;
  estadoEnvio: string | null;
  tiempoEsperaEnvio: number | null;
  lines: AeatLine[];
};

function unescapeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function tagRe(name: string) {
  return new RegExp(`<(?:[\\w.-]+:)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w.-]+:)?${name}>`);
}

/** Texto del primer elemento con ese nombre local, o null. */
export function firstTag(xml: string, name: string): string | null {
  const m = tagRe(name).exec(xml);
  return m ? unescapeXml(m[1].trim()) : null;
}

function allBlocks(xml: string, name: string): string[] {
  const re = new RegExp(tagRe(name).source, "g");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) out.push(m[1]);
  return out;
}

export function parseAeatResponse(xml: string): AeatResponse {
  const fault = firstTag(xml, "faultstring");
  const wait = firstTag(xml, "TiempoEsperaEnvio");
  const lines: AeatLine[] = allBlocks(xml, "RespuestaLinea").map((b) => {
    const dupBlock = allBlocks(b, "RegistroDuplicado")[0];
    // Los códigos de error del registro duplicado van dentro de su bloque: se quitan antes de leer los del registro.
    const own = dupBlock ? b.replace(dupBlock, "") : b;
    const idBlock = allBlocks(own, "IDFactura")[0] ?? "";
    return {
      numSerie: firstTag(idBlock, "NumSerieFactura"),
      emitterNif: firstTag(idBlock, "IDEmisorFactura"),
      issueDate: firstTag(idBlock, "FechaExpedicionFactura"),
      operacion: firstTag(own, "TipoOperacion"),
      refExterna: firstTag(own, "RefExterna"),
      estadoRegistro: firstTag(own, "EstadoRegistro") ?? "",
      codigoError: firstTag(own, "CodigoErrorRegistro"),
      descripcionError: firstTag(own, "DescripcionErrorRegistro"),
      duplicado: dupBlock
        ? {
            estado: firstTag(dupBlock, "EstadoRegistroDuplicado"),
            codigo: firstTag(dupBlock, "CodigoErrorRegistro"),
            descripcion: firstTag(dupBlock, "DescripcionErrorRegistro"),
            idPeticion: firstTag(dupBlock, "IdPeticionRegistroDuplicado"),
          }
        : null,
    };
  });
  return {
    fault,
    csv: firstTag(xml, "CSV"),
    estadoEnvio: firstTag(xml, "EstadoEnvio"),
    tiempoEsperaEnvio: wait !== null && /^\d+$/.test(wait) ? Number(wait) : null,
    lines,
  };
}

/**
 * Estado de un registro. Un rechazo por duplicado cuyo registro ya almacenado está
 * «Correcta» o «AceptadaConErrores» se trata como aceptado (idempotencia: la AEAT ya
 * lo tiene); si está «Anulada» sigue siendo un rechazo.
 */
export function lineToResult(line: AeatLine, csv: string | null): ProviderSendResult {
  const detail = [line.codigoError, line.descripcionError].filter(Boolean).join(": ") || null;
  const response = { csv, estadoRegistro: line.estadoRegistro, codigoError: line.codigoError, descripcionError: line.descripcionError, duplicado: line.duplicado };
  if (line.estadoRegistro === "Correcto") return { status: "ACCEPTED", providerRef: csv, response, error: null };
  if (line.estadoRegistro === "AceptadoConErrores") return { status: "ACCEPTED_WITH_ERRORS", providerRef: csv, response, error: detail };
  if (line.duplicado && (line.duplicado.estado === "Correcta" || line.duplicado.estado === "AceptadaConErrores")) {
    return {
      status: line.duplicado.estado === "Correcta" ? "ACCEPTED" : "ACCEPTED_WITH_ERRORS",
      providerRef: line.duplicado.idPeticion ?? csv,
      response,
      error: `Ya registrado en la AEAT (duplicado, estado ${line.duplicado.estado}).`,
    };
  }
  return { status: "REJECTED", providerRef: null, response, error: detail || `EstadoRegistro «${line.estadoRegistro || "?"}»` };
}

/** Une cada entrada con su línea de respuesta: primero por RefExterna, si no por número + operación. */
export function matchLines(
  inputs: { recordId?: string; numSerie: string; kind: "ALTA" | "ANULACION" }[],
  lines: AeatLine[]
): (AeatLine | null)[] {
  const used = new Set<number>();
  return inputs.map((inp) => {
    let idx = inp.recordId ? lines.findIndex((l, i) => !used.has(i) && l.refExterna === inp.recordId) : -1;
    if (idx < 0) {
      const op = inp.kind === "ALTA" ? "Alta" : "Anulacion";
      idx = lines.findIndex((l, i) => !used.has(i) && l.numSerie === inp.numSerie && (!l.operacion || l.operacion === op));
    }
    if (idx < 0) return null;
    used.add(idx);
    return lines[idx];
  });
}
