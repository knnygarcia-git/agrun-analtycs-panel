import type { Campo, PlanilhaParsed } from "@/lib/excel/types";
import { fmtSec } from "@/lib/format";
import { useT } from "@/lib/i18n";

function Linha({ rotulo, campo }: { rotulo: string; campo: Campo<unknown> }) {
  const t = useT();
  return (
    <tr className={`sev-${campo.severidade}`}>
      <td className="campo">{rotulo}</td>
      <td className="livre">
        {campo.bruto}
        {campo.nota && <div className="conf-note">{campo.nota}</div>}
      </td>
      <td className="celula">{campo.celula}</td>
      <td>
        {campo.severidade !== "ok" && (
          <span className={`sev-tag ${campo.severidade}`}>
            {campo.severidade === "erro"
              ? t("confCiclo.error")
              : t("confCiclo.warning")}
          </span>
        )}
      </td>
    </tr>
  );
}

export function ConferenciaCiclo({
  parsed,
  avisos = [],
}: {
  parsed: PlanilhaParsed;
  avisos?: string[];
}) {
  const t = useT();
  const c = parsed.ciclo;

  return (
    <div>
      <div className="conf-summary">
        <div className="item">
          <div className="label">{t("confCiclo.sheet")}</div>
          <div className="value">{parsed.aba}</div>
        </div>
        <div className="item">
          <div className="label">{t("confCiclo.goalSeq")}</div>
          <div className="value">
            {c.objetivo.valor ?? "—"} · #{c.sequencia.valor ?? "—"}
          </div>
        </div>
        <div className="item">
          <div className="label">{t("confCiclo.period")}</div>
          <div className="value num">
            {c.dataInicio.bruto} – {c.dataFim.bruto}
          </div>
        </div>
        <div className="item">
          <div className="label">{t("confCiclo.ftpPace")}</div>
          <div className="value num">
            {c.ftpPaceSec.valor ? `${fmtSec(c.ftpPaceSec.valor)}/km` : "—"}
          </div>
        </div>
      </div>

      {parsed.temErro ? (
        <div className="conf-banner erro">{t("confCiclo.hasErrors")}</div>
      ) : (
        <div className="conf-banner ok">{t("confCiclo.noErrors")}</div>
      )}
      {avisos.map((a, i) => (
        <div key={i} className="conf-banner aviso">
          {a}
        </div>
      ))}

      <div className="section-title">{t("confCiclo.cycleHeader")}</div>
      <div className="conf-table-wrap">
        <table className="conf">
          <thead>
            <tr>
              <th>{t("confCiclo.colField")}</th>
              <th>{t("confCiclo.colValueRead")}</th>
              <th>{t("confCiclo.colCell")}</th>
              <th>{t("confCiclo.colStatus")}</th>
            </tr>
          </thead>
          <tbody>
            <Linha rotulo={t("confCiclo.rowAthleteName")} campo={c.nomeAlunoPlanilha} />
            <Linha rotulo={t("confCiclo.rowGoal")} campo={c.objetivo} />
            <Linha rotulo={t("confCiclo.rowSequence")} campo={c.sequencia} />
            <Linha rotulo={t("confCiclo.rowStartDate")} campo={c.dataInicio} />
            <Linha rotulo={t("confCiclo.rowEndDate")} campo={c.dataFim} />
            <Linha rotulo={t("confCiclo.rowFtpPace")} campo={c.ftpPaceSec} />
            <Linha rotulo={t("confCiclo.rowTestDate")} campo={c.ftpDataTeste} />
          </tbody>
        </table>
      </div>

      <div className="section-title">{t("confCiclo.zonesTitle")}</div>
      <div className="conf-table-wrap">
        <table className="conf">
          <thead>
            <tr>
              <th>{t("confCiclo.colZone")}</th>
              <th>{t("confCiclo.colFastSlow")}</th>
              <th>{t("confCiclo.colCells")}</th>
              <th>{t("confCiclo.colStatus")}</th>
            </tr>
          </thead>
          <tbody>
            {parsed.zonas.map((z, i) => {
              const sev =
                z.codigo.severidade === "erro" ||
                z.paceRapidoSec.severidade === "erro" ||
                z.paceLentoSec.severidade === "erro"
                  ? "erro"
                  : z.paceRapidoSec.severidade === "aviso" ||
                      z.paceLentoSec.severidade === "aviso"
                    ? "aviso"
                    : "ok";
              const rap = z.paceRapidoSec.valor
                ? fmtSec(z.paceRapidoSec.valor)
                : t("confCiclo.max");
              const len = z.paceLentoSec.valor ? fmtSec(z.paceLentoSec.valor) : "—";
              return (
                <tr key={i} className={`sev-${sev}`}>
                  <td className="campo">{z.codigo.bruto}</td>
                  <td className="num">
                    {rap} → {len}
                    {z.paceLentoSec.nota && (
                      <div className="conf-note">{z.paceLentoSec.nota}</div>
                    )}
                    {z.codigo.nota && <div className="conf-note">{z.codigo.nota}</div>}
                  </td>
                  <td className="celula">
                    {z.codigo.celula} · {z.paceRapidoSec.celula} · {z.paceLentoSec.celula}
                  </td>
                  <td>
                    {sev !== "ok" && (
                      <span className={`sev-tag ${sev}`}>
                        {sev === "erro"
                          ? t("confCiclo.error")
                          : t("confCiclo.warning")}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="section-title">
        {t("confCiclo.workoutsTitle", { count: parsed.treinos.length })}
      </div>
      <div className="conf-table-wrap">
        <table className="conf">
          <thead>
            <tr>
              <th>{t("confCiclo.colWorkout")}</th>
              <th>{t("confCiclo.colWeek")}</th>
              <th>{t("confCiclo.colType")}</th>
              <th>{t("confCiclo.colDuration")}</th>
              <th>{t("confCiclo.colVolume")}</th>
              <th>{t("confCiclo.colStructure")}</th>
              <th>{t("confCiclo.colStatus")}</th>
            </tr>
          </thead>
          <tbody>
            {parsed.treinos.map((tr, i) => {
              const campos = [
                tr.codigo,
                tr.semana,
                tr.tipo,
                tr.estrutura,
                tr.duracaoPlanejadaSec,
                tr.volumePlanejadoM,
              ];
              const sev = campos.some((x) => x.severidade === "erro")
                ? "erro"
                : campos.some((x) => x.severidade === "aviso")
                  ? "aviso"
                  : "ok";
              const notas = campos.filter((x) => x.nota).map((x) => x.nota);
              return (
                <tr key={i} className={`sev-${sev}`}>
                  <td className="campo">{tr.codigo.bruto}</td>
                  <td className="num">{tr.semana.valor ?? "—"}</td>
                  <td>{tr.tipo.valor ?? "—"}</td>
                  <td className="num">
                    {tr.duracaoPlanejadaSec.valor ? fmtSec(tr.duracaoPlanejadaSec.valor) : "—"}
                  </td>
                  <td className="num">
                    {tr.volumePlanejadoM.valor
                      ? (tr.volumePlanejadoM.valor / 1000).toFixed(2)
                      : "—"}
                  </td>
                  <td className="livre">
                    {tr.estrutura.valor ?? "—"}
                    {notas.length > 0 && (
                      <div className="conf-note">{notas.join(" · ")}</div>
                    )}
                  </td>
                  <td>
                    {sev !== "ok" && (
                      <span className={`sev-tag ${sev}`}>
                        {sev === "erro"
                          ? t("confCiclo.error")
                          : t("confCiclo.warning")}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
