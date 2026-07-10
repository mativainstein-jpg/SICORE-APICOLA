interface Props {
  rutaArchivo: string;
}

export function PreviewFactura({ rutaArchivo }: Props) {
  const url = `file://${encodeURI(rutaArchivo)}`;
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
