ALTER TABLE "Order"
ADD COLUMN "quotePreviewFileKey" TEXT,
ADD COLUMN "quotePreviewFileUrl" TEXT,
ADD COLUMN "quoteSnapshotJson" JSONB,
ADD COLUMN "paymentProofFileKey" TEXT,
ADD COLUMN "finalDeliveryFileKey" TEXT,
ADD COLUMN "finalDeliveryFileUrl" TEXT,
ADD COLUMN "finalFilename" TEXT,
ADD COLUMN "finalMimeType" TEXT;

