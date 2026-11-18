import Anthropic from "@anthropic-ai/sdk";
import type {
  BetaContentBlockParam,
  BetaMessage,
  BetaMessageParam,
  BetaMessageStreamParams,
} from "@anthropic-ai/sdk/resources/beta/messages/messages";
import type { PreparedBatch } from "./prepare.ts";
import { READING_SYSTEM_PROMPT, contextText, fileLabel, retryText, type ReadingContext } from "./prompt.ts";
import { READING_OUTPUT_FORMAT, fromWire, isWireReading, type ModelReading } from "./schema.ts";
import type { ModelUsage } from "./cost.ts";

export const READING_MODEL = "claude-opus-5-5";
export const READING_MAX_TOKENS = 32_000;
export const FALLBACK_BETA = "server-side-fallback-2026-07-01";

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";
export type ModelCall = (params: BetaMessageStreamParams) => Promise<BetaMessage>;

export type CallOptions = { model?: string; effort?: Effort; maxTokens?: number; fallback?: boolean };

export type ReadErrorKind = "rate_limit" | "overloaded" | "timeout" | "connection" | "auth" | "bad_request" | "too_large" | "server" | "unknown";
export type ReadError = { kind: ReadErrorKind; httpStatus: number | null; message: string };

export type CallOutcome =
  | { kind: "reading"; reading: ModelReading; wireErrors: string[]; message: BetaMessage }
  | { kind: "unparseable"; detail: string; message: BetaMessage }
  | { kind: "refused"; category: string | null; explanation: string | null; message: BetaMessage }
  | { kind: "truncated"; stopReason: string; message: BetaMessage }
  | { kind: "error"; error: ReadError };

export function defaultModelCall(client: Anthropic = new Anthropic({ maxRetries: 3, timeout: 10 * 60 * 1000 })): ModelCall {
  return (params) => client.beta.messages.stream(params).finalMessage();
}

const b64 = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64");

export function batchContent(batch: PreparedBatch, ctx: ReadingContext): BetaContentBlockParam[] {
  const content: BetaContentBlockParam[] = [];
  for (const f of batch.files) {
    content.push({ type: "text", text: fileLabel(f) });
    if (f.kind === "pdf") content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: b64(f.bytes) } });
    else content.push({ type: "image", source: { type: "base64", media_type: f.mediaType as "image/jpeg" | "image/png", data: b64(f.bytes) } });
  }
  // Second breakpoint after the last file: the retry repeats this turn unchanged and reads the files from cache.
  const last = content[content.length - 1] as { cache_control?: { type: "ephemeral" } };
  last.cache_control = { type: "ephemeral" };
  content.push({ type: "text", text: contextText(batch, ctx) });
  return content;
}

export function buildRequest(messages: BetaMessageParam[], opts: CallOptions = {}): BetaMessageStreamParams {
  const params: BetaMessageStreamParams = {
    model: opts.model ?? READING_MODEL,
    max_tokens: opts.maxTokens ?? READING_MAX_TOKENS,
    system: [{ type: "text", text: READING_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages,
    output_config: { effort: opts.effort ?? "medium", format: READING_OUTPUT_FORMAT },
  };
  if (opts.fallback !== false) {
    params.betas = [FALLBACK_BETA];
    params.fallbacks = "default";
  }
  return params;
}

export function retryMessages(first: BetaMessageParam[], previous: BetaMessage, errors: readonly string[]): BetaMessageParam[] {
  return [
    ...first,
    { role: "assistant", content: previous.content as unknown as BetaContentBlockParam[] },
    { role: "user", content: [{ type: "text", text: retryText(errors) }] },
  ];
}

export function mapError(err: unknown): ReadError {
  const message = err instanceof Error ? err.message : String(err);
  if (err instanceof Anthropic.APIConnectionTimeoutError) return { kind: "timeout", httpStatus: null, message };
  if (err instanceof Anthropic.APIConnectionError) return { kind: "connection", httpStatus: null, message };
  if (err instanceof Anthropic.RateLimitError) return { kind: "rate_limit", httpStatus: 429, message };
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) return { kind: "auth", httpStatus: err.status, message };
  if (err instanceof Anthropic.BadRequestError || err instanceof Anthropic.NotFoundError || err instanceof Anthropic.UnprocessableEntityError) {
    return { kind: "bad_request", httpStatus: err.status, message };
  }
  if (err instanceof Anthropic.APIError) {
    const status = typeof err.status === "number" ? err.status : null;
    if (status === 413) return { kind: "too_large", httpStatus: status, message };
    if (status === 529) return { kind: "overloaded", httpStatus: status, message };
    if (status !== null && status >= 500) return { kind: "server", httpStatus: status, message };
    return { kind: "unknown", httpStatus: status, message };
  }
  return { kind: "unknown", httpStatus: null, message };
}

export function parseMessage(message: BetaMessage): CallOutcome {
  if (message.stop_reason === "refusal") {
    const d = message.stop_details as { category?: string | null; explanation?: string | null } | null;
    return { kind: "refused", category: d?.category ?? null, explanation: d?.explanation ?? null, message };
  }
  if (message.stop_reason === "max_tokens" || message.stop_reason === "model_context_window_exceeded") {
    return { kind: "truncated", stopReason: message.stop_reason, message };
  }
  const text = message.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  if (!text.trim()) return { kind: "unparseable", detail: "La respuesta no traía texto.", message };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { kind: "unparseable", detail: "La respuesta no era JSON válido.", message };
  }
  if (!isWireReading(parsed)) return { kind: "unparseable", detail: "El JSON no tiene la forma del esquema.", message };
  const { reading, errors } = fromWire(parsed);
  return { kind: "reading", reading, wireErrors: errors, message };
}

export async function callReading(call: ModelCall, params: BetaMessageStreamParams): Promise<CallOutcome> {
  let message: BetaMessage;
  try {
    message = await call(params);
  } catch (err) {
    return { kind: "error", error: mapError(err) };
  }
  return parseMessage(message);
}

/** Usage per model that actually ran (a server-side fallback reports its own iteration). */
export function messageUsages(message: BetaMessage, requestedModel: string): ModelUsage[] {
  const u = message.usage;
  const iterations = (u.iterations ?? []) as unknown as Array<Record<string, unknown>>;
  const counted = iterations.filter((it) => it.type === "message" || it.type === "fallback_message");
  if (counted.length > 0) {
    return counted.map((it) => ({
      model: it.type === "fallback_message" ? String(it.model) : requestedModel,
      input: Number(it.input_tokens) || 0,
      output: Number(it.output_tokens) || 0,
      cacheRead: Number(it.cache_read_input_tokens) || 0,
      cacheWrite: Number(it.cache_creation_input_tokens) || 0,
    }));
  }
  return [{
    model: message.model || requestedModel,
    input: u.input_tokens || 0,
    output: u.output_tokens || 0,
    cacheRead: u.cache_read_input_tokens || 0,
    cacheWrite: u.cache_creation_input_tokens || 0,
  }];
}
