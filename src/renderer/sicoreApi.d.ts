import type { SicoreApi } from "../preload/index.js";

declare global {
  interface Window {
    sicoreApi: SicoreApi;
  }
}
