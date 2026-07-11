import type { Dispatch, SetStateAction } from "react";
import type { DatosExtraidos, FacturaConfirmada, Acopiador } from "../../shared/types.js";
import { CampoConOrigen } from "./CampoConOrigen.js";

interface Props {
  factura: FacturaConfirmada;
  setFactura: Dispatch<SetStateAction<FacturaConfirmada>>;
}

const ACOPIADORES: Acopiador[] = [
  "Majul", "Apícola", "Vargas", "Pablo", "Naiman", "David",
  "Bender", "Hesayne", "Martínez", "Betiana", "Otro",
];

function marcarManual<K extends keyof FacturaConfirmada>(
  setFactura: Dispatch<SetStateAction<FacturaConfirmada>>,
  campo: K,
  valor: FacturaConfirmada[K],
) {
  setFactura((prev) => ({
    ...prev,
    [campo]: valor,
    origenCampos: { ...prev.origenCampos, [campo]: "manual" },
  }));
}

export function FormularioDatos({ factura, setFactura }: Props) {
  const origen = (campo: keyof DatosExtraidos) => factura.origenCampos[campo];

  return (
    <div className="panel">
      <div className="toggle-miel" style={{ marginBottom: 16 }}>
        <span>Tipo de producto:</span>
        <label style={{ margin: 0 }}>
          <input
            type="radio"
            checked={factura.esMiel}
            onChange={() => marcarManual(setFactura, "esMiel", true)}
          />{" "}
          Miel
        </label>
        <label style={{ margin: 0 }}>
          <input
            type="radio"
            checked={!factura.esMiel}
            onChange={() => marcarManual(setFactura, "esMiel", false)}
          />{" "}
          No es miel
        </label>
      </div>

      <div className="fila-campos">
        <CampoConOrigen etiqueta="Fecha de emisión" origen={origen("fechaEmision")}>
          <input
            type="date"
            value={factura.fechaEmision}
            onChange={(e) => marcarManual(setFactura, "fechaEmision", e.target.value)}
          />
        </CampoConOrigen>
        <CampoConOrigen etiqueta="Fecha de pago (opcional)">
          <input
            type="date"
            value={factura.fechaPago ?? ""}
            onChange={(e) => marcarManual(setFactura, "fechaPago", e.target.value)}
          />
        </CampoConOrigen>

        <CampoConOrigen etiqueta="CUIT" origen={origen("cuit")}>
          <input
            value={factura.cuit}
            maxLength={11}
            onChange={(e) => marcarManual(setFactura, "cuit", e.target.value.replace(/\D/g, ""))}
          />
        </CampoConOrigen>
        <CampoConOrigen etiqueta="Nombre del proveedor" origen={origen("nombreProveedor")}>
          <input
            value={factura.nombreProveedor}
            onChange={(e) => marcarManual(setFactura, "nombreProveedor", e.target.value)}
          />
        </CampoConOrigen>

        <CampoConOrigen etiqueta="N° de factura" origen={origen("numeroFactura")}>
          <input
            value={factura.numeroFactura}
            onChange={(e) => marcarManual(setFactura, "numeroFactura", e.target.value)}
          />
        </CampoConOrigen>
        <CampoConOrigen etiqueta="Tipo de comprobante" origen={origen("tipoComprobante")}>
          <select
            value={factura.tipoComprobante}
            onChange={(e) =>
              marcarManual(setFactura, "tipoComprobante", e.target.value as "FCA" | "FCC")
            }
          >
            <option value="FCA">FCA</option>
            <option value="FCC">FCC</option>
          </select>
          {factura.tipoComprobante === "FCC" && (
            <small style={{ color: "var(--color-manual)" }}>
              Esta factura solo se va a cargar en Apícola, no en Sicore.
            </small>
          )}
        </CampoConOrigen>

        <CampoConOrigen etiqueta="Kg" origen={origen("kg")}>
          <input
            type="number"
            value={factura.kg ?? ""}
            onChange={(e) => marcarManual(setFactura, "kg", Number(e.target.value))}
          />
        </CampoConOrigen>
        <CampoConOrigen etiqueta="Precio facturado" origen={origen("precioFacturado")}>
          <input
            type="number"
            value={factura.precioFacturado ?? ""}
            onChange={(e) => marcarManual(setFactura, "precioFacturado", Number(e.target.value))}
          />
        </CampoConOrigen>

        <CampoConOrigen etiqueta="Neto" origen={origen("neto")}>
          <input
            type="number"
            value={factura.neto}
            onChange={(e) => marcarManual(setFactura, "neto", Number(e.target.value))}
          />
        </CampoConOrigen>
        <CampoConOrigen etiqueta="No gravado" origen={origen("noGravado")}>
          <input
            type="number"
            value={factura.noGravado}
            onChange={(e) => marcarManual(setFactura, "noGravado", Number(e.target.value))}
          />
        </CampoConOrigen>

        <CampoConOrigen etiqueta="IVA (monto)" origen={origen("ivaMonto")}>
          <input
            type="number"
            value={factura.ivaMonto}
            onChange={(e) => marcarManual(setFactura, "ivaMonto", Number(e.target.value))}
          />
        </CampoConOrigen>
        <CampoConOrigen etiqueta="Percepciones" origen={origen("percepciones")}>
          <input
            type="number"
            value={factura.percepciones}
            onChange={(e) => marcarManual(setFactura, "percepciones", Number(e.target.value))}
          />
        </CampoConOrigen>

        <CampoConOrigen etiqueta="Total" origen={origen("total")}>
          <input
            type="number"
            value={factura.total}
            onChange={(e) => marcarManual(setFactura, "total", Number(e.target.value))}
          />
        </CampoConOrigen>
      </div>

      <hr />
      <h4>Retenciones (Sicore)</h4>
      {factura.tipoComprobante !== "FCA" ? (
        <p>
          Las facturas C no llevan retención de IVA ni de Ganancias (el monotributista no está
          alcanzado). El importe a pagar es el total facturado, sin descuentos.
        </p>
      ) : (
      <div className="fila-campos">
        <div>
          <label>
            <input
              type="checkbox"
              checked={!!factura.retencionIvaManual}
              onChange={(e) =>
                setFactura((prev) => ({
                  ...prev,
                  retencionIvaManual: e.target.checked ? { pct: 0 } : undefined,
                }))
              }
            />{" "}
            Forzar retención de IVA manual
          </label>
          {factura.retencionIvaManual && (
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="number"
                placeholder="%"
                value={factura.retencionIvaManual?.pct ?? ""}
                onChange={(e) =>
                  setFactura((prev) => ({
                    ...prev,
                    retencionIvaManual: { pct: Number(e.target.value), monto: undefined },
                  }))
                }
              />
              <input
                type="number"
                placeholder="Monto ($)"
                value={factura.retencionIvaManual?.monto ?? ""}
                onChange={(e) =>
                  setFactura((prev) => ({
                    ...prev,
                    retencionIvaManual: { monto: Number(e.target.value), pct: undefined },
                  }))
                }
              />
            </div>
          )}
        </div>

        <CampoConOrigen etiqueta="% Retención de Ganancias">
          <input
            type="number"
            value={factura.retencionGananciasPctManual ?? 2}
            onChange={(e) =>
              setFactura((prev) => ({
                ...prev,
                retencionGananciasPctManual: Number(e.target.value),
              }))
            }
          />
        </CampoConOrigen>

        <div>
          <label>
            <input
              type="checkbox"
              checked={factura.aplicarMinimoGanancias}
              onChange={(e) =>
                setFactura((prev) => ({ ...prev, aplicarMinimoGanancias: e.target.checked }))
              }
            />{" "}
            Aplicar mínimo no imponible (solo la primera factura del mes por CUIT)
          </label>
        </div>

        {factura.aplicarMinimoGanancias && (
          <>
            <CampoConOrigen etiqueta="Categoría del mínimo no imponible (col. M)">
              <select
                value={factura.categoriaMinimoGanancias}
                onChange={(e) =>
                  setFactura((prev) => ({
                    ...prev,
                    categoriaMinimoGanancias: e.target.value as FacturaConfirmada["categoriaMinimoGanancias"],
                  }))
                }
              >
                <option value="bienes">Bienes</option>
                <option value="honorarios">Honorarios</option>
                <option value="servicios_transporte">Servicios y transportes</option>
                <option value="manual">Monto manual</option>
              </select>
            </CampoConOrigen>
            {factura.categoriaMinimoGanancias === "manual" && (
              <CampoConOrigen etiqueta="Mínimo manual ($)">
                <input
                  type="number"
                  value={factura.minimoGananciasManual ?? ""}
                  onChange={(e) =>
                    setFactura((prev) => ({
                      ...prev,
                      minimoGananciasManual: Number(e.target.value),
                    }))
                  }
                />
              </CampoConOrigen>
            )}
          </>
        )}
      </div>
      )}

      <hr />
      <h4>Datos para Apícola</h4>
      <div className="fila-campos">
        <CampoConOrigen etiqueta="Fecha de recepción">
          <input
            type="date"
            value={factura.fechaRecepcion ?? ""}
            onChange={(e) =>
              setFactura((prev) => ({ ...prev, fechaRecepcion: e.target.value }))
            }
          />
        </CampoConOrigen>
        <CampoConOrigen etiqueta="Vencimiento (auto: recepción + días configurados)">
          <input
            type="date"
            value={factura.vencimientoManual ?? ""}
            onChange={(e) =>
              setFactura((prev) => ({ ...prev, vencimientoManual: e.target.value }))
            }
          />
        </CampoConOrigen>

        <CampoConOrigen etiqueta="Banco">
          <input
            value={factura.banco ?? ""}
            onChange={(e) => setFactura((prev) => ({ ...prev, banco: e.target.value }))}
          />
        </CampoConOrigen>
        <CampoConOrigen etiqueta="Tipo de gasto">
          <select
            value={factura.tipoGasto}
            onChange={(e) =>
              setFactura((prev) => ({ ...prev, tipoGasto: e.target.value as FacturaConfirmada["tipoGasto"] }))
            }
          >
            <option value="Miel">Miel</option>
            <option value="Generales">Generales</option>
            <option value="Agropecuario">Agropecuario</option>
          </select>
        </CampoConOrigen>

        <CampoConOrigen etiqueta="Acopiador">
          <select
            value={factura.acopiador ?? ""}
            onChange={(e) =>
              setFactura((prev) => ({ ...prev, acopiador: e.target.value as Acopiador }))
            }
          >
            <option value="">—</option>
            {ACOPIADORES.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </CampoConOrigen>
        {factura.acopiador === "Otro" && (
          <CampoConOrigen etiqueta="Acopiador (otro)">
            <input
              value={factura.acopiadorOtro ?? ""}
              onChange={(e) =>
                setFactura((prev) => ({ ...prev, acopiadorOtro: e.target.value }))
              }
            />
          </CampoConOrigen>
        )}

        <CampoConOrigen etiqueta="Control de kilos">
          <input
            type="number"
            value={factura.controlKilos ?? ""}
            onChange={(e) =>
              setFactura((prev) => ({ ...prev, controlKilos: Number(e.target.value) }))
            }
          />
        </CampoConOrigen>
        <CampoConOrigen etiqueta="Comentarios">
          <input
            value={factura.comentarios ?? ""}
            onChange={(e) => setFactura((prev) => ({ ...prev, comentarios: e.target.value }))}
          />
        </CampoConOrigen>
      </div>
    </div>
  );
}
