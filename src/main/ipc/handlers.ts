import { ipcMain, dialog, BrowserWindow } from "electron";
import ExcelJS from "exceljs";
import { promises as fs } from "node:fs";
import { leerParametros, guardarParametros } from "../config/parametros.js";
import { verificarClaveAdmin, cambiarClaveAdmin } from "../config/admin.js";
import {
  leerCarpetaDestino,
  guardarCarpetaDestino,
  obtenerCarpetaProveedor,
  guardarCarpetaProveedor,
  rutaSicore,
  rutaApicola,
} from "../excel/workbookStore.js";
import { chequearDuplicado, chequearDuplicadoApicola } from "../excel/duplicados.js";
import { agregarFacturaASicore, nombreHojaMesActual, COL_SICORE } from "../excel/sicoreWriter.js";
import { agregarFacturaAApicola } from "../excel/apicolaWriter.js";
import { extraerDatosFactura, extraerDatosDesdeImagen } from "../extraccion/parserFactura.js";
import { guardarCaptura } from "../capturas.js";
import { moverFacturaACarpeta } from "../archivo.js";
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

  ipcMain.handle("proveedor:obtenerCarpeta", async (_evt, cuit: string) =>
    obtenerCarpetaProveedor(cuit),
  );

  ipcMain.handle(
    "proveedor:elegirCarpeta",
    async (_evt, cuit: string, nombreProveedorSugerido: string) => {
      const ventana = ventanaPrincipal();
      if (!ventana) return undefined;
      // Arranca en la última carpeta usada para este proveedor, si hay una,
      // para no tener que navegar desde cero cada vez — pero siempre deja
      // elegir/confirmar, nunca mueve el archivo sin preguntar.
      const carpetaAnterior = await obtenerCarpetaProveedor(cuit);
      const resultado = await dialog.showOpenDialog(ventana, {
        title: `Elegí la carpeta del servidor para ${nombreProveedorSugerido || "este proveedor"}`,
        defaultPath: carpetaAnterior,
        properties: ["openDirectory", "createDirectory"],
      });
      if (resultado.canceled || resultado.filePaths.length === 0) return undefined;
      const carpeta = resultado.filePaths[0];
      await guardarCarpetaProveedor(cuit, carpeta);
      return carpeta;
    },
  );

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

  ipcMain.handle("factura:extraerDatosDesdeImagen", async (_evt, pngDataUrl: string) =>
    extraerDatosDesdeImagen(pngDataUrl),
  );

  ipcMain.handle("archivo:leerBase64", async (_evt, rutaArchivo: string) => {
    const buffer = await fs.readFile(rutaArchivo);
    return buffer.toString("base64");
  });

  ipcMain.handle(
    "factura:chequearDuplicado",
    async (_evt, cuit: string, numeroFactura: string, tipoComprobante: "FCA" | "FCC") => {
      const carpeta = await requerirCarpetaDestino();
      return tipoComprobante === "FCC"
        ? chequearDuplicadoApicola(rutaApicola(carpeta), cuit, numeroFactura)
        : chequearDuplicado(rutaSicore(carpeta), cuit, numeroFactura);
    },
  );

  ipcMain.handle("factura:previsualizarRetenciones", async (_evt, factura: FacturaConfirmada) => {
    const carpeta = await requerirCarpetaDestino();
    const parametros = await leerParametros();
    const filas = await filasDelMesParaCuit(carpeta, factura.cuit);
    return calcularRetenciones(factura, parametros, filas);
  });

  ipcMain.handle(
    "factura:confirmar",
    async (_evt, factura: FacturaConfirmada, carpetaArchivoProveedor: string | undefined) => {
      const carpeta = await requerirCarpetaDestino();
      const parametros = await leerParametros();

      // Las facturas C (FCC) no se cargan en Sicore, solo en Apícola.
      const vaASicore = factura.tipoComprobante !== "FCC";

      const duplicado = vaASicore
        ? await chequearDuplicado(rutaSicore(carpeta), factura.cuit, factura.numeroFactura)
        : await chequearDuplicadoApicola(rutaApicola(carpeta), factura.cuit, factura.numeroFactura);
      if (duplicado.esDuplicado) {
        throw new Error(
          `Esta factura ya fue cargada antes (hoja "${duplicado.hoja}", fila ${duplicado.fila}).`,
        );
      }

      const resultadoSicore = vaASicore
        ? await agregarFacturaASicore(rutaSicore(carpeta), factura, parametros)
        : undefined;
      const resultadoApicola = await agregarFacturaAApicola(
        rutaApicola(carpeta),
        factura,
        parametros,
      );

      // Ya se guardó en los Excel. Si el usuario eligió una carpeta del
      // proveedor (siempre se le pregunta, nunca se mueve solo), el
      // archivo original se mueve ahí. Si no eligió ninguna (canceló el
      // selector), el archivo se deja donde estaba.
      let archivoMovidoA: string | undefined;
      if (carpetaArchivoProveedor) {
        try {
          archivoMovidoA = await moverFacturaACarpeta(
            carpetaArchivoProveedor,
            factura.archivoOriginal,
          );
        } catch (err) {
          console.error("No se pudo mover la factura a la carpeta del proveedor:", err);
        }
      }

      return { sicore: resultadoSicore, apicola: resultadoApicola, archivoMovidoA };
    },
  );

  ipcMain.handle(
    "captura:guardar",
    async (_evt, rutaFacturaOriginal: string, pngDataUrl: string) => {
      const carpeta = await requerirCarpetaDestino();
      return guardarCaptura(carpeta, rutaFacturaOriginal, pngDataUrl);
    },
  );
}
