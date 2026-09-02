import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import type {
  Aluno,
  Ciclo,
  FeedbackStatus,
  TreinoExecutado,
  TreinoPlanejado,
  Zona,
} from "@/types/database";
import { fmtSec } from "@/lib/format";
import { useT } from "@/lib/i18n";

type ExecComFb = TreinoExecutado & {
  feedback:
    | { status: FeedbackStatus }
    | { status: FeedbackStatus }[]
    | null;
};

function fbStatus(e: ExecComFb): FeedbackStatus | null {
  const f = e.feedback;
  if (!f) return null;
  return (Array.isArray(f) ? f[0]?.status : f.status) ?? null;
}

/** avaliado = marcado à mão pelo coach OU feedback já enviado ao aluno */
function foiAvaliado(e: ExecComFb): boolean {
  return e.avaliado_em != null || fbStatus(e) === "enviado";
}

const COR_ZONA: Record<string, string> = {
  Z1: "var(--z1)",
  Z2: "var(--z2)",
  Z3: "var(--z3)",
  Z4: "var(--z4)",
  Z5: "var(--z5)",
};

export function AlunoDetalhePage() {
  const t = useT();
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const cicloQuery = params.get("ciclo");

  const [aluno, setAluno] = useState<Aluno | null>(null);
  const [ciclos, setCiclos] = useState<Ciclo[]>([]);
  const [cicloId, setCicloId] = useState<string | null>(null);
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [treinos, setTreinos] = useState<TreinoPlanejado[]>([]);
  const [execucoes, setExecucoes] = useState<ExecComFb[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!id) return;
    setCarregando(true);
    Promise.all([
      supabase.from("aluno").select("*").eq("id", id).single(),
      supabase
        .from("ciclo")
        .select("*")
        .eq("aluno_id", id)
        .order("data_inicio", { ascending: false }),
    ]).then(([a, c]) => {
      setAluno(a.data);
      const cs = c.data ?? [];
      setCiclos(cs);
      setCicloId(
        cicloQuery && cs.some((x) => x.id === cicloQuery)
          ? cicloQuery
          : (cs[0]?.id ?? null),
      );
      setCarregando(false);
    });
  }, [id, cicloQuery]);

  useEffect(() => {
    if (!cicloId || !id) {
      setZonas([]);
      setTreinos([]);
      setExecucoes([]);
      return;
    }
    Promise.all([
      supabase.from("zona").select("*").eq("ciclo_id", cicloId).order("codigo"),
      supabase
        .from("treino_planejado")
        .select("*")
        .eq("ciclo_id", cicloId)
        .order("codigo"),
      supabase
        .from("treino_executado")
        .select("*, feedback(status)")
        .eq("aluno_id", id),
    ]).then(([z, t, e]) => {
      setZonas((z.data ?? []) as Zona[]);
      setTreinos((t.data ?? []) as TreinoPlanejado[]);
      setExecucoes((e.data ?? []) as unknown as ExecComFb[]);
    });
  }, [cicloId, id]);

  if (carregando)
    return <div style={{ color: "var(--muted)" }}>{t("common.loading")}</div>;
  if (!aluno)
    return <div className="form-msg-erro">{t("aluno.notFound")}</div>;

  const ciclo = ciclos.find((c) => c.id === cicloId) ?? null;
  const execPorTreino = new Map(
    execucoes.map((e) => [e.treino_planejado_id, e] as const),
  );

  return (
    <>
      <div className="page-header">
        <div>
          <h1>{aluno.nome}</h1>
          <div className="meta">
            {aluno.objetivo_atual ?? t("aluno.noGoal")}
          </div>
        </div>
        <div className="header-acoes">
          <Link className="btn btn-ghost" to={`/aluno/${aluno.id}/editar`}>
            {t("aluno.editAthlete")}
          </Link>
          <Link className="btn btn-ghost" to={`/importar?aluno=${aluno.id}`}>
            {t("aluno.importPlan")}
          </Link>
          <Link className="btn btn-ghost" to={`/importar-fit?aluno=${aluno.id}`}>
            {t("aluno.importFit")}
          </Link>
        </div>
      </div>

      {ciclos.length === 0 ? (
        <div className="placeholder-box">
          {t("aluno.noCycle")}{" "}
          <Link to={`/importar?aluno=${aluno.id}`}>{t("aluno.importPlan")}</Link>.
        </div>
      ) : (
        <>
          <div className="ciclo-bar">
            <div className="field" style={{ margin: 0, flex: 1, minWidth: 240 }}>
              <label htmlFor="ciclo">{t("aluno.cycle")}</label>
              <select
                id="ciclo"
                value={cicloId ?? ""}
                onChange={(e) => setCicloId(e.target.value)}
              >
                {ciclos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.objetivo} #{c.sequencia} · {c.data_inicio} a {c.data_fim}
                  </option>
                ))}
              </select>
            </div>
            {cicloId && (
              <Link
                className="btn btn-ghost"
                to={`/aluno/${aluno.id}/ciclo/${cicloId}/editar`}
              >
                {t("aluno.editCycleZones")}
              </Link>
            )}
          </div>

          {ciclo && (
            <div className="conf-summary" style={{ marginTop: 14 }}>
              <div className="item">
                <div className="label">{t("aluno.ftpPace")}</div>
                <div className="value num">
                  {ciclo.ftp_pace_sec ? `${fmtSec(ciclo.ftp_pace_sec)}/km` : "—"}
                </div>
              </div>
              <div className="item">
                <div className="label">{t("aluno.testDate")}</div>
                <div className="value num">{ciclo.ftp_data_teste ?? "—"}</div>
              </div>
            </div>
          )}

          <div className="section-title" style={{ marginTop: 22 }}>
            {t("aluno.zonesTitle")}
          </div>
          <div className="conf-table-wrap">
            <table className="conf">
              <thead>
                <tr>
                  <th>{t("aluno.colZone")}</th>
                  <th>{t("aluno.colFast")}</th>
                  <th>{t("aluno.colSlow")}</th>
                  <th>{t("aluno.colDescription")}</th>
                </tr>
              </thead>
              <tbody>
                {zonas.map((z) => (
                  <tr key={z.id}>
                    <td>
                      <span
                        style={{
                          display: "inline-block",
                          width: 9,
                          height: 9,
                          borderRadius: "50%",
                          background: COR_ZONA[z.codigo],
                          marginRight: 7,
                        }}
                      />
                      {z.codigo}
                    </td>
                    <td className="num">
                      {z.pace_rapido_sec
                        ? fmtSec(z.pace_rapido_sec)
                        : t("aluno.max")}
                    </td>
                    <td className="num">
                      {z.pace_lento_sec ? fmtSec(z.pace_lento_sec) : "—"}
                    </td>
                    <td className="livre" style={{ color: "var(--muted)" }}>
                      {z.descricao ?? ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="section-title" style={{ marginTop: 22 }}>
            {t("aluno.cycleWorkoutsTitle", { count: treinos.length })}
          </div>
          <div className="conf-table-wrap">
            <table className="conf">
              <thead>
                <tr>
                  <th>{t("aluno.colWorkout")}</th>
                  <th>{t("aluno.colWeek")}</th>
                  <th>{t("aluno.colType")}</th>
                  <th>{t("aluno.colDuration")}</th>
                  <th>{t("aluno.colVolume")}</th>
                  <th>{t("aluno.colStructure")}</th>
                  <th>{t("aluno.colExecution")}</th>
                </tr>
              </thead>
              <tbody>
                {treinos.map((tp) => {
                  const exec = execPorTreino.get(tp.id);
                  const dot = !exec
                    ? "empty"
                    : exec.status_match === "pendente_revisao"
                      ? "review"
                      : "done";
                  const avaliado = exec ? foiAvaliado(exec) : false;
                  return (
                    <tr key={tp.id} className={avaliado ? "tr-avaliado" : ""}>
                      <td className="campo">
                        <span className={`wk-dot ${dot}`} />
                        {tp.codigo}
                      </td>
                      <td className="num">{tp.semana}</td>
                      <td>{tp.tipo ?? "—"}</td>
                      <td className="num">
                        {tp.duracao_planejada_sec
                          ? fmtSec(tp.duracao_planejada_sec)
                          : "—"}
                      </td>
                      <td className="num">
                        {tp.volume_planejado_m
                          ? (tp.volume_planejado_m / 1000).toFixed(2)
                          : "—"}
                      </td>
                      <td className="livre">{tp.estrutura ?? "—"}</td>
                      <td>
                        {exec ? (
                          <Link to={`/aluno/${aluno.id}/treino/${exec.id}`}>
                            {avaliado && (
                              <span
                                className="wk-check"
                                title={t("aluno.reviewed")}
                              >
                                ✓{" "}
                              </span>
                            )}
                            {exec.data_execucao} ·{" "}
                            {exec.duracao_real_sec
                              ? fmtSec(exec.duracao_real_sec)
                              : "—"}{" "}
                            →
                          </Link>
                        ) : (
                          <Link
                            to={`/importar-fit?aluno=${aluno.id}`}
                            style={{ color: "var(--muted-2)" }}
                          >
                            {t("aluno.importFitShort")}
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
