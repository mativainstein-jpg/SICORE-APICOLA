// Tipos compartidos entre el proceso principal (main) y la UI (renderer).

export type TipoComprobante = "FCA" | "FCC";

export type CategoriaMinimoGanancias =
  | "bienes"
  | "honorarios"
  | "servicios_transporte"
  | "manual";

export type Acopiador =
  | "Majul"
  | "Apícola"
  | "Vargas"
  | "Pablo"
  | "Naiman"
  | "David"
  | "Bender"
  | "Hesayne"
  | "Martínez"
  | "Betiana"
  | "Otro";

export type TipoGasto = "Miel" | "Generales" | "Agropecuario";

/** Un campo que puede venir de la factura (extraído) o haber sido tipeado/corregido a mano. */
export interface CampoOrigen<T> {
  valor: T;
  origen: "factura" | "manual";
}

/** Datos crudos que devuelve el motor de extracción antes de la revisión del usuario. */
export interface DatosExtraidos {
  fechaEmision?: string; // ISO yyyy-mm-dd
  cuit?: string;
  nombreProveedor?: string;
  numeroFactura?: string;
  tipoComprobante?: TipoComprobante;
  neto?: number;
  noGravado?: number;
  ivaMonto?: number;
  percepciones?: number;
  total?: number;
  kg?: number;
  precioFacturado?: number;
  esMiel?: boolean;
  textoCompleto: string;
  metodoExtraccion: "texto" | "ocr";
}

/** Datos ya confirmados por el usuario, listos para calcular y escribir. */
export interface FacturaConfirmada {
  archivoOriginal: string; // ruta del PDF/imagen original
  fechaEmision: string;
  fechaPago?: string;
  fechaRecepcion?: string;
  cuit: string;
  nombreProveedor: string;
  numeroFactura: string;
  tipoComprobante: TipoComprobante;
  kg?: number;
  neto: number;
  noGravado: number;
  ivaMonto: number;
  percepciones: number;
  total: number;
  precioFacturado?: number;
  esMiel: boolean;

  // Parámetros de cálculo de retenciones elegidos/confirmados por el usuario
  retencionIvaManual?: { pct?: number; monto?: number };
  retencionGananciasPctManual?: number;
  categoriaMinimoGanancias: CategoriaMinimoGanancias;
  minimoGananciasManual?: number;

  // Campos de Apícola
  banco?: string;
  comentarios?: string;
  tipoGasto: TipoGasto;
  controlKilos?: number;
  acopiador?: Acopiador;
  acopiadorOtro?: string;
  orden?: string;
  traza?: string;
  conciliacion?: string;
  estado?: string;
  fechaEntrega?: string;
  comentarios2?: string;
  vencimientoManual?: string;

  origenCampos: Partial<Record<keyof DatosExtraidos, "factura" | "manual">>;
}

export interface RetencionesCalculadas {
  retencionIva: number;
  retencionGanancias: number;
  aPlazo: number;
  aPagar: number;
  minimoGananciasAplicado: number;
  esPrimeraFacturaDelMesParaCuit: boolean;
}

export interface ParametrosFiscales {
  retencion_iva_miel_pct: number;
  retencion_ganancias_pct: number;
  minimo_bienes: number;
  minimo_honorarios: number;
  minimo_servicios_transporte: number;
  aplazo_pct: number;
  aplazo_umbral_neto: number;
  vencimiento_dias_default: number;
}

export interface DuplicadoCheckResult {
  esDuplicado: boolean;
  hoja?: string;
  fila?: number;
}
