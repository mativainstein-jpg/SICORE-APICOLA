import { createWorker } from "tesseract.js";

/**
 * OCR de respaldo (sección 8.2) para facturas escaneadas o en imagen, cuando
 * el PDF no tiene capa de texto útil. Se usa el idioma español.
 */
export async function extraerTextoOcr(rutaImagenOPdf: string): Promise<string> {
  const worker = await createWorker("spa");
  try {
    const {
      data: { text },
    } = await worker.recognize(rutaImagenOPdf);
    return text.trim();
  } finally {
    await worker.terminate();
  }
}
