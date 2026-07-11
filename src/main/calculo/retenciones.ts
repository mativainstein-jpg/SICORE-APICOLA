import type {
  FacturaConfirmada,
  ParametrosFiscales,
  RetencionesCalculadas,
} from "../../shared/types.js";

/** Fila mínima de una factura ya cargada, para chequear "primera del mes por CUIT" (5.3). */
export interface FilaCargada {
  cuit: string;
}

function redondear2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Retención de IVA (columna L de Sicore, sección 5.2).
 * Solo aplica a facturas A: los monotributistas (factura C) no sufren
 * retención de IVA ni de Ganancias.
 * Miel: default retencion_iva_miel_pct % del Neto.
 * No-miel: default 0%.
 * En ambos casos el usuario puede forzar % o monto manual (checkbox en UI).
 */
export function calcularRetencionIva(
  factura: FacturaConfirmada,
  parametros: ParametrosFiscales,
): number {
  if (factura.tipoComprobante !== "FCA") return 0;
  if (factura.retencionIvaManual) {
    if (factura.retencionIvaManual.monto !== undefined) {
      return redondear2(factura.retencionIvaManual.monto);
    }
    if (factura.retencionIvaManual.pct !== undefined) {
      return redondear2((factura.retencionIvaManual.pct / 100) * factura.neto);
    }
  }
  const pctDefault = factura.esMiel ? parametros.retencion_iva_miel_pct : 0;
  return redondear2((pctDefault / 100) * factura.neto);
}

/**
 * Mínimo no imponible a restar antes del 2% de Ganancias (sección 5.3),
 * aplicado solo si esta es la primera factura del mes para ese CUIT,
 * evaluado contra lo ya cargado en la hoja del mes (no contra la fecha
 * de la factura).
 */
export function obtenerMinimoGanancias(
  factura: FacturaConfirmada,
  parametros: ParametrosFiscales,
): number {
  switch (factura.categoriaMinimoGanancias) {
    case "bienes":
      return parametros.minimo_bienes;
    case "honorarios":
      return parametros.minimo_honorarios;
    case "servicios_transporte":
      return parametros.minimo_servicios_transporte;
    case "manual":
      return factura.minimoGananciasManual ?? 0;
  }
}

export function esPrimeraFacturaDelMesParaCuit(
  cuit: string,
  filasYaCargadasEnHojaDelMes: FilaCargada[],
): boolean {
  return !filasYaCargadasEnHojaDelMes.some((f) => f.cuit === cuit);
}

/**
 * Retención de Ganancias (columna M de Sicore). Solo aplica a facturas A.
 * Default: pct de parametros sobre (Neto - minimo si es la primera factura
 * del mes para ese CUIT). Editable vía retencionGananciasPctManual.
 */
export function calcularRetencionGanancias(
  factura: FacturaConfirmada,
  parametros: ParametrosFiscales,
  filasYaCargadasEnHojaDelMes: FilaCargada[],
): { retencion: number; minimoAplicado: number; esPrimera: boolean } {
  const esPrimera = esPrimeraFacturaDelMesParaCuit(
    factura.cuit,
    filasYaCargadasEnHojaDelMes,
  );
  if (factura.tipoComprobante !== "FCA") {
    return { retencion: 0, minimoAplicado: 0, esPrimera };
  }
  const minimoAplicado =
    esPrimera && factura.aplicarMinimoGanancias ? obtenerMinimoGanancias(factura, parametros) : 0;
  const pct =
    factura.retencionGananciasPctManual ?? parametros.retencion_ganancias_pct;
  const base = Math.max(0, factura.neto - minimoAplicado);
  const retencion = redondear2((pct / 100) * base);
  return { retencion, minimoAplicado, esPrimera };
}

/**
 * "A Plazo" (columna N de Sicore). Solo facturas A y solo miel,
 * aplazo_pct % del Neto, solo si Neto > aplazo_umbral_neto. El usuario
 * puede destildar "Es a plazo" para forzarlo a $0 en una factura puntual.
 */
export function calcularAPlazo(
  factura: FacturaConfirmada,
  parametros: ParametrosFiscales,
): number {
  if (factura.tipoComprobante !== "FCA") return 0;
  if (!factura.aplicarAPlazo) return 0;
  if (!factura.esMiel) return 0;
  if (factura.neto <= parametros.aplazo_umbral_neto) return 0;
  return redondear2((parametros.aplazo_pct / 100) * factura.neto);
}

/**
 * Suma de descuentos adicionales (ej. adelantos ya pagados) que el usuario
 * carga a mano en la previsualización/captura. Se restan del Importe a
 * pagar de Apícola, no de la columna O de Sicore (esa es la fórmula fiscal
 * fija de la sección 5.2, no se toca).
 */
export function sumaDescuentosAdicionales(factura: FacturaConfirmada): number {
  return redondear2(
    factura.descuentosAdicionales.reduce((suma, d) => suma + (d.monto || 0), 0),
  );
}

/**
 * Cálculo completo de retenciones para una factura, usado tanto por
 * Sicore (columna O) como de forma independiente por Apícola (columna I) —
 * ver decisión de sección 8.5: Apícola nunca lee Sicore.xlsx.
 */
export function calcularRetenciones(
  factura: FacturaConfirmada,
  parametros: ParametrosFiscales,
  filasYaCargadasEnHojaDelMes: FilaCargada[],
): RetencionesCalculadas {
  const retencionIva = calcularRetencionIva(factura, parametros);
  const { retencion: retencionGanancias, minimoAplicado, esPrimera } =
    calcularRetencionGanancias(factura, parametros, filasYaCargadasEnHojaDelMes);
  const aPlazo = calcularAPlazo(factura, parametros);
  const aPagar = redondear2(
    factura.total - retencionIva - retencionGanancias - aPlazo,
  );

  return {
    retencionIva,
    retencionGanancias,
    aPlazo,
    aPagar,
    minimoGananciasAplicado: minimoAplicado,
    esPrimeraFacturaDelMesParaCuit: esPrimera,
  };
}
