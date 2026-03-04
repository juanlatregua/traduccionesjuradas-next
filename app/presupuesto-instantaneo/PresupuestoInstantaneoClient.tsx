"use client";

import { useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import type { DocumentAnalysisResult } from "@/lib/ai/analyze-document";
import type { Quote } from "@/lib/pricing-engine/calculator";
import { calculatePrice } from "@/lib/pricing-engine/calculator";
import { MessageCircle, RotateCcw, Mail } from "lucide-react";

const DocumentUploader = dynamic(
  () => import("@/components/ia/DocumentUploader"),
  { ssr: false }
);
const LeadGate = dynamic(() => import("@/components/ia/LeadGate"), {
  ssr: false,
});
const DocumentAnalysis = dynamic(
  () => import("@/components/ia/DocumentAnalysis"),
  { ssr: false }
);
const DocumentReview = dynamic(
  () => import("@/components/ia/DocumentReview"),
  { ssr: false }
);
const InstantQuote = dynamic(() => import("@/components/ia/InstantQuote"), {
  ssr: false,
});
const PaymentFlow = dynamic(() => import("@/components/ia/PaymentFlow"), {
  ssr: false,
});
const OrderTracker = dynamic(() => import("@/components/ia/OrderTracker"), {
  ssr: false,
});

type FlowStep =
  | "upload"
  | "analyzing"
  | "doc-review"
  | "email-gate"
  | "quote"
  | "payment"
  | "success"
  | "error";

type LeadData = {
  name: string;
  email: string;
  phone: string;
};

type DocumentEntry = {
  id: string;
  analysis: DocumentAnalysisResult;
  quote: Quote;
};

export default function PresupuestoInstantaneoClient() {
  const [step, setStep] = useState<FlowStep>("upload");
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [currentDocumentId, setCurrentDocumentId] = useState<string | null>(null);
  const currentDocIdRef = useRef<string | null>(null);
  const [documents, setDocuments] = useState<DocumentEntry[]>([]);
  const [isUrgent, setIsUrgent] = useState(false);
  const [orderReference, setOrderReference] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [leadData, setLeadData] = useState<LeadData | null>(null);
  const [gdprConsent, setGdprConsent] = useState(false);
  const [errorEmail, setErrorEmail] = useState("");
  const [errorEmailSent, setErrorEmailSent] = useState(false);

  const handleUploadComplete = useCallback(
    (docId: string, token: string) => {
      currentDocIdRef.current = docId;
      setCurrentDocumentId(docId);
      setSessionToken(token);
      setStep("analyzing");
    },
    []
  );

  const handleAnalysisComplete = useCallback(
    (analysisResult: DocumentAnalysisResult, quoteResult: Quote) => {
      const docId = currentDocIdRef.current;
      if (!docId) return;
      setDocuments((prev) => [
        ...prev,
        {
          id: docId,
          analysis: analysisResult,
          quote: quoteResult,
        },
      ]);
      setStep("doc-review");
    },
    []
  );

  const handleAddAnother = useCallback(() => {
    currentDocIdRef.current = null;
    setCurrentDocumentId(null);
    setStep("upload");
  }, []);

  const handleViewQuote = useCallback(() => {
    setStep("email-gate");
  }, []);

  const handleLeadComplete = useCallback((data: LeadData) => {
    setLeadData(data);
    setStep("quote");
  }, []);

  const handleAnalysisError = useCallback((error: string) => {
    setErrorMessage(error);
    setStep("error");
  }, []);

  const handlePaymentStart = useCallback((urgent: boolean) => {
    setIsUrgent(urgent);
    setStep("payment");
  }, []);

  const handlePaymentSuccess = useCallback((ref: string) => {
    setOrderReference(ref);
    setStep("success");
  }, []);

  const handleTargetLanguageChange = useCallback(
    (docIndex: number, target: string, targetName: string) => {
      setDocuments((prev) =>
        prev.map((doc, i) => {
          if (i !== docIndex) return doc;
          const updatedAnalysis = {
            ...doc.analysis,
            language: {
              ...doc.analysis.language,
              target,
              target_name: targetName,
            },
          };
          return {
            ...doc,
            analysis: updatedAnalysis,
            quote: calculatePrice(updatedAnalysis),
          };
        })
      );
    },
    []
  );

  const handleReset = useCallback(() => {
    setStep("upload");
    currentDocIdRef.current = null;
    setCurrentDocumentId(null);
    setDocuments([]);
    setErrorMessage(null);
    setOrderReference(null);
    setLeadData(null);
    setGdprConsent(false);
  }, []);

  const whatsappFallback = `https://wa.me/34951333614?text=${encodeURIComponent(
    "Hola, he intentado usar el presupuesto instantáneo pero ha habido un problema. ¿Podéis ayudarme?"
  )}`;

  const hasWarnings = documents.some((d) => d.analysis.warnings.length > 0);
  const totalPrice = documents.reduce(
    (sum, d) => sum + (isUrgent ? d.quote.urgentPrice : d.quote.basePrice),
    0
  );
  const latestAnalysis = documents.length > 0 ? documents[documents.length - 1].analysis : null;

  return (
    <div className="space-y-6">
      {/* Step 1: Upload */}
      {step === "upload" && (
        <DocumentUploader
          onUploadComplete={handleUploadComplete}
          sessionToken={sessionToken}
          onSessionToken={setSessionToken}
          gdprConsent={gdprConsent}
          onGdprConsentChange={setGdprConsent}
        />
      )}

      {/* Step 2: Analyzing */}
      {step === "analyzing" && currentDocumentId && (
        <DocumentAnalysis
          documentId={currentDocumentId}
          onAnalysisComplete={handleAnalysisComplete}
          onError={handleAnalysisError}
        />
      )}

      {/* Step 3: Document review (add more or proceed) */}
      {step === "doc-review" && documents.length > 0 && latestAnalysis && (
        <DocumentReview
          documents={documents}
          currentAnalysis={latestAnalysis}
          onAddAnother={handleAddAnother}
          onViewQuote={handleViewQuote}
          onTargetLanguageChange={handleTargetLanguageChange}
        />
      )}

      {/* Step 4: Email gate */}
      {step === "email-gate" && documents.length > 0 && (
        <LeadGate
          documentId={documents[0].id}
          onComplete={handleLeadComplete}
        />
      )}

      {/* Step 5: Quote */}
      {step === "quote" && documents.length > 0 && (
        <InstantQuote
          documents={documents}
          onPaymentStart={handlePaymentStart}
          hasWarnings={hasWarnings}
        />
      )}

      {/* Step 6: Payment */}
      {step === "payment" && documents.length > 0 && (
        <PaymentFlow
          documentIds={documents.map((d) => d.id)}
          isUrgent={isUrgent}
          amount={totalPrice}
          onSuccess={handlePaymentSuccess}
          onCancel={() => setStep("quote")}
          defaultName={leadData?.name}
          defaultEmail={leadData?.email}
          defaultPhone={leadData?.phone}
        />
      )}

      {/* Step 7: Success */}
      {step === "success" && orderReference && (
        <OrderTracker
          orderReference={orderReference}
          currentStatus="PAID"
          documentType={
            documents.length === 1
              ? documents[0].analysis.document_type.specific_type_es
              : `${documents.length} documentos`
          }
          estimatedDelivery={
            isUrgent
              ? documents[0]?.quote.estimatedDaysUrgent
              : documents[0]?.quote.estimatedDaysStandard
          }
        />
      )}

      {/* Error state */}
      {step === "error" && (
        <div className="rounded-xl border border-rouge/20 bg-card p-6 text-center shadow-paper animate-fadeIn">
          <p className="font-baskerville text-xl text-rouge">
            No hemos podido analizar el documento
          </p>
          <p className="mt-2 text-sm text-graphite">
            {errorMessage ||
              "Ha ocurrido un error inesperado."}
          </p>

          {/* Captura de email en error */}
          {!errorEmailSent ? (
            <div className="mt-5 mx-auto max-w-sm">
              <p className="text-xs text-graphite mb-2">
                Déjanos tu email y te preparamos el presupuesto manualmente:
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (errorEmail.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(errorEmail)) {
                    fetch("/api/leads/error", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        email: errorEmail.trim(),
                        documentId: currentDocumentId,
                        error: errorMessage,
                      }),
                    }).catch(() => {});
                    setErrorEmailSent(true);
                  }
                }}
                className="flex gap-2"
              >
                <input
                  type="email"
                  value={errorEmail}
                  onChange={(e) => setErrorEmail(e.target.value)}
                  placeholder="tu@email.com"
                  className="flex-1 rounded-lg border border-graphite/20 bg-white px-3 py-2 text-sm text-encre placeholder:text-graphite/40 focus:border-bleu focus:ring-1 focus:ring-bleu/20 outline-none"
                />
                <button
                  type="submit"
                  className="flex items-center gap-1.5 rounded-lg bg-bleu px-4 py-2 text-sm font-medium text-white hover:bg-bleu-dark transition-colors"
                >
                  <Mail className="h-3.5 w-3.5" />
                  Enviar
                </button>
              </form>
            </div>
          ) : (
            <p className="mt-4 text-sm font-medium text-vert">
              Recibido. Te contactaremos en breve.
            </p>
          )}

          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <button
              onClick={handleReset}
              className="flex items-center gap-2 rounded-lg border border-bleu/20 px-5 py-2.5 text-sm font-medium text-bleu hover:bg-bleu/5 transition-colors"
            >
              <RotateCcw className="h-4 w-4" />
              Intentar de nuevo
            </button>
            <a
              href={whatsappFallback}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg bg-vert px-5 py-2.5 text-sm font-semibold text-white hover:bg-vert/90 transition-colors"
            >
              <MessageCircle className="h-4 w-4" />
              Contactar por WhatsApp
            </a>
          </div>
        </div>
      )}

      {/* Reset button (visible after review/quote/payment) */}
      {["doc-review", "quote", "payment"].includes(step) && (
        <div className="text-center">
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 text-sm text-graphite hover:text-bleu transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Empezar de nuevo
          </button>
        </div>
      )}
    </div>
  );
}
