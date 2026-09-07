// lib/ai/usage-log.ts — Una línea por llamada a la IA con el uso real de tokens.
// Sin esto no hay forma de saber si el prompt caching funciona (cache_read=0 en
// todas las llamadas = el prompt está por debajo del mínimo cacheable del modelo).

import type Anthropic from "@anthropic-ai/sdk";

export function logAiUsage(
  tag: string,
  model: string,
  usage: Anthropic.Messages.Usage | null | undefined,
) {
  if (!usage) return;
  const u = usage as Anthropic.Messages.Usage & {
    cache_creation_input_tokens?: number | null;
    cache_read_input_tokens?: number | null;
  };
  console.log(
    `[ai:${tag}] ${model} in=${u.input_tokens} out=${u.output_tokens} cache_create=${u.cache_creation_input_tokens ?? 0} cache_read=${u.cache_read_input_tokens ?? 0}`,
  );
}
