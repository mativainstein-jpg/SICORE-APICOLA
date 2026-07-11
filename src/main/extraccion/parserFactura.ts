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

function redondear2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function buscar(regex: RegExp, texto: string): string | undefined {
  const m = texto.match(regex);
  return m?.[1]?.trim();
}

/**
 * Facturas C de monotributistas (y muchas facturas con ítems) no tienen
 * "Neto Gravado"/"IVA" como etiquetas sueltas: tienen una tabla de
 * productos con columnas Cantidad / U. Medida / Precio Unit. / % Bonif /
 * Imp. Bonif. / Subtotal. Busca la fila de datos de esa tabla (un número,
 * una palabra de unidad, y otros 4 números) para poder sacar de ahí la
 * cantidad (Kg), el precio unitario y el subtotal (Neto/Total).
 */
function buscarFilaTablaProductos(
  texto: string,
): { cantidad: string; precioUnit: string; subtotal: string } | undefined {
  // Número en formato argentino: con o sin puntos de miles (ej. "1006,00" o
  // "1.006,00"). El orden importa: si probáramos primero la versión "sin
  // puntos" quedaría conforme con un prefijo corto (ej. "316" de
  // "3168900") sin llegar a intentar la alternativa correcta.
  const NUM = String.raw`\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:,\d+)?`;
  const m = texto.match(
    new RegExp(
      `(${NUM})\\s+(?:unidades?|u\\.?|un\\.?|kgs?\\.?|kilos?|litros?|lts?\\.?)\\s+(${NUM})\\s+[\\d.,]+\\s+[\\d.,]+\\s+(${NUM})`,
      "i",
    ),
  );
  if (!m) return undefined;
  return { cantidad: m[1], precioUnit: m[2], subtotal: m[3] };
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
  // AFIP suele mostrar "Punto de Venta" y "Comp. Nro" como dos campos
  // separados (no un solo "0001-00000001" corrido); si aparecen así, se
  // arma el número combinándolos con el relleno de ceros habitual.
  const puntoVentaTexto = buscar(/Punto\s*de\s*Venta\s*:?\s*(?:N[°ºo]?\.?)?\s*(\d{1,5})/i, texto);
  const compNroTexto = buscar(/Comp\.?\s*(?:Nro|N[uú]mero)\.?\s*:?\s*(\d{1,8})/i, texto);
  const numeroFacturaTexto =
    puntoVentaTexto && compNroTexto
      ? `${puntoVentaTexto.padStart(4, "0")}-${compNroTexto.padStart(8, "0")}`
      : buscar(/(\b\d{4,5}-\d{8}\b)/, texto) ??
        compNroTexto ??
        buscar(/(?:N[uú]mero|Factura)\s*:?\s*(\d{4,5}[\-\s]?\d{4,8})/i, texto);
  // Corta antes de la próxima etiqueta conocida de la factura, no solo en el
  // salto de línea: el texto de OCR suele venir sin saltos de línea limpios
  // y si no, "Nombre del proveedor" termina incluyendo el campo siguiente.
  const PROXIMA_ETIQUETA =
    /(?:Fecha\s*de\s*Emisi[oó]n|C\.?U\.?I\.?T|Domicilio|Cond(?:ici[oó]n)?|IVA|Comp\.?\s*Nro|N[uú]mero|Factura|Punto\s*de\s*Venta)\b/i;
  const nombreProveedorTexto = buscar(/Raz[oó]n\s*Social\s*:?\s*([^\n]+)/i, texto);
  const nombreProveedor = nombreProveedorTexto
    ? nombreProveedorTexto.split(PROXIMA_ETIQUETA)[0].trim()
    : undefined;

  const filaTabla = buscarFilaTablaProductos(texto);

  const netoTexto =
    buscar(/(?:Importe\s*)?Neto\s*Gravado\s*:?\s*\$?\s*(\d[\d.,]*)/i, texto) ??
    buscar(/(?:Importe\s*)?Neto\s*:?\s*\$?\s*(\d[\d.,]*)/i, texto) ??
    buscar(/Subtotal\s*:?\s*\$?\s*(\d[\d.,]*)/i, texto) ??
    filaTabla?.subtotal;
  const noGravadoTexto = buscar(/Importe\s*(?:Neto\s*)?No\s*Gravado\s*:?\s*\$?\s*(\d[\d.,]*)/i, texto);
  const ivaTexto = buscar(/(?:IVA|I\.V\.A\.)\s*(?:21\s*%|10[.,]5\s*%)?\s*:?\s*\$?\s*(\d[\d.,]*)/i, texto);
  const percepcionesTexto = buscar(/Percepci[oó]n(?:es)?[^:\n]*:?\s*\$?\s*(\d[\d.,]*)/i, texto);
  const totalTexto =
    buscar(/Importe\s*Total\s*:?\s*\$?\s*(\d[\d.,]*)/i, texto) ?? filaTabla?.subtotal;
  const kgTexto = buscar(/(\d[\d.,]*)\s*Kg\b/i, texto) ?? filaTabla?.cantidad;
  const precioTexto =
    buscar(/Precio\s*(?:Unitario|por\s*Kg|x\s*Kg|Unit\.?)?\s*:?\s*\$?\s*(\d[\d.,]*)/i, texto) ??
    buscar(/P\.?\s*Unit(?:ario|\.)?\s*:?\s*\$?\s*(\d[\d.,]*)/i, texto) ??
    filaTabla?.precioUnit;

  const esMiel = detectarEsMiel(texto);
  const tipoComprobante = detectarTipoComprobante(texto);
  const neto = parsearMonto(netoTexto);
  const total = parsearMonto(totalTexto);

  // El IVA se calcula, no se lee de una etiqueta suelta (que en muchas
  // facturas ni existe o viene mal formada): en miel es 10,5% del Neto
  // (alícuota reducida), y en el resto de las facturas A, Total - Neto.
  let ivaMonto: number | undefined;
  if (esMiel && tipoComprobante === "FCA" && neto !== undefined) {
    ivaMonto = redondear2(neto * 0.105);
  } else if (neto !== undefined && total !== undefined) {
    ivaMonto = redondear2(total - neto);
  } else {
    ivaMonto = parsearMonto(ivaTexto);
  }

  return {
    fechaEmision: parsearFechaAAAAMMDD(fechaEmisionTexto),
    cuit: normalizarCuit(cuitTexto),
    nombreProveedor,
    numeroFactura: numeroFacturaTexto,
    tipoComprobante,
    neto,
    noGravado: parsearMonto(noGravadoTexto),
    ivaMonto,
    percepciones: parsearMonto(percepcionesTexto),
    total,
    kg: parsearMonto(kgTexto),
    precioFacturado: parsearMonto(precioTexto),
    esMiel,
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
