import { NextResponse } from "next/server";
import { getOrderDetail, updateDeliveryState } from "@/lib/orders";
import { sendTranslationEtaEmail, sendTranslationReadyEmail, buildTranslationReadyEmail } from "@/lib/email";
import { sendEmailWithRetry } from "@/lib/email-retry";
import { fetchFileAsAttachment, buildIssuedInvoiceAttachment } from "@/lib/delivery-attachments";
import { buildSignedOrderUrl } from "@/lib/order-token";
import {
  addBusinessDays,
  formatEta,
  getHolidaySetFromEnv,
  getMadridBusinessBaseDate,
  suggestEtaBusinessDays,
} from "@/lib/eta";
import { transitionWorkflowState } from "@/lib/workflow-server";
import { requireStaffAccess } from "@/lib/staff-auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type Params = { params: { reference: string } };

type DeliveryFile = { url: string; fileKey?: string | null; filename?: string | null; mimeType?: string | null };

type DeliveryBody = {
  state?: "EN_PROCESO" | "TRADUCIDO";
  translatedFileUrl?: string;
  translatedFileKey?: string;
  translatedFilename?: string;
  translatedMimeType?: string;
  // Entrega MULTI-archivo: el panel sube N traducciones. El primero queda como
  // translatedFileUrl (compat); todos se adjuntan al email y se guardan en lista.
  files?: DeliveryFile[];
  notifyClient?: boolean;
  etaDate?: string;
  autoEta?: boolean;
};

export async function POST(req: Request, { params }: Params) {
  const staff = await requireStaffAccess(req);
  if (!staff.ok) {
    return NextResponse.json({ ok: false, error: staff.error }, { status: 403 });
  }
  const actorEmail = staff.email;

  try {
    const order = await getOrderDetail(params.reference);
    if (!order) {
      return NextResponse.json({ ok: false, error: "Pedido no encontrado." }, { status: 404 });
    }

    const body = (await req.json()) as DeliveryBody;
    const state = body.state || "EN_PROCESO";
    const translatedFileUrl = (body.translatedFileUrl || "").trim();
    const translatedFileKey = (body.translatedFileKey || "").trim();
    const translatedFilename = (body.translatedFilename || "").trim();
    const translatedMimeType = (body.translatedMimeType || "").trim();
    const etaDateRaw = (body.etaDate || "").trim();

    // Lista de entrega: usa body.files si llega; si no, retrocompat con el campo
    // único. El primero es el "primario" (translatedFileUrl) para páginas/SMS/email.
    const extraFiles = Array.isArray(body.files)
      ? body.files.filter((f) => f && typeof f.url === "string" && f.url.trim())
      : [];
    const deliveryFiles =
      extraFiles.length > 0
        ? extraFiles.map((f) => ({
            url: f.url.trim(),
            fileKey: (f.fileKey || "").toString().trim() || null,
            filename: (f.filename || "").toString().trim() || null,
            mimeType: (f.mimeType || "").toString().trim() || null,
          }))
        : translatedFileUrl
          ? [{ url: translatedFileUrl, fileKey: translatedFileKey || null, filename: translatedFilename || null, mimeType: translatedMimeType || null }]
          : [];
    const primaryFileUrl = deliveryFiles[0]?.url || translatedFileUrl;

    if (order.paymentStatus !== "PAID") {
      return NextResponse.json(
        { ok: false, error: "No se puede avanzar la entrega en pedidos pendientes de pago." },
        { status: 400 }
      );
    }

    if (state === "TRADUCIDO" && !primaryFileUrl) {
      return NextResponse.json(
        { ok: false, error: "Para marcar como traducido debes adjuntar al menos un archivo." },
        { status: 400 }
      );
    }

    let etaDate: Date | null | undefined;
    let etaMessage = "";

    if (state === "EN_PROCESO") {
      if (body.autoEta === false && !etaDateRaw) {
        return NextResponse.json(
          { ok: false, error: "Debes indicar una ETA manual o activar el calculo automatico." },
          { status: 400 }
        );
      }

      if (etaDateRaw) {
        const parts = etaDateRaw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!parts) {
          return NextResponse.json({ ok: false, error: "Fecha ETA no valida." }, { status: 400 });
        }
        const year = Number(parts[1]);
        const month = Number(parts[2]);
        const day = Number(parts[3]);
        const parsed = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
        if (
          parsed.getUTCFullYear() !== year ||
          parsed.getUTCMonth() !== month - 1 ||
          parsed.getUTCDate() !== day
        ) {
          return NextResponse.json({ ok: false, error: "Fecha ETA no valida." }, { status: 400 });
        }
        etaDate = parsed;
      } else if (body.autoEta !== false) {
        const businessDays = suggestEtaBusinessDays({
          words: order.words,
          pagesLabel: order.pagesLabel,
          langPair: order.langPair,
        });
        etaDate = addBusinessDays(getMadridBusinessBaseDate(), businessDays, getHolidaySetFromEnv());
      }

      if (etaDate) {
        etaMessage = ` ETA: ${formatEta(etaDate)}.`;
      }
    }

    const nextWorkflowState = state === "TRADUCIDO" ? "TRADUCIDO_ENTREGADO" : "EN_TRADUCCION";
    try {
      await transitionWorkflowState({
        reference: order.reference,
        to: nextWorkflowState,
        actorEmail,
        reason: state === "TRADUCIDO" ? "Entrega final completada." : "Inicio de traduccion.",
        // delivered:true deja que el notificador central dispare el hito "lista"
        // aunque el fichero se persista justo despues de esta transicion.
        payload: state === "TRADUCIDO" ? { delivered: true } : undefined,
      });
    } catch (transitionErr: any) {
      return NextResponse.json(
        {
          ok: false,
          error:
            transitionErr?.message ||
            "No se pudo actualizar el workflow para la entrega.",
        },
        { status: 400 }
      );
    }

    // Persistencia ACUMULATIVA: une las traducciones ya entregadas
    // (order.deliveryFilesJson) con las nuevas, deduplicando por url. Entregar más
    // archivos en una segunda tanda NO borra los anteriores del pedido.
    const existingDelivered: DeliveryFile[] = Array.isArray(order.deliveryFilesJson)
      ? (order.deliveryFilesJson as unknown as DeliveryFile[]).filter(
          (f) => f && typeof f.url === "string" && f.url.trim()
        )
      : [];
    const mergedDeliveryFiles: DeliveryFile[] =
      deliveryFiles.length > 0
        ? (() => {
            const seen = new Set(existingDelivered.map((f) => f.url));
            const out = [...existingDelivered];
            for (const f of deliveryFiles) {
              if (!seen.has(f.url)) {
                seen.add(f.url);
                out.push(f);
              }
            }
            return out;
          })()
        : [];

    await updateDeliveryState(order.reference, state, {
      translatedFileUrl: primaryFileUrl || undefined,
      translatedFileKey: deliveryFiles[0]?.fileKey || translatedFileKey || undefined,
      translatedFilename: deliveryFiles[0]?.filename || translatedFilename || undefined,
      translatedMimeType: deliveryFiles[0]?.mimeType || translatedMimeType || undefined,
      deliveryFiles: mergedDeliveryFiles.length > 0 ? mergedDeliveryFiles : undefined,
      dueDate: state === "EN_PROCESO" ? etaDate : undefined,
      eventMessage:
        `Estado de entrega actualizado a ${state}.${mergedDeliveryFiles.length > 1 ? ` ${mergedDeliveryFiles.length} archivos.` : ""}${etaMessage}`.trim(),
    });

    const statusUrl = buildSignedOrderUrl(order.reference, "estado");
    const deliveryLang = order.clientLocale === "fr" ? "fr" : "es";

    if (state === "EN_PROCESO" && etaDate) {
      sendTranslationEtaEmail({
        toEmail: order.clientEmail,
        reference: order.reference,
        etaDateLabel: formatEta(etaDate),
        statusUrl,
        lang: deliveryLang,
      }).catch((e) => console.error("[orders-delivery] eta email failed", e));
    }

    if (body.notifyClient && state === "TRADUCIDO" && primaryFileUrl) {
      // 1) Registrar QUE se envia al cliente, SINCRONO y antes de responder: el
      //    contenido exacto (asunto + cuerpo) queda en OrderEvent aunque el envio
      //    de fondo no llegue a completarse en serverless. Es lo que Juan necesita
      //    poder ver ("¿que mensaje recibio el cliente?").
      const composed = buildTranslationReadyEmail({
        reference: order.reference,
        downloadUrl: primaryFileUrl,
        statusUrl,
        lang: deliveryLang,
        translationAttached: deliveryFiles.length > 0,
        invoiceAttached: false, // el adjunto de factura se resuelve al enviar; el log refleja la traduccion
      });
      await prisma.orderEvent
        .create({
          data: {
            orderId: order.id,
            type: "notification.delivery_ready.sent",
            message: "Cliente notificado de traduccion lista con enlace de descarga.",
            payload: {
              actorEmail,
              channel: "EMAIL",
              toEmail: order.clientEmail,
              subject: composed.subject,
              bodyHtml: composed.html,
              downloadUrl: primaryFileUrl,
              fileCount: deliveryFiles.length,
            },
          },
        })
        .catch((err) => console.error("[orders-delivery] delivery notification event failed", err));

      // 2) Envio real con adjuntos (TODAS las traducciones + factura si emitida) en
      //    background para no bloquear la respuesta de la entrega.
      void (async () => {
        const multi = deliveryFiles.length > 1;
        const [fileAttachments, invAttach] = await Promise.all([
          Promise.all(
            deliveryFiles.map((f, i) =>
              fetchFileAsAttachment(
                f.url,
                f.filename || `Traduccion-jurada-${order.reference}${multi ? `-${i + 1}` : ""}.pdf`
              )
            )
          ),
          buildIssuedInvoiceAttachment(order.reference),
        ]);
        const transAttachments = fileAttachments.filter(Boolean) as NonNullable<(typeof fileAttachments)[number]>[];
        const attachments = [...transAttachments, ...(invAttach ? [invAttach] : [])];
        await sendEmailWithRetry(() =>
          sendTranslationReadyEmail({
            toEmail: order.clientEmail,
            reference: order.reference,
            downloadUrl: primaryFileUrl!,
            lang: deliveryLang,
            statusUrl,
            attachments,
            translationAttached: transAttachments.length > 0,
            invoiceAttached: !!invAttach,
          })
        );
      })().catch((e) => console.error("[orders-delivery] ready email failed", e));
      // El SMS "traduccion lista" lo dispara transitionWorkflowState al cruzar a
      // TRADUCIDO_ENTREGADO (payload.delivered) — centralizado para cubrir tambien
      // el Kanban y no depender de este checkbox manual.
    }

    return NextResponse.json({
      ok: true,
      etaDate: etaDate ? etaDate.toISOString().slice(0, 10) : null,
    });
  } catch (err: any) {
    console.error("[orders-delivery] error", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Error al actualizar la entrega." },
      { status: 500 }
    );
  }
}
