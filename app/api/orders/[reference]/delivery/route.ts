import { NextResponse } from "next/server";
import { getOrderDetail, updateDeliveryState } from "@/lib/orders";
import { sendTranslationEtaEmail, sendTranslationReadyEmail, buildTranslationReadyEmail } from "@/lib/email";
import { greetingName, resolveInvoicePlaceholder, toDeliveryLang } from "@/lib/delivery-message";
import { normalizeBillingInput, prepareDeliveryInvoice } from "@/lib/delivery-invoice";
import { splitDocumentVersions } from "@/lib/delivery-files";
import { NIF_REQUIRED_MESSAGE, decideInvoiceAction, needsNif } from "@/lib/delivery-billing";
import { sendEmailWithRetry } from "@/lib/email-retry";
import { fetchFileAsAttachment, buildIssuedInvoiceAttachment } from "@/lib/delivery-attachments";
import {
  addBusinessDays,
  formatEta,
  getHolidaySetFromEnv,
  getMadridBusinessBaseDate,
  suggestEtaBusinessDays,
} from "@/lib/eta";
import { buildSignedOrderUrl } from "@/lib/order-token";
import { transitionWorkflowState } from "@/lib/workflow-server";
import { isOrderSecured } from "@/lib/credit-terms";
import { getWorkflowState } from "@/lib/workflow";
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
  // Panel «Entregar al cliente»: archivos ya subidos que se envían (por URL),
  // datos fiscales revisados (emiten/corrigen la factura antes del email) y el
  // texto del mensaje editado por el staff.
  fileUrls?: string[];
  billing?: Record<string, unknown>;
  message?: string;
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

    // Traducciones ya entregadas (lista multi-archivo + campo único legacy).
    const existingDelivered: DeliveryFile[] = Array.isArray(order.deliveryFilesJson)
      ? (order.deliveryFilesJson as unknown as DeliveryFile[]).filter(
          (f) => f && typeof f.url === "string" && f.url.trim()
        )
      : [];
    // Lista de entrega: usa body.files si llega; si no, retrocompat con el campo
    // único. El primero es el "primario" (translatedFileUrl) para páginas/SMS/email.
    const extraFiles = Array.isArray(body.files)
      ? body.files.filter((f) => f && typeof f.url === "string" && f.url.trim())
      : [];
    const uploadedFiles =
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
    // Archivos ya subidos que el staff deja marcados en el panel: se resuelven
    // contra los del pedido (una URL desconocida se ignora).
    const knownFiles: DeliveryFile[] =
      existingDelivered.length > 0
        ? existingDelivered
        : order.finalDeliveryFileUrl || order.translatedFileUrl
          ? [
              {
                url: (order.finalDeliveryFileUrl || order.translatedFileUrl) as string,
                filename: order.finalFilename || null,
              },
            ]
          : [];
    const selectedFiles = (Array.isArray(body.fileUrls) ? body.fileUrls : [])
      .map((u) => knownFiles.find((f) => f.url === u))
      .filter((f): f is DeliveryFile => !!f && !uploadedFiles.some((n) => n.url === f.url));
    // El mismo documento marcado dos veces (versiones antiguas): solo la principal.
    const deliveryFiles = [
      ...uploadedFiles,
      ...splitDocumentVersions(selectedFiles, order.finalDeliveryFileUrl).current,
    ];
    const primaryFileUrl = deliveryFiles[0]?.url || translatedFileUrl;

    // "Cobrado" o "asegurado" (crédito: factura emitida con vencimiento). Ver
    // lib/credit-terms.ts — la regla no se relaja, cambia la palabra.
    if (!isOrderSecured(order)) {
      return NextResponse.json(
        { ok: false, error: "No se puede avanzar la entrega en pedidos pendientes de pago (ni autorizados a crédito)." },
        { status: 400 }
      );
    }

    if (state === "EN_PROCESO" && (getWorkflowState(order) === "CERRADO" || order.deliveryState === "TRADUCIDO")) {
      return NextResponse.json(
        { ok: false, error: "El pedido ya está entregado: no se puede volver a «En proceso»." },
        { status: 409 }
      );
    }

    if (body.billing && body.notifyClient && state === "TRADUCIDO" && !order.billingExcluded && !order.monthlyInvoiceId) {
      const wanted = normalizeBillingInput(body.billing, order.clientEmail);
      const action = decideInvoiceAction({
        existing: order.clientInvoice,
        amountCents: order.amountCents,
        paymentMethod: order.paymentMethod,
      });
      if (action === "issue" && needsNif(wanted.nif, order.amountCents)) {
        return NextResponse.json({ ok: false, error: NIF_REQUIRED_MESSAGE }, { status: 400 });
      }
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

    const knownUrls = new Set(
      [...existingDelivered.map((f) => f.url), order.finalDeliveryFileUrl, order.translatedFileUrl].filter(
        (u): u is string => typeof u === "string" && u.trim().length > 0
      )
    );
    const newFiles = deliveryFiles.filter((f) => !knownUrls.has(f.url));

    // CORRECCIÓN tras la entrega: el pedido ya tiene traducción entregada (o está
    // CERRADO, sumidero del workflow que no admite transición) y llega al menos
    // un archivo nuevo. No se reabre nada: el cierre es financiero y sigue
    // valiendo. La nueva versión pasa a ser la principal, queda evento de
    // auditoría y el aviso al cliente dice "versión corregida" en vez de "lista".
    // Reenviar el MISMO archivo ya entregado no es corrección (es reenvío).
    const currentWorkflow = getWorkflowState(order);
    const alreadyDelivered = currentWorkflow === "CERRADO" || order.deliveryState === "TRADUCIDO";
    const isCorrection = state === "TRADUCIDO" && alreadyDelivered && newFiles.length > 0;

    const nextWorkflowState = state === "TRADUCIDO" ? "TRADUCIDO_ENTREGADO" : "EN_TRADUCCION";
    try {
      if (currentWorkflow !== "CERRADO") await transitionWorkflowState({
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

    // Persistencia ACUMULATIVA: une las traducciones ya entregadas con las
    // nuevas, deduplicando por url. Entregar más archivos en una segunda tanda NO
    // borra los anteriores del pedido.
    // En una corrección la nueva versión va PRIMERO (es la principal y la que ve
    // el cliente arriba) y sustituye a la anterior si el nombre de archivo
    // coincide; las demás entregas del pedido se conservan.
    const mergedDeliveryFiles: DeliveryFile[] =
      deliveryFiles.length > 0
        ? (() => {
            if (isCorrection) {
              const newNames = new Set(
                deliveryFiles.map((f) => (f.filename || "").trim().toLowerCase()).filter(Boolean)
              );
              const newUrls = new Set(deliveryFiles.map((f) => f.url));
              const kept = existingDelivered.filter(
                (f) => !newUrls.has(f.url) && !newNames.has((f.filename || "").trim().toLowerCase())
              );
              return [...deliveryFiles, ...kept];
            }
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
      eventMessage: isCorrection
        ? `Corrección de la traducción subida tras la entrega (${newFiles.length} archivo${newFiles.length === 1 ? "" : "s"}).`
        : `Estado de entrega actualizado a ${state}.${mergedDeliveryFiles.length > 1 ? ` ${mergedDeliveryFiles.length} archivos.` : ""}${etaMessage}`.trim(),
    });

    if (isCorrection) {
      await prisma.orderEvent
        .create({
          data: {
            orderId: order.id,
            type: "delivery.corrected",
            message: `Corrección de la traducción${currentWorkflow === "CERRADO" ? " en pedido cerrado" : ""}: ${newFiles
              .map((f) => f.filename || f.url)
              .join(", ")}`,
            payload: {
              actorEmail,
              workflowState: currentWorkflow,
              files: newFiles,
              replaced: existingDelivered.filter((f) => !mergedDeliveryFiles.some((m) => m.url === f.url)),
              notifyClient: body.notifyClient === true,
            },
          },
        })
        .catch((err) => console.error("[orders-delivery] correction event failed", err));
    }

    const deliveryLang = toDeliveryLang(order.clientLocale);
    const warnings: string[] = [];
    let invoiceNumber: string | null = null;

    if (state === "EN_PROCESO" && etaDate) {
      sendTranslationEtaEmail({
        toEmail: order.clientEmail,
        reference: order.reference,
        etaDateLabel: formatEta(etaDate),
        statusUrl: buildSignedOrderUrl(order.reference, "estado"),
        lang: deliveryLang === "fr" ? "fr" : "es",
      }).catch((e) => console.error("[orders-delivery] eta email failed", e));
    }

    if (body.notifyClient && state === "TRADUCIDO" && primaryFileUrl) {
      // 0) Factura ANTES del email: datos fiscales revisados → emitir / corregir
      //    destinatario si aún no salió. Solo si el panel manda `billing`.
      if (body.billing) {
        try {
          const prepared = await prepareDeliveryInvoice({
            orderId: order.id,
            amountCents: order.amountCents,
            billingExcluded: order.billingExcluded,
            paymentMethod: order.paymentMethod,
            monthlyInvoiceId: order.monthlyInvoiceId,
            billing: normalizeBillingInput(body.billing, order.clientEmail),
            actorEmail,
          });
          if (prepared.warning) warnings.push(prepared.warning);
        } catch (invErr: any) {
          console.error("[orders-delivery] invoice prepare failed", invErr);
          warnings.push(`No se pudo preparar la factura (${invErr?.message || "error"}): se ha enviado sin ella.`);
        }
      }
      const invAttach = await buildIssuedInvoiceAttachment(order.reference);
      invoiceNumber = invAttach ? invAttach.name.replace(/\.pdf$/i, "") : null;

      // 1) Registrar QUE se envia al cliente, SINCRONO y antes de responder: el
      //    contenido exacto (asunto + cuerpo) queda en OrderEvent aunque el envio
      //    de fondo no llegue a completarse en serverless. Es lo que Juan necesita
      //    poder ver ("¿que mensaje recibio el cliente?").
      // El panel previsualiza «(nº al emitir)» cuando la factura aún no existe: aquí ya tiene número.
      const customMessage = resolveInvoicePlaceholder(body.message || "", invoiceNumber).trim() || null;
      const composed = buildTranslationReadyEmail({
        reference: order.reference,
        lang: deliveryLang,
        clientName: greetingName(order.clientName, order.clientEmail),
        invoiceNumber,
        message: customMessage,
        correction: isCorrection,
      });
      await prisma.orderEvent
        .create({
          data: {
            orderId: order.id,
            type: "notification.delivery_ready.sent",
            message: isCorrection
              ? "Cliente notificado de la version corregida de la traduccion."
              : "Cliente notificado de traduccion lista con enlace de descarga.",
            payload: {
              actorEmail,
              channel: "EMAIL",
              toEmail: order.clientEmail,
              subject: composed.subject,
              bodyHtml: composed.html,
              downloadUrl: primaryFileUrl,
              fileCount: deliveryFiles.length,
              correction: isCorrection,
              invoiceAttached: !!invAttach,
              invoiceNumber,
            },
          },
        })
        .catch((err) => console.error("[orders-delivery] delivery notification event failed", err));

      // 2) Envio real con adjuntos (TODAS las traducciones + factura si emitida) en
      //    background para no bloquear la respuesta de la entrega.
      void (async () => {
        const multi = deliveryFiles.length > 1;
        const fileAttachments = await Promise.all(
          deliveryFiles.map((f, i) =>
            fetchFileAsAttachment(
              f.url,
              f.filename || `Traduccion-jurada-${order.reference}${multi ? `-${i + 1}` : ""}.pdf`
            )
          )
        );
        const transAttachments = fileAttachments.filter(Boolean) as NonNullable<(typeof fileAttachments)[number]>[];
        const attachments = [...transAttachments, ...(invAttach ? [invAttach] : [])];
        const fallbackLinks = deliveryFiles.filter((_, i) => !fileAttachments[i]).map((f) => f.url);
        await sendEmailWithRetry(() =>
          sendTranslationReadyEmail({
            toEmail: order.clientEmail,
            reference: order.reference,
            lang: deliveryLang,
            clientName: greetingName(order.clientName, order.clientEmail),
            invoiceNumber,
            message: customMessage,
            fallbackLinks,
            attachments,
            invoiceAttached: !!invAttach,
            correction: isCorrection,
          })
        );
      })().catch((e) => console.error("[orders-delivery] ready email failed", e));
      // El SMS "traduccion lista" lo dispara transitionWorkflowState al cruzar a
      // TRADUCIDO_ENTREGADO (payload.delivered) — centralizado para cubrir tambien
      // el Kanban y no depender de este checkbox manual.
    }

    return NextResponse.json({
      ok: true,
      correction: isCorrection,
      invoiceNumber,
      warnings,
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
