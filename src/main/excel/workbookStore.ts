import { app } from "electron";
import { promises as fs } from "node:fs";
import path from "node:path";

/** Recuerda la carpeta destino elegida por el usuario la primera vez (sección 8.3),
 * y la carpeta donde se archiva cada factura procesada, por proveedor (CUIT). */

interface Settings {
  carpetaDestino?: string;
  /** CUIT -> carpeta del servidor donde van las facturas procesadas de ese proveedor. */
  carpetaPorProveedor?: Record<string, string>;
}

function rutaSettings(): string {
  return path.join(app.getPath("userData"), "settings.json");
}

async function leerSettings(): Promise<Settings> {
  try {
    const raw = await fs.readFile(rutaSettings(), "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function guardarSettings(cambios: Partial<Settings>): Promise<void> {
  const ruta = rutaSettings();
  const actuales = await leerSettings();
  const nuevas = { ...actuales, ...cambios };
  await fs.mkdir(path.dirname(ruta), { recursive: true });
  await fs.writeFile(ruta, JSON.stringify(nuevas, null, 2), "utf-8");
}

export async function leerCarpetaDestino(): Promise<string | undefined> {
  return (await leerSettings()).carpetaDestino;
}

export async function guardarCarpetaDestino(carpeta: string): Promise<void> {
  await guardarSettings({ carpetaDestino: carpeta });
}

export async function obtenerCarpetaProveedor(cuit: string): Promise<string | undefined> {
  return (await leerSettings()).carpetaPorProveedor?.[cuit];
}

export async function guardarCarpetaProveedor(cuit: string, carpeta: string): Promise<void> {
  const settings = await leerSettings();
  const carpetaPorProveedor = { ...settings.carpetaPorProveedor, [cuit]: carpeta };
  await guardarSettings({ carpetaPorProveedor });
}

export function rutaSicore(carpetaDestino: string): string {
  return path.join(carpetaDestino, "Sicore.xlsx");
}

export function rutaApicola(carpetaDestino: string): string {
  return path.join(carpetaDestino, "Apicola.xlsx");
}
