"use client";

// Factura del traductor en la ficha: se arrastra el PDF, la IA rellena y al guardar
// se registra el gasto REAL de colaborador y se liquidan los devengos de este pedido
// (registerCollaboratorInvoice, el mismo camino que Contabilidad → Proveedores).
// Si la factura ya llegó por lavori, se completa ESA (nunca un segundo gasto).

import { useRouter } from "next/navigation";
import { useState } from "react";
import { uploadStaffFile, type StaffUploaded } from "@/lib/staff-upload-client";

type Collaborator = { id: string; fullName: string; companyName: string | null; nif: string | null; supplierType: string | null };

export type PendingAccrual = { id: string; baseCents: number; collaborator: Collaborator };

export type RegisteredSupplierInvoice = {
  id: string;
  supplier: string | null;
  number: string | null;
  totalCents: number;
  attachmentUrl: string | null;
  needsReview: boolean;
  settlesAccruals: boolean;
  fromLavori: boolean;
};

const eur = (cents: number) => `${(cents / 100).toFixed(2).replace(".", ",")} €`;
const input = "w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-xs text-slate-100";

export default function SupplierInvoiceDrop({
  reference,
  pending,
  registered,
  canRegister,
}: {
  reference: string;
  pending: PendingAccrual[];
  registered: RegisteredSupplierInvoice[];
  canRegister: boolean;
}) {
  const collaborators = [...new Map(pending.map((a) => [a.collaborator.id, a.collaborator])).values()];
  const [collaboratorId, setCollaboratorId] = useState(collaborators[0]?.id || "");
  const collaborator = collaborators.find((c) => c.id === collaboratorId) || collaborators[0];
  // Solo la factura que llegó por lavori (sin régimen fiscal) y del mismo traductor.
  const lavoriPending = (c: Collaborator) =>
    registered.find((r) => r.fromLavori && !r.settlesAccruals && (r.supplier === c.fullName || r.supplier === c.companyName)) || null;

  return (
    <div className="space-y-2">
      {registered.map((r) => (
        <p key={r.id} className="rounded-lg border border-emerald-600/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
          Registrada: {r.supplier || "proveedor"} {r.number ? `nº ${r.number}` : ""} · {eur(r.totalCents)}
          {r.needsReview && <span className="ml-1 text-amber-300">(pendiente de revisar)</span>}
          {r.attachmentUrl && (
            <a href={r.attachmentUrl} target="_blank" rel="noreferrer" className="ml-2 font-semibold text-cyan-300 hover:underline">
              PDF
            </a>
          )}
        </p>
      ))}

      {pending.length === 0 && registered.length === 0 && (
        <p className="text-[11px] text-slate-400">
          Sin coste devengado de un traductor en este pedido: asigna el traductor con su coste para registrar su factura aquí.
        </p>
      )}

      {pending.length > 0 && !canRegister && (
        <p className="text-[11px] text-slate-400">Registrar facturas de traductor es de ADMIN/PM.</p>
      )}

      {pending.length > 0 && canRegister && collaborator && (
        <>
          {collaborators.length > 1 && (
            <select value={collaborator.id} onChange={(e) => setCollaboratorId(e.target.value)} className={input}>
              {collaborators.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.companyName || c.fullName}
                </option>
              ))}
            </select>
          )}
          <InvoiceForm
            key={collaborator.id}
            reference={reference}
            collaborator={collaborator}
            accruals={pending.filter((a) => a.collaborator.id === collaborator.id)}
            existing={lavoriPending(collaborator)}
          />
        </>
      )}
    </div>
  );
}

function InvoiceForm({
  reference,
  collaborator,
  accruals,
  existing,
}: {
  reference: string;
  collaborator: Collaborator;
  accruals: PendingAccrual[];
  existing: RegisteredSupplierInvoice | null;
}) {
  const router = useRouter();
  const accrualCents = accruals.reduce((a, e) => a + e.baseCents, 0);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [file, setFile] = useState<StaffUploaded | null>(null);
  const [number, setNumber] = useState(existing?.number || "");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [baseEur, setBaseEur] = useState(accrualCents ? (accrualCents / 100).toFixed(2) : "");
  const [vatPct, setVatPct] = useState("21");
  const [irpfPct, setIrpfPct] = useState(collaborator.supplierType === "EMPRESA" ? "0" : "15");
  const [nif, setNif] = useState(collaborator.nif || "");

  const baseCents = Math.round(Number(baseEur.replace(",", ".")) * 100) || 0;
  const vatCents = Math.round((baseCents * Number(vatPct)) / 100);
  const irpfCents = Math.round((baseCents * Number(irpfPct)) / 100);

  async function handleFile(f: File) {
    setError(null);
    setNotice(null);
    setBusy("Subiendo y leyendo la factura…");
    try {
      const form = new FormData();
      form.append("file", f);
      const extraction =
        f.size <= 10 * 1024 * 1024
          ? fetch("/api/expenses/extract", { method: "POST", body: form }).then((r) => r.json()).catch(() => null)
          : Promise.resolve(null);
      setFile(await uploadStaffFile(f, `expenses/colaborador/${reference}`));
      const extracted = await extraction;
      const d = extracted?.ok ? extracted.data : null;
      if (!d) {
        setNotice("Factura subida. No se pudo leer: rellena los datos a mano.");
        return;
      }
      if (d.supplierInvoiceNumber) setNumber(d.supplierInvoiceNumber);
      if (d.date) setDate(d.date);
      if (typeof d.baseEur === "number") setBaseEur(d.baseEur.toFixed(2));
      if (typeof d.vatRate === "number" && [0, 4, 10, 21].includes(Math.round(d.vatRate * 100))) setVatPct(String(Math.round(d.vatRate * 100)));
      if (typeof d.irpfRate === "number" && [0, 7, 15].includes(Math.round(d.irpfRate * 100))) setIrpfPct(String(Math.round(d.irpfRate * 100)));
      if (d.supplierNif) setNif(d.supplierNif);
      const avisos = [
        d.supplier ? `Emisor leído: ${d.supplier}.` : "",
        extracted.duplicateOf && extracted.duplicateOf.id !== existing?.id
          ? `⚠ Ya hay un gasto con el nº ${d.supplierInvoiceNumber} (${extracted.duplicateOf.supplier || "sin proveedor"}, ${eur(extracted.duplicateOf.totalCents)}): si es la misma factura, no la registres.`
          : "",
      ].filter(Boolean);
      setNotice(avisos.join(" ") || "Factura leída: revisa los datos.");
    } catch (err: any) {
      setError(err?.message || "No se pudo subir la factura.");
    } finally {
      setBusy(null);
    }
  }

  async function save(acceptMismatch = false): Promise<void> {
    setError(null);
    setBusy("Registrando…");
    try {
      const res = await fetch("/api/expenses/collaborator-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collaboratorId: collaborator.id,
          accrualIds: accruals.map((a) => a.id),
          number,
          date,
          baseCents,
          vatRate: Number(vatPct) / 100,
          irpfRetentionPct: Number(irpfPct),
          supplierNif: nif || null,
          attachmentUrl: file?.url,
          attachmentKey: file?.pathname,
          attachmentName: file?.name,
          existingExpenseId: existing?.id,
          acceptMismatch,
        }),
      });
      const data = await res.json();
      if (res.status === 409 && data?.mismatch) {
        setBusy(null);
        const ok = window.confirm(
          `La base de la factura (${eur(data.mismatch.gotCents)}) no cuadra con lo devengado en este pedido (${eur(data.mismatch.expectedCents)}). Si es una factura de varios pedidos, regístrala en Contabilidad → Proveedores. ¿Registrar igualmente solo con este pedido?`
        );
        if (ok) return save(true);
        return;
      }
      if (res.status === 409 && data?.duplicate) {
        throw new Error(`${data.error} Si es otra factura distinta, regístrala en Contabilidad → Proveedores.`);
      }
      if (!res.ok || !data?.ok) throw new Error(data?.error || "No se pudo registrar la factura.");
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "No se pudo registrar la factura.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-2">
      {existing && (
        <p className="text-[11px] text-amber-300">
          La factura de arriba llegó por lavori sin régimen fiscal y aún no liquida el devengo: complétala aquí (no se crea otro gasto).
        </p>
      )}
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) handleFile(f);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-3 py-5 text-center text-xs ${
          dragging ? "border-amber-400 bg-amber-500/10 text-amber-200" : "border-slate-600 text-slate-300 hover:border-amber-500"
        }`}
      >
        <input
          type="file"
          accept=".pdf,.docx,.jpg,.jpeg,.png,.webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
        {file ? (
          <span>
            📎 {file.name} — <span className="text-slate-400">arrastra otra para cambiarla</span>
          </span>
        ) : (
          <span>
            Arrastra aquí la factura del traductor (PDF, foto o Word)
            <br />
            <span className="text-slate-400">o pulsa para elegirla</span>
          </span>
        )}
      </label>

      <p className="text-xs text-slate-300">
        Traductor: <span className="font-semibold text-slate-100">{collaborator.companyName || collaborator.fullName}</span> · devengado{" "}
        {eur(accrualCents)}
      </p>

      <div className="grid grid-cols-2 gap-2">
        <input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="Nº de factura" className={input} />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={input} />
        <input value={baseEur} onChange={(e) => setBaseEur(e.target.value)} placeholder="Base (€)" inputMode="decimal" className={input} />
        <input value={nif} onChange={(e) => setNif(e.target.value)} placeholder="NIF" className={input} />
        <select value={vatPct} onChange={(e) => setVatPct(e.target.value)} className={input}>
          <option value="21">IVA 21 %</option>
          <option value="10">IVA 10 %</option>
          <option value="4">IVA 4 %</option>
          <option value="0">Sin IVA</option>
        </select>
        <select value={irpfPct} onChange={(e) => setIrpfPct(e.target.value)} className={input}>
          <option value="15">IRPF 15 %</option>
          <option value="7">IRPF 7 %</option>
          <option value="0">Sin IRPF</option>
        </select>
      </div>

      <p className="text-[11px] text-slate-400">
        Total factura {eur(baseCents + vatCents)} · a transferir {eur(baseCents + vatCents - irpfCents)}
        {baseCents > 0 && baseCents !== accrualCents && (
          <span className="ml-1 text-amber-300">· la base no cuadra con lo devengado ({eur(accrualCents)})</span>
        )}
      </p>

      <button
        type="button"
        onClick={() => save()}
        disabled={!!busy || !number.trim() || baseCents <= 0}
        className="w-full rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-500 disabled:opacity-60"
      >
        {busy || (existing ? "Completar y liquidar la factura de lavori" : "Registrar factura en contabilidad")}
      </button>

      {notice && <p className="text-[11px] text-slate-300">{notice}</p>}
      {error && <p className="text-xs font-semibold text-rose-300">{error}</p>}
    </div>
  );
}
