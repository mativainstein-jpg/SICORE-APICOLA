import { promises as fs } from "node:fs";
import path from "node:path";
import type { FacturaPendienteDeArchivar } from "../shared/types.js";

/**
 * Lista de facturas ya cargadas en los Excel cuyo archivo original todavía
 * no se movió a la carpeta del proveedor en el servidor. Se guarda en la
 * misma carpeta destino que los Excel, para que sobreviva a un reinicio de
 * la app (si alguien carga varias facturas y cierra antes de archivarlas).
 */
function rutaPendientes(carpetaDestino: string): string {
  return path.join(carpetaDestino, "facturas_pendientes_de_archivar.json");
}

async function leerPendientes(carpetaDestino: string): Promise<FacturaPendienteDeArchivar[]> {
  try {
    const raw = await fs.readFile(rutaPendientes(carpetaDestino), "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function guardarPendientes(
  carpetaDestino: string,
  lista: FacturaPendienteDeArchivar[],
): Promise<void> {
  await fs.writeFile(rutaPendientes(carpetaDestino), JSON.stringify(lista, null, 2), "utf-8");
}

export async function agregarPendiente(
  carpetaDestino: string,
  item: FacturaPendienteDeArchivar,
): Promise<void> {
  const lista = await leerPendientes(carpetaDestino);
  // Un mismo archivo no puede figurar dos veces (solo existe una vez en el
  // disco): si ya estaba anotado, se reemplaza la entrada por la nueva.
  const sinRepetido = lista.filter((f) => f.rutaOriginal !== item.rutaOriginal);
  sinRepetido.push(item);
  await guardarPendientes(carpetaDestino, sinRepetido);
}

export function listarPendientes(carpetaDestino: string): Promise<FacturaPendienteDeArchivar[]> {
  return leerPendientes(carpetaDestino);
}

export async function quitarPendientes(
  carpetaDestino: string,
  rutasAQuitar: string[],
): Promise<void> {
  const lista = await leerPendientes(carpetaDestino);
  const restante = lista.filter((f) => !rutasAQuitar.includes(f.rutaOriginal));
  await guardarPendientes(carpetaDestino, restante);
}
