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
  /** ids de treino_planejado já palpitados por outros arquivos deste MESMO
   *  lote — evita sugerir o mesmo treino duas vezes quando dois arquivos
   *  têm duração parecida (só entra na hora de CHUTAR, não em código exato). */
  jaPalpitados: Set<string> = new Set(),
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
    // atividade claramente não-corrida (cross-training, força, bike...) —
    // não arrisca chutar um treino de corrida da planilha pra ela.
    if (fit.esporte != null && fit.esporte !== "running") {
      return base({
        status: "sem_codigo",
        motivoKey: "match.notRunning",
        motivoParams: { esporte: fit.esporte },
      });
    }

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
    // prioriza treinos cuja SEMANA (período da planilha) cobre a data —
    // sem isso, um treino de outra semana com duração parecida por
    // coincidência pode ganhar de um da semana certa.
    const daSemana = candidatosDia.filter(
      (t) =>
        t.periodo_inicio != null &&
        t.periodo_fim != null &&
        t.periodo_inicio <= fit.dataExecucao &&
        t.periodo_fim >= fit.dataExecucao,
    );
    const poolBase = daSemana.length ? daSemana : candidatosDia;
    // evita repetir um treino já palpitado por outro arquivo deste lote
    // (2 treinos com duração bem parecida não podem "chutar" o mesmo T0X)
    const semRepetido = poolBase.filter((t) => !jaPalpitados.has(t.id));
    const pool = semRepetido.length ? semRepetido : poolBase;
    const ordenadosDia = [...pool].sort(
      (a, b) => (diffDe(a) ?? 1) - (diffDe(b) ?? 1),
    );
    const palpite = ordenadosDia[0];
    const diffPalpite = diffDe(palpite);
    // mesmo o melhor candidato bate muito longe da duração real (>50%) —
    // mais provável ser um trote avulso / atividade fora do plano do que
    // um treino real; não força um palpite ruim.
    if (diffPalpite != null && diffPalpite > 0.5) {
      return base({
        status: "sem_codigo",
        motivoKey: "match.noCodeNoGoodGuess",
      });
    }
    return base({
      status: "sem_codigo",
      motivoKey: "match.noCodeGuessed",
      motivoParams: { codigo: palpite.codigo, data: fit.dataExecucao },
      escolhido: palpite,
      diffPct: diffPalpite,
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
