import { supabase } from "@/lib/supabase";
import type { Ciclo, TreinoPlanejado, Zona } from "@/types/database";
import type { FitParsed } from "./types";

export type StatusCasamento =
  | "auto_confirmado"
  | "pendente_revisao"
  | "sem_codigo"
  | "sem_candidato"
  | "multiplos";

export interface TreinoComCiclo extends TreinoPlanejado {
  ciclo: Ciclo;
}

export interface ResultadoCasamento {
  status: StatusCasamento;
  /** chave i18n do motivo (ex: "match.autoOk") + params para interpolar */
  motivoKey: string;
  motivoParams: Record<string, string | number>;
  /** melhor palpite (quando há) — pré-selecionado na conferência */
  escolhido: TreinoComCiclo | null;
  diffPct: number | null;
  /** todos os treinos do aluno, para escolha manual */
  todos: TreinoComCiclo[];
  zonas: Zona[];
}

const TOLERANCIA = 0.05; // 5% (seção 5)

export async function casarTreino(
  fit: FitParsed,
  alunoId: string,
): Promise<ResultadoCasamento> {
  // todos os treinos do aluno (para escolha manual e para o fallback)
  const { data: todosRaw, error } = await supabase
    .from("treino_planejado")
    .select("*, ciclo:ciclo!inner(*)")
    .eq("ciclo.aluno_id", alunoId)
    .order("codigo");
  if (error) throw new Error(error.message);
  const todos = (todosRaw ?? []) as unknown as TreinoComCiclo[];

  const diffDe = (t: TreinoComCiclo): number | null => {
    if (!t.duracao_planejada_sec) return null;
    return (
      Math.abs(fit.duracaoRealSec - t.duracao_planejada_sec) /
      t.duracao_planejada_sec
    );
  };

  const zonasDe = async (cicloId: string): Promise<Zona[]> => {
    const { data } = await supabase
      .from("zona")
      .select("*")
      .eq("ciclo_id", cicloId)
      .order("codigo");
    return (data ?? []) as Zona[];
  };

  const semZonas: Zona[] = [];
  const base = (extra: Partial<ResultadoCasamento>): ResultadoCasamento => ({
    status: "sem_candidato",
    motivoKey: "",
    motivoParams: {},
    escolhido: null,
    diffPct: null,
    todos,
    zonas: semZonas,
    ...extra,
  });

  if (!fit.codigo) {
    // relógios sem integração TrainingPeaks/Garmin não gravam o nome do
    // treino (workout) no .FIT — chuta pelo ciclo ativo na data + duração
    // mais parecida, mas continua exigindo confirmação manual do coach.
    const doDia = todos.filter(
      (t) =>
        t.ciclo.data_inicio <= fit.dataExecucao &&
        t.ciclo.data_fim >= fit.dataExecucao,
    );
    if (doDia.length === 0) {
      return base({
        status: "sem_codigo",
        motivoKey: "match.noCodeInFile",
      });
    }
    const comDuracao = doDia.filter((t) => t.duracao_planejada_sec != null);
    const candidatosDia = comDuracao.length ? comDuracao : doDia;
    const ordenadosDia = [...candidatosDia].sort(
      (a, b) => (diffDe(a) ?? 1) - (diffDe(b) ?? 1),
    );
    const palpite = ordenadosDia[0];
    return base({
      status: "sem_codigo",
      motivoKey: "match.noCodeGuessed",
      motivoParams: { codigo: palpite.codigo, data: fit.dataExecucao },
      escolhido: palpite,
      diffPct: diffDe(palpite),
      zonas: await zonasDe(palpite.ciclo_id),
    });
  }

  // candidatos: mesmo código, ciclo cujo período cobre a data de execução
  const candidatos = todos.filter(
    (t) =>
      t.codigo === fit.codigo &&
      t.ciclo.data_inicio <= fit.dataExecucao &&
      t.ciclo.data_fim >= fit.dataExecucao,
  );

  if (candidatos.length === 0) {
    const existeCodigo = todos.some((t) => t.codigo === fit.codigo);
    return base({
      status: "sem_candidato",
      motivoKey: existeCodigo ? "match.codeNoCycleCovers" : "match.noCodeInPlan",
      motivoParams: { codigo: fit.codigo, data: fit.dataExecucao },
    });
  }

  if (candidatos.length > 1) {
    // desempata por menor diferença de duração
    const ordenados = [...candidatos].sort(
      (a, b) => (diffDe(a) ?? 1) - (diffDe(b) ?? 1),
    );
    return base({
      status: "multiplos",
      motivoKey: "match.multipleCycles",
      motivoParams: {
        count: candidatos.length,
        data: fit.dataExecucao,
        codigo: fit.codigo,
      },
      escolhido: ordenados[0],
      diffPct: diffDe(ordenados[0]),
      zonas: await zonasDe(ordenados[0].ciclo_id),
    });
  }

  const t = candidatos[0];
  const diff = diffDe(t);
  const zonas = await zonasDe(t.ciclo_id);

  if (diff == null) {
    return base({
      status: "pendente_revisao",
      motivoKey: "match.noPlanDuration",
      motivoParams: { codigo: fit.codigo },
      escolhido: t,
      diffPct: null,
      zonas,
    });
  }

  if (diff <= TOLERANCIA) {
    return base({
      status: "auto_confirmado",
      motivoKey: "match.autoOk",
      motivoParams: {
        codigo: fit.codigo,
        tol: (TOLERANCIA * 100).toFixed(0),
        diff: (diff * 100).toFixed(1),
      },
      escolhido: t,
      diffPct: diff,
      zonas,
    });
  }

  return base({
    status: "pendente_revisao",
    motivoKey: "match.durationDiverges",
    motivoParams: { codigo: fit.codigo, diff: (diff * 100).toFixed(0) },
    escolhido: t,
    diffPct: diff,
    zonas,
  });
}

export function statusMatchParaBanco(
  s: StatusCasamento,
): "auto_confirmado" | "pendente_revisao" | "confirmado_manual" {
  if (s === "auto_confirmado") return "auto_confirmado";
  return "pendente_revisao";
}
