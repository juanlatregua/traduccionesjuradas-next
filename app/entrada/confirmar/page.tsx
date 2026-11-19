import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { puertaV2On } from "@/lib/entrada/flag";
import ConfirmarEmail from "@/components/entrada/ConfirmarEmail";

export const metadata: Metadata = { title: "Confirmar email", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default function ConfirmarPage({ searchParams }: { searchParams: { k?: string } }) {
  if (!puertaV2On()) notFound();
  return (
    <section className="mx-auto max-w-md px-4 py-16 text-center">
      <ConfirmarEmail k={String(searchParams.k ?? "").slice(0, 80)} />
    </section>
  );
}
