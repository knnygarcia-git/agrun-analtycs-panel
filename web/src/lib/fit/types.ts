import type { EtapaExecutada } from "@/types/database";

/** Lap cru já normalizado do .FIT de resultado. */
export interface LapBruto {
  messageIndex: number;
  wktStepIndex: number | null;
  inicio: Date;
  /** fim = inicio + total_timer_time (NUNCA lap.timestamp — vem errado, seção 4) */
  fim: Date;
  durSec: number;
  distM: number;
  avgHr: number | null;
  maxHr: number | null;
  avgCad: number | null;
  maxCad: number | null;
  avgFracCad: number;
  maxFracCad: number;
  /** ganho de elevação na lap (metros subidos) */
  ascentM: number | null;
  intensity: string | null;
  lapTrigger: string | null;
}

export interface RecordBruto {
  t: Date;
  hr: number | null;
  speedMs: number | null;
  altM: number | null;
  cad: number | null;
  fracCad: number;
  /** distância acumulada em metros */
  distM: number;
}

export interface FitParsed {
  /** código T01..T16 extraído do nome do treino */
  codigo: string | null;
  /** "S02" / "P02" se presentes no nome (desambiguação) */
  sequenciaTag: string | null;
  planilhaTag: string | null;
  nomeTreino: string | null;
  dataExecucao: string; // YYYY-MM-DD
  inicio: Date;
  duracaoRealSec: number;
  distanciaTotalM: number;
  fcMediaSessao: number | null;
  fcMaxSessao: number | null;
  /** session.sport cru do .FIT (ex: "running", "cycling", "training") */
  esporte: string | null;
  laps: LapBruto[];
  records: RecordBruto[];
}

/** Etapas já calculadas, prontas para gravar / mostrar na conferência. */
export type EtapaCalculada = EtapaExecutada;
