import type { FitParsed } from "./types";
import { parseEstrutura } from "./estrutura";
import { tempoMovimentoSec } from "./pausas";
import type { FaixaZona } from "./zones";

export interface PontoSerie {
  /** segundos desde o início do treino */
  t: number;
  /** distância acumulada em metros */
  dist: number;
  hr: number | null;
  /** pace em s/km (limitado a 15:00 para não explodir a escala em paradas) */
  paceSec: number | null;
  /** cadência em passadas/min (já com o fator ×2 — seção 4) */
  cad: number | null;
  /** altitude em metros */
  alt: number | null;
}

const PACE_MAX = 900; // 15:00/km

/** Série ponto-a-ponto para o gráfico, reduzida para ~`alvo` pontos. */
export function construirSerie(fit: FitParsed, alvo = 480): PontoSerie[] {
  // tempo em movimento (descontando pausas manuais do relógio) — sem isso,
  // uma parada no meio do treino "estica" tudo que vem depois no gráfico e
  // desalinha a comparação com a faixa planejada.
  const todos: PontoSerie[] = fit.records.map((r) => {
    const paceSec =
      r.speedMs && r.speedMs > 0.4
        ? Math.min(PACE_MAX, Math.round(1000 / r.speedMs))
        : PACE_MAX;
    return {
      t: tempoMovimentoSec(r.t, fit.inicio, fit.pausas),
      dist: Math.round(r.distM),
      hr: r.hr,
      paceSec,
      cad: r.cad != null ? Math.round((r.cad + r.fracCad) * 2) : null,
      alt: r.altM,
    };
  });

  if (todos.length <= alvo) return todos;

  // média por janela (mantém a forma, tira o ruído segundo-a-segundo)
  const media = (xs: (number | null)[]) => {
    const vs = xs.filter((x): x is number => x != null);
    return vs.length ? Math.round(vs.reduce((a, b) => a + b, 0) / vs.length) : null;
  };
  const janela = Math.ceil(todos.length / alvo);
  const out: PontoSerie[] = [];
  for (let i = 0; i < todos.length; i += janela) {
    const bloco = todos.slice(i, i + janela);
    out.push({
      t: bloco[0].t,
      dist: bloco[0].dist,
      hr: media(bloco.map((p) => p.hr)),
      paceSec: media(bloco.map((p) => p.paceSec)),
      cad: media(bloco.map((p) => p.cad)),
      alt: media(bloco.map((p) => p.alt)),
    });
  }
  return out;
}

export interface FaixaPlano {
  /** limites do eixo x deste trecho (segundos OU metros, conforme `eixo`) */
  x0: number;
  x1: number;
  zona: string | null;
  rapidoSec: number | null;
  lentoSec: number | null;
}

/** Distância real (m) no instante `tAlvo` (s), interpolando a série real.
 *  Sem série suficiente, cai no `fallback` (estimativa por pace de zona). */
function distNoInstante(tAlvo: number, serie: PontoSerie[], fallback: number): number {
  if (serie.length < 2) return fallback;
  if (tAlvo <= serie[0].t) return serie[0].dist;
  const ultimo = serie[serie.length - 1];
  if (tAlvo >= ultimo.t) return ultimo.dist;
  for (let i = 1; i < serie.length; i++) {
    if (serie[i].t >= tAlvo) {
      const a = serie[i - 1];
      const b = serie[i];
      const frac = b.t === a.t ? 0 : (tAlvo - a.t) / (b.t - a.t);
      return a.dist + (b.dist - a.dist) * frac;
    }
  }
  return ultimo.dist;
}

/** Tempo real (s) em que a distância acumulada bateu `dAlvo` (m), interpolando
 *  a série real. Sem série suficiente, cai no `fallback` (estimativa). */
function tempoNaDistancia(dAlvo: number, serie: PontoSerie[], fallback: number): number {
  if (serie.length < 2) return fallback;
  if (dAlvo <= serie[0].dist) return serie[0].t;
  const ultimo = serie[serie.length - 1];
  if (dAlvo >= ultimo.dist) return ultimo.t;
  for (let i = 1; i < serie.length; i++) {
    if (serie[i].dist >= dAlvo) {
      const a = serie[i - 1];
      const b = serie[i];
      const frac = b.dist === a.dist ? 0 : (dAlvo - a.dist) / (b.dist - a.dist);
      return a.t + (b.t - a.t) * frac;
    }
  }
  return ultimo.t;
}

/** Constrói a faixa planejada (trechos) num eixo de tempo ou de distância.
 *  Quando o trecho já está na unidade pedida, usa o valor exato do plano.
 *  Quando precisa converter (ex: trecho em minutos, eixo em distância), usa
 *  o histórico REAL de tempo×distância do treino (não o pace da zona) —
 *  senão a faixa desalinha da linha real sempre que o aluno correu num pace
 *  diferente do planejado, e o erro se acumula trecho a trecho. */
export function faixaPlanejada(
  estrutura: string | null,
  faixas: FaixaZona[],
  eixo: "tempo" | "dist",
  serieReal: PontoSerie[] = [],
  paceFallbackSec = 360,
): FaixaPlano[] {
  const segs = parseEstrutura(estrutura);
  const porCodigo = new Map(faixas.map((f) => [f.codigo, f]));
  const out: FaixaPlano[] = [];
  let tCursor = 0; // segundos planejados acumulados (exato para trechos em tempo)
  let dCursor = 0; // metros planejados acumulados (exato para trechos em distância)

  for (const s of segs) {
    const fz = s.zona ? porCodigo.get(s.zona) : undefined;
    const paceMid =
      fz && fz.rapidoSec != null && fz.lentoSec != null
        ? (fz.rapidoSec + fz.lentoSec) / 2
        : fz?.rapidoSec ?? fz?.lentoSec ?? paceFallbackSec;

    let t0: number, t1: number, d0: number, d1: number;
    if (s.eixo === "tempo") {
      t0 = tCursor;
      t1 = tCursor + s.valor;
      d0 = dCursor;
      d1 = distNoInstante(t1, serieReal, dCursor + (s.valor / paceMid) * 1000);
    } else {
      d0 = dCursor;
      d1 = dCursor + s.valor;
      t0 = tCursor;
      t1 = tempoNaDistancia(d1, serieReal, tCursor + (s.valor / 1000) * paceMid);
    }

    out.push({
      x0: eixo === "tempo" ? t0 : d0,
      x1: eixo === "tempo" ? t1 : d1,
      zona: s.zona,
      rapidoSec: fz?.rapidoSec ?? null,
      lentoSec: fz?.lentoSec ?? null,
    });

    tCursor = t1;
    dCursor = d1;
  }
  return out;
}
