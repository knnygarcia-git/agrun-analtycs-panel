/* Tipos do banco.
   Escrito à mão para os passos 1–2. Depois pode ser substituído pela geração automática:
   `npx supabase gen types typescript --project-id <id> > src/types/database.ts`

   Obs.: as formas de linha são `type` (não `interface`) de propósito — o
   @supabase/supabase-js exige que cada Row seja atribuível a Record<string, unknown>,
   o que só vale para type aliases (índice implícito), não para interfaces.
*/

export type StatusMatch =
  | "auto_confirmado"
  | "pendente_revisao"
  | "confirmado_manual";

export type FeedbackStatus = "pendente" | "rascunho" | "aprovado" | "enviado";

export type CodigoZona = "Z1" | "Z2" | "Z3" | "Z4" | "Z5";

/** Uma etapa de um treino executado (guardada em treino_executado.etapas).
    Unidades já convertidas (seção 4): pace em s/km, cadência em rpm (×2), nunca m/s. */
export type EtapaExecutada = {
  nome: string;
  wkt_step_index: number | null;
  /** offset em segundos desde o início do treino */
  inicio_sec: number;
  fim_sec: number;
  dur_sec: number;
  dist_m: number;
  pace_sec: number | null;
  /** pace do trecho mais lento dentro da etapa (s/km) — pega quedas que a média esconde */
  pace_pior_sec: number | null;
  kph_med: number;
  kph_max: number;
  fc_min: number | null;
  fc_med: number | null;
  fc_max: number | null;
  cadencia_med: number | null;
  cadencia_max: number | null;
  elevacao_min: number | null;
  elevacao_med: number | null;
  elevacao_max: number | null;
  /** zona calculada da tabela do aluno a partir do pace real */
  zona_calculada: string | null;
  /** zona esperada, extraída do texto da estrutura do treino planejado (best-effort) */
  zona_planejada: string | null;
  /** % do tempo da etapa com o pace dentro da faixa da zona planejada (0-100), ou null */
  pct_na_faixa: number | null;
  /** posição do pace médio dentro da faixa planejada:
   *  1 = colado no limite rápido · 0 = colado no limite lento · >1 = mais rápido que a faixa · <0 = mais lento.
   *  null se não há zona planejada ou é Z5 (aberta). */
  pos_na_zona: number | null;
  /** ganho de elevação na etapa, em metros (para explicar subida de FC / queda de ritmo) */
  elevacao_ganho_m: number | null;
};

type Table<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

/** Payloads da RPC importar_ciclo (datas como 'YYYY-MM-DD', '' => NULL). */
export type CicloImportPayload = {
  objetivo: string;
  sequencia: number;
  data_inicio: string;
  data_fim: string;
  ftp_pace_sec: number | "";
  ftp_data_teste: string;
};
export type ZonaImportPayload = {
  codigo: CodigoZona;
  pace_rapido_sec: number | "";
  pace_lento_sec: number | "";
  descricao: string;
};
export type TreinoImportPayload = {
  codigo: string;
  semana: number;
  periodo_inicio: string;
  periodo_fim: string;
  tipo: string;
  estrutura: string;
  duracao_planejada_sec: number | "";
  volume_planejado_m: number | "";
};

export type Aluno = {
  id: string;
  nome: string;
  objetivo_atual: string | null;
  observacoes: string | null;
  criado_em: string;
};

export type Ciclo = {
  id: string;
  aluno_id: string;
  objetivo: string;
  sequencia: number;
  data_inicio: string;
  data_fim: string;
  ftp_pace_sec: number | null;
  ftp_data_teste: string | null;
  criado_em: string;
};

export type Zona = {
  id: string;
  ciclo_id: string;
  codigo: CodigoZona;
  /** limite mais rápido da faixa (coluna "De" / B; menor nº de segundos). NULL em Z5. */
  pace_rapido_sec: number | null;
  /** limite mais lento da faixa (coluna "Até" / C; maior nº de segundos). */
  pace_lento_sec: number | null;
  descricao: string | null;
};

export type TreinoPlanejado = {
  id: string;
  ciclo_id: string;
  codigo: string;
  semana: number;
  periodo_inicio: string | null;
  periodo_fim: string | null;
  tipo: string | null;
  estrutura: string | null;
  duracao_planejada_sec: number | null;
  volume_planejado_m: number | null;
};

export type TreinoExecutado = {
  id: string;
  treino_planejado_id: string | null;
  aluno_id: string;
  data_execucao: string;
  duracao_real_sec: number | null;
  arquivo_fit_path: string | null;
  status_match: StatusMatch;
  etapas: EtapaExecutada[];
  /** marca manual do coach ("já avaliei este treino"); ver migração 0004 */
  avaliado_em: string | null;
  criado_em: string;
};

export type Feedback = {
  id: string;
  treino_executado_id: string;
  texto_rascunho: string | null;
  texto_final: string | null;
  status: FeedbackStatus;
  gerado_em: string | null;
  aprovado_em: string | null;
  enviado_em: string | null;
};

export type Database = {
  public: {
    Tables: {
      aluno: Table<
        Aluno,
        Omit<Aluno, "id" | "criado_em"> & { id?: string; criado_em?: string },
        Partial<Aluno>
      >;
      ciclo: Table<
        Ciclo,
        Omit<Ciclo, "id" | "criado_em"> & { id?: string; criado_em?: string },
        Partial<Ciclo>
      >;
      zona: Table<Zona, Omit<Zona, "id"> & { id?: string }, Partial<Zona>>;
      treino_planejado: Table<
        TreinoPlanejado,
        Omit<TreinoPlanejado, "id"> & { id?: string },
        Partial<TreinoPlanejado>
      >;
      treino_executado: Table<
        TreinoExecutado,
        Omit<TreinoExecutado, "id" | "criado_em" | "avaliado_em"> & {
          id?: string;
          criado_em?: string;
          avaliado_em?: string | null;
        },
        Partial<TreinoExecutado>
      >;
      feedback: Table<
        Feedback,
        Omit<Feedback, "id"> & { id?: string },
        Partial<Feedback>
      >;
    };
    Views: Record<string, never>;
    Functions: {
      importar_ciclo: {
        Args: {
          p_aluno_id: string;
          p_ciclo: CicloImportPayload;
          p_zonas: ZonaImportPayload[];
          p_treinos: TreinoImportPayload[];
        } & Record<string, unknown>;
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
