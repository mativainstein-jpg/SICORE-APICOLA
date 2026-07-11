import * as pdfjsLib from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

function base64ABytes(base64: string): Uint8Array {
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

async function renderizarPagina(pdfBase64: string, numeroPagina: number, escala: number): Promise<string> {
  const doc = await pdfjsLib.getDocument({ data: base64ABytes(pdfBase64) }).promise;
  const pagina = await doc.getPage(numeroPagina);
  const viewport = pagina.getViewport({ scale: escala });

  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const contexto = canvas.getContext("2d");
  if (!contexto) throw new Error("No se pudo crear el contexto de canvas para renderizar el PDF.");

  await pagina.render({ canvasContext: contexto, viewport }).promise;
  return canvas.toDataURL("image/png");
}

/**
 * Renderiza la primera página de un PDF (recibido como base64) a un PNG en
 * base64, en alta resolución. Se usa para poder pasar por OCR las facturas
 * escaneadas sin capa de texto, sin depender de librerías nativas en el
 * proceso principal.
 */
export function renderizarPrimeraPaginaComoPng(pdfBase64: string): Promise<string> {
  return renderizarPagina(pdfBase64, 1, 2.5);
}

/**
 * Renderiza la primera página de un PDF para mostrarla en el panel de
 * previsualización (resolución más liviana que la usada para OCR). Se
 * prefiere esto por sobre un <embed file://...>, que en Windows/modo
 * desarrollo no siempre carga.
 */
export function renderizarPrimeraPaginaParaVista(pdfBase64: string): Promise<string> {
  return renderizarPagina(pdfBase64, 1, 1.5);
}
