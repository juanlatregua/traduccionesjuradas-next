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
    "flex items-center gap-3 rounded-xl border border-cream bg-white px-3 py-2 text-sm text-sepia" +
    (isLink ? " hover:border-bleu hover:bg-cream/50" : "");

  const icon =
    type === "email" ? (
      <IconEmail />
    ) : type === "whatsapp" ? (
      <IconWhatsapp />
    ) : type === "phone" ? (
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-cream text-[11px] font-semibold text-bleu">
        Tel
      </span>
    ) : (
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-cream text-[11px] font-semibold text-sepia">
        📍
      </span>
    );

  if (isLink) {
    return (
      <a href={href} className={Classes}>
        {icon}
        <div className="flex flex-col">
          <span className="text-xs font-semibold uppercase tracking-wide text-graphite">
            {label}
          </span>
          <span className="text-sm text-encre">{value}</span>
        </div>
      </a>
    );
  }

  return (
    <div className={Classes}>
      {icon}
      <div className="flex flex-col">
        <span className="text-xs font-semibold uppercase tracking-wide text-graphite">
          {label}
        </span>
        <span className="text-sm text-encre">{value}</span>
      </div>
    </div>
  );
}


