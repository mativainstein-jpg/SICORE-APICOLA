import { contextBridge, ipcRenderer } from "electron";
import type {
  DatosExtraidos,
  DuplicadoCheckResult,
  FacturaConfirmada,
  ParametrosFiscales,
  RetencionesCalculadas,
} from "../shared/types.js";

/**
 * Superficie de API expuesta al renderer vía contextBridge, con
 * contextIsolation activado y sin nodeIntegration (buena práctica de
 * seguridad de Electron: el renderer nunca tiene acceso directo a Node/fs).
 */
const api = {
  config: {
    leerParametros: (): Promise<ParametrosFiscales> =>
      ipcRenderer.invoke("config:leerParametros"),
    guardarParametros: (clave: string, parametros: ParametrosFiscales): Promise<void> =>
      ipcRenderer.invoke("config:guardarParametros", clave, parametros),
    verificarClaveAdmin: (clave: string): Promise<boolean> =>
      ipcRenderer.invoke("config:verificarClaveAdmin", clave),
    cambiarClaveAdmin: (claveActual: string, claveNueva: string): Promise<void> =>
      ipcRenderer.invoke("config:cambiarClaveAdmin", claveActual, claveNueva),
  },
  carpeta: {
    obtenerDestino: (): Promise<string | undefined> =>
      ipcRenderer.invoke("carpeta:obtenerDestino"),
    elegirDestino: (): Promise<string | undefined> =>
      ipcRenderer.invoke("carpeta:elegirDestino"),
  },
  factura: {
    seleccionarArchivos: (): Promise<string[]> =>
      ipcRenderer.invoke("factura:seleccionarArchivos"),
    extraerDatos: (rutaArchivo: string): Promise<DatosExtraidos> =>
      ipcRenderer.invoke("factura:extraerDatos", rutaArchivo),
    extraerDatosDesdeImagen: (pngDataUrl: string): Promise<DatosExtraidos> =>
      ipcRenderer.invoke("factura:extraerDatosDesdeImagen", pngDataUrl),
    chequearDuplicado: (cuit: string, numeroFactura: string): Promise<DuplicadoCheckResult> =>
      ipcRenderer.invoke("factura:chequearDuplicado", cuit, numeroFactura),
    previsualizarRetenciones: (factura: FacturaConfirmada): Promise<RetencionesCalculadas> =>
      ipcRenderer.invoke("factura:previsualizarRetenciones", factura),
    confirmar: (factura: FacturaConfirmada): Promise<unknown> =>
      ipcRenderer.invoke("factura:confirmar", factura),
  },
  captura: {
    guardar: (rutaFacturaOriginal: string, pngDataUrl: string): Promise<string> =>
      ipcRenderer.invoke("captura:guardar", rutaFacturaOriginal, pngDataUrl),
  },
  archivo: {
    leerBase64: (rutaArchivo: string): Promise<string> =>
      ipcRenderer.invoke("archivo:leerBase64", rutaArchivo),
  },
  actualizaciones: {
    onListaParaInstalar: (callback: (mensaje: string) => void): void => {
      ipcRenderer.on("actualizacion:lista", (_evt, mensaje: string) => callback(mensaje));
    },
  },
};

contextBridge.exposeInMainWorld("sicoreApi", api);

export type SicoreApi = typeof api;
