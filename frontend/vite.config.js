import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: process.env.ZERA_HOSTED_BUILD === 'true' ? '/' : './',
  plugins: [react()],
  server: {
    port: 5178
  }
});
