import type { Metadata } from "next";
import UploadDocumentForm from "@/components/funnel/UploadDocumentForm";
import { getSessionOrRedirect } from "@/lib/session";

export const metadata: Metadata = {
  title: "Subir documento original | Traducción jurada",
  robots: { index: false, follow: false },
};

type UploadPageProps = {
  searchParams?: {
    reason?: string;
  };
};

export default async function UploadPage({ searchParams }: UploadPageProps) {
  const session = await getSessionOrRedirect("UPLOAD");
  return <UploadDocumentForm docs={session.docs} reason={searchParams?.reason || null} />;
}

