import ExcelJS from "exceljs";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { FacturaConfirmada, ParametrosFiscales } from "../../shared/types.js";
import { calcularRetenciones, sumaDescuentosAdicionales } from "../calculo/retenciones.js";
import { conArchivoBloqueado } from "./lock.js";
import { backupAntesDeEscribir } from "./backup.js";

function redondear2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Columnas de Apicola.xlsx, sección 6. Una única hoja "Facturas". */
export const COL_APICOLA = {
  vencimiento: 1, // A
  fechaRecepcion: 2, // B
  proveedor: 3, // C
  banco: 4, // D
  numeroComprobante: 5, // E
  tipo: 6, // F
  cuit: 7, // G
  comentarios: 8, // H
  importeAPagar: 9, // I
  tipoGasto: 10, // J
  controlKilos: 11, // K
  saldo: 12, // L
  acopiador: 13, // M
  orden: 14, // N
  kilosFacturados: 15, // O
  traza: 16, // P
  conciliacion: 17, // Q
  precio: 18, // R
  estado: 19, // S
  fechaEntrega: 20, // T
  comentarios2: 21, // U
} as const;

const HEADERS_APICOLA = [
  "Vencimiento",
  "Fecha de recepción",
  "Proveedor",
  "Banco",
  "N° de comprobante",
  "Tipo",
  "CUIT",
  "Comentarios",
  "Importe a pagar",
  "Tipo de gasto",
  "Control de kilos",
  "Saldo",
  "Acopiador",
  "Orden",
  "Kilos facturados",
  "Traza",
  "Conciliación",
  "Precio",
  "Estado",
  "Fecha de entrega",
  "Comentarios",
];

const NOMBRE_HOJA = "Facturas";

function sumarDias(fechaIso: string, dias: number): string {
  const fecha = new Date(fechaIso + "T00:00:00");
  fecha.setDate(fecha.getDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

async function abrirOCrearWorkbook(rutaArchivo: string): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  try {
    await fs.access(rutaArchivo);
    await workbook.xlsx.readFile(rutaArchivo);
  } catch {
    // se crea vacío
  }
  return workbook;
}

function obtenerOCrearHoja(workbook: ExcelJS.Workbook): ExcelJS.Worksheet {
  let sheet = workbook.getWorksheet(NOMBRE_HOJA);
  if (!sheet) {
    sheet = workbook.addWorksheet(NOMBRE_HOJA);
    sheet.addRow(HEADERS_APICOLA);
    sheet.getRow(1).font = { bold: true };
    sheet.columns.forEach((col) => {
      col.width = 16;
    });
  }
  return sheet;
}

export interface ResultadoEscrituraApicola {
  fila: number;
}

/**
 * Escribe la factura en Apicola.xlsx. El "Importe a pagar" (col. I) se
 * recalcula con el mismo módulo de retenciones que usa Sicore, de forma
 * independiente — nunca se lee Sicore.xlsx (decisión sección 8.5).
 */
export async function agregarFacturaAApicola(
  rutaApicolaXlsx: string,
  factura: FacturaConfirmada,
  parametros: ParametrosFiscales,
): Promise<ResultadoEscrituraApicola> {
  await fs.mkdir(path.dirname(rutaApicolaXlsx), { recursive: true });
  try {
    await fs.access(rutaApicolaXlsx);
  } catch {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.writeFile(rutaApicolaXlsx);
  }

  return conArchivoBloqueado(rutaApicolaXlsx, async () => {
    await backupAntesDeEscribir(rutaApicolaXlsx);

    const workbook = await abrirOCrearWorkbook(rutaApicolaXlsx);
    const sheet = obtenerOCrearHoja(workbook);

    // El cálculo de "primera factura del mes por CUIT" (col M de Sicore)
    // es un detalle propio de Sicore; para Apícola recalculamos las
    // retenciones sin ese contexto (no se puede leer Sicore.xlsx), por lo
    // que Importe a pagar usa el mínimo solo si el usuario así lo confirmó
    // al revisar la factura (factura.categoriaMinimoGanancias ya refleja
    // la decisión tomada en la pantalla de revisión).
    const retenciones = calcularRetenciones(factura, parametros, []);
    const descuentos = sumaDescuentosAdicionales(factura);
    const importeAPagar = redondear2(retenciones.aPagar - descuentos);

    const comentariosConDescuentos =
      factura.descuentosAdicionales.length > 0
        ? [
            factura.comentarios,
            `Descuentos: ${factura.descuentosAdicionales
              .map((d) => `${d.concepto} ($${d.monto})`)
              .join(", ")}`,
          ]
            .filter(Boolean)
            .join(" — ")
        : factura.comentarios ?? "";

    const fechaRecepcion = factura.fechaRecepcion ?? factura.fechaEmision;
    const vencimiento =
      factura.vencimientoManual ??
      sumarDias(fechaRecepcion, parametros.vencimiento_dias_default);

    const acopiador =
      factura.acopiador === "Otro" ? factura.acopiadorOtro ?? "Otro" : factura.acopiador ?? "";

    const fila = sheet.addRow([
      vencimiento,
      fechaRecepcion,
      factura.nombreProveedor,
      factura.banco ?? "",
      factura.numeroFactura,
      factura.tipoComprobante,
      factura.cuit,
      comentariosConDescuentos,
      importeAPagar,
      factura.tipoGasto,
      factura.controlKilos ?? "",
      null, // Saldo: fórmula K - O, seteada abajo
      acopiador,
      factura.orden ?? "",
      factura.kg ?? "",
      factura.traza ?? "",
      factura.conciliacion ?? "",
      factura.precioFacturado ?? "",
      factura.estado ?? "",
      factura.fechaEntrega ?? "",
      factura.comentarios2 ?? "",
    ]);
    const numeroFila = fila.number;
    fila.getCell(COL_APICOLA.saldo).value = {
      formula: `K${numeroFila}-O${numeroFila}`,
    };

    await workbook.xlsx.writeFile(rutaApicolaXlsx);

    return { fila: numeroFila };
  });
}
