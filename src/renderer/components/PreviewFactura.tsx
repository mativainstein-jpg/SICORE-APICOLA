interface Props {
  rutaArchivo: string;
}

/** Convierte una ruta de archivo (Windows o Unix) a un file:// válido para Chromium. */
function rutaAFileUrl(ruta: string): string {
  let normalizada = ruta.replace(/\\/g, "/");
  if (!normalizada.startsWith("/")) normalizada = "/" + normalizada;
  return "file://" + encodeURI(normalizada);
}

export function PreviewFactura({ rutaArchivo }: Props) {
  const url = rutaAFileUrl(rutaArchivo);
  const esImagen = /\.(png|jpe?g)$/i.test(rutaArchivo);

  return (
    <div className="panel" style={{ height: "100%" }}>
      {esImagen ? (
        <img src={url} alt="Previsualización de la factura" style={{ maxWidth: "100%" }} />
      ) : (
        <embed src={url} type="application/pdf" width="100%" height="100%" />
      )}
    </div>
  );
}
