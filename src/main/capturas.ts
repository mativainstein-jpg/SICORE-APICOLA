import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Guarda la captura de pantalla de la previsualización de retenciones
 * (sección 2), en una carpeta "captura de pantalla/" junto a los Excel,
 * con el mismo nombre que el archivo de la factura original.
 */
export async function guardarCaptura(
  carpetaDestino: string,
  rutaFacturaOriginal: string,
  pngDataUrl: string,
): Promise<string> {
  const carpetaCapturas = path.join(carpetaDestino, "captura de pantalla");
  await fs.mkdir(carpetaCapturas, { recursive: true });

  const nombreBase = path.basename(
    rutaFacturaOriginal,
    path.extname(rutaFacturaOriginal),
  );
  const rutaSalida = path.join(carpetaCapturas, `${nombreBase}.png`);

  const base64 = pngDataUrl.replace(/^data:image\/png;base64,/, "");
  await fs.writeFile(rutaSalida, Buffer.from(base64, "base64"));
  return rutaSalida;
}
