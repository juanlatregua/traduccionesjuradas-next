"use client";

import type { ReactNode } from "react";
import { FILE_INPUT_ID } from "@/components/entrada/PuertaPortada";

// Same click opens the picker (the browser only allows it inside the user's gesture) and brings the card into view.
// While an upload runs, or when the current step has no picker, it only takes the client to the card.
export default function SubirHeroButton({ className, children }: { className: string; children: ReactNode }) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        const input = document.getElementById(FILE_INPUT_ID) as HTMLInputElement | null;
        const card = document.getElementById("subir");
        if (input && !input.disabled) input.click();
        else if (card) {
          if (!card.hasAttribute("tabindex")) card.setAttribute("tabindex", "-1");
          card.focus({ preventScroll: true });
        }
        card?.scrollIntoView({ behavior: "smooth", block: "start" });
      }}
    >
      {children}
    </button>
  );
}
