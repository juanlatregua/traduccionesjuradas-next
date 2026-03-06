"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  resolveFunnelPathForStep,
  resolveGuestStep,
  resolveGoogleCallbackStep,
  sanitizeReturnPath,
  type CheckoutSessionSnapshot,
  type FunnelStep,
} from "@/lib/funnel-routing";
import {
  createCheckoutSessionId,
  readCheckoutSession,
  saveCheckoutSession,
} from "@/lib/funnel-session-client";

type Direction = "fr-es" | "es-fr";
type Step = 1 | 2 | 3;
type SelectionMode = "presets" | "file";

type DocOption = {
  id: string;
  label: string;
  keywords: string[];
  pricing: "fixed" | "per-page" | "per-word";
  fixedPrice?: number;
  pagePrice?: number;
  wordPrice?: number;
  deadline: string;
  samplePdf: string;
  payDirect: boolean;
};

type CartItem = {
  uid: string;
  docId: string;
  label: string;
  price: number;
  deadline: string;
  detail: string;
  samplePdf: string;
  payDirect: boolean;
  pricingModel: "fixed" | "per-page" | "per-word";
  attachedFileName?: string;
};

const QUICK_FAQ = [
  {
    q: "¿Es valida para Extranjeria y tramites oficiales?",
    a: "Si. La traduccion jurada va firmada por traductor jurado acreditado y sirve para tramites oficiales.",
  },
  {
    q: "¿Se entrega en PDF o papel?",
    a: "Entrega base en PDF firmado digitalmente. Si necesitas papel, se puede enviar por mensajeria (+24 h).",
  },
  {
    q: "¿Puedo pagar al instante?",
    a: "Si. En casos cerrados y documentos por palabra con conteo validado puedes pagar al momento.",
  },
  {
    q: "¿Puedo seguir mi pedido?",
    a: "Si. Puedes registrarte con Google y acceder a tu area de cliente para seguimiento.",
  },
  {
    q: "¿Recto y verso cuentan como 2 hojas?",
    a: "No. Recto y verso se considera una sola hoja.",
  },
];

const DOC_OPTIONS: DocOption[] = [
  {
    id: "penales-apostillado",
    label: "Certificado de penales apostillado",
    keywords: ["penales", "apostilla", "casier", "bulletin"],
    pricing: "fixed",
    fixedPrice: 50,
    deadline: "24 h",
    samplePdf: "/recursos/extrait-de-la-fiche-anthropometrique-avec-apostille.pdf",
    payDirect: true,
  },
  {
    id: "nacimiento",
    label: "Certificado de nacimiento",
    keywords: ["nacimiento", "naissance", "registro civil"],
    pricing: "fixed",
    fixedPrice: 40,
    deadline: "24 h",
    samplePdf: "/recursos/certificado-literal-de-nacimiento.pdf",
    payDirect: true,
  },
  {
    id: "medios-economicos",
    label: "Certificado de medios economicos",
    keywords: ["medios", "saldo", "bancario", "certificado"],
    pricing: "fixed",
    fixedPrice: 40,
    deadline: "24 h",
    samplePdf: "/recursos/certificat-de-solde-maroc-certificado-de-saldo-bancario-marruecos.pdf",
    payDirect: true,
  },
  {
    id: "kbis",
    label: "Kbis",
    keywords: ["kbis", "mercantil", "empresa", "registro"],
    pricing: "fixed",
    fixedPrice: 45,
    deadline: "24-48 h",
    samplePdf: "/recursos/kbis-france.pdf",
    payDirect: true,
  },
  {
    id: "registro-mercantil",
    label: "Registro Mercantil",
    keywords: ["registro", "mercantil", "empresa"],
    pricing: "fixed",
    fixedPrice: 45,
    deadline: "24-48 h",
    samplePdf: "/recursos/ejemplo-mercantil.pdf",
    payDirect: true,
  },
  {
    id: "delf-dalf",
    label: "Titulo DELF/DALF",
    keywords: ["delf", "dalf", "titulo", "idioma"],
    pricing: "fixed",
    fixedPrice: 40,
    deadline: "24 h",
    samplePdf: "/recursos/DELF-DALF .pdf",
    payDirect: true,
  },
  {
    id: "titulo-universitario",
    label: "Titulo universitario",
    keywords: ["titulo", "universitario", "diploma"],
    pricing: "fixed",
    fixedPrice: 40,
    deadline: "24 h",
    samplePdf: "/recursos/DIPLOME-LICENCE.pdf",
    payDirect: true,
  },
  {
    id: "titulo-apostillado",
    label: "Titulo universitario apostillado",
    keywords: ["titulo", "apostilla", "universitario"],
    pricing: "fixed",
    fixedPrice: 45,
    deadline: "24-48 h",
    samplePdf: "/recursos/diplome-apostille.pdf",
    payDirect: true,
  },
  {
    id: "titulo-apostillado-legalizado",
    label: "Titulo universitario apostillado legalizado",
    keywords: ["titulo", "apostilla", "legalizado"],
    pricing: "fixed",
    fixedPrice: 55,
    deadline: "24-48 h",
    samplePdf: "/recursos/ejemplo-academico.pdf",
    payDirect: true,
  },
  {
    id: "expediente-universitario",
    label: "Expediente universitario",
    keywords: ["expediente", "notas", "universitario", "releve"],
    pricing: "per-page",
    pagePrice: 35,
    deadline: "Segun paginas",
    samplePdf: "/recursos/ejemplo-academico.pdf",
    payDirect: true,
  },
  {
    id: "nacimiento-apostillado",
    label: "Certificado de nacimiento apostillado",
    keywords: ["nacimiento", "apostilla", "registro civil"],
    pricing: "fixed",
    fixedPrice: 45,
    deadline: "24-48 h",
    samplePdf: "/recursos/certificado-literal-de-nacimiento.pdf",
    payDirect: true,
  },
  {
    id: "certificado-residencia-cnie",
    label: "Certificado de residencia (CNIE)",
    keywords: ["residencia", "cnie", "certificado", "frances"],
    pricing: "fixed",
    fixedPrice: 40,
    deadline: "24 h",
    samplePdf: "/recursos/certificat-de-residence-pour-obtenir-le-CNIE.pdf",
    payDirect: true,
  },
  {
    id: "certificado-desplazamiento-em10",
    label: "Certificado de desplazamiento EM10",
    keywords: ["desplazamiento", "em10", "certificado"],
    pricing: "fixed",
    fixedPrice: 40,
    deadline: "24 h",
    samplePdf: "/recursos/certificat-de-detachement---certificado-de-desplazamiento-EM10.pdf",
    payDirect: true,
  },
  {
    id: "contrat-de-marriage",
    label: "Contrat de marriage",
    keywords: ["contrat", "marriage", "matrimonio", "notarial"],
    pricing: "per-word",
    wordPrice: 0.08,
    deadline: "Segun volumen",
    samplePdf: "/recursos/contrat-de-marriage.pdf",
    payDirect: true,
  },
  {
    id: "bulletin-n3",
    label: "Bulletin n°3",
    keywords: ["bulletin", "n3", "penales"],
    pricing: "fixed",
    fixedPrice: 50,
    deadline: "24 h",
    samplePdf: "/recursos/bulletin-n3-madagascar.pdf",
    payDirect: true,
  },
  {
    id: "documento-3plus",
    label: "Documento 3+ hojas (contar palabras)",
    keywords: ["3 hojas", "palabras", "larga", "documento"],
    pricing: "per-word",
    wordPrice: 0.08,
    deadline: "Segun volumen",
    samplePdf: "/recursos/ejemplo-juridico.pdf",
    payDirect: true,
  },
  {
    id: "estatutos",
    label: "Estatutos",
    keywords: ["estatutos", "sociedad", "empresa"],
    pricing: "per-word",
    wordPrice: 0.08,
    deadline: "Segun volumen",
    samplePdf: "/recursos/ejemplo-mercantil.pdf",
    payDirect: true,
  },
  {
    id: "actas-notariales",
    label: "Actas notariales",
    keywords: ["actas", "notariales", "notaria"],
    pricing: "per-word",
    wordPrice: 0.08,
    deadline: "Segun volumen",
    samplePdf: "/recursos/ejemplo-juridico.pdf",
    payDirect: true,
  },
  {
    id: "capitulaciones",
    label: "Capitulaciones matrimoniales",
    keywords: ["capitulaciones", "matrimoniales", "notarial"],
    pricing: "per-word",
    wordPrice: 0.08,
    deadline: "Segun volumen",
    samplePdf: "/recursos/contrat-de-marriage.pdf",
    payDirect: true,
  },
  {
    id: "herencia",
    label: "Documentacion de herencia",
    keywords: ["herencia", "testamento", "sucesiones"],
    pricing: "per-word",
    wordPrice: 0.08,
    deadline: "Segun volumen",
    samplePdf: "/recursos/ejemplo-juridico.pdf",
    payDirect: true,
  },
];

function money(amount: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(amount);
}

function estimatePrice(doc: DocOption, pages: number, words: number) {
  if (doc.pricing === "fixed") return doc.fixedPrice || 0;
  if (doc.pricing === "per-page") return (doc.pagePrice || 0) * Math.max(1, pages);
  return (doc.wordPrice || 0) * Math.max(1, words);
}

function estimateDetail(doc: DocOption, pages: number, words: number) {
  if (doc.pricing === "fixed") return "Precio cerrado.";
  if (doc.pricing === "per-page") return `${Math.max(1, pages)} paginas x ${money(doc.pagePrice || 0)}.`;
  return `${Math.max(1, words)} palabras x ${money(doc.wordPrice || 0)}.`;
}

function uiStepToFunnelStep(step: Step): FunnelStep {
  if (step === 1) return "SELECT";
  if (step === 2) return "UPLOAD";
  return "CHECKOUT";
}

export default function FrenchOfferPanel() {
  const [sessionId, setSessionId] = useState<string>(() => createCheckoutSessionId());
  const [step, setStep] = useState<Step>(1);
  const [selectionMode, setSelectionMode] = useState<SelectionMode>("presets");
  const [direction, setDirection] = useState<Direction>("fr-es");
  const [query, setQuery] = useState("");
  const [selectedDocId, setSelectedDocId] = useState<string>(DOC_OPTIONS[0].id);
  const [pages, setPages] = useState(3);
  const [words, setWords] = useState(1200);
  const [presetAttachment, setPresetAttachment] = useState<File | null>(null);
  const [presetAttachmentInputKey, setPresetAttachmentInputKey] = useState(0);
  const [fileUpload, setFileUpload] = useState<File | null>(null);
  const [extractingWords, setExtractingWords] = useState(false);
  const [filePrice, setFilePrice] = useState<number | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartFiles, setCartFiles] = useState<Record<string, File>>({});
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [googleRedirecting, setGoogleRedirecting] = useState(false);
  const [guestEmail, setGuestEmail] = useState("");
  const [urgencyNotes, setUrgencyNotes] = useState("");
  const [pendingOrderReference, setPendingOrderReference] = useState<string | null>(null);
  const createOrderIdempotencyRef = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [botHistory, setBotHistory] = useState<Array<{ from: "bot" | "user"; text: string }>>([]);
  const [sessionHydrated, setSessionHydrated] = useState(false);
  const firstMissingInputRef = useRef<HTMLInputElement | null>(null);
  const [tracking, setTracking] = useState<{
    sourceRaw?: string;
    sourceChannel?: string;
    sourceAgent?: string;
    sourceCampaign?: string;
    sourceMedium?: string;
    sourceLanding?: string;
  }>({});

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = readCheckoutSession();
    if (saved?.sessionId) {
      setSessionId(saved.sessionId);
      if (saved.currentStep === "UPLOAD") setStep(2);
      if (saved.currentStep === "CHECKOUT") setStep(3);
      if (saved.orderReference) setPendingOrderReference(saved.orderReference);
      if (saved.guestEmail) setGuestEmail(saved.guestEmail);
    }

    const params = new URLSearchParams(window.location.search);
    const requestedStep = (params.get("step") || "").toLowerCase();
    if (requestedStep === "upload") setStep(2);
    if (requestedStep === "checkout") setStep(3);

    const srcRaw = (params.get("src") || params.get("utm_source") || "").trim().toLowerCase();
    const sourceChannel =
      srcRaw === "wa" || srcRaw === "whatsapp" || srcRaw.startsWith("whatsapp")
        ? "WHATSAPP"
        : undefined;
    const sourceAgent = (params.get("agent") || "").trim() || undefined;
    const sourceCampaign =
      (params.get("campaign") || params.get("utm_campaign") || "").trim() || undefined;
    const sourceMedium = (params.get("utm_medium") || "").trim() || undefined;
    setTracking({
      sourceRaw: srcRaw || undefined,
      sourceChannel,
      sourceAgent,
      sourceCampaign,
      sourceMedium,
      sourceLanding: window.location.pathname + window.location.search,
    });
    setSessionHydrated(true);
  }, []);

  const selectedDoc = useMemo(
    () => DOC_OPTIONS.find((doc) => doc.id === selectedDocId) || DOC_OPTIONS[0],
    [selectedDocId]
  );

  const matches = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return DOC_OPTIONS.slice(0, 8);
    return DOC_OPTIONS.filter((doc) => {
      const inLabel = doc.label.toLowerCase().includes(term);
      const inKeywords = doc.keywords.some((keyword) => keyword.toLowerCase().includes(term));
      return inLabel || inKeywords;
    }).slice(0, 8);
  }, [query]);

  const previewPrice = estimatePrice(selectedDoc, pages, words);
  const previewDetail = estimateDetail(selectedDoc, pages, words);
  const cartTotal = cart.reduce((sum, item) => sum + item.price, 0);
  const missingUploadItems = useMemo(
    () => cart.filter((item) => !cartFiles[item.uid]),
    [cart, cartFiles]
  );
  const firstMissingUid = missingUploadItems[0]?.uid || null;
  const uploadReady = cart.length > 0 && missingUploadItems.length === 0;
  const guestEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail.trim());
  const hasMixedPricing =
    cart.some((item) => item.pricingModel === "per-word") &&
    cart.some((item) => item.pricingModel !== "per-word");
  const allPayDirect = cart.length > 0 && cart.every((item) => item.payDirect) && !hasMixedPricing;
  const botContext = useMemo(() => {
    if (selectedDoc.pricing === "fixed") {
      return `Para "${selectedDoc.label}" tienes precio cerrado y puedes pagar al instante.`;
    }
    if (selectedDoc.pricing === "per-page") {
      return `Para "${selectedDoc.label}" calcula por paginas (35 EUR/pagina).`;
    }
    return `Para "${selectedDoc.label}" usa extractor PDF o palabras manuales (0,08 EUR/palabra).`;
  }, [selectedDoc]);

  useEffect(() => {
    setBotHistory([
      { from: "bot", text: "Hola, te ayudo a cerrar el pedido en menos de 1 minuto." },
      { from: "bot", text: botContext },
    ]);
  }, [botContext]);

  useEffect(() => {
    if (!sessionHydrated) return;
    const snapshot: CheckoutSessionSnapshot = {
      sessionId,
      selectedDocumentTypes: cart.map((item) => item.docId),
      uploadedFiles: cart
        .map((item) => ({ uid: item.uid, fileName: cartFiles[item.uid]?.name || item.attachedFileName || "" }))
        .filter((item) => Boolean(item.fileName)),
      customerAuthState: guestEmailValid ? "guest" : "unknown",
      currentStep: uiStepToFunnelStep(step),
      orderReference: pendingOrderReference,
      guestEmail: guestEmail.trim().toLowerCase() || undefined,
      updatedAt: new Date().toISOString(),
    };
    saveCheckoutSession(snapshot);
  }, [
    cart,
    cartFiles,
    guestEmail,
    guestEmailValid,
    pendingOrderReference,
    sessionHydrated,
    sessionId,
    step,
  ]);

  const askBot = (question: string, answer: string) => {
    setBotHistory((prev) => [
      ...prev,
      { from: "user", text: question },
      { from: "bot", text: answer },
    ]);
  };

  const clearPendingOrder = () => {
    setPendingOrderReference(null);
    createOrderIdempotencyRef.current = null;
  };

  const addToCart = () => {
    const uid = `${selectedDoc.id}-${Date.now()}`;
    const selectedAttachment = presetAttachment || (selectedDoc.pricing === "per-word" ? fileUpload : null);
    const item: CartItem = {
      uid,
      docId: selectedDoc.id,
      label: selectedDoc.label,
      price: previewPrice,
      deadline: selectedDoc.deadline,
      detail: previewDetail,
      samplePdf: selectedDoc.samplePdf,
      payDirect: selectedDoc.payDirect,
      pricingModel: selectedDoc.pricing,
      attachedFileName: selectedAttachment?.name || undefined,
    };
    setCart((prev) => [...prev, item]);
    if (selectedAttachment) {
      setCartFiles((prev) => ({ ...prev, [uid]: selectedAttachment }));
    }
    if (presetAttachment) {
      setPresetAttachment(null);
      setPresetAttachmentInputKey((prev) => prev + 1);
    }
    if (selectedDoc.pricing === "per-word" && fileUpload) {
      setFileUpload(null);
    }
    clearPendingOrder();
    setStep(2);
    setError(null);
    setNotice(null);
  };

  const addFileDocToCart = () => {
    if (words < 5) {
      setError("Sube un documento y extrae las palabras primero.");
      return;
    }
    const price = filePrice ?? Math.round(words * WORD_PRICE_FR * 1.1);
    const fileName = fileUpload?.name || "Documento";
    const uid = `file-${Date.now()}`;
    const item: CartItem = {
      uid,
      docId: "file-upload",
      label: `${fileName} (${words} palabras)`,
      price,
      deadline: "Segun volumen",
      detail: `Precio cerrado basado en ${words} palabras.`,
      samplePdf: "",
      payDirect: true,
      pricingModel: "per-word",
      attachedFileName: fileUpload?.name || undefined,
    };
    setCart((prev) => [...prev, item]);
    if (fileUpload) {
      setCartFiles((prev) => ({ ...prev, [uid]: fileUpload }));
    }
    clearPendingOrder();
    setStep(2);
    setError(null);
    setNotice(null);
    setFileUpload(null);
    setFilePrice(null);
  };

  const removeItem = (uid: string) => {
    setCart((prev) => prev.filter((item) => item.uid !== uid));
    setCartFiles((prev) => {
      const next = { ...prev };
      delete next[uid];
      return next;
    });
    clearPendingOrder();
  };

  const attachFileToCartItem = (uid: string, file: File | null) => {
    if (!file) return;
    setCartFiles((prev) => ({ ...prev, [uid]: file }));
    setCart((prev) =>
      prev.map((item) => (item.uid === uid ? { ...item, attachedFileName: file.name } : item))
    );
    setError(null);
  };

  const goCheckout = () => {
    if (cart.length === 0) {
      setError("Añade al menos un documento a la cesta.");
      return;
    }
    if (!uploadReady) {
      setError("Sube el documento original de cada item para continuar al checkout.");
      setNotice("Paso obligatorio: sube el original (PDF/JPG/PNG) y luego finaliza pedido.");
      firstMissingInputRef.current?.focus();
      return;
    }
    setStep(3);
    setError(null);
  };

  const WORD_PRICE_FR = 0.08;

  const extractWordsFromFile = async () => {
    if (!fileUpload) {
      setError("Adjunta un PDF o imagen para extraer palabras.");
      return;
    }
    setExtractingWords(true);
    setError(null);
    setNotice(null);
    try {
      const formData = new FormData();
      formData.append("file", fileUpload);
      formData.append("lang", direction);
      formData.append("urgency", "normal");
      const res = await fetch("/api/estimador", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "No se pudieron extraer palabras.");
      }
      const extracted = Number(data.words || 0);
      if (!Number.isFinite(extracted) || extracted <= 0) {
        throw new Error("No se pudieron extraer palabras validas.");
      }
      setWords(extracted);
      setFilePrice(Math.round(extracted * WORD_PRICE_FR * 1.1));
      setNotice(`Palabras extraidas: ${extracted}. Precio actualizado.`);
    } catch (err: any) {
      setError(err?.message || "No se pudieron extraer palabras.");
    } finally {
      setExtractingWords(false);
    }
  };

  const uploadCartDocuments = async (reference: string, clientEmail?: string) => {
    const entries = cart
      .map((item) => ({ item, file: cartFiles[item.uid] }))
      .filter((entry): entry is { item: CartItem; file: File } => Boolean(entry.file));

    if (entries.length === 0) return;

    const uploadedUids: string[] = [];
    const failedDetails: string[] = [];

    for (const entry of entries) {
      const formData = new FormData();
      formData.append("file", entry.file);
      if (clientEmail) {
        formData.append("clientEmail", clientEmail);
      }
      try {
        const res = await fetch(`/api/orders/${reference}/documents`, {
          method: "POST",
          body: formData,
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.ok) {
          const reason = data?.error
            ? String(data.error)
            : `HTTP ${res.status}`;
          failedDetails.push(`${entry.item.label}: ${reason}`);
          continue;
        }
        uploadedUids.push(entry.item.uid);
      } catch (err: any) {
        failedDetails.push(`${entry.item.label}: ${String(err?.message || "Error de red")}`);
      }
    }

    if (uploadedUids.length > 0) {
      setCartFiles((prev) => {
        const next = { ...prev };
        for (const uid of uploadedUids) delete next[uid];
        return next;
      });
    }

    if (failedDetails.length > 0) {
      const firstError = failedDetails[0];
      throw new Error(
        `Pedido ${reference} creado, pero faltan adjuntos por subir (${failedDetails.length}). ${firstError}`
      );
    }
  };

  const payNow = async (authMode: "guest" | "google") => {
    setCheckoutLoading(true);
    setError(null);
    setNotice(null);
    try {
      if (cart.length === 0) {
        throw new Error("Añade al menos un documento antes de continuar.");
      }
      if (!uploadReady) {
        throw new Error("Sube el documento original de cada item para continuar al checkout.");
      }
      const normalizedGuestEmail = guestEmail.trim().toLowerCase();
      if (!guestEmailValid) {
        throw new Error("Indica un email valido para continuar.");
      }

      const labels = cart.map((item) => item.label).join(" + ").slice(0, 110);
      const containsWordCountItem = cart.some((item) => item.pricingModel === "per-word");

      let orderReference = pendingOrderReference;
      let orderToken = "";
      if (!orderReference) {
        const idempotencyKey =
          createOrderIdempotencyRef.current ||
          `fr:${sessionId}:${Date.now()}:${Math.random().toString(16).slice(2, 10)}`;
        createOrderIdempotencyRef.current = idempotencyKey;
        const res = await fetch("/api/orders", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-idempotency-key": idempotencyKey,
          },
          body: JSON.stringify({
            amountCents: Math.round(cartTotal * 100),
            currency: "eur",
            title: `Pedido frances: ${labels}`,
            source: "preset",
            langPair: direction,
            pagesLabel: `${cart.length} documento(s)`,
            hasMixedCart: hasMixedPricing,
            containsWordCountItem,
            reviewRequired: hasMixedPricing,
            reviewReason: hasMixedPricing
              ? "Carrito mixto (prefijado + por palabras) requiere validacion interna previa."
              : undefined,
            urgencyNotes: urgencyNotes.trim() || undefined,
            sourceChannel: tracking.sourceChannel,
            sourceAgent: tracking.sourceAgent,
            sourceCampaign: tracking.sourceCampaign,
            sourceMedium: tracking.sourceMedium,
            sourceLanding: tracking.sourceLanding,
            guestEmail: normalizedGuestEmail,
            checkoutSessionId: sessionId,
            checkoutStep: "CHECKOUT",
            selectedDocumentTypes: cart.map((item) => item.docId),
            uploadedFilesCount: cart.length,
            idempotencyKey,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data?.ok || !data?.order?.reference) {
          throw new Error(data?.error || "No se pudo crear el pedido.");
        }
        orderReference = data.order.reference as string;
        orderToken = (data.order.token as string) || "";
        setPendingOrderReference(orderReference);
      }

      const attachmentsCount = cart.filter((item) => Boolean(cartFiles[item.uid])).length;
      if (attachmentsCount > 0) {
        setNotice(`Subiendo ${attachmentsCount} documento(s) adjuntos al pedido...`);
        await uploadCartDocuments(orderReference, normalizedGuestEmail);
        setNotice("Adjuntos subidos correctamente. Redirigiendo al pago...");
      }

      const baseStep = resolveGuestStep({
        selectedCount: cart.length,
        uploadedCount: attachmentsCount,
      });
      if (baseStep !== "CHECKOUT") {
        setStep(baseStep === "UPLOAD" ? 2 : 1);
        throw new Error("Faltan datos para llegar al checkout.");
      }

      const params = new URLSearchParams();
      if (orderToken) params.set("token", orderToken);
      if (tracking.sourceRaw) params.set("src", tracking.sourceRaw);
      if (tracking.sourceAgent) params.set("agent", tracking.sourceAgent);
      const qs = params.toString();
      setNotice(null);
      const paymentUrl = `/area-cliente/pedido/${orderReference}/pagar${qs ? `?${qs}` : ""}`;
      setPendingOrderReference(orderReference);

      if (authMode === "google") {
        const authStep = resolveGoogleCallbackStep({
          selectedCount: cart.length,
          uploadedCount: attachmentsCount,
          lastKnownStep: uiStepToFunnelStep(step),
        });
        const callbackTarget = authStep === "CHECKOUT" ? paymentUrl : resolveFunnelPathForStep(authStep);
        const callbackUrl = sanitizeReturnPath(callbackTarget, paymentUrl);
        window.location.assign(`/acceso?callbackUrl=${encodeURIComponent(callbackUrl)}`);
        return;
      }

      window.location.assign(paymentUrl);
    } catch (err: any) {
      setNotice(null);
      setError(err?.message || "No se pudo crear el pedido.");
    } finally {
      setCheckoutLoading(false);
      setGoogleRedirecting(false);
    }
  };

  const handleGuestCheckout = () => {
    void payNow("guest");
  };

  const handleGoogleCheckout = () => {
    setGoogleRedirecting(true);
    void payNow("google");
  };

  return (
    <section className="mt-10 rounded-3xl border border-cream bg-cream p-5 shadow-sm sm:p-6">
      <p className="inline-flex rounded-full border border-cream bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-bleu">
        Contratacion autonoma en frances
      </p>
      <h2 className="mt-3 text-xl font-semibold text-encre sm:text-2xl">
        Elige documento, sube original y finaliza pedido
      </h2>
      <p className="mt-2 text-sm text-sepia">
        Flujo guiado sin pérdidas de estado: selecciona, adjunta original y pasa al checkout con pago claro.
      </p>

      <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setStep(1)}
          className={`rounded-full px-3 py-1 ${step === 1 ? "bg-bleu text-white" : "bg-white text-sepia"}`}
        >
          1. Seleccion
        </button>
        <button
          type="button"
          onClick={() => setStep(2)}
          className={`rounded-full px-3 py-1 ${step === 2 ? "bg-bleu text-white" : "bg-white text-sepia"}`}
        >
          2. Subir original
        </button>
        <button
          type="button"
          onClick={goCheckout}
          className={`rounded-full px-3 py-1 ${step === 3 ? "bg-bleu text-white" : "bg-white text-sepia"}`}
        >
          3. Checkout
        </button>
      </div>

      <label className="mt-4 flex max-w-xs flex-col gap-2 rounded-2xl border border-cream bg-white p-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-sepia">Combinacion</span>
        <select
          value={direction}
          onChange={(e) => setDirection(e.target.value as Direction)}
          className="rounded-2xl border border-cream bg-white px-3 py-2 text-sm"
        >
          <option value="fr-es">Frances a Espanol</option>
          <option value="es-fr">Espanol a Frances</option>
        </select>
      </label>

      {step === 1 && (
        <div className="mt-5 space-y-4">
          <div className="inline-flex rounded-2xl border border-cream bg-white p-1">
            <button
              type="button"
              onClick={() => setSelectionMode("presets")}
              className={`rounded-xl px-3 py-2 text-xs font-semibold ${
                selectionMode === "presets" ? "bg-bleu text-white" : "text-sepia"
              }`}
            >
              Documentos habituales (precio cerrado)
            </button>
            <button
              type="button"
              onClick={() => setSelectionMode("file")}
              className={`rounded-xl px-3 py-2 text-xs font-semibold ${
                selectionMode === "file" ? "bg-bleu text-white" : "text-sepia"
              }`}
            >
              Subir documento (contar palabras)
            </button>
          </div>

          {selectionMode === "presets" ? (
            <div className="grid gap-4 md:grid-cols-[1.5fr_1fr]">
              <div className="rounded-2xl border border-cream bg-white p-4">
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-sepia">
                    Documento (escribe y te proponemos opciones)
                  </span>
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Ejemplo: penales, nacimiento, Kbis..."
                    className="mt-2 w-full rounded-2xl border border-cream px-3 py-2 text-sm"
                  />
                </label>

                <div className="mt-3 space-y-2">
                  {matches.map((doc) => (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => setSelectedDocId(doc.id)}
                      className={`w-full rounded-2xl border px-3 py-2 text-left text-sm ${
                        selectedDoc.id === doc.id
                          ? "border-bleu bg-cream text-encre"
                          : "border-cream bg-white text-sepia"
                      }`}
                    >
                      {doc.label}
                      {doc.pricing === "per-word" && (
                        <span className="ml-2 text-[11px] text-bleu">(por palabra)</span>
                      )}
                      {doc.pricing === "per-page" && (
                        <span className="ml-2 text-[11px] text-bleu">(por pagina)</span>
                      )}
                    </button>
                  ))}
                </div>

                {selectedDoc.pricing === "per-page" && (
                  <label className="mt-3 flex max-w-[220px] flex-col gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-sepia">Paginas</span>
                    <input
                      type="number"
                      min={1}
                      max={120}
                      value={pages}
                      onChange={(e) => setPages(Number(e.target.value) || 1)}
                      className="rounded-2xl border border-cream px-3 py-2 text-sm"
                    />
                  </label>
                )}

                {selectedDoc.pricing === "per-word" && (
                  <div className="mt-3 space-y-3">
                    <label className="flex max-w-[280px] flex-col gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-sepia">Adjuntar PDF (extractor)</span>
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                        onChange={(e) => setFileUpload(e.target.files?.[0] || null)}
                        className="block w-full text-xs file:mr-3 file:rounded-xl file:border-0 file:bg-cream file:px-3 file:py-2 file:text-xs file:font-semibold file:text-sepia"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={extractWordsFromFile}
                      disabled={extractingWords}
                      className="rounded-2xl border border-cream px-4 py-2 text-sm font-semibold text-sepia hover:bg-cream disabled:opacity-60"
                    >
                      {extractingWords ? "Extrayendo palabras..." : "Extraer palabras del documento"}
                    </button>
                    <label className="flex max-w-[220px] flex-col gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-sepia">Palabras (manual)</span>
                      <input
                        type="number"
                        min={1}
                        max={200000}
                        value={words}
                        onChange={(e) => setWords(Number(e.target.value) || 1)}
                        className="rounded-2xl border border-cream px-3 py-2 text-sm"
                      />
                    </label>
                  </div>
                )}

                {selectedDoc.pricing !== "per-word" && (
                  <div className="mt-3 rounded-2xl border border-cream bg-parchment p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-sepia">
                      Adjuntar tu documento (recomendado)
                    </p>
                    <input
                      key={presetAttachmentInputKey}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,application/pdf,image/jpeg,image/png"
                      onChange={(e) => setPresetAttachment(e.target.files?.[0] || null)}
                      className="mt-2 block w-full text-xs file:mr-3 file:rounded-xl file:border-0 file:bg-white file:px-3 file:py-2 file:text-xs file:font-semibold file:text-sepia"
                    />
                    <p className="mt-2 text-[11px] text-graphite">
                      Si no lo adjuntas aquí, te lo pediremos en el paso 2 para poder continuar al checkout.
                    </p>
                  </div>
                )}

                <div className="mt-4 rounded-2xl border border-cream bg-cream p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-sepia">Precio estimado</p>
                  <p className="mt-1 text-xl font-bold text-bleu">{money(previewPrice)}</p>
                  <p className="text-xs text-sepia">{previewDetail}</p>
                  <p className="text-xs text-sepia">Plazo: {selectedDoc.deadline}</p>
                </div>

                <button
                  type="button"
                  onClick={addToCart}
                  className="mt-4 rounded-2xl bg-bleu px-4 py-2 text-sm font-semibold text-white hover:bg-bleu-dark"
                >
                  Añadir a la cesta
                </button>
              </div>

              <div className="rounded-2xl border border-cream bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-sepia">Vista previa documento</p>
                <div className="mt-2 overflow-hidden rounded-xl border border-cream bg-cream">
                  <object
                    data={selectedDoc.samplePdf}
                    type="application/pdf"
                    className="h-[220px] w-full"
                    aria-label="Vista previa PDF"
                  >
                    <div className="flex h-[220px] items-center justify-center text-xs text-graphite">
                      Vista previa no disponible
                    </div>
                  </object>
                </div>
                <a
                  href={selectedDoc.samplePdf}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-xs font-semibold text-bleu hover:underline"
                >
                  Ver ejemplo en nueva pestaña
                </a>

                <div className="mt-4 rounded-2xl border border-cream bg-cream p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-bleu">
                    Bot de confianza
                  </p>
                  <p className="mt-1 text-xs text-sepia">Respuestas en vivo según el documento seleccionado.</p>
                  <div className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded-xl border border-cream bg-white p-2">
                    {botHistory.map((msg, idx) => (
                      <p
                        key={`${msg.from}-${idx}`}
                        className={`text-xs ${
                          msg.from === "bot" ? "text-sepia" : "text-bleu font-semibold text-right"
                        }`}
                      >
                        {msg.text}
                      </p>
                    ))}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {QUICK_FAQ.map((item) => (
                      <button
                        key={item.q}
                        type="button"
                        onClick={() => askBot(item.q, item.a)}
                        className="rounded-full border border-cream bg-white px-2.5 py-1 text-[11px] font-semibold text-sepia"
                      >
                        {item.q}
                      </button>
                    ))}
                  </div>
                  <Link
                    href="/preguntas-frecuentes"
                    className="mt-2 inline-block text-xs font-semibold text-bleu hover:underline"
                  >
                    Ver FAQ completa
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-cream bg-white p-4">
              <p className="text-sm font-semibold text-encre">
                Sube tu documento y calculamos el precio por palabras
              </p>
              <p className="mt-1 text-xs text-sepia">
                Tarifa: {money(WORD_PRICE_FR)}/palabra. Válido para cualquier documento en francés.
              </p>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-sepia">
                    Adjuntar documento (PDF, JPG o PNG)
                  </span>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                    onChange={(e) => {
                      setFileUpload(e.target.files?.[0] || null);
                      setFilePrice(null);
                    }}
                    className="block w-full text-xs file:mr-3 file:rounded-xl file:border-0 file:bg-cream file:px-3 file:py-2 file:text-xs file:font-semibold file:text-sepia"
                  />
                </label>
                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-sepia">
                    O introduce palabras manualmente
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={200000}
                    value={words}
                    onChange={(e) => {
                      const w = Number(e.target.value) || 1;
                      setWords(w);
                      setFilePrice(Math.round(w * WORD_PRICE_FR * 1.1));
                    }}
                    className="rounded-2xl border border-cream px-3 py-2 text-sm"
                  />
                </label>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={extractWordsFromFile}
                  disabled={extractingWords || !fileUpload}
                  className="rounded-2xl bg-bleu px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {extractingWords ? "Extrayendo palabras..." : "Extraer palabras del documento"}
                </button>
              </div>

              <div className="mt-4 rounded-2xl border border-cream bg-cream p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-sepia">Precio estimado</p>
                {filePrice != null ? (
                  <>
                    <p className="mt-1 text-xl font-bold text-bleu">{money(filePrice)}</p>
                    <p className="text-xs text-sepia">
                      Precio cerrado basado en {words} palabras.
                    </p>
                    <p className="text-xs text-sepia">Plazo: segun volumen.</p>
                  </>
                ) : (
                  <p className="mt-1 text-sm text-sepia">
                    Sube un documento o introduce las palabras para ver el precio.
                  </p>
                )}
              </div>

              {filePrice != null && (
                <button
                  type="button"
                  onClick={addFileDocToCart}
                  className="mt-4 rounded-2xl bg-bleu px-4 py-2 text-sm font-semibold text-white hover:bg-bleu-dark"
                >
                  Añadir a la cesta
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="mt-5 rounded-2xl border border-cream bg-white p-4">
          {cart.length === 0 ? (
            <p className="text-sm text-sepia">La cesta esta vacia. Añade un documento en el paso 1.</p>
          ) : (
            <>
              <div
                className={`mb-4 rounded-xl border px-3 py-2 text-sm ${
                  uploadReady
                    ? "border-cream bg-cream text-bleu"
                    : "border-amber-200 bg-amber-50 text-amber-800"
                }`}
              >
                {uploadReady
                  ? "Originales completos. Ya puedes pasar al checkout."
                  : "Sube el documento original de cada item para continuar al checkout."}
              </div>

              <div className="space-y-3">
                {cart.map((item) => (
                  <div key={item.uid} className="flex items-start justify-between gap-3 rounded-xl border border-cream p-3">
                    <div>
                      <p className="text-sm font-semibold text-encre">{item.label}</p>
                      <p className="text-xs text-sepia">{item.detail}</p>
                      <p className="text-xs text-sepia">Plazo: {item.deadline}</p>
                      {cartFiles[item.uid] ? (
                        <p className="text-xs font-semibold text-bleu">
                          Original listo: {cartFiles[item.uid].name}
                        </p>
                      ) : (
                        <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-2">
                          <p className="text-[11px] font-semibold text-amber-800">
                            Obligatorio para pagar
                          </p>
                          <input
                            ref={item.uid === firstMissingUid ? firstMissingInputRef : null}
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                            onChange={(e) => attachFileToCartItem(item.uid, e.target.files?.[0] || null)}
                            className="mt-1 block w-full text-[11px] file:mr-2 file:rounded-lg file:border-0 file:bg-white file:px-2 file:py-1.5 file:text-[11px] file:font-semibold file:text-sepia"
                          />
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-bleu">{money(item.price)}</p>
                      <button
                        type="button"
                        onClick={() => removeItem(item.uid)}
                        className="mt-1 text-xs font-semibold text-graphite hover:text-sepia"
                      >
                        Quitar
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-xl border border-cream bg-cream p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-sepia">Subtotal</p>
                <p className="text-xl font-bold text-bleu">{money(cartTotal)}</p>
              </div>
              {uploadReady && (
                <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-3">
                  <p className="text-sm font-semibold text-blue-900">
                    ¿Añadir otro documento o finalizar pedido?
                  </p>
                  <p className="mt-1 text-xs text-blue-800">
                    Puedes volver al selector para añadir más tipos o continuar directamente al checkout.
                  </p>
                </div>
              )}
            </>
          )}

          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="rounded-2xl border border-cream px-4 py-2 font-semibold text-sepia hover:bg-cream"
            >
              Añadir otro documento
            </button>
            <button
              type="button"
              onClick={goCheckout}
              className="rounded-2xl bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
              disabled={!uploadReady}
            >
              Ir a checkout
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="mt-5 rounded-2xl border border-cream bg-white p-4">
          <p className="text-sm text-sepia">
            Pedido preparado en dirección{" "}
            <span className="font-semibold">{direction === "fr-es" ? "Frances a Espanol" : "Espanol a Frances"}</span>.
          </p>
          <p className="mt-1 text-xl font-bold text-bleu">{money(cartTotal)}</p>
          <ul className="mt-2 list-disc pl-5 text-xs text-sepia">
            {cart.map((item) => (
              <li key={item.uid}>{item.label}</li>
            ))}
          </ul>
          <div className="mt-3 rounded-2xl border border-cream bg-parchment p-3">
            <label className="block text-xs font-semibold uppercase tracking-wide text-sepia">
              Email de contacto (obligatorio)
            </label>
            <input
              type="email"
              value={guestEmail}
              onChange={(e) => setGuestEmail(e.target.value)}
              placeholder="tu@email.com"
              className="mt-2 w-full rounded-xl border border-cream bg-white px-3 py-2 text-sm text-encre"
            />
            <p className="mt-1 text-[11px] text-graphite">
              Usaremos este email para confirmaciones y para recuperar tu pedido.
            </p>
          </div>

          <div className="mt-3 rounded-2xl border border-cream bg-parchment p-3">
            <label className="block text-xs font-semibold uppercase tracking-wide text-sepia">
              Observaciones urgencia
            </label>
            <textarea
              value={urgencyNotes}
              onChange={(e) => setUrgencyNotes(e.target.value)}
              placeholder="Ejemplo: necesito entrega antes del viernes por cita administrativa."
              className="mt-2 h-20 w-full rounded-xl border border-cream bg-white px-3 py-2 text-sm text-encre"
            />
            <p className="mt-1 text-[11px] text-graphite">
              En francés estándar (rama A) el ETA base es de 2 días laborables sin contar el día del pago.
            </p>
          </div>

          {allPayDirect ? (
            <button
              type="button"
              onClick={handleGuestCheckout}
              disabled={checkoutLoading || cart.length === 0 || !uploadReady || !guestEmailValid}
              className="mt-3 rounded-2xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
            >
              {checkoutLoading ? "Preparando checkout..." : "Continuar como invitado al pago"}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleGuestCheckout}
              disabled={checkoutLoading || cart.length === 0 || !uploadReady || !guestEmailValid}
              className="mt-3 rounded-2xl bg-bleu-dark px-4 py-2 text-sm font-semibold text-white hover:bg-bleu-dark disabled:opacity-60"
            >
              {checkoutLoading ? "Enviando..." : "Enviar a revisión interna"}
            </button>
          )}

          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            <button
              type="button"
              onClick={handleGoogleCheckout}
              disabled={checkoutLoading || googleRedirecting || !uploadReady || !guestEmailValid}
              className="rounded-2xl border border-cream px-4 py-2 font-semibold text-sepia hover:bg-cream"
            >
              {googleRedirecting ? "Abriendo Google..." : "Continuar con Google y seguir al checkout"}
            </button>
            <button
              type="button"
              onClick={() => setStep(2)}
              className="rounded-2xl border border-cream px-4 py-2 font-semibold text-sepia hover:bg-cream"
            >
              Volver a cesta
            </button>
          </div>
          <p className="mt-2 text-xs text-graphite">
            Si eliges Google, guardamos el progreso y te devolvemos al checkout correcto.
          </p>
        </div>
      )}

      {error && <p className="mt-3 text-sm font-semibold text-red-700">{error}</p>}
      {notice && <p className="mt-3 text-sm font-semibold text-bleu">{notice}</p>}
    </section>
  );
}
