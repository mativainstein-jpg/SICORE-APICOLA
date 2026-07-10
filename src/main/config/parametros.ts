import { app } from "electron";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { ParametrosFiscales } from "../../shared/types.js";

const DEFAULTS: ParametrosFiscales = {
  retencion_iva_miel_pct: 6,
  retencion_ganancias_pct: 2,
  minimo_bienes: 224000,
  minimo_honorarios: 160000,
  minimo_servicios_transporte: 67170,
  aplazo_pct: 4.5,
  aplazo_umbral_neto: 50000,
  vencimiento_dias_default: 7,
};

/**
 * Los parametros viven en userData (no en el .asar, que es de solo lectura).
 * En el primer arranque se copian desde el default embebido en la app.
 */
function rutaParametros(): string {
  return path.join(app.getPath("userData"), "parametros_fiscales.json");
}

export async function leerParametros(): Promise<ParametrosFiscales> {
  const ruta = rutaParametros();
  try {
    const raw = await fs.readFile(ruta, "utf-8");
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    await fs.mkdir(path.dirname(ruta), { recursive: true });
    await fs.writeFile(ruta, JSON.stringify(DEFAULTS, null, 2), "utf-8");
    return { ...DEFAULTS };
  }
}

export async function guardarParametros(
  parametros: ParametrosFiscales,
): Promise<void> {
  const ruta = rutaParametros();
  await fs.mkdir(path.dirname(ruta), { recursive: true });
  await fs.writeFile(ruta, JSON.stringify(parametros, null, 2), "utf-8");
}
