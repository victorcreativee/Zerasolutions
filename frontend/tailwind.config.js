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
          gold: "#b98900"
        }
      },
      boxShadow: {
        soft: "0 18px 60px rgba(23, 33, 29, 0.08)"
      }
    }
  },
  plugins: []
};
