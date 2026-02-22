"use client";

import { useState } from "react";

type StaffOtpGateProps = {
  initialEmail?: string;
};

export default function StaffOtpGate({ initialEmail = "" }: StaffOtpGateProps) {
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loadingSend, setLoadingSend] = useState(false);
  const [loadingVerify, setLoadingVerify] = useState(false);

  const sendCode = async () => {
    if (!email.trim()) {
      setMessage("Introduce tu correo autorizado.");
      return;
    }
    setLoadingSend(true);
    setMessage(null);
    try {
      const res = await fetch("/api/traductor/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "No se pudo enviar el codigo.");
      setMessage(`Codigo enviado a ${email.trim().toLowerCase()}.`);
    } catch (err: any) {
      setMessage(err?.message || "Error al enviar codigo.");
    } finally {
      setLoadingSend(false);
    }
  };

  const verifyCode = async () => {
    setLoadingVerify(true);
    setMessage(null);
    try {
      const res = await fetch("/api/traductor/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Codigo no valido.");
      window.location.assign("/zona-traductor");
    } catch (err: any) {
      setMessage(err?.message || "Error verificando codigo.");
    } finally {
      setLoadingVerify(false);
    }
  };

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Verificacion extra</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
        Introduce tu codigo personal
      </h1>
      <p className="mt-3 text-sm text-slate-700">
        Envia un codigo de 6 digitos a tu correo autorizado y usalo para entrar en zona traductor.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Correo staff autorizado"
          autoComplete="email"
          className="rounded-2xl border border-slate-200 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={sendCode}
          disabled={loadingSend || !email.trim()}
          className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {loadingSend ? "Enviando..." : "Enviar codigo"}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Codigo de 6 digitos"
          className="rounded-2xl border border-slate-200 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={verifyCode}
          disabled={loadingVerify}
          className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {loadingVerify ? "Verificando..." : "Validar codigo"}
        </button>
      </div>

      {message && (
        <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          {message}
        </p>
      )}
    </section>
  );
}
