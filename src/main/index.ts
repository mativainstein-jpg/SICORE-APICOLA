import { app, BrowserWindow } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { registrarHandlersIpc } from "./ipc/handlers.js";
import { configurarAutoUpdater } from "./updater.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// import.meta.env.DEV es inyectado por vite-plugin-electron en desarrollo.
const esDev = !app.isPackaged;

let ventanaPrincipal: BrowserWindow | null = null;

function crearVentana(): void {
  ventanaPrincipal = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: "Sicore / Apícola — NAIMAN Foods",
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (esDev && process.env.VITE_DEV_SERVER_URL) {
    ventanaPrincipal.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    ventanaPrincipal.loadFile(path.join(__dirname, "../../dist/index.html"));
  }

  ventanaPrincipal.on("closed", () => {
    ventanaPrincipal = null;
  });

  if (!esDev) {
    configurarAutoUpdater(ventanaPrincipal);
  }
}

app.whenReady().then(() => {
  registrarHandlersIpc(() => ventanaPrincipal);
  crearVentana();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) crearVentana();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
