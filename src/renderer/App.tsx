import { useEffect, useState } from "react";
import type { FacturaConfirmada } from "../shared/types.js";
import { RevisionFactura } from "./pages/RevisionFactura.js";
import { Configuracion } from "./pages/Configuracion.js";
import { ArchivarFacturas } from "./pages/ArchivarFacturas.js";
import { construirFacturaDesdeExtraccion } from "./util/construirFactura.js";
import { renderizarPrimeraPaginaComoPng } from "./util/renderizarPdf.js";

type Pantalla = "carga" | "revision" | "configuracion" | "archivar";

const MIN_CARACTERES_TEXTO_UTIL = 40;

export function App() {
  const [carpetaDestino, setCarpetaDestino] = useState<string | undefined>();
  const [cargandoCarpeta, setCargandoCarpeta] = useState(true);
  const [cola, setCola] = useState<string[]>([]);
  const [facturaEnRevision, setFacturaEnRevision] = useState<FacturaConfirmada>();
  const [extrayendo, setExtrayendo] = useState(false);
  const [pantalla, setPantalla] = useState<Pantalla>("carga");
  const [avisoActualizacion, setAvisoActualizacion] = useState<string>();
  const [cargadas, setCargadas] = useState(0);
  const [pendientesDeArchivar, setPendientesDeArchivar] = useState(0);

  useEffect(() => {
    window.sicoreApi.carpeta.obtenerDestino().then((c) => {
      setCarpetaDestino(c);
      setCargandoCarpeta(false);
    });
    window.sicoreApi.actualizaciones.onListaParaInstalar(setAvisoActualizacion);
  }, []);

  async function actualizarPendientes() {
    try {
      const lista = await window.sicoreApi.pendientes.listar();
      setPendientesDeArchivar(lista.length);
    } catch {
      // sin carpeta destino todavía
    }
  }

  useEffect(() => {
    if (carpetaDestino) actualizarPendientes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carpetaDestino, pantalla]);

  useEffect(() => {
    if (cola.length > 0 && !facturaEnRevision && !extrayendo) {
      procesarSiguiente();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cola, facturaEnRevision, extrayendo]);

  async function elegirCarpeta() {
    const carpeta = await window.sicoreApi.carpeta.elegirDestino();
    if (carpeta) setCarpetaDestino(carpeta);
  }

  async function cargarFacturas() {
    const archivos = await window.sicoreApi.factura.seleccionarArchivos();
    if (archivos.length > 0) {
      setCola((prev) => [...prev, ...archivos]);
      setPantalla("carga");
    }
  }

  async function procesarSiguiente() {
    const [siguiente, ...resto] = cola;
    setExtrayendo(true);
    try {
      let datos = await window.sicoreApi.factura.extraerDatos(siguiente);

      const esPdfSinTexto =
        siguiente.toLowerCase().endsWith(".pdf") &&
        (!datos.textoCompleto || datos.textoCompleto.length < MIN_CARACTERES_TEXTO_UTIL);

      if (esPdfSinTexto) {
        // PDF escaneado (sin capa de texto): lo renderizamos como imagen acá
        // en la ventana (con el <canvas> del navegador) y lo mandamos a OCR.
        try {
          const base64Pdf = await window.sicoreApi.archivo.leerBase64(siguiente);
          const pngDataUrl = await renderizarPrimeraPaginaComoPng(base64Pdf);
          datos = await window.sicoreApi.factura.extraerDatosDesdeImagen(pngDataUrl);
        } catch (err) {
          console.error("No se pudo hacer OCR sobre el PDF escaneado:", err);
        }
      }

      setFacturaEnRevision(construirFacturaDesdeExtraccion(siguiente, datos));
      setCola(resto);
      setPantalla("revision");
    } finally {
      setExtrayendo(false);
    }
  }

  function facturaConfirmada() {
    setCargadas((n) => n + 1);
    setFacturaEnRevision(undefined);
    if (cola.length === 0) setPantalla("carga");
  }

  function omitirFactura() {
    setFacturaEnRevision(undefined);
    if (cola.length === 0) setPantalla("carga");
  }

  if (cargandoCarpeta) {
    return <div className="pantalla-centrada">Cargando…</div>;
  }

  if (!carpetaDestino) {
    return (
      <div className="pantalla-centrada">
        <h2>Bienvenido/a</h2>
        <p>
          Elegí la carpeta donde se van a guardar <strong>Sicore.xlsx</strong> y{" "}
          <strong>Apicola.xlsx</strong>. Esta elección queda guardada para la próxima vez.
        </p>
        <button onClick={elegirCarpeta}>Elegir carpeta</button>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <header className="app-header">
        <h1>Sicore / Apícola — NAIMAN Foods</h1>
        <div style={{ display: "flex", gap: 10 }}>
          {cargadas > 0 && <span>{cargadas} factura(s) cargada(s) hoy</span>}
          <button
            className="secundario"
            disabled={cola.length > 0 || !!facturaEnRevision}
            onClick={() => setPantalla("archivar")}
          >
            Archivar facturas{pendientesDeArchivar > 0 ? ` (${pendientesDeArchivar})` : ""}
          </button>
          <button
            className="secundario"
            title={carpetaDestino}
            disabled={cola.length > 0 || !!facturaEnRevision}
            onClick={elegirCarpeta}
          >
            Cambiar carpeta
          </button>
          <button className="secundario" onClick={() => setPantalla("configuracion")}>
            Configuración
          </button>
        </div>
      </header>

      {avisoActualizacion && <div className="error-banner">{avisoActualizacion}</div>}

      <div className="contenido">
        {pantalla === "configuracion" && (
          <Configuracion onCerrar={() => setPantalla(cola.length > 0 || facturaEnRevision ? "revision" : "carga")} />
        )}

        {pantalla === "archivar" && <ArchivarFacturas onCerrar={() => setPantalla("carga")} />}

        {pantalla === "carga" && (
          <div className="pantalla-centrada">
            <h2>Cargar facturas</h2>
            <p>Podés seleccionar una o varias facturas a la vez (PDF o imagen).</p>
            <button onClick={cargarFacturas}>Cargar facturas</button>
            {cola.length > 0 && (
              <p>{cola.length} factura(s) en cola, procesando de a una…</p>
            )}
          </div>
        )}

        {pantalla === "revision" && extrayendo && (
          <div className="pantalla-centrada">Leyendo la factura…</div>
        )}

        {pantalla === "revision" && !extrayendo && facturaEnRevision && (
          <RevisionFactura
            facturaInicial={facturaEnRevision}
            onConfirmada={facturaConfirmada}
            onOmitir={omitirFactura}
          />
        )}
      </div>
    </div>
  );
}
