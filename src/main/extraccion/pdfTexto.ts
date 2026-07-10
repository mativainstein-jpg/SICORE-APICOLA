import { promises as fs } from "node:fs";

/**
 * Extrae la capa de texto de un PDF con pdfjs-dist (camino rápido y preciso,
 * sección 8.2). Si el PDF es una imagen escaneada, esto devuelve muy poco
 * o ningún texto, y el llamador debe caer a OCR.
 */
export async function extraerTextoPdf(rutaPdf: string): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = await fs.readFile(rutaPdf);
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(data) }).promise;

  let textoCompleto = "";
  for (let numeroPagina = 1; numeroPagina <= doc.numPages; numeroPagina++) {
    const pagina = await doc.getPage(numeroPagina);
    const contenido = await pagina.getTextContent();
    const textoPagina = contenido.items
      .map((item: any) => ("str" in item ? item.str : ""))
      .join(" ");
    textoCompleto += textoPagina + "\n";
  }
  return textoCompleto.trim();
}

/** Umbral bajo el cual se considera que el PDF no tiene capa de texto útil. */
export const MIN_CARACTERES_TEXTO_UTIL = 40;
