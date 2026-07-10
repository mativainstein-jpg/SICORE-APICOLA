import type { ReactNode } from "react";

interface Props {
  etiqueta: string;
  origen?: "factura" | "manual";
  children: ReactNode;
}

/** Marca visual (mejora 9.4) para distinguir campos extraídos de la factura vs. tipeados a mano. */
export function CampoConOrigen({ etiqueta, origen, children }: Props) {
  const clase = origen === "manual" ? "campo-origen-manual" : origen === "factura" ? "campo-origen-factura" : "";
  return (
    <div className={clase}>
      <label>
        {etiqueta}
        {origen === "factura" && <span className="badge badge-factura">factura</span>}
        {origen === "manual" && <span className="badge badge-manual">manual</span>}
      </label>
      {children}
    </div>
  );
}
