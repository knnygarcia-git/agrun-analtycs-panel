import FitParser from "fit-file-parser";
import type { EtapaExecutada } from "@/types/database";
import type { FitParsed, LapBruto, RecordBruto } from "./types";
import {
  classificarZona,
  faixaPorCodigo,
  zonasDaEstrutura,
  type FaixaZona,
} from "./zones";

/* eslint-disable @typescript-eslint/no-explicit-any */

const RE_CODIGO = /\bT(\d{2})\b/i;
const RE_SEQ = /\bS(\d{2})\b/i;
const RE_PLAN = /\bP(\d{2})\b/i;

/** desembrulha campos que a lib devolve como {value,...} */
function num(v: any): number | null {
  if (v == null) return null;
  if (typeof v === "object" && "value" in v) v = (v as any).value;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toDate(v: any): Date | null {
  if (v instanceof Date) return v;
  if (typeof v === "string" || typeof v === "number") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function isoDate(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
    d.getUTCDate(),
  ).padStart(2, "0")}`;
}

export async function parseFitResultado(buf: ArrayBuffer): Promise<FitParsed> {
  const parser = new FitParser({
    force: true,
    speedUnit: "m/s",
    lengthUnit: "m",
    mode: "list",
  });
  const data: any = await parser.parseAsync(buf);

  const sessao = (data.sessions ?? [])[0] ?? {};
  const nomeTreino: string | null =
    data.workout?.wkt_name ?? data.workout?.wktName ?? null;
  const codMatch = nomeTreino?.match(RE_CODIGO) ?? null;
  const codigo = codMatch ? `T${codMatch[1]}` : null;

  const inicio =
    toDate(sessao.start_time) ??
    toDate((data.records ?? [])[0]?.timestamp) ??
    new Date();

  const duracaoRealSec = Math.round(
    num(sessao.total_elapsed_time) ?? num(sessao.total_timer_time) ?? 0,
  );

  const records: RecordBruto[] = (data.records ?? []).flatMap((r: any) => {
    const t = toDate(r.timestamp);
    if (!t) return [];
    return [
      {
        t,
        hr: num(r.heart_rate),
        speedMs: num(r.enhanced_speed) ?? num(r.speed),
        altM: num(r.enhanced_altitude) ?? num(r.altitude),
        cad: num(r.cadence),
        fracCad: num(r.fractional_cadence) ?? 0,
        distM: num(r.distance) ?? 0,
      },
    ];
  });

  const laps: LapBruto[] = (data.laps ?? []).flatMap((l: any) => {
    const inicioLap = toDate(l.start_time);
    if (!inicioLap) return [];
    const durSec = num(l.total_timer_time) ?? num(l.total_elapsed_time) ?? 0;
    return [
      {
        messageIndex: num(l.message_index) ?? -1,
        wktStepIndex: num(l.wkt_step_index),
        inicio: inicioLap,
        // seção 4: NUNCA l.timestamp — fim = inicio + duração
        fim: new Date(inicioLap.getTime() + durSec * 1000),
        durSec,
        distM: num(l.total_distance) ?? 0,
        avgHr: num(l.avg_heart_rate),
        maxHr: num(l.max_heart_rate),
        avgCad: num(l.avg_cadence),
        maxCad: num(l.max_cadence),
        avgFracCad: num(l.avg_fractional_cadence) ?? 0,
        maxFracCad: num(l.max_fractional_cadence) ?? 0,
        ascentM: num(l.total_ascent),
        intensity: l.intensity ?? null,
        lapTrigger: l.lap_trigger ?? null,
      },
    ];
  });

  return {
    codigo,
    sequenciaTag: nomeTreino?.match(RE_SEQ)?.[0]?.toUpperCase() ?? null,
    planilhaTag: nomeTreino?.match(RE_PLAN)?.[0]?.toUpperCase() ?? null,
    nomeTreino,
    dataExecucao: isoDate(inicio),
    inicio,
    duracaoRealSec,
    distanciaTotalM: Math.round(num(sessao.total_distance) ?? 0),
    fcMediaSessao: num(sessao.avg_heart_rate),
    fcMaxSessao: num(sessao.max_heart_rate),
    laps,
    records,
  };
}

/* ------------------------------------------------------------------ */
/* Cálculo das etapas                                                  */
/* ------------------------------------------------------------------ */

const NOME_INTENSIDADE: Record<string, string> = {
  warmup: "Aquecimento",
  active: "Ativo",
  cooldown: "Esfriar",
  rest: "Intervalo",
  recovery: "Recuperação",
  interval: "Intervalo",
};

function mean(xs: number[]): number | null {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

/** Descarta micro-laps (< 12s): a lap de fim de sessão e os lapes manuais
 *  de 2-3s que o aluno gera mexendo no relógio. O nº de laps descartadas
 *  vira sinal de "treino picotado". */
function lapsUteis(laps: LapBruto[]): { uteis: LapBruto[]; descartadas: number } {
  const uteis = laps.filter((l) => l.durSec >= 12);
  return { uteis, descartadas: laps.length - uteis.length };
}

export function calcularEtapas(
  fit: FitParsed,
  faixas: FaixaZona[],
  estruturaPlano: string | null,
): EtapaExecutada[] {
  const { uteis: laps } = lapsUteis(fit.laps);
  const zonasPlano = zonasDaEstrutura(estruturaPlano);

  // numeração "km N" / "resto" dentro de um grupo de laps do mesmo passo
  const contagemPorStep = new Map<number, number>();
  for (const l of laps) {
    if (l.wktStepIndex != null)
      contagemPorStep.set(
        l.wktStepIndex,
        (contagemPorStep.get(l.wktStepIndex) ?? 0) + 1,
      );
  }
  const kmContador = new Map<number, number>();

  return laps.map((l) => {
    const recs = fit.records.filter(
      (r) => r.t >= l.inicio && r.t < l.fim,
    );

    const paceSec =
      l.distM > 0 ? Math.round(l.durSec / (l.distM / 1000)) : null;
    const kphMed = l.distM > 0 ? (l.distM / l.durSec) * 3.6 : 0;
    const kphMax = Math.max(
      0,
      ...recs.map((r) => (r.speedMs ?? 0) * 3.6),
    );

    const hrs = recs.map((r) => r.hr).filter((x): x is number => x != null);
    const alts = recs.map((r) => r.altM).filter((x): x is number => x != null);

    // ritmos ponto-a-ponto (só quando em movimento) para achar o trecho mais lento
    const pacesRec = recs
      .map((r) => (r.speedMs && r.speedMs > 0.4 ? 1000 / r.speedMs : null))
      .filter((x): x is number => x != null && x < 1200);
    // percentil 90: "trecho lento sustentado", ignora blips de GPS parado
    let pacePiorSec: number | null = null;
    if (pacesRec.length >= 5) {
      const ord = [...pacesRec].sort((a, b) => a - b);
      pacePiorSec = Math.round(ord[Math.floor(ord.length * 0.9)]);
    } else if (pacesRec.length) {
      pacePiorSec = Math.round(Math.max(...pacesRec));
    }

    const zonaPlanejada =
      l.wktStepIndex != null ? (zonasPlano[l.wktStepIndex] ?? null) : null;
    const faixaPlano = faixaPorCodigo(zonaPlanejada, faixas);
    let pctNaFaixa: number | null = null;
    let posNaZona: number | null = null;
    if (
      faixaPlano &&
      (faixaPlano.rapidoSec != null || faixaPlano.lentoSec != null)
    ) {
      // Z5 não tem limite rápido (qualquer pace mais veloz conta);
      // Z1 não tem limite lento.
      const rap = faixaPlano.rapidoSec ?? 0;
      const len = faixaPlano.lentoSec ?? Number.POSITIVE_INFINITY;
      if (pacesRec.length) {
        const dentro = pacesRec.filter((p) => p >= rap && p <= len).length;
        pctNaFaixa = Math.round((dentro / pacesRec.length) * 100);
      }
      // posição na zona só faz sentido com os dois limites reais
      if (
        paceSec != null &&
        faixaPlano.rapidoSec != null &&
        faixaPlano.lentoSec != null &&
        len !== rap
      ) {
        // 1 = colado no rápido · 0 = colado no lento · >1 rápido demais · <0 lento demais
        posNaZona = Math.round(((len - paceSec) / (len - rap)) * 100) / 100;
      }
    }

    // ganho de elevação: da lap se disponível, senão soma dos deltas positivos da série
    let elevGanho: number | null = l.ascentM;
    if (elevGanho == null && alts.length > 2) {
      let g = 0;
      for (let k = 1; k < alts.length; k++)
        if (alts[k] > alts[k - 1]) g += alts[k] - alts[k - 1];
      elevGanho = Math.round(g);
    }

    const cadMed =
      l.avgCad != null ? Math.round((l.avgCad + l.avgFracCad) * 2) : null;
    const cadMax =
      l.maxCad != null ? Math.round((l.maxCad + l.maxFracCad) * 2) : null;

    const zonaCalculada =
      paceSec != null ? classificarZona(paceSec, faixas) : null;

    // nome
    const base =
      (l.intensity && NOME_INTENSIDADE[l.intensity]) ??
      (l.intensity ? l.intensity : "Etapa");
    let nome = base;
    if (l.wktStepIndex != null && (contagemPorStep.get(l.wktStepIndex) ?? 0) > 1) {
      if (l.lapTrigger === "distance") {
        const n = (kmContador.get(l.wktStepIndex) ?? 0) + 1;
        kmContador.set(l.wktStepIndex, n);
        nome = `${base} — km ${n}`;
      } else {
        nome = `${base} — resto`;
      }
    }

    return {
      nome,
      wkt_step_index: l.wktStepIndex,
      inicio_sec: Math.round((l.inicio.getTime() - fit.inicio.getTime()) / 1000),
      fim_sec: Math.round((l.fim.getTime() - fit.inicio.getTime()) / 1000),
      dur_sec: Math.round(l.durSec),
      dist_m: Math.round(l.distM),
      pace_sec: paceSec,
      pace_pior_sec: pacePiorSec,
      kph_med: Number(kphMed.toFixed(1)),
      kph_max: Number(kphMax.toFixed(1)),
      fc_min: hrs.length ? Math.min(...hrs) : null,
      fc_med: l.avgHr ?? (hrs.length ? Math.round(mean(hrs)!) : null),
      fc_max: l.maxHr ?? (hrs.length ? Math.max(...hrs) : null),
      cadencia_med: cadMed,
      cadencia_max: cadMax,
      elevacao_min: alts.length ? Math.round(Math.min(...alts)) : null,
      elevacao_med: alts.length ? Math.round(mean(alts)!) : null,
      elevacao_max: alts.length ? Math.round(Math.max(...alts)) : null,
      elevacao_ganho_m: elevGanho,
      zona_calculada: zonaCalculada,
      zona_planejada: zonaPlanejada,
      pct_na_faixa: pctNaFaixa,
      pos_na_zona: posNaZona,
    };
  });
}
