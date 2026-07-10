import electronUpdaterPkg from "electron-updater";
import log from "electron-log";
import type { BrowserWindow } from "electron";

// electron-updater es un módulo CommonJS: no expone exports nombrados en ESM,
// hay que desestructurar desde el export default.
const { autoUpdater } = electronUpdaterPkg;

/**
 * Auto-update en segundo plano contra GitHub Releases (sección 8.4-a).
 * Chequeo silencioso al abrir, descarga en background, instala en el
 * próximo reinicio. Los usuarios son administrativos no técnicos: no se
 * muestran diálogos ni mensajes técnicos, solo un aviso simple opcional.
 */
export function configurarAutoUpdater(ventana: BrowserWindow): void {
  autoUpdater.logger = log;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("update-downloaded", () => {
    ventana.webContents.send(
      "actualizacion:lista",
      "Hay una actualización lista, se aplicará al reiniciar la app.",
    );
  });

  autoUpdater.on("error", (err) => {
    log.error("Error de auto-actualización:", err);
    // Falla silenciosa: la app debe seguir funcionando con la versión actual
    // aunque no haya internet o el chequeo falle.
  });

  autoUpdater.checkForUpdatesAndNotify().catch((err) => {
    log.error("No se pudo chequear actualizaciones:", err);
  });
}
