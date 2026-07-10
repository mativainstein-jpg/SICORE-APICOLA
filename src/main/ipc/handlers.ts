import { ipcMain, dialog, BrowserWindow } from "electron";
import ExcelJS from "exceljs";
import { leerParametros, guardarParametros } from "../config/parametros.js";
import { verificarClaveAdmin, cambiarClaveAdmin } from "../config/admin.js";
import {
  leerCarpetaDestino,
  guardarCarpetaDestino,
  rutaSicore,
  rutaApicola,
} from "../excel/workbookStore.js";
import { chequearDuplicado } from "../excel/duplicados.js";
import { agregarFacturaASicore, nombreHojaMesActual, COL_SICORE } from "../excel/sicoreWriter.js";
import { agregarFacturaAApicola } from "../excel/apicolaWriter.js";
import { extraerDatosFactura } from "../extraccion/parserFactura.js";
import { guardarCaptura } from "../capturas.js";
import { calcularRetenciones, type FilaCargada } from "../calculo/retenciones.js";
import type { FacturaConfirmada, ParametrosFiscales } from "../../shared/types.js";

async function requerirCarpetaDestino(): Promise<string> {
  const carpeta = await leerCarpetaDestino();
  if (!carpeta) {
    throw new Error(
      "Todavía no se eligió la carpeta donde se guardan Sicore.xlsx y Apicola.xlsx.",
    );
  }
  return carpeta;
}

async function filasDelMesParaCuit(carpeta: string, cuit: string): Promise<FilaCargada[]> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.readFile(rutaSicore(carpeta));
  } catch {
    return [];
  }
  const sheet = workbook.getWorksheet(nombreHojaMesActual());
  if (!sheet) return [];
  const filas: FilaCargada[] = [];
  for (let fila = 2; fila <= sheet.rowCount; fila++) {
    const cuitFila = String(sheet.getRow(fila).getCell(COL_SICORE.cuit).value ?? "").trim();
    if (cuitFila) filas.push({ cuit: cuitFila });
  }
  return filas;
}

export function registrarHandlersIpc(ventanaPrincipal: () => BrowserWindow | null): void {
  ipcMain.handle("config:leerParametros", async () => leerParametros());

  ipcMain.handle(
    "config:guardarParametros",
    async (_evt, clave: string, parametros: ParametrosFiscales) => {
      const ok = await verificarClaveAdmin(clave);
      if (!ok) throw new Error("Clave de administrador incorrecta.");
      await guardarParametros(parametros);
    },
  );

  ipcMain.handle("config:verificarClaveAdmin", async (_evt, clave: string) =>
    verificarClaveAdmin(clave),
  );

  ipcMain.handle(
    "config:cambiarClaveAdmin",
    async (_evt, claveActual: string, claveNueva: string) => {
      const ok = await verificarClaveAdmin(claveActual);
      if (!ok) throw new Error("Clave actual incorrecta.");
      await cambiarClaveAdmin(claveNueva);
    },
  );

  ipcMain.handle("carpeta:obtenerDestino", async () => leerCarpetaDestino());

  ipcMain.handle("carpeta:elegirDestino", async () => {
    const ventana = ventanaPrincipal();
    if (!ventana) return undefined;
    const resultado = await dialog.showOpenDialog(ventana, {
      title: "Elegir carpeta para Sicore.xlsx y Apicola.xlsx",
      properties: ["openDirectory", "createDirectory"],
    });
    if (resultado.canceled || resultado.filePaths.length === 0) return undefined;
    const carpeta = resultado.filePaths[0];
    await guardarCarpetaDestino(carpeta);
    return carpeta;
  });

  ipcMain.handle("factura:seleccionarArchivos", async () => {
    const ventana = ventanaPrincipal();
    if (!ventana) return [];
    const resultado = await dialog.showOpenDialog(ventana, {
      title: "Cargar facturas",
      properties: ["openFile", "multiSelections"],
      filters: [
        { name: "Facturas", extensions: ["pdf", "png", "jpg", "jpeg"] },
      ],
    });
    return resultado.canceled ? [] : resultado.filePaths;
  });

  ipcMain.handle("factura:extraerDatos", async (_evt, rutaArchivo: string) =>
    extraerDatosFactura(rutaArchivo),
  );

  ipcMain.handle(
    "factura:chequearDuplicado",
    async (_evt, cuit: string, numeroFactura: string) => {
      const carpeta = await requerirCarpetaDestino();
      return chequearDuplicado(rutaSicore(carpeta), cuit, numeroFactura);
    },
  );

  ipcMain.handle("factura:previsualizarRetenciones", async (_evt, factura: FacturaConfirmada) => {
    const carpeta = await requerirCarpetaDestino();
    const parametros = await leerParametros();
    const filas = await filasDelMesParaCuit(carpeta, factura.cuit);
    return calcularRetenciones(factura, parametros, filas);
  });

  ipcMain.handle("factura:confirmar", async (_evt, factura: FacturaConfirmada) => {
    const carpeta = await requerirCarpetaDestino();
    const parametros = await leerParametros();

    const duplicado = await chequearDuplicado(
      rutaSicore(carpeta),
      factura.cuit,
      factura.numeroFactura,
    );
    if (duplicado.esDuplicado) {
      throw new Error(
        `Esta factura ya fue cargada antes (hoja "${duplicado.hoja}", fila ${duplicado.fila}).`,
      );
    }

    const resultadoSicore = await agregarFacturaASicore(rutaSicore(carpeta), factura, parametros);
    const resultadoApicola = await agregarFacturaAApicola(
      rutaApicola(carpeta),
      factura,
      parametros,
    );

    return { sicore: resultadoSicore, apicola: resultadoApicola };
  });

  ipcMain.handle(
    "captura:guardar",
    async (_evt, rutaFacturaOriginal: string, pngDataUrl: string) => {
      const carpeta = await requerirCarpetaDestino();
      return guardarCaptura(carpeta, rutaFacturaOriginal, pngDataUrl);
    },
  );
}
