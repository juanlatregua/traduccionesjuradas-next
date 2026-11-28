// Imagen de vista previa (WhatsApp, SMS, iMessage…) con la marca: #1A2E4A, isotipo y etiqueta dorada.
import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 };

export function brandOgImage(opts: { tag?: string | null; amount?: string | null; amountNote?: string | null; line?: string | null }) {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "64px 80px", backgroundColor: "#1A2E4A", fontFamily: "serif" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
            <svg width="110" height="80" viewBox="24 20 222 138">
              <line x1="40" y1="36" x2="160" y2="36" stroke="#FFFFFF" strokeWidth="16" strokeLinecap="round" />
              <line x1="76" y1="36" x2="76" y2="142" stroke="#FFFFFF" strokeWidth="16" strokeLinecap="round" />
              <line x1="76" y1="142" x2="160" y2="142" stroke="#B8922A" strokeWidth="16" strokeLinecap="round" />
              <path d="M160,36 Q230,36 230,89 Q230,142 160,142" fill="none" stroke="#B8922A" strokeWidth="16" strokeLinecap="round" />
            </svg>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: "46px", color: "#FFFFFF" }}>Traducciones Juradas</span>
              <span style={{ fontSize: "22px", color: "#D8CFBE", letterSpacing: "3px", fontFamily: "sans-serif" }}>MÁLAGA · TRADUCCIÓN JURADA OFICIAL</span>
            </div>
          </div>
          {opts.tag ? (
            <span style={{ fontSize: "26px", fontWeight: 700, color: "#1A2E4A", backgroundColor: "#B8922A", padding: "10px 22px", borderRadius: "8px", letterSpacing: "2px", fontFamily: "sans-serif" }}>{opts.tag}</span>
          ) : null}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {opts.amount ? <span style={{ fontSize: "120px", color: "#FFFFFF", lineHeight: 1 }}>{opts.amount}</span> : null}
          {opts.amountNote ? <span style={{ fontSize: "30px", color: "#D8CFBE", fontFamily: "sans-serif" }}>{opts.amountNote}</span> : null}
          {opts.line ? <span style={{ fontSize: "34px", color: "#FFFFFF", fontFamily: "sans-serif" }}>{opts.line}</span> : null}
        </div>
        <div style={{ display: "flex", fontSize: "24px", color: "#D8CFBE", fontFamily: "sans-serif" }}>
          <span>traduccionesjuradas.net</span>
        </div>
      </div>
    ),
    OG_SIZE
  );
}
