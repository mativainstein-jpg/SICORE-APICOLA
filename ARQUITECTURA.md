# Arquitectura — Sistema de Procesamiento de Facturas (Sicore / Apícola)

Fase 1 (análisis) resuelta en este documento. Fase 2 (implementación) en `src/`.

## Stack elegido

- **Electron + React + TypeScript + Vite**: única forma práctica de tener una
  app de escritorio idéntica en Windows/macOS, con doble clic, sin terminal,
  y con auto-update integrado.
- **electron-builder**: genera `.exe` (NSIS) y `.dmg`/`.app`, con
  auto-actualización desde **GitHub Releases** vía `electron-updater`
  (resuelve la sección 8.4-a: el updater corre en segundo plano al abrir la
  app, sin pasos manuales).
- **exceljs**: lectura/escritura de `.xlsx` preservando fórmulas y formato,
  necesario para las columnas calculadas (O en Sicore, I/L en Apícola).
- **pdfjs-dist**: extracción de capa de texto de PDF (rápido, camino
  primario). **tesseract.js**: OCR fallback para facturas escaneadas/imagen
  (sección 8.2 - híbrido).
- **proper-lockfile**: bloqueo de archivo para evitar corrupción por
  escritura concurrente (mejora 9.2).
- Sin backend/servidor: todo corre local en el proceso principal de
  Electron; el proceso de renderer (React) solo habla con `main` vía IPC
  (`contextBridge`, `contextIsolation: true`, sin `nodeIntegration` en el
  renderer — buena práctica de seguridad de Electron).

## Estructura de carpetas

```
src/
  main/                     # proceso principal de Electron (Node)
    index.ts                # bootstrap, ventana, auto-updater
    updater.ts              # electron-updater sobre GitHub Releases
    excel/
      workbookStore.ts       # ruta de carpeta destino guardada (userData)
      lock.ts                 # bloqueo de archivo (proper-lockfile) + cola
      backup.ts               # copia .bak con timestamp antes de escribir
      sicoreWriter.ts          # crea/agrega filas a Sicore.xlsx
      apicolaWriter.ts         # crea/agrega filas a Apicola.xlsx
      duplicados.ts            # chequeo CUIT + N° factura
    calculo/
      retenciones.ts          # reglas puras de sección 5 y 6 (testeable)
    extraccion/
      pdfTexto.ts              # capa de texto de PDF (pdfjs-dist)
      ocr.ts                    # fallback OCR (tesseract.js)
      parserFactura.ts          # regex + heurísticas -> campos estructurados
      deteccionMiel.ts          # heurística de producto "miel"
    config/
      parametros.ts             # lee/escribe config/parametros_fiscales.json
      admin.ts                   # hash+verificación de clave admin (9.7)
    capturas.ts                 # guarda captura de pantalla de retenciones
    ipc/
      handlers.ts                # registro de todos los canales IPC
  preload/
    index.ts                   # contextBridge, API tipada para el renderer
  renderer/                   # UI React
    main.tsx / App.tsx
    pages/
      CargaFacturas.tsx         # cola de carga + selector múltiple
      RevisionFactura.tsx       # panel dividido: preview | formulario
      Configuracion.tsx         # parámetros fiscales (protegido por admin)
    components/
      PreviewFactura.tsx
      FormularioDatos.tsx        # marca visual campo extraído vs. manual
      RetencionesPreview.tsx     # lo que se captura como screenshot
    state/
      colaFacturas.ts
  shared/
    types.ts                   # tipos compartidos main/renderer
config/
  parametros_fiscales.json     # ver sección 7 de la spec
resources/                    # íconos de la app
```

## Decisiones clave (sección 8, ya resueltas en la spec) + notas de implementación

1. **Detección de miel**: `deteccionMiel.ts` busca keywords ("miel", "apícola",
   "polen", "cera", NCM de miel) en el texto extraído; UI muestra un toggle
   arriba del formulario para forzar Miel/No-miel.
2. **Extracción híbrida**: `parserFactura.ts` intenta primero `pdfTexto.ts`;
   si el texto extraído es insuficiente (< umbral de caracteres o campos
   clave no matchean), cae a `ocr.ts`.
3. **Ubicación de Excels**: primer uso pide carpeta destino (`dialog.
   showOpenDialog`), se persiste en `app.getPath('userData')/settings.json`
   vía `workbookStore.ts`. Si no existen `Sicore.xlsx`/`Apicola.xlsx` en esa
   carpeta, se crean con headers y estilos.
4. **Auto-update**: `updater.ts` usa `autoUpdater` de `electron-updater`
   apuntando al repo de GitHub (releases). Chequeo silencioso al abrir,
   descarga en segundo plano, instala en el próximo reinicio de la app sin
   diálogos técnicos (solo un aviso simple "Hay una actualización lista,
   se aplicará al reiniciar").
5. **Importe a pagar en Apícola**: `apicolaWriter.ts` llama a
   `calculo/retenciones.ts` de forma independiente con los mismos datos de
   factura — nunca lee `Sicore.xlsx`.

## Mejoras adicionales evaluadas (más allá de la sección 9 de la spec)

Propuestas para una futura iteración (no bloquean el MVP, documentadas para
decisión del usuario):

- **Historial/auditoría**: hoja oculta o archivo `log.jsonl` con quién cargó
  qué factura y cuándo (usuario, hostname, timestamp), útil si en el futuro
  hay más de un empleado y se necesita trazabilidad.
- **Exportable de resumen mensual**: botón "Resumen del mes" que totaliza
  retenciones/IVA/A pagar sin abrir Excel, para control rápido.
- **Alertas de vencimiento** (Apícola col. A): aviso en la app cuando hay
  facturas con vencimiento en los próximos N días, para no perder fechas de
  pago.
- **Reintento de OCR con recorte manual**: si el usuario ve que la
  extracción falló en un campo puntual, poder recortar esa zona de la
  imagen y re-OCRearla en vez de tipear todo a mano.
- **Modo offline-first para el update**: si no hay internet al abrir, la app
  debe seguir funcionando con la última versión instalada (no bloquear el
  arranque esperando red) — se documenta como requisito no funcional
  implícito.
- **Exportación a PDF del comprobante de carga**: opcional, un resumen de la
  factura + retenciones calculadas, para archivo interno o para el
  proveedor.

Estas no se implementan en el MVP salvo que el usuario las pida
explícitamente; se dejan documentadas para no perderlas.

## Plan de implementación por fases (Fase 2)

1. Scaffolding del proyecto (Electron + Vite + React + TS), configuración de
   build/dev.
2. `config/parametros_fiscales.json` + módulo de lectura/escritura +
   pantalla de configuración protegida por clave admin.
3. Módulo puro `calculo/retenciones.ts` (reglas 5.2, 5.3, 6) con lógica
   testeable, independiente de Excel/UI.
4. Escritura de Excel: `sicoreWriter.ts` + `apicolaWriter.ts` +
   `duplicados.ts` + `backup.ts` + `lock.ts`.
5. Extracción: `pdfTexto.ts`, `ocr.ts`, `parserFactura.ts`,
   `deteccionMiel.ts`.
6. IPC + preload + wiring en `main/index.ts`.
7. UI: carga múltiple → cola de revisión de a una → panel dividido
   preview/formulario editable con marcado visual manual-vs-extraído →
   confirmar → escritura + captura de pantalla.
8. Auto-update (`electron-updater`) + empaquetado (`electron-builder`) para
   Windows y macOS.
9. Validaciones (CUIT, duplicados) y pulido de UX en español para usuarios
   no técnicos.
