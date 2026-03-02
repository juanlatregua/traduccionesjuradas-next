"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import type { DocumentAnalysisResult } from "@/lib/ai/analyze-document";
import type { Quote } from "@/lib/pricing-engine/calculator";
import { MessageCircle, RotateCcw } from "lucide-react";

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
  | "email-gate"
  | "analyzing"
  | "quote"
  | "payment"
  | "success"
  | "error";

type LeadData = {
  name: string;
  email: string;
  phone: string;
};

export default function PresupuestoInstantaneoClient() {
  const [step, setStep] = useState<FlowStep>("upload");
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<DocumentAnalysisResult | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [isUrgent, setIsUrgent] = useState(false);
  const [orderReference, setOrderReference] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [leadData, setLeadData] = useState<LeadData | null>(null);

  const handleUploadComplete = useCallback(
    (docId: string, token: string) => {
      setDocumentId(docId);
      setSessionToken(token);
      setStep("email-gate");
    },
    []
  );

  const handleLeadComplete = useCallback((data: LeadData) => {
    setLeadData(data);
    setStep("analyzing");
  }, []);

  const handleAnalysisComplete = useCallback(
    (analysisResult: DocumentAnalysisResult, quoteResult: Quote) => {
      setAnalysis(analysisResult);
      setQuote(quoteResult);
      setStep("quote");
    },
    []
  );

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

  const handleReset = useCallback(() => {
    setStep("upload");
    setDocumentId(null);
    setAnalysis(null);
    setQuote(null);
    setErrorMessage(null);
    setOrderReference(null);
    setLeadData(null);
  }, []);

  const whatsappFallback = `https://wa.me/34951333614?text=${encodeURIComponent(
    "Hola, he intentado usar el presupuesto instantáneo pero ha habido un problema. ¿Podéis ayudarme?"
  )}`;

  return (
    <div className="space-y-6">
      {/* Step 1: Upload */}
      {step === "upload" && (
        <DocumentUploader
          onUploadComplete={handleUploadComplete}
          sessionToken={sessionToken}
          onSessionToken={setSessionToken}
        />
      )}

      {/* Step 2: Email gate */}
      {step === "email-gate" && documentId && (
        <LeadGate
          documentId={documentId}
          onComplete={handleLeadComplete}
        />
      )}

      {/* Step 3: Analyzing */}
      {step === "analyzing" && documentId && (
        <DocumentAnalysis
          documentId={documentId}
          onAnalysisComplete={handleAnalysisComplete}
          onError={handleAnalysisError}
        />
      )}

      {/* Step 4: Quote */}
      {step === "quote" && analysis && quote && documentId && (
        <>
          <DocumentAnalysis
            documentId={documentId}
            onAnalysisComplete={() => {}}
            onError={() => {}}
          />
          <InstantQuote
            quote={quote}
            analysis={analysis}
            documentId={documentId}
            onPaymentStart={handlePaymentStart}
            hasWarnings={analysis.warnings.length > 0}
          />
        </>
      )}

      {/* Step 5: Payment */}
      {step === "payment" && documentId && (
        <PaymentFlow
          documentId={documentId}
          isUrgent={isUrgent}
          onSuccess={handlePaymentSuccess}
          onCancel={() => setStep("quote")}
          defaultName={leadData?.name}
          defaultEmail={leadData?.email}
          defaultPhone={leadData?.phone}
        />
      )}

      {/* Step 6: Success */}
      {step === "success" && orderReference && (
        <OrderTracker
          orderReference={orderReference}
          currentStatus="PAID"
          documentType={analysis?.document_type.specific_type_es}
          estimatedDelivery={
            isUrgent
              ? quote?.estimatedDaysUrgent
              : quote?.estimatedDaysStandard
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

      {/* Reset button (visible after analysis) */}
      {["quote", "payment"].includes(step) && (
        <div className="text-center">
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 text-sm text-graphite hover:text-bleu transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Analizar otro documento
          </button>
        </div>
      )}
    </div>
  );
}
