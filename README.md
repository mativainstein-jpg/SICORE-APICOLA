# Sicore / Apícola

App de escritorio (Windows/macOS) para digitalizar facturas de compra de
NAIMAN Foods y generar/actualizar `Sicore.xlsx` y `Apicola.xlsx`. Ver
`ARQUITECTURA.md` para el detalle de decisiones de diseño y plan de
implementación.

## Desarrollo

```bash
npm install
npm run dev          # levanta Vite + Electron en modo desarrollo
npm run typecheck
npm test             # tests del motor de cálculo de retenciones y del parser
```

## Empaquetado (genera el instalador que usan los administrativos)

```bash
npm run package:win   # .exe (NSIS) para Windows
npm run package:mac   # .dmg para macOS
```

Los instaladores se publican en GitHub Releases del repositorio configurado
en `package.json` (`build.publish`); la app chequea y descarga
actualizaciones desde ahí automáticamente al abrir (`electron-updater`).

## Estructura

- `src/main/`: proceso principal de Electron — cálculo de retenciones,
  lectura/escritura de Excel, extracción de datos de factura (texto de PDF
  + OCR de respaldo), IPC.
- `src/preload/`: puente seguro (`contextBridge`) entre el proceso
  principal y la interfaz.
- `src/renderer/`: interfaz en React (carga de facturas, panel dividido de
  revisión, pantalla de configuración).
- `config/parametros_fiscales.json`: valores por defecto de los
  porcentajes y mínimos usados en los cálculos (se editan también desde la
  pantalla de Configuración, protegida por clave de administrador).

## Primer uso

Al abrir la app por primera vez, se pide elegir la carpeta donde se van a
crear `Sicore.xlsx` y `Apicola.xlsx`. Esa carpeta queda guardada para las
próximas veces.
