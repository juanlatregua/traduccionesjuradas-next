export type FunnelStep = "SELECT" | "UPLOAD" | "CHECKOUT" | "CONFIRM";
export type CustomerAuthState = "guest" | "user" | "unknown";

type StepCounts = {
  selectedCount: number;
  uploadedCount: number;
};

const DEFAULT_SELECT_PATH = "/traductor-jurado-frances";

function toSafeCount(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

export function isSafeReturnPath(path?: string | null) {
  if (!path) return false;
  if (!path.startsWith("/")) return false;
  if (path.startsWith("//")) return false;
  return true;
}

export function sanitizeReturnPath(path?: string | null, fallback = DEFAULT_SELECT_PATH) {
  return isSafeReturnPath(path) ? String(path) : fallback;
}

export function resolveStepForCounts(input: StepCounts): FunnelStep {
  const selectedCount = toSafeCount(input.selectedCount);
  const uploadedCount = toSafeCount(input.uploadedCount);
  if (selectedCount === 0) return "SELECT";
  if (uploadedCount === 0) return "UPLOAD";
  return "CHECKOUT";
}

export function resolveGuestStep(input: StepCounts): FunnelStep {
  return resolveStepForCounts(input);
}

export function resolveGoogleCallbackStep(input: StepCounts & { lastKnownStep?: FunnelStep | null }): FunnelStep {
  const minimumStep = resolveStepForCounts(input);
  const lastKnownStep = input.lastKnownStep || null;
  if (!lastKnownStep) return minimumStep;
  if (lastKnownStep === "CONFIRM") return "CONFIRM";
  if (lastKnownStep === "CHECKOUT" && minimumStep === "CHECKOUT") return "CHECKOUT";
  if (lastKnownStep === "UPLOAD" && minimumStep !== "SELECT") return "UPLOAD";
  return minimumStep;
}

export function resolveCheckoutEntryStep(input: {
  hasSession: boolean;
  selectedCount: number;
  uploadedCount: number;
}): FunnelStep {
  if (!input.hasSession) return "SELECT";
  return resolveStepForCounts({
    selectedCount: input.selectedCount,
    uploadedCount: input.uploadedCount,
  });
}

export function resolveFunnelPathForStep(step: FunnelStep) {
  if (step === "SELECT") return DEFAULT_SELECT_PATH;
  if (step === "UPLOAD") return `${DEFAULT_SELECT_PATH}?step=upload`;
  if (step === "CHECKOUT") return `${DEFAULT_SELECT_PATH}?step=checkout`;
  return `${DEFAULT_SELECT_PATH}?step=confirm`;
}

export type CheckoutSessionSnapshot = {
  sessionId: string;
  selectedDocumentTypes: string[];
  uploadedFiles: Array<{
    uid: string;
    fileName: string;
    storageKey?: string;
  }>;
  customerAuthState: CustomerAuthState;
  currentStep: FunnelStep;
  orderReference?: string | null;
  guestEmail?: string;
  updatedAt: string;
};
