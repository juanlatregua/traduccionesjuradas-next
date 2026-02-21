"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type Props = {
  intervalMs?: number;
};

export default function AutoRefresh({ intervalMs = 5000 }: Props) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => {
      const tag = (document.activeElement?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || tag === "button") return;
      router.refresh();
    }, Math.max(2000, intervalMs));
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return null;
}
