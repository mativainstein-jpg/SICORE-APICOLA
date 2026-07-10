import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import electron from "vite-plugin-electron/simple";

export default defineConfig({
  plugins: [
    react(),
    electron({
      main: {
        entry: "src/main/index.ts",
        vite: {
          build: {
            outDir: "dist-electron/main",
            rollupOptions: {
              external: ["electron", "exceljs", "electron-updater", "electron-log", "proper-lockfile", "pdfjs-dist", "tesseract.js"],
            },
          },
        },
      },
      preload: {
        input: "src/preload/index.ts",
        vite: {
          build: {
            outDir: "dist-electron/preload",
            rollupOptions: {
              external: ["electron"],
              output: {
                format: "cjs",
                entryFileNames: "index.cjs",
              },
            },
          },
        },
      },
      renderer: {},
    }),
  ],
});
