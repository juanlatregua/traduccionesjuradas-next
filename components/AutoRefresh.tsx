"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type Props = {
  intervalMs?: number;
  idleMs?: number;
};

export default function AutoRefresh({ intervalMs = 15000, idleMs = 30000 }: Props) {
  const router = useRouter();
  const lastInteractionRef = useRef<number>(Date.now());

  useEffect(() => {
    const markInteraction = () => {
      lastInteractionRef.current = Date.now();
    };

    const events: Array<keyof WindowEventMap> = [
      "pointerdown",
      "keydown",
      "scroll",
      "touchstart",
      "mousemove",
    ];
    events.forEach((evt) => window.addEventListener(evt, markInteraction, { passive: true }));

    const id = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastInteractionRef.current < Math.max(5000, idleMs)) return;
      const tag = (document.activeElement?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || tag === "button") return;
      router.refresh();
    }, Math.max(5000, intervalMs));

    return () => {
      clearInterval(id);
      events.forEach((evt) => window.removeEventListener(evt, markInteraction));
    };
  }, [router, intervalMs, idleMs]);

  return null;
}
