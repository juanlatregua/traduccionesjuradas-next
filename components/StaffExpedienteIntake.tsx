"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { QUOTE_PDF_LANGS, QUOTE_PDF_LANG_LABELS } from "@/lib/quote-pdf-langs";
import { upload } from "@vercel/blob/client";
import { Loader2, Upload, X, FileText, CheckCircle2, AlertTriangle, Scissors } from "lucide-react";
import { clientPriceFromCost, computeQuoteTotals, PAPER_SHIPPING_BASE_EUR } from "@/lib/quote-math";
import { computeBase } from "@/lib/pricing-engine/calculator";
import { isAutoPriceable, manualPriceReason, resolvePriceablePair } from "@/lib/pricing-engine/languages";
import { lavoriRouteFromPair, lavoriLangFromPair, type LavoriRoute } from "@/lib/lavori-bridge";
import LavoriCandidatePicker, { describeLavoriPick, lavoriPickToCandidatos, useLavoriCartera, type LavoriPick } from "@/components/LavoriCandidatePicker";
import type { EmailBrief } from "@/lib/ai/email-brief";

// Intake de expediente para STAFF: soltar N PDFs → extraer datos con el pipeline
// barato (Haiku/texto o Sonnet/visión) → tabla editable → generar presupuesto.

type DocStatus = "uploading" | "analyzing" | "done" | "error" | "manual" | "split";

// Una línea es facturable (se puede incluir y ponerle precio) si está analizada,
// si dio error (precio a mano), si es una línea manual sin documento, o si es un
// documento detectado dentro de un PDF con varios (split, editable).
function isPriceable(status: DocStatus): boolean {
  return status === "done" || status === "error" || status === "manual" || status === "split";
}

// Convierte un documento de la respuesta del análisis en una fila del builder.
// isSplit = el archivo contenía varios documentos → la fila es editable (split).
function buildDocRow(d: any, mode: "text" | "vision" | undefined, isSplit: boolean): DocRow {
  const range =
    isSplit && d.pageStart
      ? d.pageEnd && d.pageEnd > d.pageStart
        ? ` · págs ${d.pageStart}-${d.pageEnd}`
        : ` · pág ${d.pageStart}`
      : "";
  return {
    localId: uid(),
    fileName: `${d.fileName || ""}${range}`,
    fileSize: 0,
    mimeType: "application/pdf",
    status: isSplit ? "split" : "done",
    include: true,
    documentTypeEs: d.documentTypeEs,
    documentType: d.documentType,
    sourceLang: d.sourceLang,
    sourceName: d.sourceName,
    targetLang: d.targetLang,
    targetName: d.targetName,
    words: d.words,
    pages: d.pages,
    complexity: d.complexity,
    countryCode: d.countryCode ?? undefined,
    hasApostille: d.hasApostille ?? undefined,
    mode,
    unitPrice: Number(d.basePrice) || 0,
    // El precio de esta fila lo gestiona el engine (se re-calcula al cambiar el
    // idioma destino del expediente) hasta que el staff lo edite a mano.
    autoPriced: true,
    priceNote: d.manualPriceReason || undefined,
    minApplied: !!d.minimumApplied,
    minAmount: d.minimumAmount ?? undefined,
    blobUrl: d.fileUrl || undefined,
    pageStart: d.pageStart,
    pageEnd: d.pageEnd,
  };
}

type DocRow = {
  localId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  status: DocStatus;
  error?: string;
  include: boolean;
  // datos extraídos
  documentTypeEs?: string;
  documentType?: string; // specific_type del engine (para re-pricear)
  sourceLang?: string;
  sourceName?: string;
  targetLang?: string;
  targetName?: string;
  words?: number;
  pages?: number;
  complexity?: string;
  countryCode?: string;
  hasApostille?: boolean;
  mode?: "text" | "vision";
  unitPrice: number; // editable, pre-IVA (coste TOTAL de la linea)
  wordRate?: number; // €/palabra de esta linea (modo "palabra"); unitPrice = words × wordRate
  // true = precio gestionado por el engine (se re-calcula al cambiar el idioma
  // destino del expediente); editarlo a mano lo desactiva.
  autoPriced?: boolean;
  // Motivo por el que la línea NO lleva precio automático (falta destino,
  // traducción cruzada, idioma sin tarifa) → "analizar a mano".
  priceNote?: string;
  // El precio viene del SUELO del par (las palabras dan menos): visible para
  // decidir conscientemente en expedientes con varios certificados cortos.
  minApplied?: boolean;
  minAmount?: number;
  // trazabilidad al PDF origen (para ver/descargar cada documento)
  blobUrl?: string;
  pageStart?: number;
  pageEnd?: number;
};

// URL del endpoint que extrae el rango de páginas de un documento para
// verlo/descargarlo como PDF propio.
function docViewUrl(d: DocRow, download = false): string | null {
  if (!d.blobUrl) return null;
  const p = new URLSearchParams({ url: d.blobUrl });
  if (d.pageStart) p.set("start", String(d.pageStart));
  if (d.pageEnd) p.set("end", String(d.pageEnd));
  if (d.documentTypeEs) p.set("name", d.documentTypeEs);
  if (download) p.set("download", "1");
  return `/api/documents/extract-pages?${p.toString()}`;
}

const LANGS: { code: string; name: string }[] = [
  { code: "es", name: "Español" },
  { code: "fr", name: "Francés" },
  { code: "en", name: "Inglés" },
  { code: "de", name: "Alemán" },
  { code: "it", name: "Italiano" },
  { code: "pt", name: "Portugués" },
  { code: "ca", name: "Catalán" },
  { code: "nl", name: "Neerlandés" },
  { code: "sv", name: "Sueco" },
  { code: "no", name: "Noruego" },
  { code: "ar", name: "Árabe" },
  { code: "ro", name: "Rumano" },
  // Lenguas SIN tarifa automática pero con jurados en el tablón de lavori
  // (padrón 24-ago-2026, 28 lenguas): el builder debe poder fijar el par para
  // pedir precio a mano (lavoriManualRoute vale para cualquier lengua con
  // cartera). Caso Yafit 24-ago: el análisis devolvió "he" y knownLangCode lo
  // descartaba → origen "—" y el panel de lavori ni se pintaba, en silencio.
  // ⚠ Mantener alineada con el tablón (GET lavori.es/api/motor/miembros): una
  // lengua nueva allí que falte aquí reproduce el bug.
  { code: "he", name: "Hebreo" },
  { code: "pl", name: "Polaco" },
  { code: "ru", name: "Ruso" },
  { code: "uk", name: "Ucraniano" },
  { code: "bg", name: "Búlgaro" },
  { code: "da", name: "Danés" },
  { code: "el", name: "Griego" },
  { code: "hu", name: "Húngaro" },
  { code: "tr", name: "Turco" },
  { code: "fa", name: "Persa" },
  { code: "fi", name: "Finés" },
  { code: "hr", name: "Croata" },
  { code: "la", name: "Latín" },
  { code: "mk", name: "Macedonio" },
  { code: "sl", name: "Esloveno" },
  { code: "sr", name: "Serbio" },
  { code: "zh", name: "Chino" },
];

const CONCURRENCY = 3;
const ACCEPTED = ".pdf,.jpg,.jpeg,.png,.heic,.tiff,.tif,.webp";

// Solo códigos de idioma reales del selector: el análisis puede devolver
// "unknown" y NUNCA debe entrar en el estado ni en textos cara al cliente.
function knownLangCode(v?: string): string {
  return v && LANGS.some((l) => l.code === v) ? v : "";
}

function langNameOf(code?: string): string {
  return LANGS.find((l) => l.code === code)?.name || "";
}

// Nombre de idioma apto para el cliente: descarta "Unknown"/"Desconocido".
function knownLangName(v?: string): string {
  return v && !/^(unknown|desconocid)/i.test(v.trim()) ? v.trim() : "";
}

function suggestVolumeDiscountPct(count: number): number {
  if (count >= 10) return 15;
  if (count >= 5) return 10;
  if (count >= 3) return 5;
  return 0;
}

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

async function runPool<T>(items: T[], worker: (item: T) => Promise<void>, limit: number) {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      await worker(items[idx]);
    }
  });
  await Promise.all(runners);
}

// Prefill por deep-link (fusion del antiguo QuoteBuilder): cliente, idiomas,
// entrega y una linea suelta. Equivale al QuoteBuilderInitialData de antes.
type StaffIntakeInitialData = {
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  sourceLang?: string;
  targetLang?: string;
  deliveryType?: "DIGITAL_PDF" | "PAPER_SHIP";
  lineDescription?: string;
  lineAmount?: string;
  // Coste del traductor (p. ej. el precio propuesto en lavori): siembra la linea con
  // ese coste y deja el margen en AUTO (a diferencia de lineAmount, que fija el
  // precio de cliente exacto con margen 0).
  lineCost?: string;
};

type Props = {
  // Expediente entrante ya subido por el cliente: se analizan por documentId.
  initialDocs?: { documentId: string; fileName: string; fileUrl?: string }[];
  initialCustomer?: { name?: string; email?: string; phone?: string };
  initialData?: StaffIntakeInitialData;
  expedienteRef?: string | null;
  // Solicitud de precio de lavori de la que nace este presupuesto (lead sin
  // expediente): viaja a /api/quotes para atar quoteId a la solicitud.
  lavoriLeadRef?: string | null;
  // Email de la bandeja del que nace el presupuesto: la IA lo lee (par,
  // urgencia, entrega, documento provisional, notas, preguntas) y prerrellena.
  emailContext?: { id: string; fromName: string | null; fromEmail: string; subject: string } | null;
};

export default function StaffExpedienteIntake({ initialDocs, initialCustomer, initialData, expedienteRef, lavoriLeadRef, emailContext }: Props = {}) {
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [customerName, setCustomerName] = useState(initialCustomer?.name || initialData?.customerName || "");
  const [customerEmail, setCustomerEmail] = useState(initialCustomer?.email || initialData?.customerEmail || "");
  const [customerPhone, setCustomerPhone] = useState(initialCustomer?.phone || initialData?.customerPhone || "");
  const [sourceLang, setSourceLang] = useState(initialData?.sourceLang || "");
  const [targetLang, setTargetLang] = useState(initialData?.targetLang || "");
  const [discountPct, setDiscountPct] = useState(0);
  const [discountTouched, setDiscountTouched] = useState(false);
  const [validityDays, setValidityDays] = useState(15);
  const [notesLegal, setNotesLegal] = useState("");
  const [holderNames, setHolderNames] = useState("");
  // null = margen AUTO (tiered por coste, FR sin margen). Un número = override manual.
  const [marginPct, setMarginPct] = useState<number | null>(initialData?.lineAmount ? 0 : null);
  // Modo de precio del COSTE por línea: "document" = precio fijo por documento
  // (escribes el coste a mano); "word" = por palabra (coste = palabras × tarifa).
  const [priceMode, setPriceMode] = useState<"document" | "word">("document");
  const [wordRate, setWordRate] = useState<number>(0.07);
  // P2: si false, soltar documentos NO lanza el conteo IA (precio a mano / fijo).
  const [autoCount, setAutoCount] = useState(true);
  const [pdfLang, setPdfLang] = useState<string>("es");
  const [deliveryType, setDeliveryType] = useState<"DIGITAL_PDF" | "PAPER_SHIP">(
    initialData?.deliveryType === "PAPER_SHIP" ? "PAPER_SHIP" : "DIGITAL_PDF"
  );
  const [deliveryNote, setDeliveryNote] = useState("");
  const [paymentMethods, setPaymentMethods] = useState<string[]>(["bbva", "openbank", "sabadell", "bizum607"]);
  const [contactWhatsapp, setContactWhatsapp] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Solicitud de precio vía lavori (leads de WhatsApp sin pedido).
  const [lavoriState, setLavoriState] = useState<{ phase: "idle" | "sending" | "done" | "error"; msg?: string }>({ phase: "idle" });
  const [lavoriSpecs, setLavoriSpecs] = useState("");
  const [lavoriPick, setLavoriPick] = useState<LavoriPick>({ mode: "carril" });

  // Lectura IA del email (solo cuando el presupuesto nace de la bandeja).
  const [brief, setBrief] = useState<EmailBrief | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefError, setBriefError] = useState<string | null>(null);
  const [briefCopied, setBriefCopied] = useState(false);
  const briefRunsRef = useRef(0);
  // Nombre-IA: id de la fila cuyo nombre se está sugiriendo (spinner inline).
  const [namingId, setNamingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Agenda de clientes (modelo Customer): elegir uno rellena los campos. Portado
  // del antiguo QuoteBuilder al fusionar ambos builders en este intake.
  type Agenda = {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    companyName: string | null;
    fiscalName: string | null;
    nif: string | null;
  };
  const [agenda, setAgenda] = useState<Agenda[]>([]);
  useEffect(() => {
    fetch("/api/customers")
      .then((r) => r.json())
      .then((d) => {
        if (d?.ok && Array.isArray(d.customers)) setAgenda(d.customers);
      })
      .catch(() => {});
  }, []);

  // Prefill por deep-link (PM, panel de pedido): sembrar una linea manual desde
  // lineDescription/lineAmount, para que el bloque de presupuesto aparezca y el
  // precio especificado no se pierda. Con lineAmount el margen arranca en 0 (el
  // staff especifico el precio exacto; lo persistido = lo indicado).
  useEffect(() => {
    if (initialDocs && initialDocs.length) return; // el camino expediente posee docs
    if (initialData?.lineDescription || initialData?.lineAmount || initialData?.lineCost) {
      const amount = initialData.lineAmount || initialData.lineCost;
      setDocs([
        {
          localId: uid(),
          fileName: initialData.lineDescription || "",
          fileSize: 0,
          mimeType: "",
          status: "manual",
          include: true,
          unitPrice: amount ? Number(String(amount).replace(",", ".")) || 0 : 0,
        },
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const patch = useCallback((localId: string, data: Partial<DocRow>) => {
    setDocs((prev) => prev.map((d) => (d.localId === localId ? { ...d, ...data } : d)));
  }, []);

  // Nombre-IA: llamada barata "solo nombre" (sin contar palabras) para filas que
  // se soltaron sin análisis o cuyo análisis falló. Rellena el nombre editable.
  const suggestName = useCallback(
    async (d: DocRow) => {
      if (!d.blobUrl) return;
      setNamingId(d.localId);
      try {
        const res = await fetch("/api/zona-traductor/expediente/name", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ blobUrl: d.blobUrl, fileName: d.fileName, mimeType: d.mimeType }),
        });
        const data = await res.json();
        if (data.ok && data.name) patch(d.localId, { fileName: data.name, documentTypeEs: data.name });
      } catch {
        /* el staff siempre puede teclearlo a mano */
      } finally {
        setNamingId(null);
      }
    },
    [patch]
  );

  const readEmail = useCallback(
    async (withDocs: DocRow[]) => {
      if (!emailContext) return;
      setBriefLoading(true);
      setBriefError(null);
      try {
        const res = await fetch("/api/zona-traductor/expediente/email-brief", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            inboxId: emailContext.id,
            docs: withDocs
              .filter((d) => d.status === "done" || d.status === "split" || d.status === "manual")
              .map((d) => ({
                fileName: d.fileName,
                documentTypeEs: d.documentTypeEs || null,
                sourceLang: d.sourceLang || null,
                targetLang: d.targetLang || null,
                words: typeof d.words === "number" ? d.words : null,
                pages: typeof d.pages === "number" ? d.pages : null,
              })),
          }),
        });
        const data = await res.json();
        if (!res.ok || !data?.ok) throw new Error(data?.error || "No se pudo leer el email.");
        const b: EmailBrief = data.brief;
        setBrief(b);
        // Prerrellena SOLO lo vacío: el staff manda.
        if (b.sourceLang) setSourceLang((cur) => cur || knownLangCode(b.sourceLang || ""));
        if (b.targetLang) setTargetLang((cur) => cur || knownLangCode(b.targetLang || ""));
        if (b.deliveryHint === "PAPER_SHIP") setDeliveryType("PAPER_SHIP");
        if (b.quoteNotes) setNotesLegal((cur) => cur || b.quoteNotes || "");
      } catch (err: any) {
        setBriefError(err?.message || "No se pudo leer el email.");
      } finally {
        setBriefLoading(false);
      }
    },
    [emailContext]
  );

  // 1ª lectura al abrir (solo email); 2ª cuando los documentos terminan de
  // analizarse (para que vea tipos/palabras y detecte lo que falta).
  useEffect(() => {
    if (!emailContext || briefRunsRef.current > 0) return;
    briefRunsRef.current = 1;
    void readEmail([]);
  }, [emailContext, readEmail]);
  useEffect(() => {
    if (!emailContext || briefRunsRef.current !== 1 || docs.length === 0) return;
    if (docs.some((d) => d.status === "uploading" || d.status === "analyzing")) return;
    briefRunsRef.current = 2;
    void readEmail(docs);
  }, [emailContext, docs, readEmail]);

  const processFile = useCallback(
    async (row: DocRow, file: File) => {
      try {
        const safeName = file.name.replace(/[^\w.\- ]+/g, "_").slice(0, 120);
        const blob = await upload(`expedientes/${Date.now()}-${safeName}`, file, {
          access: "public",
          handleUploadUrl: "/api/documents/upload",
          clientPayload: JSON.stringify({ gdprConsent: true }),
        });

        // Guarda el blobUrl ya: filas con error o sin analizar conservan el "ver".
        patch(row.localId, { status: "analyzing", blobUrl: blob.url });

        // P2: sin conteo automatico → fila editable a mano (sin coste de IA).
        if (!autoCount) {
          patch(row.localId, { status: "manual", blobUrl: blob.url });
          return;
        }

        const res = await fetch("/api/zona-traductor/expediente/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            blobUrl: blob.url,
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type || "application/pdf",
            targetLang: targetLang || undefined,
          }),
        });
        const data = await res.json();
        if (!data.ok) {
          patch(row.localId, { status: "error", error: data.error || "Error al analizar." });
          return;
        }
        // Un PDF puede contener VARIOS documentos (expediente + título…): el
        // análisis devuelve `documents` (1..N). Si hay más de uno, la fila
        // subida se expande en N filas editables.
        const list: any[] = Array.isArray(data.documents) && data.documents.length ? data.documents : [data.document];
        const isSplit = list.length > 1;
        const built = list.map((d) => buildDocRow(d, data.mode, isSplit));
        setDocs((prev) => {
          const idx = prev.findIndex((x) => x.localId === row.localId);
          if (idx === -1) return prev;
          return [...prev.slice(0, idx), ...built, ...prev.slice(idx + 1)];
        });
        // Sugerir dirección global desde el primer documento analizado.
        const first = list[0] || {};
        setSourceLang((cur) => cur || knownLangCode(first.sourceLang));
        setTargetLang((cur) => cur || knownLangCode(first.targetLang));
      } catch (err: any) {
        patch(row.localId, { status: "error", error: "Error de conexión." });
      }
    },
    [patch, targetLang, autoCount]
  );

  const handleFiles = useCallback(
    async (fileList: FileList) => {
      const files = Array.from(fileList);
      if (!files.length) return;
      const rows: DocRow[] = files.map((f) => ({
        localId: uid(),
        fileName: f.name,
        fileSize: f.size,
        mimeType: f.type,
        status: "uploading",
        include: true,
        unitPrice: 0,
      }));
      setDocs((prev) => [...prev, ...rows]);
      if (!discountTouched) {
        setDiscountPct(suggestVolumeDiscountPct(docs.length + rows.length));
      }
      const pairs = rows.map((row, i) => ({ row, file: files[i] }));
      await runPool(pairs, ({ row, file }) => processFile(row, file), CONCURRENCY);
      // Re-sugerir descuento por volumen con los documentos finalizados.
      if (!discountTouched) {
        setDocs((cur) => {
          const includedDone = cur.filter((d) => d.include && (d.status === "done" || d.status === "split")).length;
          setDiscountPct(suggestVolumeDiscountPct(includedDone));
          return cur;
        });
      }
    },
    [docs.length, discountTouched, processFile]
  );

  // Preload: expediente entrante ya subido por el cliente → analizar por id.
  useEffect(() => {
    if (!initialDocs || initialDocs.length === 0) return;
    setDocs(
      initialDocs.map((d) => ({
        localId: d.documentId,
        fileName: d.fileName,
        blobUrl: d.fileUrl,
        fileSize: 0,
        mimeType: "application/pdf",
        status: "analyzing" as DocStatus,
        include: true,
        unitPrice: 0,
      }))
    );
    const analyzeExisting = async (d: { documentId: string }) => {
      try {
        const res = await fetch("/api/zona-traductor/expediente/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentId: d.documentId }),
        });
        const data = await res.json();
        if (!data.ok) {
          patch(d.documentId, { status: "error", error: data.error || "Error al analizar." });
          return;
        }
        const list: any[] = Array.isArray(data.documents) && data.documents.length ? data.documents : [data.document];
        const isSplit = list.length > 1;
        const built = list.map((doc) => buildDocRow(doc, data.mode, isSplit));
        setDocs((prev) => {
          const idx = prev.findIndex((x) => x.localId === d.documentId);
          if (idx === -1) return prev;
          return [...prev.slice(0, idx), ...built, ...prev.slice(idx + 1)];
        });
        const first = list[0] || {};
        setSourceLang((cur) => cur || knownLangCode(first.sourceLang));
        setTargetLang((cur) => cur || knownLangCode(first.targetLang));
      } catch {
        patch(d.documentId, { status: "error", error: "Error de conexión." });
      }
    };
    runPool(initialDocs, analyzeExisting, CONCURRENCY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addManualLine = useCallback(() => {
    setDocs((prev) => [
      ...prev,
      {
        localId: uid(),
        fileName: "",
        fileSize: 0,
        mimeType: "",
        status: "manual" as DocStatus,
        include: true,
        unitPrice: 0,
      },
    ]);
  }, []);

  // Separa una fila multipágina en UNA LÍNEA POR PÁGINA. Útil cuando un rango
  // (p. ej. el placeholder escaneado de págs 4-5) contiene 2 documentos: cada
  // página queda como su propio documento editable y con su propio "ver PDF".
  const splitRowByPages = useCallback((localId: string) => {
    setDocs((prev) => {
      const idx = prev.findIndex((x) => x.localId === localId);
      if (idx === -1) return prev;
      const d = prev[idx];
      const start = d.pageStart || 1;
      const end = d.pageEnd || start;
      if (end <= start) return prev;
      const baseName = (d.fileName || "documento").replace(/ · págs? .*$/, "");
      const rows: DocRow[] = [];
      for (let pg = start; pg <= end; pg += 1) {
        rows.push({
          ...d,
          localId: uid(),
          status: "split",
          fileName: `${baseName} · pág ${pg}`,
          pageStart: pg,
          pageEnd: pg,
          words: undefined,
          unitPrice: 0,
        });
      }
      return [...prev.slice(0, idx), ...rows, ...prev.slice(idx + 1)];
    });
  }, []);

  // Aplica la tarifa por palabra a las líneas con palabras: coste = palabras ×
  // tarifa. No toca líneas sin palabras (escaneados sin contar, manuales).
  const applyWordRate = useCallback(() => {
    setDocs((prev) =>
      prev.map((d) =>
        isPriceable(d.status) && d.words && d.words > 0
          ? { ...d, wordRate, unitPrice: Math.round(d.words * (wordRate || 0) * 100) / 100, autoPriced: false, priceNote: undefined }
          : d
      )
    );
  }, [wordRate]);

  // Re-precio al cambiar el idioma destino del expediente: las filas cuyo
  // precio gestiona el engine (autoPriced) se recalculan con computeBase —
  // misma fórmula que el análisis del servidor. Sin par válido (original ES
  // sin destino, cruzada, idioma sin tarifa) la fila queda SIN precio y con
  // nota "a mano". Las editadas a mano no se tocan. Corre también al LLEGAR
  // filas (deps: docs): si el destino ya estaba fijado antes de subir el PDF
  // y el análisis vino sin destino, la fila se re-precia aquí en vez de quedar
  // "a mano" con el par a la vista (caso Ana Suárez 22-ago, ES→EN sin precio).
  useEffect(() => {
    setDocs((prev) => {
      const next = prev.map((d) => {
        if (!d.autoPriced || !isPriceable(d.status) || d.status === "manual" || !d.sourceLang) return d;
        // Destino efectivo: el del expediente; "" = Auto (al español).
        const foreign = resolvePriceablePair(d.sourceLang, targetLang || "es");
        if (!foreign || !isAutoPriceable(foreign)) {
          const note = manualPriceReason(d.sourceLang, foreign);
          return d.unitPrice === 0 && d.priceNote === note ? d : { ...d, unitPrice: 0, priceNote: note };
        }
        if (!d.documentType || !d.words) return d; // sin métricas no se recalcula
        const r = computeBase({
          specificType: d.documentType,
          foreignLang: foreign,
          words: d.words,
          pages: d.pages || 1,
          complexity: d.complexity,
          countryCode: d.countryCode,
          hasApostille: d.hasApostille,
        });
        const base = Math.round(r.basePrice * 100) / 100;
        const minApplied = !r.fixedPriceApplied && r.wordPrice < r.minimum;
        // Las filas es→X siguen el destino del expediente: refresca también su
        // dirección para que la descripción cara al cliente cuadre con el precio.
        const tgtPatch =
          d.sourceLang === "es" && targetLang
            ? { targetLang, targetName: langNameOf(targetLang) || undefined }
            : {};
        const unchanged =
          d.unitPrice === base &&
          !d.priceNote &&
          d.minApplied === minApplied &&
          (!("targetLang" in tgtPatch) || d.targetLang === targetLang);
        return unchanged
          ? d
          : { ...d, ...tgtPatch, unitPrice: base, priceNote: undefined, minApplied, minAmount: r.minimum };
      });
      // Misma referencia si nada cambió: evita el bucle setDocs → docs → effect.
      return next.every((row, i) => row === prev[i]) ? prev : next;
    });
  }, [targetLang, docs]);

  // El campo editable de cada línea es el COSTE del traductor (sin IVA).
  // El precio al cliente se deriva aplicando el margen.
  const clientPriceOf = useCallback(
    (cost: number) =>
      marginPct === null
        ? clientPriceFromCost(cost || 0, `${sourceLang}-${targetLang}`)
        : Math.round((cost || 0) * (1 + marginPct / 100) * 100) / 100,
    [marginPct, sourceLang, targetLang]
  );

  const togglePaymentMethod = useCallback((m: string) => {
    setPaymentMethods((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
  }, []);

  const includedDocs = docs.filter((d) => d.include && isPriceable(d.status));
  const costTotal = useMemo(
    () => includedDocs.reduce((s, d) => s + (d.unitPrice || 0), 0),
    [includedDocs]
  );
  // Totales en vivo con la MISMA funcion que el servidor (computeQuoteTotals) →
  // la UI nunca diverge del precio que se persiste en /api/quotes.
  const quoteTotals = useMemo(
    () =>
      computeQuoteTotals({
        lines: includedDocs.map((d) => ({
          description: d.documentTypeEs || d.fileName || "Linea",
          quantity: 1,
          unitPrice: clientPriceOf(d.unitPrice),
        })),
        discountType: discountPct > 0 ? "PERCENT" : "NONE",
        discountValue: discountPct,
        vatRate: 0.21,
        deliveryType,
        shippingBase: PAPER_SHIPPING_BASE_EUR,
      }),
    [includedDocs, clientPriceOf, discountPct, deliveryType]
  );
  const subtotal = quoteTotals.subtotal;
  const shipping = quoteTotals.shippingAmount;
  const discountAmount = quoteTotals.discountAmount;
  const vat = quoteTotals.vatAmount;
  const total = quoteTotals.total;

  const busy = docs.some((d) => d.status === "uploading" || d.status === "analyzing");
  const hasEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail);
  const hasPhone = customerPhone.trim().length >= 6;
  const missing: string[] = [];
  if (includedDocs.length === 0) missing.push("una línea con precio");
  if (!customerName.trim()) missing.push("nombre del cliente");
  if (!hasEmail && !hasPhone) missing.push("email o teléfono del cliente");
  if (!sourceLang) missing.push("idioma origen");
  if (!targetLang) missing.push("idioma destino");
  const canSubmit = !submitting && !busy && missing.length === 0;

  // ── Solicitar PRECIO vía lavori (lead de WhatsApp, sin pedido) ──
  // Docs con archivo real (las líneas manuales sin documento no viajan).
  const lavoriDocs = useMemo(
    () => docs.filter((d) => d.include && d.blobUrl && isPriceable(d.status)),
    [docs]
  );
  // Carril fijo si existe; si no, la lengua con cartera en el tablón (cualquier
  // jurada no francesa) — la cartera viva decide si hay a quién enviar.
  const lavoriPair = useMemo(() => {
    const src = sourceLang || "";
    const tgt = targetLang || "es";
    if (!src || src === tgt) return null;
    if (src !== "es" && tgt !== "es") return null; // cruzada: a medida, no lavori
    return `${src}->${tgt}`;
  }, [sourceLang, targetLang]);
  const lavoriFixed = useMemo(() => lavoriRouteFromPair(lavoriPair), [lavoriPair]);
  const lavoriLang = useMemo(() => lavoriLangFromPair(lavoriPair), [lavoriPair]);
  const lavoriCartera = useLavoriCartera(lavoriLang && lavoriLang.lang !== "fr" ? lavoriLang.lang : null);
  const lavoriRoute = useMemo<LavoriRoute | null>(
    () =>
      lavoriFixed ||
      (lavoriLang && lavoriLang.lang !== "fr" && lavoriCartera.miembros.length > 0
        ? { ...lavoriLang, candidatos: [] }
        : null),
    [lavoriFixed, lavoriLang, lavoriCartera.miembros.length]
  );
  useEffect(() => {
    setLavoriPick(lavoriFixed ? { mode: "carril" } : { mode: "todos" });
  }, [lavoriFixed]);

  const sendLavoriPrice = useCallback(async () => {
    if (!lavoriRoute || lavoriDocs.length === 0) return;
    const candidatos = lavoriPickToCandidatos(lavoriPick, lavoriCartera.miembros);
    if ((lavoriPick.mode === "uno" || lavoriPick.mode === "todos") && (!candidatos || candidatos.length === 0)) {
      setLavoriState({ phase: "error", msg: "Elige el jurado al que enviar la solicitud." });
      return;
    }
    setLavoriState({ phase: "sending" });
    try {
      const res = await fetch("/api/lavori/price-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          docs: lavoriDocs.map((d) => ({
            url: d.blobUrl,
            // Nombre neutro (tipo documental); el fichero original del cliente
            // puede llevar su nombre y no debe viajar.
            name: d.documentTypeEs || undefined,
            pageStart: d.pageStart,
            pageEnd: d.pageEnd,
          })),
          sourceLang: sourceLang || "es",
          targetLang: targetLang || "es",
          words: lavoriDocs.reduce((acc, d) => acc + (d.words || 0), 0) || undefined,
          expedienteRef: expedienteRef || undefined,
          customerHint:
            [customerName.trim(), customerPhone.trim()].filter(Boolean).join(" · ") || undefined,
          customerPhone: customerPhone.trim() || undefined,
          customerEmail: customerEmail.trim() || undefined,
          customerName: customerName.trim() || undefined,
          especificaciones: lavoriSpecs.trim() || undefined,
          ...(candidatos ? { candidatos } : {}),
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setLavoriState({ phase: "error", msg: data.error || "No se pudo enviar la solicitud." });
        return;
      }
      const aQuien = describeLavoriPick(lavoriPick, lavoriRoute, lavoriCartera.miembros);
      const hora = new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
      setLavoriState({
        phase: "done",
        msg: data.repetido
          ? `Esta solicitud ya estaba enviada a ${aQuien} (no se ha duplicado).`
          : `✓ Enviada a ${aQuien} · ${hora}. Cuando el traductor pase su precio te llegará por email con el enlace a este builder.`,
      });
    } catch {
      setLavoriState({ phase: "error", msg: "Error de conexión." });
    }
  }, [lavoriRoute, lavoriDocs, sourceLang, targetLang, expedienteRef, customerName, customerPhone, customerEmail, lavoriSpecs, lavoriPick, lavoriCartera.miembros]);

  const handleSubmit = useCallback(async () => {
    setSubmitError(null);
    setSubmitting(true);
    try {
      const lines = includedDocs.map((d) => {
        // Sin tipo documental cae al nombre del fichero: al menos sin extensión.
        const baseName = d.documentTypeEs || d.fileName.trim().replace(/\.(pdf|jpe?g|png|heic|docx?)$/i, "") || "Línea";
        // Dirección cara al cliente: NUNCA "Desconocido"/"Unknown" (presupuesto
        // 2026-00045) — si el análisis no supo el destino, manda el del
        // presupuesto; sin dato fiable, se omite la dirección.
        const dirSrc = knownLangName(d.sourceName) || langNameOf(knownLangCode(d.sourceLang)) || langNameOf(sourceLang);
        const dirTgt =
          knownLangName(d.targetName) ||
          langNameOf(knownLangCode(d.targetLang)) ||
          langNameOf(targetLang) ||
          // Original extranjero sin destino explícito → hacia el español.
          (knownLangCode(d.sourceLang) && d.sourceLang !== "es" ? "Español" : "");
        const parts: string[] = [];
        if (dirSrc && dirTgt) parts.push(`${dirSrc}→${dirTgt}`);
        if (d.words) parts.push(`${d.words} palabras`);
        if (d.pages && d.pages > 1) parts.push(`${d.pages} págs`);
        return {
          description: parts.length ? `${baseName} (${parts.join(", ")})` : baseName,
          quantity: 1,
          unitPrice: clientPriceOf(d.unitPrice), // precio CLIENTE = coste × (1+margen)
          supplierUnitCost: d.unitPrice, // coste del traductor (interno)
          sourceFileUrl: d.blobUrl, // PDF origen (para ver/descargar el documento)
          pageStart: d.pageStart,
          pageEnd: d.pageEnd,
        };
      });
      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: customerName.trim(),
          customerEmail: customerEmail.trim(),
          customerPhone: customerPhone.trim() || undefined,
          sourceLang,
          targetLang,
          deliveryType,
          expedienteRef: expedienteRef || undefined,
          lavoriLeadRef: lavoriLeadRef || undefined,
          pdfLang,
          discountType: discountPct > 0 ? "PERCENT" : "NONE",
          discountValue: discountPct,
          vatRate: 0.21,
          validityDays,
          notesLegal: [deliveryNote.trim() ? `Plazo de entrega: ${deliveryNote.trim()}.` : "", notesLegal.trim()].filter(Boolean).join(" ") || undefined,
          holderNames: holderNames.trim() || undefined,
          marginPct: marginPct ?? undefined,
          paymentMethods,
          contactWhatsapp: contactWhatsapp.trim() || undefined,
          lines,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setSubmitError(data.error || "No se pudo crear el presupuesto.");
        setSubmitting(false);
        return;
      }
      window.location.href = `/admin/quotes/${data.quote.id}`;
    } catch {
      setSubmitError("Error de conexión al crear el presupuesto.");
      setSubmitting(false);
    }
  }, [includedDocs, customerName, customerEmail, customerPhone, sourceLang, targetLang, discountPct, validityDays, notesLegal, holderNames, expedienteRef, lavoriLeadRef, clientPriceOf, marginPct, paymentMethods, contactWhatsapp, deliveryType, deliveryNote, pdfLang]);

  return (
    <div className="space-y-6 text-slate-200">
      {/* Cliente ARRIBA: confirma QUIÉN antes de subir documentos / cotizar.
          (Selector de agenda + datos; el builder unificado funciona sin docs.) */}
      <div className="space-y-3 rounded-xl border border-slate-700 bg-slate-900/40 p-4">
        <h3 className="text-sm font-semibold text-white">Cliente</h3>
        {agenda.length > 0 && (
          <select
            className="w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-slate-200"
            defaultValue=""
            onChange={(e) => {
              const c = agenda.find((x) => x.id === e.target.value);
              if (!c) return;
              setCustomerName(c.companyName || c.name || "");
              setCustomerEmail((c.email || "").toLowerCase());
              setCustomerPhone(c.phone || "");
            }}
          >
            <option value="">— Elegir cliente de la agenda (o teclear abajo) —</option>
            {agenda.map((c) => (
              <option key={c.id} value={c.id}>
                {c.companyName || c.name}
                {c.nif ? ` · ${c.nif}` : ""}
                {c.email ? ` · ${c.email}` : ""}
              </option>
            ))}
          </select>
        )}
        <div className="grid gap-2 sm:grid-cols-3">
          <input className="w-full rounded border border-slate-600 bg-slate-900 px-3 py-2" placeholder="Nombre del cliente" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          <input className="w-full rounded border border-slate-600 bg-slate-900 px-3 py-2" placeholder="Email" type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
          <input className="w-full rounded border border-slate-600 bg-slate-900 px-3 py-2" placeholder="Teléfono (opcional)" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
        </div>
        <input
          className="mt-2 w-full rounded border border-slate-600 bg-slate-900 px-3 py-2"
          placeholder="Titulares de los certificados (opcional, p. ej. María García, Juan Pérez)"
          value={holderNames}
          onChange={(e) => setHolderNames(e.target.value)}
        />
      </div>

      {emailContext && (
        <div className="space-y-3 rounded-xl border border-sky-500/30 bg-sky-500/5 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-sky-200">Lectura del email (IA)</h3>
            {briefLoading && <Loader2 className="h-4 w-4 animate-spin text-sky-300" />}
            <button
              type="button"
              onClick={() => void readEmail(docs)}
              disabled={briefLoading}
              className="ml-auto rounded border border-sky-500/40 px-2 py-1 text-xs text-sky-200 hover:bg-sky-500/10 disabled:opacity-50"
            >
              Releer con los documentos
            </button>
          </div>
          {briefError && <p className="text-xs text-amber-300">✗ {briefError}</p>}
          {!brief && !briefError && briefLoading && (
            <p className="text-xs text-sky-200/80">Leyendo qué pide el cliente…</p>
          )}
          {brief && (
            <div className="space-y-2 text-sm">
              <p className="text-sky-50">{brief.summary}</p>
              <div className="flex flex-wrap gap-1.5 text-xs">
                {(brief.sourceLang || brief.targetLang) && (
                  <span className="rounded bg-slate-800 px-2 py-0.5 text-slate-200">
                    Par: {(brief.sourceLang || "?").toUpperCase()} → {(brief.targetLang || "?").toUpperCase()}
                  </span>
                )}
                {brief.urgency && (
                  <span className={`rounded px-2 py-0.5 ${brief.urgency === "urgent" ? "bg-amber-500/20 text-amber-200" : "bg-slate-800 text-slate-200"}`}>
                    {brief.urgency === "urgent" ? "Urgente" : "Plazo normal"}{brief.deadline ? ` · ${brief.deadline}` : ""}
                  </span>
                )}
                {brief.deliveryHint && (
                  <span className="rounded bg-slate-800 px-2 py-0.5 text-slate-200">
                    {brief.deliveryHint === "PAPER_SHIP" ? "Pide papel" : "Pide PDF"}
                  </span>
                )}
                {brief.provisional && (
                  <span className="rounded bg-rose-500/20 px-2 py-0.5 font-semibold text-rose-200">
                    Documento provisional / incompleto
                  </span>
                )}
              </div>
              {brief.provisional && brief.provisionalReason && (
                <p className="text-xs text-rose-200/90">{brief.provisionalReason}</p>
              )}
              {brief.quoteNotes && (
                <p className="text-xs text-sky-200/80">
                  Nota añadida al presupuesto (editable abajo en «Notas legales»): <em>{brief.quoteNotes}</em>
                </p>
              )}
              {brief.questions.length > 0 && (
                <div className="rounded-lg border border-sky-500/20 bg-slate-900/50 p-3">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-sky-300">Preguntas al cliente</p>
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard?.writeText(brief.questions.map((q) => `- ${q}`).join("\n"));
                        setBriefCopied(true);
                        setTimeout(() => setBriefCopied(false), 1500);
                      }}
                      className="ml-auto rounded border border-slate-600 px-2 py-0.5 text-[11px] text-slate-300 hover:bg-slate-800"
                    >
                      {briefCopied ? "Copiadas ✓" : "Copiar"}
                    </button>
                  </div>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-slate-200">
                    {brief.questions.map((q, i) => (
                      <li key={i}>{q}</li>
                    ))}
                  </ul>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Pégalas en la instrucción del borrador IA de la bandeja o en el email del presupuesto.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Idioma destino del expediente — elígelo ANTES de subir si traduces a
          un tercer idioma (p. ej. todo a inglés). Pre-rellena la dirección de
          cada documento detectado hacia ese idioma. */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/40 px-4 py-3">
        <label className="text-sm font-medium text-slate-200">Idioma destino del expediente</label>
        <select
          value={targetLang}
          onChange={(e) => setTargetLang(e.target.value)}
          className="rounded border border-slate-600 bg-slate-900 px-2 py-1.5 text-sm text-slate-200"
        >
          <option value="">Auto (al español)</option>
          {LANGS.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
        </select>
        <span className="text-xs text-slate-500">Elígelo antes de subir si traduces a un tercer idioma (p. ej. todo a inglés). El precio final lo confirmas tú.</span>
        {docs.some((d) => d.priceNote) && (
          <span className="flex w-full items-center gap-1 text-xs text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            Hay líneas sin precio automático (falta destino o par sin español): elige aquí el idioma de destino para recalcular, o pon el precio a mano.
          </span>
        )}
      </div>

      {/* P2: elegir si el conteo IA se lanza al soltar (tiene coste) o se pone a mano */}
      <label className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/40 px-4 py-3 text-sm text-slate-200">
        <input
          type="checkbox"
          checked={autoCount}
          onChange={(e) => setAutoCount(e.target.checked)}
          className="h-4 w-4"
        />
        <span className="font-medium">Contar palabras automáticamente al soltar (IA)</span>
        <span className="text-xs text-slate-500">
          El conteo automático usa IA y tiene coste. Desactívalo para clientes con precio fijo por documento
          (p. ej. 30 €/doc): subes el archivo y pones el precio a mano, sin lanzar el conteo.
        </span>
      </label>

      {/* Dropzone */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-cyan-700/50 bg-slate-900/50 px-6 py-10 transition-colors hover:border-cyan-500"
        role="button"
        tabIndex={0}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-cyan-500/10">
          <Upload className="h-6 w-6 text-cyan-400" />
        </div>
        <p className="font-semibold text-white">Arrastra los documentos del expediente</p>
        <p className="text-sm text-slate-400">PDF, foto o escaneo · varios a la vez · máx. 20 MB c/u</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED}
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {/* Añadir una línea a mano (sin documento) */}
      <div>
        <button
          type="button"
          onClick={addManualLine}
          className="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
        >
          + Añadir línea manual
        </button>
        <span className="ml-2 text-xs text-slate-500">Para presupuestar sin subir documento, o añadir conceptos sueltos.</span>
      </div>

      {/* Tabla de documentos */}
      {docs.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-700">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/60 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-3 py-2"></th>
                <th className="px-3 py-2">Documento</th>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">Dirección</th>
                <th className="px-3 py-2 text-right">Palabras</th>
                {priceMode === "word" && <th className="px-3 py-2 text-right">€/palabra</th>}
                <th className="px-3 py-2 text-right">{priceMode === "word" ? "Total coste" : "Coste fijo"}</th>
                <th className="px-3 py-2 text-right">Precio cliente</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {docs.map((d) => (
                <tr key={d.localId} className={d.include ? "" : "opacity-40"}>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={d.include}
                      disabled={d.status === "uploading" || d.status === "analyzing"}
                      onChange={(e) => patch(d.localId, { include: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-600"
                    />
                  </td>
                  <td className="max-w-[220px] px-3 py-2">
                    {d.status === "manual" || d.status === "error" ? (
                      <div>
                        <input
                          type="text"
                          value={d.fileName}
                          onChange={(e) => patch(d.localId, { fileName: e.target.value })}
                          placeholder={d.status === "error" ? "Nombre / concepto del documento" : "Concepto de la línea"}
                          className="w-full rounded border border-slate-600 bg-slate-900 px-2 py-1 text-sm"
                        />
                        {d.blobUrl && (
                          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px]">
                            <a href={docViewUrl(d)!} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">ver</a>
                            <span className="text-slate-600">·</span>
                            <a href={docViewUrl(d, true)!} className="text-cyan-400 hover:underline">descargar</a>
                            <span className="text-slate-600">·</span>
                            <button
                              type="button"
                              onClick={() => suggestName(d)}
                              disabled={namingId === d.localId}
                              className="text-cyan-400 hover:underline disabled:opacity-50"
                              title="Sugerir el tipo de documento con IA (no cuenta palabras)"
                            >
                              {namingId === d.localId ? "nombrando…" : "sugerir nombre (IA)"}
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 shrink-0 text-slate-500" />
                          <span className="truncate" title={d.fileName}>{d.fileName}</span>
                        </div>
                        {d.blobUrl && (
                          <div className="ml-6 mt-0.5 flex items-center gap-2 text-[11px]">
                            <a href={docViewUrl(d)!} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">ver</a>
                            <span className="text-slate-600">·</span>
                            <a href={docViewUrl(d, true)!} className="text-cyan-400 hover:underline">descargar</a>
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {d.status === "uploading" && (
                      <span className="flex items-center gap-1 text-slate-400"><Loader2 className="h-3 w-3 animate-spin" /> Subiendo…</span>
                    )}
                    {d.status === "analyzing" && (
                      <span className="flex items-center gap-1 text-cyan-400"><Loader2 className="h-3 w-3 animate-spin" /> Analizando…</span>
                    )}
                    {d.status === "error" && (
                      <span className="flex items-center gap-1 text-amber-400" title={d.error}><AlertTriangle className="h-3 w-3" /> Error · precio a mano</span>
                    )}
                    {d.status === "manual" && (
                      <span className="text-slate-400">Línea manual</span>
                    )}
                    {d.status === "done" && (
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                        {d.documentTypeEs}
                        {d.mode === "text" && (
                          <span className="ml-1 rounded bg-emerald-500/15 px-1 text-[10px] text-emerald-300" title="Analizado por texto (barato)">texto</span>
                        )}
                        {d.priceNote ? (
                          <span className="ml-1 flex items-center gap-0.5 rounded bg-amber-500/15 px-1 text-[10px] text-amber-300" title={`${d.priceNote} — sin precio automático: fija el destino del expediente o pon el precio a mano`}>
                            <AlertTriangle className="h-3 w-3" /> a mano: {d.priceNote}
                          </span>
                        ) : (
                          knownLangCode(d.targetLang) && d.targetLang !== "es" && (
                            <span className="ml-1 rounded bg-amber-500/15 px-1 text-[10px] text-amber-300" title="Destino no-español: revisa y ajusta el precio (suele ser algo más alto)">revisa precio</span>
                          )
                        )}
                        {!d.priceNote && d.autoPriced !== false && d.minApplied && (
                          <span className="ml-1 rounded bg-sky-500/15 px-1 text-[10px] text-sky-300" title={`El precio viene del mínimo del par${d.minAmount ? ` (${d.minAmount} €)` : ""}, no de las palabras — en expedientes con varios certificados cortos cada doc suma su mínimo: bájalo a mano si lo ves justo`}>mínimo aplicado</span>
                        )}
                      </span>
                    )}
                    {d.status === "split" && (
                      <div className="space-y-1">
                        <input
                          type="text"
                          value={d.documentTypeEs || ""}
                          onChange={(e) => patch(d.localId, { documentTypeEs: e.target.value })}
                          placeholder="Concepto / tipo"
                          className="w-full rounded border border-slate-600 bg-slate-900 px-2 py-1 text-xs"
                        />
                        <div className="flex flex-wrap items-center gap-1">
                          <span className="rounded bg-cyan-500/15 px-1 text-[10px] text-cyan-300" title="Documento detectado dentro de un PDF con varios — revisa y ajusta">auto · varios</span>
                          {d.priceNote ? (
                            <span className="rounded bg-amber-500/15 px-1 text-[10px] text-amber-300" title={`${d.priceNote} — sin precio automático: fija el destino del expediente o pon el precio a mano`}>a mano: {d.priceNote}</span>
                          ) : (
                            knownLangCode(d.targetLang) && d.targetLang !== "es" && (
                              <span className="rounded bg-amber-500/15 px-1 text-[10px] text-amber-300" title="Destino no-español: revisa y ajusta el precio">revisa precio</span>
                            )
                          )}
                          {!d.priceNote && d.autoPriced !== false && d.minApplied && (
                            <span className="rounded bg-sky-500/15 px-1 text-[10px] text-sky-300" title={`El precio viene del mínimo del par${d.minAmount ? ` (${d.minAmount} €)` : ""}, no de las palabras — bájalo a mano si lo ves justo`}>mínimo aplicado</span>
                          )}
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-slate-300">
                    {d.status === "done" ? (
                      `${(knownLangCode(d.sourceLang) || sourceLang || "?").toUpperCase()}→${(knownLangCode(d.targetLang) || targetLang || "?").toUpperCase()}`
                    ) : d.status === "error" || d.status === "manual" || d.status === "split" ? (
                      <div className="flex items-center gap-1">
                        <select
                          value={d.sourceLang || ""}
                          onChange={(e) => patch(d.localId, { sourceLang: e.target.value || undefined })}
                          className="rounded border border-slate-600 bg-slate-900 px-1 py-1 text-xs"
                        >
                          <option value="">orig</option>
                          {LANGS.map((l) => <option key={l.code} value={l.code}>{l.code.toUpperCase()}</option>)}
                        </select>
                        <span>→</span>
                        <select
                          value={d.targetLang || ""}
                          onChange={(e) => patch(d.localId, { targetLang: e.target.value || undefined })}
                          className="rounded border border-slate-600 bg-slate-900 px-1 py-1 text-xs"
                        >
                          <option value="">dest</option>
                          {LANGS.map((l) => <option key={l.code} value={l.code}>{l.code.toUpperCase()}</option>)}
                        </select>
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-300">
                    {d.status === "done" ? (
                      d.words ?? "—"
                    ) : d.status === "error" || d.status === "manual" || d.status === "split" ? (
                      <input
                        type="number"
                        min={0}
                        value={d.words ?? ""}
                        onChange={(e) => {
                          const w = e.target.value === "" ? undefined : Number(e.target.value);
                          patch(
                            d.localId,
                            priceMode === "word"
                              ? { words: w, unitPrice: Math.round((w || 0) * (d.wordRate ?? wordRate) * 100) / 100, autoPriced: false, priceNote: undefined }
                              : { words: w }
                          );
                        }}
                        placeholder="palabras"
                        className="w-20 rounded border border-slate-600 bg-slate-900 px-2 py-1 text-right tabular-nums"
                      />
                    ) : (
                      "—"
                    )}
                  </td>
                  {priceMode === "word" && (
                    <td className="px-3 py-2 text-right">
                      {isPriceable(d.status) ? (
                        <input
                          type="number"
                          min={0}
                          step="0.001"
                          value={d.wordRate ?? wordRate}
                          onChange={(e) => {
                            const r = Math.max(0, Number(e.target.value));
                            patch(d.localId, { wordRate: r, unitPrice: Math.round((d.words || 0) * r * 100) / 100, autoPriced: false, priceNote: undefined });
                          }}
                          className="w-20 rounded border border-slate-600 bg-slate-900 px-2 py-1 text-right tabular-nums"
                          title="€ por palabra (coste del traductor) de esta línea"
                        />
                      ) : (
                        "—"
                      )}
                    </td>
                  )}
                  <td className="px-3 py-2 text-right">
                    {isPriceable(d.status) ? (
                      priceMode === "word" ? (
                        <span className="tabular-nums text-slate-300">{(d.unitPrice || 0).toFixed(2)} €</span>
                      ) : (
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={d.unitPrice}
                          onChange={(e) => patch(d.localId, { unitPrice: Number(e.target.value), autoPriced: false, priceNote: undefined })}
                          className="w-24 rounded border border-slate-600 bg-slate-900 px-2 py-1 text-right tabular-nums"
                        />
                      )
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold text-white">
                    {isPriceable(d.status) ? `${clientPriceOf(d.unitPrice).toFixed(2)} €` : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1">
                      {d.blobUrl && d.pageStart != null && d.pageEnd != null && d.pageEnd > d.pageStart && (
                        <button
                          type="button"
                          onClick={() => splitRowByPages(d.localId)}
                          title="Separar en una línea por página (p. ej. 2 certificados en 2 páginas)"
                          className="rounded p-1 text-cyan-400 hover:bg-slate-800"
                          aria-label="Dividir por páginas"
                        >
                          <Scissors className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setDocs((prev) => prev.filter((x) => x.localId !== d.localId))}
                        className="rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-300"
                        aria-label="Quitar"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Configuración del presupuesto (al haber líneas; el Cliente va arriba). */}
      {docs.length > 0 && (
          <div className="space-y-3 rounded-xl border border-slate-700 bg-slate-900/40 p-4">
            <h3 className="text-sm font-semibold text-white">Presupuesto</h3>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-slate-400">
                Idioma origen
                <select className="mt-1 w-full rounded border border-slate-600 bg-slate-900 px-2 py-2 text-slate-200" value={sourceLang} onChange={(e) => setSourceLang(e.target.value)}>
                  <option value="">—</option>
                  {LANGS.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
                </select>
              </label>
              <label className="text-xs text-slate-400">
                Idioma destino
                <select className="mt-1 w-full rounded border border-slate-600 bg-slate-900 px-2 py-2 text-slate-200" value={targetLang} onChange={(e) => setTargetLang(e.target.value)}>
                  <option value="">—</option>
                  {LANGS.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
                </select>
              </label>
              <label className="text-xs text-slate-400">
                Descuento volumen (%)
                <input type="number" min={0} max={100} value={discountPct} onChange={(e) => { setDiscountTouched(true); setDiscountPct(Number(e.target.value)); }} className="mt-1 w-full rounded border border-slate-600 bg-slate-900 px-2 py-2" />
              </label>
              <label className="text-xs text-slate-400">
                Validez (días)
                <input type="number" min={1} value={validityDays} onChange={(e) => setValidityDays(Number(e.target.value))} className="mt-1 w-full rounded border border-slate-600 bg-slate-900 px-2 py-2" />
              </label>
              <label className="text-xs text-slate-400">
                Tipo de entrega
                <select value={deliveryType} onChange={(e) => setDeliveryType(e.target.value as "DIGITAL_PDF" | "PAPER_SHIP")} className="mt-1 w-full rounded border border-slate-600 bg-slate-900 px-2 py-2 text-slate-200">
                  <option value="DIGITAL_PDF">PDF con certificado digital</option>
                  <option value="PAPER_SHIP">Envío en papel (+12 € + IVA)</option>
                </select>
              </label>
              <label className="text-xs text-slate-400">
                Idioma del PDF
                <select value={pdfLang} onChange={(e) => setPdfLang(e.target.value)} className="mt-1 w-full rounded border border-slate-600 bg-slate-900 px-2 py-2 text-slate-200">
                  {QUOTE_PDF_LANGS.map((l) => (
                    <option key={l} value={l}>{QUOTE_PDF_LANG_LABELS[l]}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-slate-400">
                Plazo de entrega
                <input value={deliveryNote} onChange={(e) => setDeliveryNote(e.target.value)} placeholder="ej. 3-4 días hábiles" className="mt-1 w-full rounded border border-slate-600 bg-slate-900 px-2 py-2" />
              </label>
            </div>
            {sourceLang && targetLang && docs.some((d) => (d.status === "done" || d.status === "split") && (d.sourceLang !== sourceLang || d.targetLang !== targetLang)) && (
              <p className="text-xs text-amber-400">⚠ Hay documentos con dirección distinta a la del presupuesto. La dirección de cada doc va en su línea; el par del presupuesto es informativo.</p>
            )}

            {/* Modo de precio del coste por línea: por documento (fijo) o por palabra */}
            <div className="border-t border-slate-700 pt-3">
              <label className="text-xs text-slate-400">Precio del coste por</label>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPriceMode("document")}
                  className={`rounded border px-2 py-1 text-xs ${priceMode === "document" ? "border-cyan-500 bg-cyan-600/20 text-cyan-200" : "border-slate-600 text-slate-300 hover:bg-slate-800"}`}
                >
                  Documento (fijo)
                </button>
                <button
                  type="button"
                  onClick={() => setPriceMode("word")}
                  className={`rounded border px-2 py-1 text-xs ${priceMode === "word" ? "border-cyan-500 bg-cyan-600/20 text-cyan-200" : "border-slate-600 text-slate-300 hover:bg-slate-800"}`}
                >
                  Palabra
                </button>
                {priceMode === "word" && (
                  <>
                    <input
                      type="number"
                      min={0}
                      step="0.001"
                      value={wordRate}
                      onChange={(e) => setWordRate(Math.max(0, Number(e.target.value)))}
                      className="w-20 rounded border border-slate-600 bg-slate-900 px-2 py-1 text-right tabular-nums"
                      title="€ por palabra (coste del traductor)"
                    />
                    <span className="text-xs text-slate-400">€/palabra</span>
                    <button
                      type="button"
                      onClick={applyWordRate}
                      className="rounded border border-cyan-500 bg-cyan-600/20 px-2 py-1 text-xs text-cyan-200 hover:bg-cyan-600/30"
                    >
                      Aplicar a las líneas
                    </button>
                  </>
                )}
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                {priceMode === "document"
                  ? "Escribe el coste fijo de cada documento en su fila."
                  : "Coste = palabras × tarifa. Pulsa “Aplicar” para rellenar las líneas con palabras; luego puedes ajustar cada una a mano."}
              </p>
            </div>

            {/* Margen sobre el coste del traductor (interno; el cliente solo ve su precio) */}
            <div className="border-t border-slate-700 pt-3">
              <label className="text-xs text-slate-400">Margen sobre coste del traductor (%)</label>
              <div className="mt-1 flex items-center gap-2">
                <input type="number" min={0} value={marginPct ?? ""} placeholder="Auto" onChange={(e) => setMarginPct(e.target.value === "" ? null : Math.max(0, Number(e.target.value)))} className="w-24 rounded border border-slate-600 bg-slate-900 px-2 py-2" />
                <button type="button" onClick={() => setMarginPct(null)} className={`rounded border px-2 py-1 text-xs ${marginPct === null ? "border-cyan-500 bg-cyan-600/20 text-cyan-200" : "border-slate-600 text-slate-300 hover:bg-slate-800"}`}>Auto</button>
                {[30, 40].map((m) => (
                  <button key={m} type="button" onClick={() => setMarginPct(m)} className={`rounded border px-2 py-1 text-xs ${marginPct === m ? "border-cyan-500 bg-cyan-600/20 text-cyan-200" : "border-slate-600 text-slate-300 hover:bg-slate-800"}`}>{m}%</button>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-slate-500">Auto = margen por tramo de coste (30/25/20 %), francés sin margen. El cliente solo ve el precio final.</p>
            </div>

            {/* Formas de pago a mostrar en el PDF + WhatsApp del presupuesto */}
            <div className="border-t border-slate-700 pt-3">
              <label className="text-xs text-slate-400">Formas de pago en el presupuesto</label>
              <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-300">
                {[
                  { id: "bbva", label: "BBVA" },
                  { id: "openbank", label: "Openbank" },
                  { id: "sabadell", label: "Banco Sabadell" },
                  { id: "bizum607", label: "Bizum 607356273" },
                  { id: "bizum654", label: "Bizum 654069126" },
                  { id: "paypal", label: "PayPal" },
                ].map((m) => (
                  <label key={m.id} className="flex items-center gap-1">
                    <input type="checkbox" checked={paymentMethods.includes(m.id)} onChange={() => togglePaymentMethod(m.id)} />
                    {m.label}
                  </label>
                ))}
              </div>
              <input value={contactWhatsapp} onChange={(e) => setContactWhatsapp(e.target.value)} placeholder="WhatsApp para este presupuesto (opcional; por defecto 951 333 614)" className="mt-2 w-full rounded border border-slate-600 bg-slate-900 px-2 py-2 text-sm" />
            </div>
          </div>
      )}

      {/* Solicitud de PRECIO vía lavori: lead de WhatsApp cuyo par tiene cartera
          en el tablón. El traductor ve los documentos y propone su precio; la
          respuesta llega por email y queda anclada al lead. Destinatarios: carril
          por defecto, toda la lengua o uno en concreto (21-ago-2026). */}
      {lavoriRoute && lavoriDocs.length > 0 && (
        <div className="space-y-2 rounded-xl border border-violet-700/60 bg-violet-950/30 p-4">
          <h3 className="text-sm font-semibold text-violet-200">
            Solicitar precio vía lavori · {lavoriRoute.par}
          </h3>
          <p className="text-xs text-violet-300/80">
            Manda {lavoriDocs.length === 1 ? "el documento" : `los ${lavoriDocs.length} documentos`} a
            jurados del par como encargo dirigido sin precio. Sin datos del cliente: solo tipo,
            volumen y los PDF. Útil antes de generar el presupuesto.
            {customerEmail.trim() || customerPhone.trim()
              ? " Al enviarlo, el cliente recibirá un acuse (email si lo tiene; si no, WhatsApp/SMS)."
              : ""}
          </p>
          <LavoriCandidatePicker
            route={lavoriRoute}
            cartera={lavoriCartera}
            value={lavoriPick}
            onChange={setLavoriPick}
            disabled={lavoriState.phase === "sending" || lavoriState.phase === "done"}
          />
          <textarea
            value={lavoriSpecs}
            onChange={(e) => setLavoriSpecs(e.target.value)}
            disabled={lavoriState.phase === "sending" || lavoriState.phase === "done"}
            maxLength={2000}
            rows={2}
            placeholder="Especificaciones del encargo (opcional): apostilla íntegra, plazo deseado, grafía de nombres… Sin datos del cliente."
            className="w-full rounded-lg border border-violet-700/60 bg-violet-950/40 px-3 py-2 text-sm text-violet-100 placeholder:text-violet-400/60 focus:border-violet-500 focus:outline-none disabled:opacity-40"
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={lavoriState.phase === "sending" || lavoriState.phase === "done" || busy}
              onClick={sendLavoriPrice}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {lavoriState.phase === "sending"
                ? "Enviando…"
                : lavoriState.phase === "done"
                  ? "Solicitud enviada"
                  : `Solicitar precio (${lavoriDocs.length} doc${lavoriDocs.length > 1 ? "s" : ""})`}
            </button>
            {lavoriState.msg && (
              <span className={`text-xs ${lavoriState.phase === "error" ? "text-amber-400" : "text-violet-300"}`}>
                {lavoriState.msg}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Totales + acción */}
      {includedDocs.length > 0 && (
        <div className="flex flex-col items-end gap-3 rounded-xl border border-slate-700 bg-slate-900/40 p-4">
          <div className="w-full max-w-xs space-y-1 text-sm">
            <div className="flex justify-between text-slate-400"><span>Subtotal</span><span className="tabular-nums">{subtotal.toFixed(2)} €</span></div>
            {discountPct > 0 && <div className="flex justify-between text-emerald-400"><span>Descuento {discountPct}%</span><span className="tabular-nums">-{discountAmount.toFixed(2)} €</span></div>}
            {shipping > 0 && <div className="flex justify-between text-slate-400"><span>Envío papel</span><span className="tabular-nums">{shipping.toFixed(2)} €</span></div>}
            <div className="flex justify-between text-slate-400"><span>IVA 21%</span><span className="tabular-nums">{vat.toFixed(2)} €</span></div>
            <div className="flex justify-between border-t border-slate-700 pt-1 text-base font-semibold text-white"><span>Total</span><span className="tabular-nums">{total.toFixed(2)} €</span></div>
            <div className="mt-1 flex justify-between border-t border-dashed border-slate-700 pt-1 text-[11px] text-slate-500" title="Solo visible para ti, no aparece en el presupuesto del cliente">
              <span>Interno · coste {costTotal.toFixed(2)} € · margen {marginPct === null ? "AUTO" : `${marginPct}%`}</span>
              <span className="tabular-nums">+{(subtotal - costTotal).toFixed(2)} €</span>
            </div>
          </div>
          {submitError && <p className="text-sm text-amber-400">{submitError}</p>}
          <button
            type="button"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="rounded-xl bg-cyan-600 px-5 py-2.5 font-semibold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? "Creando…" : `Generar presupuesto (${includedDocs.length} doc${includedDocs.length > 1 ? "s" : ""})`}
          </button>
          {!canSubmit && !submitting && missing.length > 0 && (
            <p className="text-xs text-amber-400">Falta: {missing.join(", ")}.</p>
          )}
          <p className="text-xs text-slate-500">Se crea como borrador en /admin/quotes para revisar y enviar.</p>
        </div>
      )}
    </div>
  );
}
