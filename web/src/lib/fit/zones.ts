import type { Zona } from "@/types/database";

export interface FaixaZona {
  codigo: string;
  rapidoSec: number | null; // limite rápido (menor)
  lentoSec: number | null; // limite lento (maior)
}

export function faixasDeZonas(zonas: Zona[]): FaixaZona[] {
  return [...zonas]
    .sort((a, b) => a.codigo.localeCompare(b.codigo))
    .map((z) => ({
      codigo: z.codigo,
      rapidoSec: z.pace_rapido_sec,
      lentoSec: z.pace_lento_sec,
    }));
}

/**
 * Classifica um pace (segundos por km) numa zona, a partir da tabela do ciclo.
 * Regra: a zona é aquela cujo intervalo [rapido, lento] contém o pace.
 * - Mais rápido que o limite rápido da zona mais veloz  -> essa zona (ex: Z5).
 * - Mais lento que o limite lento da zona mais lenta    -> essa zona (ex: Z1).
 * Nunca lê zona do arquivo .FIT (seção 4 da especificação).
 */
export function classificarZona(paceSec: number, faixas: FaixaZona[]): string | null {
  if (!faixas.length || !Number.isFinite(paceSec)) return null;

  // ordena da mais lenta (maior tempo) para a mais rápida
  const ordenadas = [...faixas].sort(
    (a, b) => (b.lentoSec ?? Infinity) - (a.lentoSec ?? Infinity),
  );

  for (const f of ordenadas) {
    const rapido = f.rapidoSec ?? 0; // Z5: sem limite rápido
    const lento = f.lentoSec ?? Infinity; // Z1: sem limite lento (na prática tem)
    if (paceSec >= rapido && paceSec <= lento) return f.codigo;
  }

  // fora de todas as faixas: encaixa na extremidade
  const maisLenta = ordenadas[0];
  const maisRapida = ordenadas[ordenadas.length - 1];
  if (maisLenta.lentoSec != null && paceSec > maisLenta.lentoSec) return maisLenta.codigo;
  if (maisRapida.rapidoSec != null && paceSec < maisRapida.rapidoSec) return maisRapida.codigo;
  return null;
}

export { zonasDaEstrutura } from "./estrutura";

/** Faixa [rápido, lento] de uma zona pelo código, ou null. */
export function faixaPorCodigo(
  codigo: string | null,
  faixas: FaixaZona[],
): FaixaZona | null {
  if (!codigo) return null;
  return faixas.find((f) => f.codigo === codigo) ?? null;
}
