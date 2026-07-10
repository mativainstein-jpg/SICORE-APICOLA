import { app } from "electron";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Protege la pantalla de configuración (sección 9.7): solo un usuario
 * admin puede editar los parámetros fiscales. Clave por defecto "naiman"
 * la primera vez; se recomienda cambiarla desde la propia pantalla.
 */

const CLAVE_POR_DEFECTO = "naiman";

interface AdminStore {
  salt: string;
  hash: string;
}

function rutaAdmin(): string {
  return path.join(app.getPath("userData"), "admin.json");
}

function hashClave(clave: string, salt: Buffer): Buffer {
  return scryptSync(clave, salt, 64);
}

async function leerOInicializar(): Promise<AdminStore> {
  const ruta = rutaAdmin();
  try {
    const raw = await fs.readFile(ruta, "utf-8");
    return JSON.parse(raw);
  } catch {
    const salt = randomBytes(16);
    const hash = hashClave(CLAVE_POR_DEFECTO, salt);
    const store: AdminStore = {
      salt: salt.toString("hex"),
      hash: hash.toString("hex"),
    };
    await fs.mkdir(path.dirname(ruta), { recursive: true });
    await fs.writeFile(ruta, JSON.stringify(store, null, 2), "utf-8");
    return store;
  }
}

export async function verificarClaveAdmin(clave: string): Promise<boolean> {
  const store = await leerOInicializar();
  const salt = Buffer.from(store.salt, "hex");
  const hashIngresado = hashClave(clave, salt);
  const hashGuardado = Buffer.from(store.hash, "hex");
  if (hashIngresado.length !== hashGuardado.length) return false;
  return timingSafeEqual(hashIngresado, hashGuardado);
}

export async function cambiarClaveAdmin(nuevaClave: string): Promise<void> {
  const salt = randomBytes(16);
  const hash = hashClave(nuevaClave, salt);
  const store: AdminStore = {
    salt: salt.toString("hex"),
    hash: hash.toString("hex"),
  };
  await fs.writeFile(rutaAdmin(), JSON.stringify(store, null, 2), "utf-8");
}
