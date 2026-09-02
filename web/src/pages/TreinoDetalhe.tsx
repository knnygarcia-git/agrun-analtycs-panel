import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Voltar } from "@/components/Voltar";
import type {
  Ciclo,
  FeedbackStatus,
  TreinoExecutado,
  TreinoPlanejado,
  Zona,
} from "@/types/database";
import { fmtSec } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { faixasDeZonas } from "@/lib/fit/zones";
import { parseFitResultado } from "@/lib/fit/parse";
import { construirSerie, type PontoSerie } from "@/lib/fit/serie";
import { GraficoTreino } from "@/components/GraficoTreino";
import { GraficoPlanoRealizado } from "@/components/GraficoPlanoRealizado";
import { FeedbackSection } from "@/components/FeedbackSection";
import { NomeEtapa } from "@/components/NomeEtapa";

const COR_ZONA: Record<string, string> = {
  Z1: "var(--z1)",
  Z2: "var(--z2)",
  Z3: "var(--z3)",
  Z4: "var(--z4)",
  Z5: "var(--z5)",
};


interface ExecComPlano extends TreinoExecutado {
  treino_planejado: (TreinoPlanejado & { ciclo: Ciclo }) | null;
  feedback:
    | { status: FeedbackStatus }
    | { status: FeedbackStatus }[]
    | null;
}

function fbStatusDe(e: ExecComPlano | null): FeedbackStatus | null {
  const f = e?.feedback;
  if (!f) return null;
  return (Array.isArray(f) ? f[0]?.status : f.status) ?? null;
}

export function TreinoDetalhePage() {
  const t = useT();
  const { id: alunoId, execId } = useParams<{ id: string; execId: string }>();
  const navigate = useNavigate();
  const [exec, setExec] = useState<ExecComPlano | null>(null);
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [serie, setSerie] = useState<PontoSerie[] | null>(null);
  const [erroSerie, setErroSerie] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  async function removerExecucao() {
    if (!exec) return;
    if (!window.confirm(t("treino.confirmRemove"))) return;
    if (exec.arquivo_fit_path) {
      await supabase.storage.from("fit-files").remove([exec.arquivo_fit_path]);
    }
    const { error } = await supabase
      .from("treino_executado")
      .delete()
      .eq("id", exec.id);
    if (error) {
      setErro(error.message);
      return;
    }
    navigate(`/aluno/${alunoId}?ciclo=${exec.treino_planejado?.ciclo_id ?? ""}`);
  }

  async function alternarAvaliado() {
    if (!exec) return;
    const novo = exec.avaliado_em ? null : new Date().toISOString();
    const { error } = await supabase
      .from("treino_executado")
      .update({ avaliado_em: novo })
      .eq("id", exec.id);
    if (error) {
      setErro(error.message);
      return;
    }
    setExec({ ...exec, avaliado_em: novo });
  }

  useEffect(() => {
    if (!execId) return;
    setCarregando(true);
    supabase
      .from("treino_executado")
      .select(
        "*, treino_planejado:treino_planejado(*, ciclo:ciclo(*)), feedback(status)",
      )
      .eq("id", execId)
      .single()
      .then(async ({ data, error }) => {
        if (error || !data) {
          setCarregando(false);
          return;
        }
        const e = data as unknown as ExecComPlano;
        setExec(e);
        const cicloId = e.treino_planejado?.ciclo_id;
        if (cicloId) {
          const { data: z } = await supabase
            .from("zona")
            .select("*")
            .eq("ciclo_id", cicloId)
            .order("codigo");
          setZonas((z ?? []) as Zona[]);
        }
        setCarregando(false);

        // série do gráfico: reprocessa o .FIT do Storage (decisão: não guardar no banco)
        if (e.arquivo_fit_path) {
          try {
            const dl = await supabase.storage
              .from("fit-files")
              .download(e.arquivo_fit_path);
            if (dl.error) throw new Error(dl.error.message);
            const fit = await parseFitResultado(await dl.data.arrayBuffer());
            setSerie(construirSerie(fit));
          } catch (err) {
            setErroSerie((err as Error).message);
          }
        }
      });
  }, [execId]);

  if (carregando)
    return <div style={{ color: "var(--muted)" }}>{t("common.loading")}</div>;
  if (!exec)
    return <div className="form-msg-erro">{t("treino.notFound")}</div>;

  const plano = exec.treino_planejado;
  const etapas = exec.etapas ?? [];
  const planSec = plano?.duracao_planejada_sec ?? null;
  const diffPct =
    planSec && exec.duracao_real_sec
      ? (Math.abs(exec.duracao_real_sec - planSec) / planSec) * 100
      : null;
  const faixas = faixasDeZonas(zonas);

  const feedbackEnviado = fbStatusDe(exec) === "enviado";
  const avaliado = exec.avaliado_em != null || feedbackEnviado;

  return (
    <div className="pagina-larga">
      <Voltar to={`/aluno/${alunoId}?ciclo=${plano?.ciclo_id ?? ""}`}>
        {t("common.backToAthlete")}
      </Voltar>
      <div className="page-header">
        <div>
          <h1>
            {plano?.codigo ?? "?"} · {plano?.tipo ?? t("treino.workoutFallback")}
          </h1>
          <div className="meta">
            {exec.data_execucao}
            {plano?.ciclo && ` · ${plano.ciclo.objetivo} #${plano.ciclo.sequencia}`}
          </div>
        </div>
        <div className="header-acoes">
          {!feedbackEnviado && (
            <button
              className={`btn btn-ghost${exec.avaliado_em ? " is-on" : ""}`}
              onClick={alternarAvaliado}
            >
              {exec.avaliado_em
                ? `✓ ${t("treino.unmarkReviewed")}`
                : t("treino.markReviewed")}
            </button>
          )}
          <button className="btn btn-danger" onClick={removerExecucao}>
            {t("treino.removeExecution")}
          </button>
        </div>
      </div>
      {erro && <div className="form-msg-erro">{erro}</div>}

      <div className="conf-summary">
        <div className="item">
          <div className="label">{t("treino.realDuration")}</div>
          <div className="value num">
            {exec.duracao_real_sec ? fmtSec(exec.duracao_real_sec) : "—"}
          </div>
        </div>
        <div className="item">
          <div className="label">{t("treino.planned")}</div>
          <div className="value num">{planSec ? fmtSec(planSec) : "—"}</div>
        </div>
        <div className="item">
          <div className="label">{t("treino.difference")}</div>
          <div className="value num">
            {diffPct != null ? `${diffPct.toFixed(1)}%` : "—"}
          </div>
        </div>
        <div className="item">
          <div className="label">{t("treino.match")}</div>
          <div className="value">
            {exec.status_match === "auto_confirmado"
              ? t("treino.matchAuto")
              : exec.status_match === "confirmado_manual"
                ? t("treino.matchManual")
                : t("treino.matchReview")}
          </div>
        </div>
        <div className="item">
          <div className="label">{t("treino.reviewed")}</div>
          <div
            className="value"
            style={avaliado ? { color: "var(--z2)" } : undefined}
          >
            {feedbackEnviado
              ? t("treino.reviewedYesSent")
              : exec.avaliado_em
                ? t("treino.reviewedYesManual")
                : t("treino.reviewedNo")}
          </div>
        </div>
      </div>

      <div className="section-title">{t("treino.paceHrTitle")}</div>
      {erroSerie ? (
        <div className="conf-banner aviso">
          {t("treino.chartReprocessError", { msg: erroSerie })}
        </div>
      ) : !serie ? (
        <div className="placeholder-box">{t("treino.reprocessing")}</div>
      ) : (
        <>
          <GraficoTreino serie={serie} faixas={faixas} />
          <GraficoPlanoRealizado
            serie={serie}
            faixas={faixas}
            estrutura={plano?.estrutura ?? null}
          />
        </>
      )}

      <div className="section-title">{t("treino.stageComparisonTitle")}</div>
      <div className="conf-table-wrap">
        <table className="conf densa">
          <thead>
            <tr>
              <th>{t("etapas.stage")}</th>
              <th>{t("etapas.start")}</th>
              <th>{t("etapas.end")}</th>
              <th>{t("etapas.duration")}</th>
              <th>{t("etapas.km")}</th>
              <th>{t("etapas.pace")}</th>
              <th>{t("etapas.zone")}</th>
              <th>{t("etapas.plan")}</th>
              <th>{t("etapas.inRange")}</th>
              <th>{t("etapas.hrMinAvgMax")}</th>
              <th>{t("etapas.cadAvg")}</th>
              <th>{t("etapas.elevMinAvgMax")}</th>
            </tr>
          </thead>
          <tbody>
            {etapas.map((e, i) => {
              const diverge =
                e.zona_planejada &&
                e.zona_calculada &&
                e.zona_planejada !== e.zona_calculada;
              const foraDaFaixa = e.pct_na_faixa != null && e.pct_na_faixa < 60;
              return (
                <tr key={i} className={diverge || foraDaFaixa ? "sev-aviso" : ""}>
                  <td className="campo">
                    <NomeEtapa nome={e.nome} />
                  </td>
                  <td className="num">{fmtSec(e.inicio_sec)}</td>
                  <td className="num">{fmtSec(e.fim_sec)}</td>
                  <td className="num">{fmtSec(e.dur_sec)}</td>
                  <td className="num">
                    {e.dist_m != null ? (e.dist_m / 1000).toFixed(2) : "—"}
                  </td>
                  <td className="num">{e.pace_sec ? fmtSec(e.pace_sec) : "—"}</td>
                  <td>
                    {e.zona_calculada ? (
                      <span
                        className="mini-zone"
                        style={{
                          background: `${COR_ZONA[e.zona_calculada]}22`,
                          color: COR_ZONA[e.zona_calculada],
                        }}
                      >
                        {e.zona_calculada}
                      </span>
                    ) : (
                      "—"
                    )}
                    {diverge && (
                      <span className="alert-mismatch">≠ {e.zona_planejada}</span>
                    )}
                  </td>
                  <td>{e.zona_planejada ?? "—"}</td>
                  <td className="num">
                    {e.pct_na_faixa != null ? `${e.pct_na_faixa}%` : "—"}
                  </td>
                  <td className="num">
                    {e.fc_min ?? "—"} / {e.fc_med ?? "—"} / {e.fc_max ?? "—"}
                  </td>
                  <td className="num">{e.cadencia_med ?? "—"}</td>
                  <td className="num">
                    {e.elevacao_min ?? "—"} / {e.elevacao_med ?? "—"} /{" "}
                    {e.elevacao_max ?? "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="section-title section-gap">{t("treino.feedbackTitle")}</div>
      <FeedbackSection treinoExecutadoId={exec.id} />
    </div>
  );
}
