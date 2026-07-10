import { createWorker } from "tesseract.js";

/**
 * OCR de respaldo (sección 8.2), para facturas en imagen (PNG/JPG). El
 * motor de OCR no puede leer un PDF crudo como imagen: si el PDF no tiene
 * capa de texto (factura escaneada), por ahora esos campos quedan para
 * completar a mano (fallback manual, sección 4) en vez de intentar un OCR
 * que fallaría. Nunca debe dejar pasar una excepción no controlada: un
 * error acá no puede tirar abajo toda la app.
 */
export async function extraerTextoOcr(rutaImagen: string): Promise<string> {
  const worker = await createWorker("spa");
  try {
    const {
      data: { text },
    } = await worker.recognize(rutaImagen);
    return text.trim();
  } catch (err) {
    console.error("Fallo el OCR de", rutaImagen, err);
    return "";
  } finally {
    await worker.terminate().catch(() => {});
  }
}
