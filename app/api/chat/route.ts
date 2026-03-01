import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { SYSTEM_PROMPT } from "@/lib/chat/system-prompt";
import { sanitizeMessage, isPromptInjection } from "@/lib/chat/sanitize";
import { detectLanguage } from "@/lib/chat/detect-language";

type ChatMessage = { role: "user" | "assistant"; content: string };

const anthropic = new Anthropic();

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

    // Validate messages
    if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
      return Response.json({ error: "Messages required" }, { status: 400 });
    }

    // Sanitize & check last user message
    const lastMsg = rawMessages[rawMessages.length - 1];
    if (!lastMsg || lastMsg.role !== "user") {
      return Response.json({ error: "Last message must be from user" }, { status: 400 });
    }

    const sanitized = sanitizeMessage(lastMsg.content);
    if (!sanitized) {
      return Response.json({ error: "Empty message" }, { status: 400 });
    }

    if (isPromptInjection(sanitized)) {
      return Response.json({
        error: "No puedo procesar esa solicitud. ¿En qué puedo ayudarte con traducciones juradas?",
      }, { status: 400 });
    }

    // Rate limits
    const clientIp = getClientIp(req);
    const ipHash = await hashIp(clientIp);

    const sessionLimit = await checkRateLimit({
      key: `chat:session:${sessionId}`,
      limit: 20,
      windowMs: 3_600_000, // 1 hour
    });

    if (!sessionLimit.ok) {
      return Response.json({
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
      windowMs: 86_400_000, // 24 hours
    });

    if (!ipLimit.ok) {
      return Response.json({
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

    // Build sanitized messages for API
    const messages: ChatMessage[] = rawMessages.map((m) => ({
      role: m.role,
      content: sanitizeMessage(m.content),
    }));

    // Detect language from the last user message
    const detectedLanguage = detectLanguage(sanitized);

    // Stream from Anthropic
    const stream = anthropic.messages.stream({
      model: "claude-sonnet-4-20250514",
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages,
    });

    let fullResponse = "";
    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              const text = event.delta.text;
              fullResponse += text;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
            }
          }

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();

          // Save to DB after streaming completes
          const allMessages = [
            ...messages,
            { role: "assistant" as const, content: fullResponse },
          ];

          // Detect intent from the full conversation
          const detectedIntent = detectIntent(sanitized);

          await prisma.chatSession.upsert({
            where: { sessionId },
            create: {
              sessionId,
              messages: allMessages,
              detectedLanguage,
              detectedIntent,
              ipHash,
              messageCount: allMessages.length,
            },
            update: {
              messages: allMessages,
              detectedLanguage,
              detectedIntent,
              messageCount: allMessages.length,
              updatedAt: new Date(),
            },
          }).catch((err: unknown) => {
            console.error("[chat] DB save error:", err);
          });
        } catch (err) {
          console.error("[chat] Stream error:", err);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: "Error generando respuesta" })}\n\n`)
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
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
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
