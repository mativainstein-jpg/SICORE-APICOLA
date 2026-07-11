import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Mueve el archivo original de la factura ya cargada a la carpeta del
 * proveedor en el servidor (elegida por el usuario, sección "carpeta por
 * proveedor"). Se usa copiar + borrar (no fs.rename) porque el archivo
 * original puede estar en otra unidad/disco que la carpeta destino.
 */
export async function moverFacturaACarpeta(
  carpetaDestino: string,
  rutaOriginal: string,
): Promise<string> {
  await fs.mkdir(carpetaDestino, { recursive: true });

  const nombreBase = path.basename(rutaOriginal, path.extname(rutaOriginal));
  const ext = path.extname(rutaOriginal);
  let destino = path.join(carpetaDestino, `${nombreBase}${ext}`);

  try {
    await fs.access(destino);
    // Ya existe un archivo con ese nombre: se agrega un sufijo con la hora
    // para no pisarlo.
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    destino = path.join(carpetaDestino, `${nombreBase}.${timestamp}${ext}`);
  } catch {
    // no existe, se puede usar el nombre tal cual
  }

  await fs.copyFile(rutaOriginal, destino);
  await fs.unlink(rutaOriginal);
  return destino;
}
