import { describe, expect, it } from "vitest";
import { parsearCamposDesdeTexto } from "./parserFactura.js";
import { detectarEsMiel } from "./deteccionMiel.js";

const TEXTO_FACTURA_EJEMPLO = `
FACTURA A
Punto de Venta: 0001 Comp. Nro: 00012345
Fecha de Emisión: 05/07/2026
Razón Social: Apicultores del Sur SRL
C.U.I.T.: 30-71044294-8
Importe Neto Gravado: $ 100.000,00
Importe No Gravado: $ 0,00
IVA 21%: $ 21.000,00
Percepciones: $ 500,00
Importe Total: $ 121.500,00
1500,00 Kg de miel a granel
Precio por Kg: $ 66,67
`;

describe("parsearCamposDesdeTexto", () => {
  it("extrae los campos principales de una factura tipo AFIP", () => {
    const datos = parsearCamposDesdeTexto(TEXTO_FACTURA_EJEMPLO);
    expect(datos.fechaEmision).toBe("2026-07-05");
    expect(datos.cuit).toBe("30710442948");
    expect(datos.tipoComprobante).toBe("FCA");
    expect(datos.neto).toBe(100000);
    expect(datos.ivaMonto).toBe(21000);
    expect(datos.total).toBe(121500);
    expect(datos.kg).toBe(1500);
    expect(datos.esMiel).toBe(true);
  });
});

describe("parsearCamposDesdeTexto - texto de OCR sin saltos de línea limpios", () => {
  it("no incluye el campo siguiente dentro del nombre del proveedor", () => {
    const texto = "Razón Social: VARGAS BALTAZAR Fecha de Emisión: 06/07/2026 C.U.I.T.: 20-12345678-9";
    const datos = parsearCamposDesdeTexto(texto);
    expect(datos.nombreProveedor).toBe("VARGAS BALTAZAR");
  });
});

describe("parsearCamposDesdeTexto - factura C de monotributista (sin Neto/IVA explícitos)", () => {
  const TEXTO_FACTURA_C = `
FACTURA C COD. 011
ARISTUCHE SERGIO DANIEL MARIO
Razón Social: ARISTUCHE SERGIO DANIEL MARIO
Domicilio Comercial: San Martin 379 - Santa Teresa, Santa Fe
Condición frente al IVA: Responsable Monotributo
Punto de Venta: 00004 Comp. Nro: 00000115
Fecha de Emisión: 07/07/2026
CUIT: 20138712479
Ingresos Brutos: 1020123484
Fecha de Inicio de Actividades: 01/11/2017
CUIT: 33708955499 Apellido y Nombre / Razón Social: NAIMAN S.A.
Condición frente al IVA: IVA Responsable Inscripto Domicilio: Jose Ubach Y Roca 1153 - Parana, Entre Ríos
Condición de venta: Contado
Código Producto / Servicio Cantidad U. Medida Precio Unit. % Bonif Imp. Bonif. Subtotal
Miel de abeja 1006,00 unidades 3150,00 0,00 0,00 3168900,00
`;

  it("saca Cantidad/Precio Unit./Subtotal de la tabla cuando no hay Neto Gravado ni IVA", () => {
    const datos = parsearCamposDesdeTexto(TEXTO_FACTURA_C);
    expect(datos.cuit).toBe("20138712479"); // el del proveedor, no el de NAIMAN
    expect(datos.tipoComprobante).toBe("FCC");
    expect(datos.kg).toBe(1006);
    expect(datos.precioFacturado).toBe(3150);
    expect(datos.neto).toBe(3168900);
    expect(datos.total).toBe(3168900);
  });
});

describe("detectarEsMiel", () => {
  it("detecta miel por palabras clave", () => {
    expect(detectarEsMiel("Venta de miel a granel")).toBe(true);
    expect(detectarEsMiel("Insumos apícolas varios")).toBe(true);
  });

  it("no detecta miel en facturas sin relación", () => {
    expect(detectarEsMiel("Compra de repuestos para camión")).toBe(false);
  });
});
