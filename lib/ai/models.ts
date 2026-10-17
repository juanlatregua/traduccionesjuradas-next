// lib/ai/models.ts — Ids de modelo Claude: el único sitio donde se cambian.
// lavori (scripts/vigia-modelos.mts) lee este fichero y avisa si uno se queda atrás.
//
// Sonnet 5.5 y Haiku 5.5 razonan por defecto y ese razonamiento gasta max_tokens:
// cada llamada fija output_config.effort y deja margen en max_tokens. No usar
// temperature/top_p/top_k, budget_tokens, prefill ni tool_choice forzado (400).

import type Anthropic from "@anthropic-ai/sdk";

export const SONNET_MODEL = "claude-sonnet-5-5";
export const HAIKU_MODEL = "claude-haiku-5-5";
export const OPUS_MODEL = "claude-opus-5-5";

// Los modelos nuevos pueden declinar (HTTP 200, stop_reason "refusal", contenido
// vacío o parcial): se comprueba antes de leer content.
export function assertNotRefused(resp: Pick<Anthropic.Message, "stop_reason" | "stop_details">, where: string): void {
  if (resp.stop_reason !== "refusal") return;
  console.error(`[${where}] El modelo declinó la petición:`, JSON.stringify(resp.stop_details ?? null));
  throw new Error("El modelo declinó procesar esta petición.");
}
