import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Mueve el archivo original de la factura ya cargada a una carpeta
 * "Facturas procesadas" dentro de la carpeta destino, para que no quede
 * mezclado con las facturas todavía pendientes de cargar. Se usa copiar +
 * borrar (no fs.rename) porque el archivo original puede estar en otra
 * unidad/disco (ej. Descargas en C:, carpeta destino en un disco de red).
 */
export async function moverFacturaAProcesadas(
  carpetaDestino: string,
  rutaOriginal: string,
): Promise<string> {
  const carpetaProcesadas = path.join(carpetaDestino, "Facturas procesadas");
  await fs.mkdir(carpetaProcesadas, { recursive: true });

  const nombreBase = path.basename(rutaOriginal, path.extname(rutaOriginal));
  const ext = path.extname(rutaOriginal);
  let destino = path.join(carpetaProcesadas, `${nombreBase}${ext}`);

  try {
    await fs.access(destino);
    // Ya existe un archivo con ese nombre: se agrega un sufijo con la hora
    // para no pisarlo (puede pasar si dos proveedores mandan un archivo
    // con el mismo nombre, ej. "factura.pdf").
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    destino = path.join(carpetaProcesadas, `${nombreBase}.${timestamp}${ext}`);
  } catch {
    // no existe, se puede usar el nombre tal cual
  }

  await fs.copyFile(rutaOriginal, destino);
  await fs.unlink(rutaOriginal);
  return destino;
}
