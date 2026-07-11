import { extraerTextoPdf, MIN_CARACTERES_TEXTO_UTIL } from "./pdfTexto.js";
import { extraerTextoOcr } from "./ocr.js";
import { detectarEsMiel } from "./deteccionMiel.js";
import type { DatosExtraidos, TipoComprobante } from "../../shared/types.js";

function parsearMonto(texto: string | undefined): number | undefined {
  if (!texto) return undefined;
  // Formato argentino: 1.234.567,89
  const limpio = texto.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  if (!limpio) return undefined;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : undefined;
}

function buscar(regex: RegExp, texto: string): string | undefined {
  const m = texto.match(regex);
  return m?.[1]?.trim();
}

function parsearFechaAAAAMMDD(fechaTexto: string | undefined): string | undefined {
  if (!fechaTexto) return undefined;
  const m = fechaTexto.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (!m) return undefined;
  let [, dia, mes, anio] = m;
  if (anio.length === 2) anio = `20${anio}`;
  return `${anio}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`;
}

function normalizarCuit(cuitTexto: string | undefined): string | undefined {
  if (!cuitTexto) return undefined;
  const digitos = cuitTexto.replace(/\D/g, "");
  return digitos.length === 11 ? digitos : undefined;
}

function detectarTipoComprobante(texto: string): TipoComprobante | undefined {
  // Facturas de compra tipo A o C (spec usa FCA/FCC = Factura Compra A / Factura Compra C).
  if (/\bFACTURA\b[\s\S]{0,40}\bA\b/i.test(texto) || /\bC[oó]d(igo)?\.?\s*0?01\b/i.test(texto)) {
    return "FCA";
  }
  if (/\bFACTURA\b[\s\S]{0,40}\bC\b/i.test(texto) || /\bC[oó]d(igo)?\.?\s*0?11\b/i.test(texto)) {
    return "FCC";
  }
  return undefined;
}

/**
 * Extrae los campos de la sección 4 de la spec a partir del texto plano de
 * la factura, con regex/heurísticas tolerantes a formatos distintos de
 * AFIP. Cualquier campo no detectado queda undefined; la UI lo marca para
 * completar a mano (fallback manual, sección 4).
 */
export function parsearCamposDesdeTexto(texto: string): Omit<
  DatosExtraidos,
  "textoCompleto" | "metodoExtraccion"
> {
  const fechaEmisionTexto = buscar(/Fecha\s*de\s*Emisi[oó]n\s*:?\s*([\d/\-]+)/i, texto);
  const cuitTexto = buscar(/C\.?U\.?I\.?T\.?\s*(?:N[°ºo]?)?\s*:?\s*([\d\-.]{11,14})/i, texto);
  const numeroFacturaTexto =
    buscar(/(?:Comp\.?\s*Nro|N[uú]mero|Factura)\s*:?\s*(\d{4,5}[\-\s]?\d{4,8})/i, texto) ??
    buscar(/(\b\d{4,5}-\d{8}\b)/, texto);
  const nombreProveedor = buscar(/Raz[oó]n\s*Social\s*:?\s*([^\n]+)/i, texto);

  const netoTexto = buscar(/Importe\s*Neto\s*Gravado\s*:?\s*\$?\s*([\d.,]+)/i, texto);
  const noGravadoTexto = buscar(/Importe\s*(?:Neto\s*)?No\s*Gravado\s*:?\s*\$?\s*([\d.,]+)/i, texto);
  const ivaTexto = buscar(/(?:IVA|I\.V\.A\.)\s*(?:21\s*%|10[.,]5\s*%)?\s*:?\s*\$?\s*([\d.,]+)/i, texto);
  const percepcionesTexto = buscar(/Percepci[oó]n(?:es)?[^:\n]*:?\s*\$?\s*([\d.,]+)/i, texto);
  const totalTexto = buscar(/Importe\s*Total\s*:?\s*\$?\s*([\d.,]+)/i, texto);
  const kgTexto = buscar(/(\d[\d.,]*)\s*Kg\b/i, texto);
  const precioTexto = buscar(/Precio\s*(?:Unitario|por\s*Kg)?\s*:?\s*\$?\s*([\d.,]+)/i, texto);

  return {
    fechaEmision: parsearFechaAAAAMMDD(fechaEmisionTexto),
    cuit: normalizarCuit(cuitTexto),
    nombreProveedor,
    numeroFactura: numeroFacturaTexto,
    tipoComprobante: detectarTipoComprobante(texto),
    neto: parsearMonto(netoTexto),
    noGravado: parsearMonto(noGravadoTexto),
    ivaMonto: parsearMonto(ivaTexto),
    percepciones: parsearMonto(percepcionesTexto),
    total: parsearMonto(totalTexto),
    kg: parsearMonto(kgTexto),
    precioFacturado: parsearMonto(precioTexto),
    esMiel: detectarEsMiel(texto),
  };
}

/**
 * Pipeline híbrido completo (sección 8.2): intenta texto de PDF primero;
 * si es insuficiente, cae a OCR.
 */
export async function extraerDatosFactura(rutaArchivo: string): Promise<DatosExtraidos> {
  const esPdf = rutaArchivo.toLowerCase().endsWith(".pdf");
  let texto = "";
  let metodo: "texto" | "ocr" = "texto";

  if (esPdf) {
    try {
      texto = await extraerTextoPdf(rutaArchivo);
    } catch {
      texto = "";
    }
  }

  if (texto.length < MIN_CARACTERES_TEXTO_UTIL) {
    if (esPdf) {
      // PDF escaneado sin capa de texto: por ahora no se rasteriza a imagen
      // para pasarlo por OCR (requeriría una dependencia nativa extra). El
      // usuario completa esos campos a mano (fallback manual, sección 4).
      texto = "";
    } else {
      texto = await extraerTextoOcr(rutaArchivo);
    }
    metodo = "ocr";
  }

  const campos = parsearCamposDesdeTexto(texto);
  return { ...campos, textoCompleto: texto, metodoExtraccion: metodo };
}

/**
 * Extrae los campos de una factura a partir de una imagen ya renderizada
 * (dataURL PNG), usando OCR. Se usa para PDFs escaneados: el renderer
 * convierte la página del PDF a imagen (con Canvas del navegador, sin
 * depender de librerías nativas en el proceso principal) y manda esa
 * imagen acá para el reconocimiento de texto.
 */
export async function extraerDatosDesdeImagen(pngDataUrl: string): Promise<DatosExtraidos> {
  const texto = await extraerTextoOcr(pngDataUrl);
  const campos = parsearCamposDesdeTexto(texto);
  return { ...campos, textoCompleto: texto, metodoExtraccion: "ocr" };
}
