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

/** Constrói a faixa planejada (trechos) num eixo de tempo ou de distância.
 *  Trechos em tempo são convertidos para distância (e vice-versa) usando o
 *  pace médio da zona do trecho. */
export function faixaPlanejada(
  estrutura: string | null,
  faixas: FaixaZona[],
  eixo: "tempo" | "dist",
  paceFallbackSec = 360,
): FaixaPlano[] {
  const segs = parseEstrutura(estrutura);
  const porCodigo = new Map(faixas.map((f) => [f.codigo, f]));
  const out: FaixaPlano[] = [];
  let cursor = 0;

  for (const s of segs) {
    const fz = s.zona ? porCodigo.get(s.zona) : undefined;
    const paceMid =
      fz && fz.rapidoSec != null && fz.lentoSec != null
        ? (fz.rapidoSec + fz.lentoSec) / 2
        : fz?.rapidoSec ?? fz?.lentoSec ?? paceFallbackSec;

    // valor do trecho no eixo pedido
    let extensao: number;
    if (s.eixo === eixo) {
      extensao = s.valor;
    } else if (eixo === "dist") {
      // tempo(seg) -> distância(m): m = seg / (paceMid_seg_por_km / 1000)
      extensao = (s.valor / paceMid) * 1000;
    } else {
      // distância(m) -> tempo(seg)
      extensao = (s.valor / 1000) * paceMid;
    }

    out.push({
      x0: cursor,
      x1: cursor + extensao,
      zona: s.zona,
      rapidoSec: fz?.rapidoSec ?? null,
      lentoSec: fz?.lentoSec ?? null,
    });
    cursor += extensao;
  }
  return out;
}
