import ExcelJS from "exceljs";
import type { DuplicadoCheckResult } from "../../shared/types.js";
import { COL_SICORE } from "./sicoreWriter.js";
import { COL_APICOLA } from "./apicolaWriter.js";

async function chequearDuplicadoEnArchivo(
  rutaArchivo: string,
  colCuit: number,
  colNumeroFactura: number,
  cuit: string,
  numeroFactura: string,
): Promise<DuplicadoCheckResult> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.readFile(rutaArchivo);
  } catch {
    return { esDuplicado: false };
  }

  for (const sheet of workbook.worksheets) {
    for (let fila = 2; fila <= sheet.rowCount; fila++) {
      const cuitFila = String(sheet.getRow(fila).getCell(colCuit).value ?? "").trim();
      const numeroFila = String(sheet.getRow(fila).getCell(colNumeroFactura).value ?? "").trim();
      if (cuitFila === cuit.trim() && numeroFila === numeroFactura.trim()) {
        return { esDuplicado: true, hoja: sheet.name, fila };
      }
    }
  }
  return { esDuplicado: false };
}

/**
 * Chequeo de duplicados por CUIT + N° de factura (mejora 9.1) en Sicore.xlsx,
 * recorriendo todas las hojas (meses).
 */
export function chequearDuplicado(
  rutaSicoreXlsx: string,
  cuit: string,
  numeroFactura: string,
): Promise<DuplicadoCheckResult> {
  return chequearDuplicadoEnArchivo(
    rutaSicoreXlsx,
    COL_SICORE.cuit,
    COL_SICORE.numeroFactura,
    cuit,
    numeroFactura,
  );
}

/**
 * Mismo chequeo pero en Apicola.xlsx: necesario porque las facturas C
 * (FCC) solo se cargan ahí, nunca en Sicore.
 */
export function chequearDuplicadoApicola(
  rutaApicolaXlsx: string,
  cuit: string,
  numeroFactura: string,
): Promise<DuplicadoCheckResult> {
  return chequearDuplicadoEnArchivo(
    rutaApicolaXlsx,
    COL_APICOLA.cuit,
    COL_APICOLA.numeroComprobante,
    cuit,
    numeroFactura,
  );
}
