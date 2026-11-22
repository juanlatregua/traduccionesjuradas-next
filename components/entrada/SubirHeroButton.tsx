"use client";

import type { ReactNode } from "react";
import { FILE_INPUT_ID } from "@/components/entrada/PuertaPortada";

// Same click opens the picker (the browser only allows it inside the user's gesture) and brings the card into view.
export default function SubirHeroButton({ className, children }: { className: string; children: ReactNode }) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        const input = document.getElementById(FILE_INPUT_ID) as HTMLInputElement | null;
        input?.click();
        document.getElementById("subir")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }}
    >
      {children}
    </button>
  );
}
