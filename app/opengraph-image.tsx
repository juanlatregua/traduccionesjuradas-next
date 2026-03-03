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
        }}
      >
        {/* Shield icon */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 80,
            height: 80,
            borderRadius: 20,
            backgroundColor: "#0F6B66",
            marginBottom: 24,
            fontSize: 40,
          }}
        >
          <span style={{ color: "white" }}>&#10003;</span>
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: 52,
            fontWeight: 700,
            color: "#FFFFFF",
            textAlign: "center",
            lineHeight: 1.2,
          }}
        >
          TRADUCCIONES JURADAS
        </div>
        <div
          style={{
            fontSize: 52,
            fontWeight: 700,
            color: "#0F6B66",
            textAlign: "center",
            marginTop: 4,
          }}
        >
          .net
        </div>

        {/* Separator */}
        <div
          style={{
            width: 120,
            height: 4,
            backgroundColor: "#0F6B66",
            borderRadius: 2,
            marginTop: 28,
            marginBottom: 28,
          }}
        />

        {/* Subtitle */}
        <div
          style={{
            fontSize: 28,
            color: "#E8DCC8",
            textAlign: "center",
            maxWidth: 800,
            lineHeight: 1.4,
          }}
        >
          Traducción jurada oficial online
        </div>
        <div
          style={{
            fontSize: 22,
            color: "#E8DCC8",
            opacity: 0.8,
            textAlign: "center",
            marginTop: 12,
          }}
        >
          Precio cerrado al instante &middot; Traductor jurado N.º 3850
        </div>

        {/* Bottom badges */}
        <div
          style={{
            display: "flex",
            gap: 16,
            marginTop: 40,
          }}
        >
          {["24-48h entrega", "10 idiomas", "+3.000 traducciones"].map(
            (badge) => (
              <div
                key={badge}
                style={{
                  fontSize: 16,
                  color: "#FFFFFF",
                  backgroundColor: "rgba(255,255,255,0.1)",
                  borderRadius: 20,
                  padding: "8px 20px",
                }}
              >
                {badge}
              </div>
            )
          )}
        </div>
      </div>
    ),
    { ...size }
  );
}
