import { useEffect, useState } from "react";
import type { ParametrosFiscales } from "../../shared/types.js";

interface Props {
  onCerrar: () => void;
}

export function Configuracion({ onCerrar }: Props) {
  const [autenticado, setAutenticado] = useState(false);
  const [clave, setClave] = useState("");
  const [error, setError] = useState<string>();
  const [parametros, setParametros] = useState<ParametrosFiscales>();
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (autenticado) {
      window.sicoreApi.config.leerParametros().then(setParametros);
    }
  }, [autenticado]);

  async function ingresar() {
    setError(undefined);
    const ok = await window.sicoreApi.config.verificarClaveAdmin(clave);
    if (ok) setAutenticado(true);
    else setError("Clave incorrecta. Esta pantalla es solo para el usuario admin.");
  }

  async function guardar() {
    if (!parametros) return;
    setGuardando(true);
    setError(undefined);
    try {
      await window.sicoreApi.config.guardarParametros(clave, parametros);
      onCerrar();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  if (!autenticado) {
    return (
      <div className="pantalla-centrada">
        <h2>Configuración (solo administrador)</h2>
        {error && <div className="error-banner">{error}</div>}
        <input
          type="password"
          placeholder="Clave de administrador"
          value={clave}
          onChange={(e) => setClave(e.target.value)}
          style={{ maxWidth: 280 }}
        />
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={ingresar}>Ingresar</button>
          <button className="secundario" onClick={onCerrar}>
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  if (!parametros) return <div className="pantalla-centrada">Cargando…</div>;

  const campo = (
    clave: keyof ParametrosFiscales,
    etiqueta: string,
  ) => (
    <div>
      <label>{etiqueta}</label>
      <input
        type="number"
        value={parametros[clave]}
        onChange={(e) =>
          setParametros((prev) => prev && { ...prev, [clave]: Number(e.target.value) })
        }
      />
    </div>
  );

  return (
    <div className="contenido">
      <h2>Parámetros fiscales</h2>
      {error && <div className="error-banner">{error}</div>}
      <div className="fila-campos">
        {campo("retencion_iva_miel_pct", "% Retención IVA (miel)")}
        {campo("retencion_ganancias_pct", "% Retención de Ganancias (default)")}
        {campo("minimo_bienes", "Mínimo no imponible — Bienes ($)")}
        {campo("minimo_honorarios", "Mínimo no imponible — Honorarios ($)")}
        {campo("minimo_servicios_transporte", "Mínimo no imponible — Servicios y transportes ($)")}
        {campo("aplazo_pct", "% A Plazo (solo miel)")}
        {campo("aplazo_umbral_neto", "Umbral de Neto para A Plazo ($)")}
        {campo("vencimiento_dias_default", "Días default para vencimiento (Apícola)")}
      </div>
      <div className="acciones-formulario">
        <button className="secundario" onClick={onCerrar} disabled={guardando}>
          Cancelar
        </button>
        <button onClick={guardar} disabled={guardando}>
          {guardando ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </div>
  );
}
