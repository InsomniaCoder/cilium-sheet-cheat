import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// A client-only build so `npm run build` produces static files in dist/.
export default defineConfig({
  plugins: [react()],
  base: "./",
});
