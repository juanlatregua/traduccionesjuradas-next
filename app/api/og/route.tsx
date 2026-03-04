import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const title = searchParams.get("title") || "Traducciones juradas oficiales";
  const subtitle =
    searchParams.get("subtitle") || "Precio cerrado al instante";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "60px 80px",
          backgroundColor: "#1E3A5F",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Top: site name + accent line */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "12px",
                backgroundColor: "#C8A951",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "24px",
                fontWeight: 700,
                color: "#1E3A5F",
              }}
            >
              TJ
            </div>
            <span
              style={{
                fontSize: "22px",
                color: "#C8A951",
                fontWeight: 600,
                letterSpacing: "-0.02em",
              }}
            >
              TraduccionesJuradas.net
            </span>
          </div>
          <div
            style={{
              marginTop: "20px",
              width: "80px",
              height: "4px",
              backgroundColor: "#C8A951",
              borderRadius: "2px",
            }}
          />
        </div>

        {/* Center: title + subtitle */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            maxWidth: "900px",
          }}
        >
          <h1
            style={{
              fontSize: title.length > 50 ? "46px" : "56px",
              fontWeight: 700,
              color: "#FFFFFF",
              lineHeight: 1.15,
              letterSpacing: "-0.02em",
              margin: 0,
            }}
          >
            {title}
          </h1>
          <p
            style={{
              fontSize: "26px",
              color: "rgba(255, 255, 255, 0.7)",
              lineHeight: 1.4,
              margin: 0,
            }}
          >
            {subtitle}
          </p>
        </div>

        {/* Bottom: credential */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span
            style={{
              fontSize: "18px",
              color: "rgba(255, 255, 255, 0.5)",
              letterSpacing: "0.04em",
            }}
          >
            Traductor jurado oficial &middot; MAEC N.&ordm; 3850
          </span>
          <div
            style={{
              display: "flex",
              gap: "8px",
            }}
          >
            <div
              style={{
                padding: "8px 20px",
                borderRadius: "8px",
                backgroundColor: "rgba(255, 255, 255, 0.1)",
                color: "rgba(255, 255, 255, 0.7)",
                fontSize: "16px",
              }}
            >
              Entrega 24-72 h
            </div>
            <div
              style={{
                padding: "8px 20px",
                borderRadius: "8px",
                backgroundColor: "rgba(200, 169, 81, 0.2)",
                color: "#C8A951",
                fontSize: "16px",
              }}
            >
              Precio cerrado
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
