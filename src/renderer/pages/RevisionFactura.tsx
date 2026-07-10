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
  const refPreview = useRef<HTMLDivElement>(null);

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

  async function confirmar() {
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
      );
      if (duplicado.esDuplicado) {
        setError(
          `Esta factura ya fue cargada antes (hoja "${duplicado.hoja}", fila ${duplicado.fila}).`,
        );
        setConfirmando(false);
        return;
      }

      await window.sicoreApi.factura.confirmar(factura);

      if (refPreview.current) {
        const canvas = await html2canvas(refPreview.current);
        const dataUrl = canvas.toDataURL("image/png");
        await window.sicoreApi.captura.guardar(factura.archivoOriginal, dataUrl);
      }

      onConfirmada();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setConfirmando(false);
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
          />
          <div className="acciones-formulario">
            <button className="secundario" onClick={onOmitir} disabled={confirmando}>
              Omitir esta factura
            </button>
            <button onClick={confirmar} disabled={confirmando}>
              {confirmando ? "Guardando…" : "Confirmar y guardar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
