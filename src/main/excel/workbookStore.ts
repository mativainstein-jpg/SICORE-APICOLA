import { app } from "electron";
import { promises as fs } from "node:fs";
import path from "node:path";

/** Recuerda la carpeta destino elegida por el usuario la primera vez (sección 8.3). */

interface Settings {
  carpetaDestino?: string;
}

function rutaSettings(): string {
  return path.join(app.getPath("userData"), "settings.json");
}

export async function leerCarpetaDestino(): Promise<string | undefined> {
  try {
    const raw = await fs.readFile(rutaSettings(), "utf-8");
    const settings: Settings = JSON.parse(raw);
    return settings.carpetaDestino;
  } catch {
    return undefined;
  }
}

export async function guardarCarpetaDestino(carpeta: string): Promise<void> {
  const ruta = rutaSettings();
  await fs.mkdir(path.dirname(ruta), { recursive: true });
  await fs.writeFile(ruta, JSON.stringify({ carpetaDestino: carpeta }, null, 2), "utf-8");
}

export function rutaSicore(carpetaDestino: string): string {
  return path.join(carpetaDestino, "Sicore.xlsx");
}

export function rutaApicola(carpetaDestino: string): string {
  return path.join(carpetaDestino, "Apicola.xlsx");
}
