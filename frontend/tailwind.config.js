/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        zera: {
          ink: "#17211d",
          navy: "#1f2937",
          slate: "#334155",
          muted: "#5e6b66",
          line: "#dfe8e3",
          lineStrong: "#cbd8d1",
          green: "rgb(var(--zera-green, 21 128 61) / <alpha-value>)",
          greenDark: "rgb(var(--zera-green-dark, 17 101 49) / <alpha-value>)",
          mint: "rgb(var(--zera-mint, 233 248 239) / <alpha-value>)",
          mintSoft: "rgb(var(--zera-mint-soft, 244 251 246) / <alpha-value>)",
          gold: "#b98900",
          blue: "#2563eb",
          amber: "#b7791f",
          red: "#b42318",
          canvas: "#f6f8f7",
          surface: "#f1f5f3",
          panel: "#ffffff"
        }
      },
      boxShadow: {
        soft: "0 10px 24px rgba(23, 33, 29, 0.06)",
        panel: "0 18px 44px rgba(23, 33, 29, 0.12)",
        xs: "0 1px 2px rgba(23, 33, 29, 0.06)",
        card: "0 1px 2px rgba(23, 33, 29, 0.04), 0 12px 24px rgba(23, 33, 29, 0.04)"
      }
    }
  },
  plugins: []
};
