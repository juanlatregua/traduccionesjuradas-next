"use client";

import { useEffect, useRef, useState } from "react";

type PayPalButtonProps = {
  reference: string;
  onSuccess: () => void;
};

declare global {
  interface Window {
    paypal?: {
      Buttons: (opts: {
        createOrder: () => Promise<string>;
        onApprove: (data: { orderID: string }) => Promise<void>;
        onError: (err: unknown) => void;
      }) => { render: (el: HTMLElement) => void };
    };
  }
}

export default function PayPalButton({ reference, onSuccess }: PayPalButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const renderedRef = useRef(false);

  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
    if (!clientId) {
      setError("PayPal no configurado.");
      setLoading(false);
      return;
    }

    // Load PayPal JS SDK
    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=EUR`;
    script.async = true;
    script.onload = () => {
      setLoading(false);
      if (window.paypal && containerRef.current && !renderedRef.current) {
        renderedRef.current = true;
        window.paypal
          .Buttons({
            createOrder: async () => {
              const res = await fetch("/api/payment/paypal", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reference }),
              });
              const data = await res.json();
              if (!data.ok) throw new Error(data.error);
              return data.paypalOrderId;
            },
            onApprove: async (data) => {
              const res = await fetch("/api/payment/paypal/capture", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  paypalOrderId: data.orderID,
                  reference,
                }),
              });
              const result = await res.json();
              if (result.ok) {
                onSuccess();
              } else {
                setError(result.error || "Error al confirmar pago.");
              }
            },
            onError: (err) => {
              console.error("[paypal] error", err);
              setError("Error en el pago con PayPal.");
            },
          })
          .render(containerRef.current);
      }
    };
    script.onerror = () => {
      setError("No se pudo cargar PayPal.");
      setLoading(false);
    };
    document.body.appendChild(script);

    return () => {
      if (script.parentNode) script.parentNode.removeChild(script);
    };
  }, [reference, onSuccess]);

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Cargando PayPal...</p>;
  }

  return <div ref={containerRef} />;
}
