import { describe, expect, it } from "vitest";
import {
  calcularAPlazo,
  calcularRetenciones,
  calcularRetencionGanancias,
  calcularRetencionIva,
} from "./retenciones.js";
import type { FacturaConfirmada, ParametrosFiscales } from "../../shared/types.js";

const parametros: ParametrosFiscales = {
  retencion_iva_miel_pct: 6,
  retencion_ganancias_pct: 2,
  minimo_bienes: 224000,
  minimo_honorarios: 160000,
  minimo_servicios_transporte: 67170,
  aplazo_pct: 4.5,
  aplazo_umbral_neto: 50000,
  vencimiento_dias_default: 7,
};

function factura(overrides: Partial<FacturaConfirmada> = {}): FacturaConfirmada {
  return {
    archivoOriginal: "f.pdf",
    fechaEmision: "2026-07-01",
    cuit: "20111111112",
    nombreProveedor: "Proveedor SA",
    numeroFactura: "0001-00000001",
    tipoComprobante: "FCA",
    neto: 100000,
    noGravado: 0,
    ivaMonto: 21000,
    percepciones: 0,
    total: 121000,
    esMiel: true,
    aplicarMinimoGanancias: true,
    categoriaMinimoGanancias: "bienes",
    aplicarAPlazo: true,
    tipoGasto: "Miel",
    origenCampos: {},
    ...overrides,
  };
}

describe("calcularRetencionIva", () => {
  it("miel: default 6% del neto", () => {
    expect(calcularRetencionIva(factura(), parametros)).toBe(6000);
  });

  it("no-miel: default 0%", () => {
    expect(calcularRetencionIva(factura({ esMiel: false }), parametros)).toBe(0);
  });

  it("permite forzar % manual", () => {
    const f = factura({ retencionIvaManual: { pct: 10 } });
    expect(calcularRetencionIva(f, parametros)).toBe(10000);
  });

  it("permite forzar monto manual", () => {
    const f = factura({ retencionIvaManual: { monto: 1234.5 } });
    expect(calcularRetencionIva(f, parametros)).toBe(1234.5);
  });

  it("no aplica retención de IVA en facturas C, ni aunque se fuerce manual", () => {
    const f = factura({ tipoComprobante: "FCC", retencionIvaManual: { monto: 1234.5 } });
    expect(calcularRetencionIva(f, parametros)).toBe(0);
  });
});

describe("calcularRetencionGanancias", () => {
  it("aplica el minimo solo en la primera factura del mes para el CUIT", () => {
    const f = factura({ neto: 300000, categoriaMinimoGanancias: "bienes" });
    const primera = calcularRetencionGanancias(f, parametros, []);
    expect(primera.esPrimera).toBe(true);
    expect(primera.minimoAplicado).toBe(224000);
    expect(primera.retencion).toBe(1520); // (300000-224000)*2%

    const segunda = calcularRetencionGanancias(f, parametros, [{ cuit: f.cuit }]);
    expect(segunda.esPrimera).toBe(false);
    expect(segunda.minimoAplicado).toBe(0);
    expect(segunda.retencion).toBe(6000); // 300000*2%
  });

  it("nunca da base negativa cuando el neto es menor al minimo", () => {
    const f = factura({ neto: 50000, categoriaMinimoGanancias: "bienes" });
    const r = calcularRetencionGanancias(f, parametros, []);
    expect(r.retencion).toBe(0);
  });

  it("respeta el % manual editado por el usuario", () => {
    const f = factura({
      neto: 300000,
      categoriaMinimoGanancias: "bienes",
      retencionGananciasPctManual: 5,
    });
    const r = calcularRetencionGanancias(f, parametros, []);
    expect(r.retencion).toBe(3800); // (300000-224000)*5%
  });

  it("no aplica ningún mínimo si el usuario lo desactiva, aunque sea la primera factura del mes", () => {
    const f = factura({
      neto: 300000,
      categoriaMinimoGanancias: "bienes",
      aplicarMinimoGanancias: false,
    });
    const r = calcularRetencionGanancias(f, parametros, []);
    expect(r.esPrimera).toBe(true);
    expect(r.minimoAplicado).toBe(0);
    expect(r.retencion).toBe(6000); // 300000*2%, sin restar mínimo
  });

  it("no aplica retención de Ganancias en facturas C", () => {
    const f = factura({ neto: 300000, tipoComprobante: "FCC" });
    const r = calcularRetencionGanancias(f, parametros, []);
    expect(r.retencion).toBe(0);
    expect(r.minimoAplicado).toBe(0);
  });
});

describe("calcularAPlazo", () => {
  it("solo aplica a miel y por encima del umbral", () => {
    expect(calcularAPlazo(factura({ esMiel: true, neto: 60000 }), parametros)).toBe(2700);
    expect(calcularAPlazo(factura({ esMiel: true, neto: 50000 }), parametros)).toBe(0);
    expect(calcularAPlazo(factura({ esMiel: false, neto: 60000 }), parametros)).toBe(0);
  });

  it("da $0 si el usuario destilda 'Es a plazo', aunque sea miel y supere el umbral", () => {
    const f = factura({ esMiel: true, neto: 60000, aplicarAPlazo: false });
    expect(calcularAPlazo(f, parametros)).toBe(0);
  });
});

describe("calcularRetenciones", () => {
  it("A Pagar = Total - retIva - retGanancias - aPlazo", () => {
    const f = factura({ neto: 300000, total: 363000, esMiel: true });
    const r = calcularRetenciones(f, parametros, []);
    expect(r.retencionIva).toBe(18000); // 6% de 300000
    expect(r.retencionGanancias).toBe(1520); // (300000-224000)*2%
    expect(r.aPlazo).toBe(13500); // 4.5% de 300000
    expect(r.aPagar).toBe(363000 - 18000 - 1520 - 13500);
  });
});
