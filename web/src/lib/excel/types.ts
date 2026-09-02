/** Resultado do parsing da planilha, com proveniência e status por campo,
    para alimentar a tela de conferência (seção 3 da especificação). */

export type Severidade = "ok" | "aviso" | "erro";

export interface Campo<T> {
  /** valor já convertido (segundos, ISO date, texto…), ou null se não lido */
  valor: T | null;
  /** célula(s) de origem, ex: "J3" ou "J20:J22" */
  celula: string;
  /** como o valor aparece para o coach conferir */
  bruto: string;
  severidade: Severidade;
  nota?: string;
}

export interface CicloParsed {
  nomeAlunoPlanilha: Campo<string>;
  objetivo: Campo<string>;
  sequencia: Campo<number>;
  dataInicio: Campo<string>; // YYYY-MM-DD
  dataFim: Campo<string>;
  ftpPaceSec: Campo<number>;
  ftpDataTeste: Campo<string>;
}

export interface ZonaParsed {
  codigo: Campo<string>;
  paceRapidoSec: Campo<number>;
  paceLentoSec: Campo<number>;
}

export interface TreinoParsed {
  codigo: Campo<string>;
  semana: Campo<number>;
  periodoInicio: Campo<string>;
  periodoFim: Campo<string>;
  tipo: Campo<string>;
  estrutura: Campo<string>;
  duracaoPlanejadaSec: Campo<number>;
  volumePlanejadoM: Campo<number>;
}

export interface PlanilhaParsed {
  aba: string;
  ciclo: CicloParsed;
  zonas: ZonaParsed[];
  treinos: TreinoParsed[];
  /** true se qualquer Campo tem severidade "erro" ou a estrutura está incompleta */
  temErro: boolean;
}
