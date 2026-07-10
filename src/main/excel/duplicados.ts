import ExcelJS from "exceljs";
import type { DuplicadoCheckResult } from "../../shared/types.js";
import { COL_SICORE } from "./sicoreWriter.js";

/**
 * Chequeo de duplicados por CUIT + N° de factura (mejora 9.1), recorriendo
 * todas las hojas (meses) de Sicore.xlsx, porque la misma factura no debería
 * cargarse dos veces sin importar en qué mes se la haya cargado antes.
 */
export async function chequearDuplicado(
  rutaSicoreXlsx: string,
  cuit: string,
  numeroFactura: string,
): Promise<DuplicadoCheckResult> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.readFile(rutaSicoreXlsx);
  } catch {
    return { esDuplicado: false };
  }

  for (const sheet of workbook.worksheets) {
    for (let fila = 2; fila <= sheet.rowCount; fila++) {
      const cuitFila = String(sheet.getRow(fila).getCell(COL_SICORE.cuit).value ?? "").trim();
      const numeroFila = String(
        sheet.getRow(fila).getCell(COL_SICORE.numeroFactura).value ?? "",
      ).trim();
      if (cuitFila === cuit.trim() && numeroFila === numeroFactura.trim()) {
        return { esDuplicado: true, hoja: sheet.name, fila };
      }
    }
  }
  return { esDuplicado: false };
}
