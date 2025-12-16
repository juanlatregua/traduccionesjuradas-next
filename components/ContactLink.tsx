"use client";

import IconEmail from "./IconEmail";
import IconWhatsapp from "./IconWhatsapp";
import React from "react";

type ContactType = "phone" | "email" | "whatsapp" | "location";

interface ContactLinkProps {
  type: ContactType;
  label: string;
  value: string;
  href?: string;
}

export default function ContactLink({
  type,
  label,
  value,
  href,
}: ContactLinkProps) {
  const isLink = Boolean(href);

  const Classes =
    "flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700" +
    (isLink ? " hover:border-emerald-300 hover:bg-emerald-50/50" : "");

  const icon =
    type === "email" ? (
      <IconEmail />
    ) : type === "whatsapp" ? (
      <IconWhatsapp />
    ) : type === "phone" ? (
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-semibold text-emerald-700">
        Tel
      </span>
    ) : (
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600">
        📍
      </span>
    );

  if (isLink) {
    return (
      <a href={href} className={Classes}>
        {icon}
        <div className="flex flex-col">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {label}
          </span>
          <span className="text-sm text-slate-800">{value}</span>
        </div>
      </a>
    );
  }

  return (
    <div className={Classes}>
      {icon}
      <div className="flex flex-col">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {label}
        </span>
        <span className="text-sm text-slate-800">{value}</span>
      </div>
    </div>
  );
}


