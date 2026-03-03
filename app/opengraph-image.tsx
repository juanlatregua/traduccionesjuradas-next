import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "TraduccionesJuradas.net — Traducción jurada oficial online";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          background: "linear-gradient(135deg, #1E3A5F 0%, #1B2A41 100%)",
          fontFamily: "system-ui, sans-serif",
          padding: 60,
        }}
      >
        {/* Logo horizontal — isotipo + wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          {/* Isotipo (escudo) */}
          <svg
            width="140"
            height="140"
            viewBox="0 0 200 200"
          >
            <path
              fill="#2A4A6B"
              d="M100 18 C136 18 160 30 174 44 V98 C174 142 146 170 100 186 C54 170 26 142 26 98 V44 C40 30 64 18 100 18 Z"
            />
            <path
              fill="#FFFFFF"
              d="M70 52 H122 L140 70 V126 C140 131 136 135 131 135 H70 C65 135 61 131 61 126 V61 C61 56 65 52 70 52 Z"
            />
            <path fill="#E8DCC8" d="M122 52 V70 H140" />
            <line x1="76" y1="82" x2="122" y2="82" stroke="#1B2A41" strokeWidth="8" strokeLinecap="round" opacity="0.85" />
            <line x1="76" y1="100" x2="122" y2="100" stroke="#1B2A41" strokeWidth="8" strokeLinecap="round" opacity="0.85" />
            <line x1="76" y1="118" x2="108" y2="118" stroke="#1B2A41" strokeWidth="8" strokeLinecap="round" opacity="0.85" />
            <circle fill="#0F6B66" cx="135" cy="124" r="26" />
            <path d="M124 124 L132 132 L147 113" fill="none" stroke="#FFFFFF" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
          </svg>

          {/* Wordmark */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span
              style={{
                fontSize: 54,
                fontWeight: 700,
                color: "#FFFFFF",
                letterSpacing: 1.5,
                lineHeight: 1.1,
              }}
            >
              TRADUCCIONES
            </span>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 4 }}>
              <span
                style={{
                  fontSize: 54,
                  fontWeight: 700,
                  color: "#0F6B66",
                  letterSpacing: 1.5,
                  lineHeight: 1.1,
                }}
              >
                JURADAS
              </span>
              <span
                style={{
                  fontSize: 36,
                  fontWeight: 600,
                  color: "#6C7A89",
                }}
              >
                .net
              </span>
            </div>
            {/* Separator line */}
            <div
              style={{
                width: 300,
                height: 3,
                backgroundColor: "#0F6B66",
                opacity: 0.35,
                marginTop: 6,
                borderRadius: 2,
              }}
            />
          </div>
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 26,
            color: "#E8DCC8",
            textAlign: "center",
            marginTop: 48,
            lineHeight: 1.4,
          }}
        >
          Traducción jurada oficial online · Precio cerrado al instante
        </div>

        {/* Bottom badges */}
        <div
          style={{
            display: "flex",
            gap: 16,
            marginTop: 32,
          }}
        >
          {[
            "Traductor jurado N.º 3850",
            "Entrega 24-48h",
            "10 idiomas",
            "+3.000 traducciones",
          ].map((badge) => (
            <div
              key={badge}
              style={{
                fontSize: 14,
                color: "#FFFFFF",
                backgroundColor: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 20,
                padding: "7px 18px",
              }}
            >
              {badge}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}
