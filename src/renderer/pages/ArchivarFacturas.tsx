import { useEffect, useState } from "react";
import type { FacturaPendienteDeArchivar } from "../../shared/types.js";

interface Props {
  onCerrar: () => void;
}

interface GrupoProveedor {
  cuit: string;
  nombreProveedor: string;
  facturas: FacturaPendienteDeArchivar[];
}

function agruparPorProveedor(lista: FacturaPendienteDeArchivar[]): GrupoProveedor[] {
  const mapa = new Map<string, GrupoProveedor>();
  for (const f of lista) {
    const existente = mapa.get(f.cuit);
    if (existente) {
      existente.facturas.push(f);
    } else {
      mapa.set(f.cuit, { cuit: f.cuit, nombreProveedor: f.nombreProveedor, facturas: [f] });
    }
  }
  return [...mapa.values()].sort((a, b) => a.nombreProveedor.localeCompare(b.nombreProveedor));
}

function nombreArchivo(ruta: string): string {
  return ruta.split(/[\\/]/).pop() ?? ruta;
}

/**
 * Pantalla aparte de la carga de datos: acá se organizan las facturas ya
 * cargadas en los Excel, agrupadas por proveedor, y se elige a qué carpeta
 * del servidor mover cada grupo — recién cuando el usuario quiere, no
 * durante la carga.
 */
export function ArchivarFacturas({ onCerrar }: Props) {
  const [grupos, setGrupos] = useState<GrupoProveedor[]>();
  const [procesando, setProcesando] = useState<string>();
  const [mensajes, setMensajes] = useState<Record<string, string>>({});

  async function recargar() {
    const lista = await window.sicoreApi.pendientes.listar();
    setGrupos(agruparPorProveedor(lista));
  }

  useEffect(() => {
    recargar();
  }, []);

  async function archivarGrupo(grupo: GrupoProveedor) {
    setProcesando(grupo.cuit);
    setMensajes((prev) => ({ ...prev, [grupo.cuit]: "" }));
    try {
      const carpeta = await window.sicoreApi.proveedor.elegirCarpeta(
        grupo.cuit,
        grupo.nombreProveedor,
      );
      if (!carpeta) return; // canceló el selector

      const rutas = grupo.facturas.map((f) => f.rutaOriginal);
      const resultado = await window.sicoreApi.pendientes.archivarProveedor(
        grupo.cuit,
        rutas,
        carpeta,
      );

      if (resultado.errores.length > 0) {
        setMensajes((prev) => ({
          ...prev,
          [grupo.cuit]: `Se movieron ${resultado.movidos.length} de ${rutas.length}. Fallaron: ${resultado.errores
            .map((e) => nombreArchivo(e.ruta))
            .join(", ")}`,
        }));
      }
      await recargar();
    } finally {
      setProcesando(undefined);
    }
  }

  async function quitarFactura(ruta: string) {
    await window.sicoreApi.pendientes.quitar([ruta]);
    await recargar();
  }

  return (
    <div className="contenido">
      <h2>Archivar facturas</h2>
      <p>
        Estas facturas ya se cargaron en Sicore/Apícola. Elegí a qué carpeta de tu servidor mover
        cada archivo original, agrupadas por proveedor. Si un archivo ya lo moviste a mano, podés
        sacarlo de esta lista sin moverlo.
      </p>

      {!grupos ? (
        <p>Cargando…</p>
      ) : grupos.length === 0 ? (
        <p>No hay facturas pendientes de archivar. 🎉</p>
      ) : (
        grupos.map((grupo) => (
          <div className="panel" key={grupo.cuit} style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <strong>{grupo.nombreProveedor || "(sin nombre)"}</strong>{" "}
                <span style={{ color: "#666" }}>
                  — CUIT {grupo.cuit} — {grupo.facturas.length} factura(s)
                </span>
              </div>
              <button onClick={() => archivarGrupo(grupo)} disabled={procesando === grupo.cuit}>
                {procesando === grupo.cuit ? "Moviendo…" : "Elegir carpeta y archivar todas"}
              </button>
            </div>
            {mensajes[grupo.cuit] && <p className="error-banner">{mensajes[grupo.cuit]}</p>}
            <ul className="cola-lista">
              {grupo.facturas.map((f) => (
                <li
                  key={f.rutaOriginal}
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <span>{nombreArchivo(f.rutaOriginal)}</span>
                  <button className="secundario" onClick={() => quitarFactura(f.rutaOriginal)}>
                    Ya la archivé a mano, sacar de la lista
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}

      <div className="acciones-formulario">
        <button className="secundario" onClick={onCerrar}>
          Volver
        </button>
      </div>
    </div>
  );
}
