import lockfile from "proper-lockfile";

/**
 * Bloqueo de archivo + cola de escritura (mejora 9.2): evita que dos
 * administrativos cargando facturas al mismo tiempo corrompan el mismo
 * .xlsx. Reintenta con backoff porque el archivo puede estar bloqueado
 * por otra instancia de la app en otra máquina (ej. carpeta compartida
 * por red/Drive).
 */
export async function conArchivoBloqueado<T>(
  rutaArchivo: string,
  fn: () => Promise<T>,
): Promise<T> {
  const release = await lockfile.lock(rutaArchivo, {
    retries: {
      retries: 20,
      minTimeout: 250,
      maxTimeout: 2000,
      factor: 1.5,
    },
    stale: 30000,
    realpath: false,
  });
  try {
    return await fn();
  } finally {
    await release();
  }
}
