/**
 * Heurística de detección automática de "miel" (sección 8.1) por texto de
 * la factura. La UI siempre muestra un toggle para forzar el tipo si esta
 * detección falla o es ambigua.
 */
const PALABRAS_CLAVE_MIEL = [
  /\bmiel(es)?\b/i,
  /\bap[ií]colas?\b/i,
  /\bap[ií]cultura\b/i,
  /\bpol[ei]n\b/i,
  /\bcera\s+de\s+abejas?\b/i,
  /\bpropoleo?s?\b/i,
  /\btambor(es)?\s+de\s+miel\b/i,
  /\bnc[m]?\s*0409\b/i, // posición arancelaria de la miel natural
];

export function detectarEsMiel(textoFactura: string): boolean {
  return PALABRAS_CLAVE_MIEL.some((regex) => regex.test(textoFactura));
}
