import type {
  CicloImportPayload,
  TreinoImportPayload,
  ZonaImportPayload,
  CodigoZona,
} from "@/types/database";
import type { PlanilhaParsed } from "./types";

const DESC_ZONA: Record<string, string> = {
  Z1: "Muito leve / recuperação",
  Z2: "Moderado / base aeróbica",
  Z3: "Difícil / tempo run",
  Z4: "Muito difícil / limiar",
  Z5: "Esforço máximo",
};

/** Converte o resultado da conferência nos payloads da RPC importar_ciclo.
    Só deve ser chamado quando parsed.temErro === false. */
export function toImportPayload(parsed: PlanilhaParsed): {
  ciclo: CicloImportPayload;
  zonas: ZonaImportPayload[];
  treinos: TreinoImportPayload[];
} {
  const c = parsed.ciclo;
  const ciclo: CicloImportPayload = {
    objetivo: c.objetivo.valor ?? "",
    sequencia: c.sequencia.valor ?? 0,
    data_inicio: c.dataInicio.valor ?? "",
    data_fim: c.dataFim.valor ?? "",
    ftp_pace_sec: c.ftpPaceSec.valor ?? "",
    ftp_data_teste: c.ftpDataTeste.valor ?? "",
  };

  const zonas: ZonaImportPayload[] = parsed.zonas.map((z) => {
    const codigo = (z.codigo.valor ?? "") as CodigoZona;
    return {
      codigo,
      pace_rapido_sec: z.paceRapidoSec.valor ?? "",
      pace_lento_sec: z.paceLentoSec.valor ?? "",
      descricao: DESC_ZONA[codigo] ?? "",
    };
  });

  const treinos: TreinoImportPayload[] = parsed.treinos.map((t) => ({
    codigo: t.codigo.valor ?? "",
    semana: t.semana.valor ?? 0,
    periodo_inicio: t.periodoInicio.valor ?? "",
    periodo_fim: t.periodoFim.valor ?? "",
    tipo: t.tipo.valor ?? "",
    estrutura: t.estrutura.valor ?? "",
    duracao_planejada_sec: t.duracaoPlanejadaSec.valor ?? "",
    volume_planejado_m: t.volumePlanejadoM.valor ?? "",
  }));

  return { ciclo, zonas, treinos };
}
