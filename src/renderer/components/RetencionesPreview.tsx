import { forwardRef } from "react";
import type { RetencionesCalculadas } from "../../shared/types.js";

interface Props {
  retenciones: RetencionesCalculadas | undefined;
  total: number;
  cargando: boolean;
  notas: string;
  onCambiarNotas: (notas: string) => void;
}

const fmt = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });

/** Este es el bloque que se captura como "captura de pantalla" al confirmar (sección 2). */
export const RetencionesPreview = forwardRef<HTMLDivElement, Props>(function RetencionesPreview(
  { retenciones, total, cargando, notas, onCambiarNotas },
  ref,
) {
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
              <td>
                Retención IVA
                {retenciones.esPrimeraFacturaDelMesParaCuit ? "" : ""}
              </td>
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
            <tr className="total">
              <td>A Pagar</td>
              <td>{fmt.format(retenciones.aPagar)}</td>
            </tr>
          </tbody>
        </table>
      )}
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
