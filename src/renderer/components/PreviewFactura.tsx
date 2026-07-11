import { useEffect, useState } from "react";
import { renderizarPrimeraPaginaParaVista } from "../util/renderizarPdf.js";

interface Props {
  rutaArchivo: string;
}

const MIME_POR_EXTENSION: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

/**
 * Previsualización de la factura. No usa file://: en Windows y en modo
 * desarrollo (servido desde http://localhost) esas URLs no siempre cargan
 * por restricciones de seguridad de Chromium. En cambio, se lee el archivo
 * por IPC y se muestra como imagen ya renderizada (PDF vía pdfjs+canvas,
 * igual que para el OCR; imágenes directamente como data URL).
 */
export function PreviewFactura({ rutaArchivo }: Props) {
  const [dataUrl, setDataUrl] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelado = false;
    setDataUrl(undefined);
    setError(undefined);

    const extension = rutaArchivo.slice(rutaArchivo.lastIndexOf(".")).toLowerCase();
    const esPdf = extension === ".pdf";

    window.sicoreApi.archivo
      .leerBase64(rutaArchivo)
      .then(async (base64) => {
        if (cancelado) return;
        if (esPdf) {
          const png = await renderizarPrimeraPaginaParaVista(base64);
          if (!cancelado) setDataUrl(png);
        } else {
          const mime = MIME_POR_EXTENSION[extension] ?? "image/png";
          setDataUrl(`data:${mime};base64,${base64}`);
        }
      })
      .catch((err) => {
        if (!cancelado) setError((err as Error).message);
      });

    return () => {
      cancelado = true;
    };
  }, [rutaArchivo]);

  return (
    <div className="panel" style={{ height: "100%", textAlign: "center" }}>
      {error && <div className="error-banner">No se pudo mostrar la factura: {error}</div>}
      {!error && !dataUrl && <p>Cargando previsualización…</p>}
      {dataUrl && (
        <img src={dataUrl} alt="Previsualización de la factura" style={{ maxWidth: "100%" }} />
      )}
    </div>
  );
}
