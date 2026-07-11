import { forwardRef, useState } from "react";
import type { RetencionesCalculadas } from "../../shared/types.js";

interface Descuento {
  concepto: string;
  monto: number;
}

interface Props {
  retenciones: RetencionesCalculadas | undefined;
  total: number;
  cargando: boolean;
  notas: string;
  onCambiarNotas: (notas: string) => void;
  descuentos: Descuento[];
  onCambiarDescuentos: (descuentos: Descuento[]) => void;
}

const fmt = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });

/** Este es el bloque que se captura como "captura de pantalla" al confirmar (sección 2). */
export const RetencionesPreview = forwardRef<HTMLDivElement, Props>(function RetencionesPreview(
  { retenciones, total, cargando, notas, onCambiarNotas, descuentos, onCambiarDescuentos },
  ref,
) {
  const [conceptoNuevo, setConceptoNuevo] = useState("");
  const [montoNuevo, setMontoNuevo] = useState("");

  const totalDescuentos = descuentos.reduce((suma, d) => suma + (d.monto || 0), 0);
  const aPagarFinal = retenciones ? retenciones.aPagar - totalDescuentos : undefined;

  function agregarDescuento() {
    const monto = Number(montoNuevo);
    if (!conceptoNuevo.trim() || !monto) return;
    onCambiarDescuentos([...descuentos, { concepto: conceptoNuevo.trim(), monto }]);
    setConceptoNuevo("");
    setMontoNuevo("");
  }

  function quitarDescuento(indice: number) {
    onCambiarDescuentos(descuentos.filter((_, i) => i !== indice));
  }

  return (
    <div className="retenciones-preview" ref={ref}>
      <strong>Previsualización de retenciones</strong>
      {cargando || !retenciones ? (
        <p>Calculando…</p>
      ) : (
        <table>
          <tbody>
            <tr>
              <td>Total facturado</td>
              <td>{fmt.format(total)}</td>
            </tr>
            <tr>
              <td>Retención IVA</td>
              <td>-{fmt.format(retenciones.retencionIva)}</td>
            </tr>
            <tr>
              <td>
                Retención de Ganancias
                {retenciones.minimoGananciasAplicado > 0 && (
                  <span className="badge badge-factura">
                    mínimo {fmt.format(retenciones.minimoGananciasAplicado)}
                  </span>
                )}
              </td>
              <td>-{fmt.format(retenciones.retencionGanancias)}</td>
            </tr>
            <tr>
              <td>A Plazo</td>
              <td>-{fmt.format(retenciones.aPlazo)}</td>
            </tr>
            {descuentos.map((d, i) => (
              <tr key={i}>
                <td>
                  {d.concepto}
                  <button
                    className="secundario"
                    style={{ marginLeft: 8, padding: "2px 8px", fontSize: "0.75rem" }}
                    onClick={() => quitarDescuento(i)}
                  >
                    quitar
                  </button>
                </td>
                <td>-{fmt.format(d.monto)}</td>
              </tr>
            ))}
            <tr className="total">
              <td>A Pagar</td>
              <td>{aPagarFinal !== undefined ? fmt.format(aPagarFinal) : "—"}</td>
            </tr>
          </tbody>
        </table>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "flex-end" }}>
        <div style={{ flex: 2 }}>
          <label>Agregar descuento (ej. adelanto ya pagado)</label>
          <input
            value={conceptoNuevo}
            onChange={(e) => setConceptoNuevo(e.target.value)}
            placeholder="Concepto (ej. Adelanto 01/07)"
          />
        </div>
        <div style={{ flex: 1 }}>
          <input
            type="number"
            value={montoNuevo}
            onChange={(e) => setMontoNuevo(e.target.value)}
            placeholder="Monto ($)"
          />
        </div>
        <button className="secundario" onClick={agregarDescuento}>
          Agregar
        </button>
      </div>

      <div style={{ marginTop: 10 }}>
        <label>Notas (opcional, queda en la captura)</label>
        <textarea
          value={notas}
          onChange={(e) => onCambiarNotas(e.target.value)}
          placeholder="Ej: pagar antes del viernes, verificar kilos..."
          style={{ width: "100%", minHeight: 50 }}
        />
      </div>
    </div>
  );
});
