import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        parchment: "#F7F1E6",
        cream: "#F0EBE0",
        card: "#FDFAF4",
        encre: "#1A2E4A",
        sepia: "#3D3630",
        graphite: "#5F564E",
        bleu: {
          DEFAULT: "#1A2E4A",
          dark: "#0F1E30",
          light: "#3D6FA8",
        },
        or: {
          DEFAULT: "#B8922A",
          light: "#F0E2B8",
          dark: "#8A6A1A",
        },
        rouge: "#8B2500",
        vert: "#2D5016",
      },
      fontFamily: {
        baskerville: [
          "Libre Baskerville",
          "Georgia",
          "Times New Roman",
          "serif",
        ],
        sans: [
          "Source Sans 3",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "sans-serif",
        ],
        caveat: ["Caveat", "cursive"],
      },
      animation: {
        stampIn: "stampIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        inkWrite: "inkWrite 1.2s ease-out forwards",
        slideUp: "slideUp 0.6s ease-out forwards",
        fadeIn: "fadeIn 0.5s ease-out forwards",
      },
      keyframes: {
        stampIn: {
          "0%": { transform: "scale(2.5) rotate(-15deg)", opacity: "0" },
          "60%": { transform: "scale(0.9) rotate(2deg)", opacity: "1" },
          "100%": { transform: "scale(1) rotate(0deg)", opacity: "1" },
        },
        inkWrite: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "30%": { opacity: "1" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(30px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
      borderRadius: {
        doc: "8px",
      },
      boxShadow: {
        paper:
          "2px 3px 8px rgba(28, 25, 23, 0.08), -1px -1px 4px rgba(28, 25, 23, 0.03)",
        "paper-hover":
          "4px 6px 16px rgba(28, 25, 23, 0.12), -2px -2px 8px rgba(28, 25, 23, 0.04)",
      },
    },
  },
  plugins: [],
};
export default config;
