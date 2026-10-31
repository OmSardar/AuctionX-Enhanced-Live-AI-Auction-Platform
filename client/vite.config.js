import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiTarget = env.VITE_API_URL || "http://localhost:5000";

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 3000,
      host: true, // 👈 This enables access via local IP
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
        },
        "/socket.io": {
          target: apiTarget,
          ws: true,
          changeOrigin: true,
          secure: false,
        },
        "/auth": {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    preview: {
      port: 4173,
      host: true,
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
        },
        "/socket.io": {
          target: apiTarget,
          ws: true,
          changeOrigin: true,
          secure: false,
        },
        "/auth": {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"), // ✅ Correct alias syntax
      },
    },
    build: {
      commonjsOptions: {
        transformMixedEsModules: true,
      },
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            if (id.includes("vite/preload-helper") || id.includes("@babel/runtime")) {
              return "vendor-react";
            }
            if (id.includes("node_modules/libphonenumber-js")) {
              return "vendor-libphonenumber";
            }
            if (
              id.includes("node_modules/chart.js") ||
              id.includes("node_modules/chartjs-adapter-moment") ||
              id.includes("node_modules/moment")
            ) {
              return "vendor-charts";
            }
            if (
              id.includes("node_modules/jspdf") ||
              id.includes("node_modules/pdf-lib") ||
              id.includes("node_modules/html2canvas")
            ) {
              return "vendor-pdf";
            }
            if (
              id.includes("node_modules/react/") ||
              id.includes("node_modules/react-dom/") ||
              id.includes("node_modules/react-router-dom/")
            ) {
              return "vendor-react";
            }
            if (
              id.includes("node_modules/@reduxjs/toolkit") ||
              id.includes("node_modules/react-redux") ||
              id.includes("node_modules/redux-persist")
            ) {
              return "vendor-redux";
            }
            if (
              id.includes("node_modules/lucide-react") ||
              id.includes("node_modules/react-icons")
            ) {
              return "vendor-icons";
            }
            if (
              id.includes("node_modules/framer-motion") ||
              id.includes("node_modules/gsap") ||
              id.includes("node_modules/@studio-freight/lenis")
            ) {
              return "vendor-animation";
            }
          },
        },
      },
    },
  };
});
