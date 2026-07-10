import ExcelJS from "exceljs";
import { promises as fs } from "node:fs";
import path from "node:path";
import type {
  FacturaConfirmada,
  ParametrosFiscales,
  RetencionesCalculadas,
} from "../../shared/types.js";
import { calcularRetenciones, type FilaCargada } from "../calculo/retenciones.js";
import { conArchivoBloqueado } from "./lock.js";
import { backupAntesDeEscribir } from "./backup.js";

/** Columnas de la hoja mensual de Sicore.xlsx, sección 5.2. */
export const COL_SICORE = {
  fechaEmision: 1, // A
  fechaPago: 2, // B
  cuit: 3, // C
  proveedor: 4, // D
  numeroFactura: 5, // E
  kg: 6, // F
  neto: 7, // G
  noGravado: 8, // H
  iva: 9, // I
  percepciones: 10, // J
  total: 11, // K
  retencionIva: 12, // L
  retencionGanancias: 13, // M
  aPlazo: 14, // N
  aPagar: 15, // O
} as const;

const HEADERS_SICORE = [
  "Fecha de emisión",
  "Fecha de pago",
  "CUIT",
  "Nombre del proveedor",
  "Número de factura",
  "Kg",
  "Neto",
  "No gravado",
  "IVA (monto)",
  "Percepciones",
  "Total",
  "Retención IVA",
  "Retención de Ganancias",
  "A Plazo",
  "A Pagar",
];

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

/** La factura se carga en la hoja del mes en que se está cargando, no el mes de emisión (5.1). */
export function nombreHojaMesActual(fecha: Date = new Date()): string {
  return MESES[fecha.getMonth()];
}

async function abrirOCrearWorkbook(rutaArchivo: string): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  try {
    await fs.access(rutaArchivo);
    await workbook.xlsx.readFile(rutaArchivo);
  } catch {
    // se crea vacío; las hojas de mes se agregan on-demand
  }
  return workbook;
}

function obtenerOCrearHojaMes(workbook: ExcelJS.Workbook, nombreMes: string): ExcelJS.Worksheet {
  let sheet = workbook.getWorksheet(nombreMes);
  if (!sheet) {
    sheet = workbook.addWorksheet(nombreMes);
    sheet.addRow(HEADERS_SICORE);
    sheet.getRow(1).font = { bold: true };
    sheet.columns.forEach((col) => {
      col.width = 18;
    });
  }
  return sheet;
}

function filasCargadasParaCuit(sheet: ExcelJS.Worksheet): FilaCargada[] {
  const filas: FilaCargada[] = [];
  for (let fila = 2; fila <= sheet.rowCount; fila++) {
    const cuit = String(sheet.getRow(fila).getCell(COL_SICORE.cuit).value ?? "").trim();
    if (cuit) filas.push({ cuit });
  }
  return filas;
}

export interface ResultadoEscrituraSicore {
  hoja: string;
  fila: number;
  retenciones: RetencionesCalculadas;
}

export async function agregarFacturaASicore(
  rutaSicoreXlsx: string,
  factura: FacturaConfirmada,
  parametros: ParametrosFiscales,
  ahora: Date = new Date(),
): Promise<ResultadoEscrituraSicore> {
  await fs.mkdir(path.dirname(rutaSicoreXlsx), { recursive: true });
  // aseguramos que el archivo exista antes de tomar el lock (proper-lockfile
  // necesita un path existente).
  try {
    await fs.access(rutaSicoreXlsx);
  } catch {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.writeFile(rutaSicoreXlsx);
  }

  return conArchivoBloqueado(rutaSicoreXlsx, async () => {
    await backupAntesDeEscribir(rutaSicoreXlsx);

    const workbook = await abrirOCrearWorkbook(rutaSicoreXlsx);
    const nombreMes = nombreHojaMesActual(ahora);
    const sheet = obtenerOCrearHojaMes(workbook, nombreMes);

    const filasDelMesParaCuit = filasCargadasParaCuit(sheet);
    const retenciones = calcularRetenciones(factura, parametros, filasDelMesParaCuit);

    const fila = sheet.addRow([
      factura.fechaEmision,
      factura.fechaPago ?? "",
      factura.cuit,
      factura.nombreProveedor,
      factura.numeroFactura,
      factura.kg ?? "",
      factura.neto,
      factura.noGravado,
      factura.ivaMonto,
      factura.percepciones,
      factura.total,
      retenciones.retencionIva,
      retenciones.retencionGanancias,
      retenciones.aPlazo,
      null, // A Pagar: fórmula, seteada abajo
    ]);
    const numeroFila = fila.number;
    fila.getCell(COL_SICORE.aPagar).value = {
      formula: `K${numeroFila}-L${numeroFila}-M${numeroFila}-N${numeroFila}`,
    };

    await workbook.xlsx.writeFile(rutaSicoreXlsx);

    return { hoja: nombreMes, fila: numeroFila, retenciones };
  });
}
