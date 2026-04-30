import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { SYSTEM_PROMPT } from "@/lib/chat/system-prompt";
import { sanitizeMessage, isPromptInjection } from "@/lib/chat/sanitize";
import { detectLanguage } from "@/lib/chat/detect-language";
import { CHAT_TOOLS, executeToolCall } from "@/lib/chat/tools";

type ImageBlock = {
  type: "image";
  source: {
    type: "base64";
    media_type: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
    data: string;
  };
  fileName?: string;
};

type TextBlock = { type: "text"; text: string };

type ContentBlock = TextBlock | ImageBlock;

type ChatMessage = {
  role: "user" | "assistant";
  content: string | ContentBlock[];
};

const anthropic = new Anthropic();
const MAX_TOOL_ITERATIONS = 5;
const MODEL = "claude-sonnet-4-20250514";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES: ImageBlock["source"]["media_type"][] = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

async function hashIp(ip: string): Promise<string> {
  const data = new TextEncoder().encode(ip);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawMessages: ChatMessage[] = body.messages ?? [];
    const sessionId: string = body.sessionId ?? crypto.randomUUID();

    if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
      return Response.json({ ok: false, error: "Messages required" }, { status: 400 });
    }

    const lastMsg = rawMessages[rawMessages.length - 1];
    if (!lastMsg || lastMsg.role !== "user") {
      return Response.json({ ok: false, error: "Last message must be from user" }, { status: 400 });
    }

    const lastText = extractText(lastMsg.content);
    const lastImages = extractImages(lastMsg.content);

    for (const img of lastImages) {
      if (!ALLOWED_IMAGE_TYPES.includes(img.source.media_type)) {
        return Response.json(
          { ok: false, error: "Tipo de imagen no permitido. Usa JPG, PNG o WEBP." },
          { status: 400 },
        );
      }
      const approxBytes = Math.floor((img.source.data.length * 3) / 4);
      if (approxBytes > MAX_IMAGE_BYTES) {
        return Response.json(
          { ok: false, error: "Imagen demasiado grande (máximo 5 MB)." },
          { status: 400 },
        );
      }
    }

    const sanitized = sanitizeMessage(lastText);
    if (!sanitized && lastImages.length === 0) {
      return Response.json({ ok: false, error: "Empty message" }, { status: 400 });
    }

    if (sanitized && isPromptInjection(sanitized)) {
      const rejectionMsg = "No puedo procesar esa solicitud. ¿En qué puedo ayudarte con traducciones juradas?";
      const enc = new TextEncoder();
      const rejectionStream = new ReadableStream({
        start(controller) {
          controller.enqueue(enc.encode(`data: ${JSON.stringify({ text: rejectionMsg })}\n\n`));
          controller.enqueue(enc.encode("data: [DONE]\n\n"));
          controller.close();
        },
      });
      return new Response(rejectionStream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "X-Session-Id": sessionId,
        },
      });
    }

    const clientIp = getClientIp(req);
    const ipHash = await hashIp(clientIp);

    const sessionLimit = await checkRateLimit({
      key: `chat:session:${sessionId}`,
      limit: 20,
      windowMs: 3_600_000,
    });

    if (!sessionLimit.ok) {
      return Response.json({
        ok: false,
        error: "Has alcanzado el límite de mensajes. Para continuar, escríbenos por WhatsApp al +34 951 333 614.",
        referToWhatsApp: true,
      }, {
        status: 429,
        headers: {
          "X-RateLimit-Remaining": "0",
          "Retry-After": String(sessionLimit.retryAfterSec),
        },
      });
    }

    const ipLimit = await checkRateLimit({
      key: `chat:ip:${ipHash}`,
      limit: 100,
      windowMs: 86_400_000,
    });

    if (!ipLimit.ok) {
      return Response.json({
        ok: false,
        error: "Demasiadas solicitudes. Inténtalo más tarde o escríbenos por WhatsApp.",
        referToWhatsApp: true,
      }, {
        status: 429,
        headers: {
          "X-RateLimit-Remaining": "0",
          "Retry-After": String(ipLimit.retryAfterSec),
        },
      });
    }

    const messages: ChatMessage[] = rawMessages.map((m) => sanitizeChatMessage(m));

    const detectedLanguage = detectLanguage(sanitized);

    const apiMessages: Anthropic.MessageParam[] = messages.map((m) => ({
      role: m.role,
      content: toApiContent(m.content),
    }));

    const messagesForDb: { role: "user" | "assistant"; content: string }[] = messages.map(
      (m) => ({ role: m.role, content: contentToText(m.content) }),
    );

    let fullVisibleResponse = "";
    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
            const stream = anthropic.messages.stream({
              model: MODEL,
              max_tokens: 1024,
              system: [
                {
                  type: "text",
                  text: SYSTEM_PROMPT,
                  cache_control: { type: "ephemeral" },
                },
              ],
              tools: CHAT_TOOLS,
              messages: apiMessages,
            });

            for await (const event of stream) {
              if (
                event.type === "content_block_delta" &&
                event.delta.type === "text_delta"
              ) {
                const text = event.delta.text;
                fullVisibleResponse += text;
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ text })}\n\n`),
                );
              }
            }

            const final = await stream.finalMessage();
            apiMessages.push({ role: "assistant", content: final.content });

            if (final.stop_reason !== "tool_use") break;

            const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
            for (const block of final.content) {
              if (block.type !== "tool_use") continue;
              try {
                const result = await executeToolCall(block.name, block.input);
                toolResults.push({
                  type: "tool_result",
                  tool_use_id: block.id,
                  content: JSON.stringify(result),
                });
              } catch (err) {
                console.error(`[chat] Tool ${block.name} error:`, err);
                toolResults.push({
                  type: "tool_result",
                  tool_use_id: block.id,
                  content: JSON.stringify({
                    error: err instanceof Error ? err.message : "Tool execution failed",
                  }),
                  is_error: true,
                });
              }
            }

            if (toolResults.length === 0) break;
            apiMessages.push({ role: "user", content: toolResults });
          }

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();

          const detectedIntent = detectIntent(sanitized);
          const savedMessages = [
            ...messagesForDb,
            { role: "assistant" as const, content: fullVisibleResponse },
          ];

          await prisma.chatSession
            .upsert({
              where: { sessionId },
              create: {
                sessionId,
                messages: savedMessages,
                detectedLanguage,
                detectedIntent,
                ipHash,
                messageCount: savedMessages.length,
              },
              update: {
                messages: savedMessages,
                detectedLanguage,
                detectedIntent,
                messageCount: savedMessages.length,
                updatedAt: new Date(),
              },
            })
            .catch((err: unknown) => {
              console.error("[chat] DB save error:", err);
            });
        } catch (err) {
          console.error("[chat] Stream error:", err);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: "Error generando respuesta" })}\n\n`),
          );
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-RateLimit-Remaining": String(sessionLimit.remaining),
        "X-Session-Id": sessionId,
      },
    });
  } catch (err) {
    console.error("[chat] Route error:", err);
    return Response.json(
      { ok: false, error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}

function extractText(content: ChatMessage["content"]): string {
  if (typeof content === "string") return content;
  return content
    .filter((b): b is TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

function extractImages(content: ChatMessage["content"]): ImageBlock[] {
  if (typeof content === "string") return [];
  return content.filter((b): b is ImageBlock => b.type === "image");
}

function sanitizeChatMessage(m: ChatMessage): ChatMessage {
  if (typeof m.content === "string") {
    return { role: m.role, content: sanitizeMessage(m.content) };
  }
  const blocks: ContentBlock[] = m.content
    .map((b): ContentBlock | null => {
      if (b.type === "text") return { type: "text", text: sanitizeMessage(b.text) };
      if (b.type === "image") {
        if (!ALLOWED_IMAGE_TYPES.includes(b.source.media_type)) return null;
        return {
          type: "image",
          source: {
            type: "base64",
            media_type: b.source.media_type,
            data: b.source.data,
          },
          fileName: b.fileName,
        };
      }
      return null;
    })
    .filter((b): b is ContentBlock => b !== null);
  return { role: m.role, content: blocks };
}

function toApiContent(
  content: ChatMessage["content"],
): string | Anthropic.Messages.ContentBlockParam[] {
  if (typeof content === "string") return content;
  return content.map((b) => {
    if (b.type === "image") {
      return {
        type: "image" as const,
        source: {
          type: "base64" as const,
          media_type: b.source.media_type,
          data: b.source.data,
        },
      };
    }
    return { type: "text" as const, text: b.text };
  });
}

function contentToText(content: ChatMessage["content"]): string {
  if (typeof content === "string") return content;
  return content
    .map((b) => {
      if (b.type === "text") return b.text;
      const name = b.fileName ?? "imagen adjunta";
      return `[imagen: ${name}]`;
    })
    .join(" ")
    .trim();
}

function detectIntent(text: string): string {
  const lower = text.toLowerCase();
  if (/presupuesto|precio|cost|cuánto|combien|how\s*much|tarifa/i.test(lower)) {
    return "presupuesto";
  }
  if (/queja|complaint|problema|issue|mal|error/i.test(lower)) {
    return "queja";
  }
  return "info";
}
