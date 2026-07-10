import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Copia de seguridad del Excel antes de cada escritura (mejora 9.3),
 * para poder revertir una carga mal hecha o recuperarse de corrupción.
 * Se guarda en una subcarpeta "backups" junto al archivo, con timestamp,
 * y se conservan solo las últimas N copias por archivo para no acumular
 * indefinidamente.
 */
const MAX_BACKUPS_POR_ARCHIVO = 20;

export async function backupAntesDeEscribir(rutaArchivo: string): Promise<void> {
  try {
    await fs.access(rutaArchivo);
  } catch {
    return; // no existe todavía: nada que respaldar
  }

  const dir = path.dirname(rutaArchivo);
  const nombre = path.basename(rutaArchivo, path.extname(rutaArchivo));
  const ext = path.extname(rutaArchivo);
  const carpetaBackups = path.join(dir, "backups");
  await fs.mkdir(carpetaBackups, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const destino = path.join(carpetaBackups, `${nombre}.${timestamp}${ext}`);
  await fs.copyFile(rutaArchivo, destino);

  await limpiarBackupsViejos(carpetaBackups, nombre, ext);
}

async function limpiarBackupsViejos(
  carpetaBackups: string,
  nombreBase: string,
  ext: string,
): Promise<void> {
  const archivos = (await fs.readdir(carpetaBackups))
    .filter((f) => f.startsWith(`${nombreBase}.`) && f.endsWith(ext))
    .sort();
  const sobrantes = archivos.length - MAX_BACKUPS_POR_ARCHIVO;
  if (sobrantes <= 0) return;
  for (const f of archivos.slice(0, sobrantes)) {
    await fs.unlink(path.join(carpetaBackups, f)).catch(() => {});
  }
}
