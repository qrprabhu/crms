import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/postcss";

export default defineConfig({
  plugins: [react()],
  css: {
    postcss: {
      plugins: [tailwindcss()],
    },
  },
  preview: {
    allowedHosts: [".ondigitalocean.app", "localhost", "127.0.0.1"],
  },
  server: {
    allowedHosts: [".ondigitalocean.app", "localhost", "127.0.0.1"],
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;

          if (id.includes("/node_modules/react-router/") || id.includes("/node_modules/react-router-dom/")) {
            return "router-vendor";
          }

          if (
            id.includes("/node_modules/react/") ||
            id.includes("/node_modules/react-dom/") ||
            id.includes("/node_modules/scheduler/")
          ) {
            return "react-vendor";
          }

          if (
            id.includes("/node_modules/recharts/") ||
            id.includes("/node_modules/d3-") ||
            id.includes("/node_modules/victory-vendor/")
          ) {
            return "charts-vendor";
          }

          if (id.includes("/node_modules/xlsx/")) {
            return "excel-vendor";
          }

          if (id.includes("/node_modules/jszip/")) {
            return "zip-vendor";
          }

          if (id.includes("/node_modules/papaparse/")) {
            return "csv-vendor";
          }

          if (id.includes("/node_modules/pdfjs-dist/")) {
            return "pdf-vendor";
          }

          if (id.includes("/node_modules/lucide-react/")) {
            return "icons-vendor";
          }

          if (id.includes("/node_modules/country-state-city/lib/country")) {
            return "geo-country-vendor";
          }

          if (id.includes("/node_modules/country-state-city/lib/state")) {
            return "geo-state-vendor";
          }

          if (id.includes("/node_modules/country-state-city/lib/assets/country.json")) {
            return "geo-country-data-vendor";
          }

          if (id.includes("/node_modules/country-state-city/lib/assets/state.json")) {
            return "geo-state-data-vendor";
          }

          if (id.includes("/node_modules/axios/")) {
            return "network-vendor";
          }

          return "vendor";
        },
      },
    },
  },
});
