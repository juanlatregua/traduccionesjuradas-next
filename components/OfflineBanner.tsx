"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { useUiLang } from "@/lib/i18n/use-ui-lang";

export function OfflineBanner() {
  const lang = useUiLang();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 flex items-center gap-2 rounded-xl bg-encre px-4 py-2.5 text-sm font-medium text-white shadow-lg">
      <WifiOff className="h-4 w-4" />
      {lang === "fr" ? "Pas de connexion internet" : "Sin conexión a internet"}
    </div>
  );
}
