/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        zera: {
          ink: "#17211d",
          muted: "#5e6b66",
          line: "#dfe8e3",
          green: "#15803d",
          mint: "#e9f8ef",
          gold: "#b98900",
          canvas: "#f5f7f6",
          surface: "#f1f5f3"
        }
      },
      boxShadow: {
        soft: "0 12px 32px rgba(23, 33, 29, 0.07)",
        panel: "0 10px 24px rgba(23, 33, 29, 0.12)",
        xs: "0 1px 2px rgba(23, 33, 29, 0.06)"
      }
    }
  },
  plugins: []
};
