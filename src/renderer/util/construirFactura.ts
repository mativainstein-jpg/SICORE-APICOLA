import type { DatosExtraidos, FacturaConfirmada } from "../../shared/types.js";

const CAMPOS_ORIGEN_FACTURA: (keyof DatosExtraidos)[] = [
  "fechaEmision", "cuit", "nombreProveedor", "numeroFactura", "tipoComprobante",
  "neto", "noGravado", "ivaMonto", "percepciones", "total", "kg", "precioFacturado",
];

export function construirFacturaDesdeExtraccion(
  archivoOriginal: string,
  datos: DatosExtraidos,
): FacturaConfirmada {
  const origenCampos: FacturaConfirmada["origenCampos"] = {};
  for (const campo of CAMPOS_ORIGEN_FACTURA) {
    origenCampos[campo] = datos[campo] !== undefined ? "factura" : "manual";
  }

  return {
    archivoOriginal,
    fechaEmision: datos.fechaEmision ?? new Date().toISOString().slice(0, 10),
    cuit: datos.cuit ?? "",
    nombreProveedor: datos.nombreProveedor ?? "",
    numeroFactura: datos.numeroFactura ?? "",
    tipoComprobante: datos.tipoComprobante ?? "FCA",
    kg: datos.kg,
    neto: datos.neto ?? 0,
    noGravado: datos.noGravado ?? 0,
    ivaMonto: datos.ivaMonto ?? 0,
    percepciones: datos.percepciones ?? 0,
    total: datos.total ?? 0,
    precioFacturado: datos.precioFacturado,
    esMiel: datos.esMiel ?? false,
    aplicarMinimoGanancias: true,
    categoriaMinimoGanancias: "bienes",
    aplicarAPlazo: true,
    descuentosAdicionales: [],
    tipoGasto: datos.esMiel ? "Miel" : "Generales",
    origenCampos,
    textoReconocido: datos.textoCompleto,
  };
}

export function esCuitValido(cuit: string): boolean {
  return /^\d{11}$/.test(cuit);
}
