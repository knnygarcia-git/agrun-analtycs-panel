import type { PausaBruta } from "./types";

/** Extrai os trechos pausados dos eventos `timer` do .FIT (stop_all → start
 *  seguinte). O relógio para de contar tempo/distância nesses trechos —
 *  é o que TrainingPeaks/Garmin Connect chamam de "tempo em movimento".
 *  O stop final da sessão (sem start depois) não vira pausa, é só o fim. */
/* eslint-disable @typescript-eslint/no-explicit-any */
export function extrairPausas(eventos: any[] | undefined): PausaBruta[] {
  const pausas: PausaBruta[] = [];
  let aberta: Date | null = null;
  for (const e of eventos ?? []) {
    if (e?.event !== "timer") continue;
    const ts = e?.timestamp instanceof Date ? e.timestamp : new Date(e?.timestamp);
    if (Number.isNaN(ts.getTime())) continue;
    if (e.event_type === "stop_all" || e.event_type === "stop") {
      aberta = ts;
    } else if (e.event_type === "start" && aberta) {
      if (ts.getTime() > aberta.getTime()) pausas.push({ inicio: aberta, fim: ts });
      aberta = null;
    }
  }
  return pausas;
}

/** Segundos "em movimento" entre `inicioSessao` e `momento`: o tempo de
 *  relógio corrido, menos qualquer trecho pausado no meio. Sem pausas
 *  registradas, é idêntico ao tempo corrido normal. */
export function tempoMovimentoSec(
  momento: Date,
  inicioSessao: Date,
  pausas: PausaBruta[],
): number {
  let sec = (momento.getTime() - inicioSessao.getTime()) / 1000;
  for (const p of pausas) {
    if (p.inicio.getTime() >= momento.getTime()) break;
    const fimEfetivo = Math.min(p.fim.getTime(), momento.getTime());
    sec -= (fimEfetivo - p.inicio.getTime()) / 1000;
  }
  return Math.round(sec);
}
