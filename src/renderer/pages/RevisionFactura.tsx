import { useEffect, useRef, useState } from "react";
import html2canvas from "html2canvas";
import type { FacturaConfirmada, RetencionesCalculadas } from "../../shared/types.js";
import { PreviewFactura } from "../components/PreviewFactura.js";
import { FormularioDatos } from "../components/FormularioDatos.js";
import { RetencionesPreview } from "../components/RetencionesPreview.js";
import { esCuitValido } from "../util/construirFactura.js";

interface Props {
  facturaInicial: FacturaConfirmada;
  onConfirmada: () => void;
  onOmitir: () => void;
}

export function RevisionFactura({ facturaInicial, onConfirmada, onOmitir }: Props) {
  const [factura, setFactura] = useState(facturaInicial);
  const [retenciones, setRetenciones] = useState<RetencionesCalculadas>();
  const [calculando, setCalculando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string>();
  const [notasCaptura, setNotasCaptura] = useState("");
  const [vistaPreviaCaptura, setVistaPreviaCaptura] = useState<string>();
  const [guardando, setGuardando] = useState(false);
  const refPreview = useRef<HTMLDivElement>(null);

  const llevaCaptura = factura.tipoComprobante === "FCA";

  useEffect(() => {
    setFactura(facturaInicial);
  }, [facturaInicial]);

  useEffect(() => {
    setCalculando(true);
    const timeout = setTimeout(async () => {
      try {
        const r = await window.sicoreApi.factura.previsualizarRetenciones(factura);
        setRetenciones(r);
      } catch {
        // se ignora hasta tanto haya carpeta destino elegida
      } finally {
        setCalculando(false);
      }
    }, 250);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [factura]);

  async function revisarAntesDeGuardar() {
    setError(undefined);
    if (!esCuitValido(factura.cuit)) {
      setError("El CUIT debe tener 11 dígitos.");
      return;
    }
    if (!factura.numeroFactura.trim()) {
      setError("Falta el número de factura.");
      return;
    }

    setConfirmando(true);
    try {
      const duplicado = await window.sicoreApi.factura.chequearDuplicado(
        factura.cuit,
        factura.numeroFactura,
        factura.tipoComprobante,
      );
      if (duplicado.esDuplicado) {
        setError(
          `Esta factura ya fue cargada antes (hoja "${duplicado.hoja}", fila ${duplicado.fila}).`,
        );
        return;
      }

      if (llevaCaptura && refPreview.current) {
        // Las capturas de pantalla solo se guardan para facturas A (sección 2,
        // acotado a pedido: en las C no se generan).
        const canvas = await html2canvas(refPreview.current);
        setVistaPreviaCaptura(canvas.toDataURL("image/png"));
      } else {
        await guardarFacturaFinal(undefined);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setConfirmando(false);
    }
  }

  async function guardarFacturaFinal(captura: string | undefined) {
    setGuardando(true);
    setError(undefined);
    try {
      // Siempre se le pregunta al usuario dónde archivar el original en el
      // servidor (arranca en la última carpeta usada para este proveedor,
      // pero nunca se mueve solo sin que él elija/confirme). Si cancela el
      // selector, la factura se guarda igual en los Excel, solo que el
      // archivo original se queda donde estaba.
      const carpetaProveedor = await window.sicoreApi.proveedor.elegirCarpeta(
        factura.cuit,
        factura.nombreProveedor,
      );

      await window.sicoreApi.factura.confirmar(factura, carpetaProveedor);
      if (captura) {
        await window.sicoreApi.captura.guardar(factura.archivoOriginal, captura);
      }
      onConfirmada();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div>
      {error && <div className="error-banner">{error}</div>}
      <div className="split">
        <PreviewFactura rutaArchivo={factura.archivoOriginal} />
        <div style={{ display: "flex", flexDirection: "column", gap: 12, overflow: "auto" }}>
          <FormularioDatos factura={factura} setFactura={setFactura} />
          <RetencionesPreview
            ref={refPreview}
            retenciones={retenciones}
            total={factura.total}
            cargando={calculando}
            notas={notasCaptura}
            onCambiarNotas={setNotasCaptura}
          />
          <div className="acciones-formulario">
            <button className="secundario" onClick={onOmitir} disabled={confirmando}>
              Omitir esta factura
            </button>
            <button onClick={revisarAntesDeGuardar} disabled={confirmando}>
              {confirmando
                ? "Preparando…"
                : llevaCaptura
                  ? "Revisar captura y guardar"
                  : "Confirmar y guardar"}
            </button>
          </div>

          {factura.textoReconocido !== undefined && (
            <details className="panel">
              <summary style={{ cursor: "pointer" }}>
                Texto reconocido (para soporte, si algo no se completó solo)
              </summary>
              <textarea
                readOnly
                value={factura.textoReconocido || "(no se reconoció ningún texto)"}
                style={{ width: "100%", height: 160, marginTop: 8, fontFamily: "monospace" }}
                onFocus={(e) => e.currentTarget.select()}
              />
            </details>
          )}
        </div>
      </div>

      {vistaPreviaCaptura && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
        >
          <div
            className="panel"
            style={{ maxWidth: 560, maxHeight: "85vh", overflow: "auto", background: "white" }}
          >
            <h3>Así se va a guardar la captura</h3>
            <p>
              Si querés cambiar algo (por ejemplo agregar una nota), volvé a revisar; la captura
              se vuelve a generar cuando confirmes de nuevo.
            </p>
            <img src={vistaPreviaCaptura} alt="Vista previa de la captura" style={{ maxWidth: "100%", border: "1px solid #ddd" }} />
            <div className="acciones-formulario">
              <button
                className="secundario"
                onClick={() => setVistaPreviaCaptura(undefined)}
                disabled={guardando}
              >
                Volver a revisar
              </button>
              <button
                onClick={() => guardarFacturaFinal(vistaPreviaCaptura)}
                disabled={guardando}
              >
                {guardando ? "Guardando…" : "Guardar factura"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
