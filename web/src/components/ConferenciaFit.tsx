import type { EtapaExecutada } from "@/types/database";
import { fmtSec } from "@/lib/format";
import { useT, type TKey } from "@/lib/i18n";
import type { FitParsed } from "@/lib/fit/types";
import type { ResultadoCasamento, TreinoComCiclo } from "@/lib/fit/match";
import { TabelaEtapas } from "@/components/TabelaEtapas";

export function ConferenciaFit({
  fit,
  resultado,
  selecionado,
  etapas,
  onSelecionar,
}: {
  fit: FitParsed;
  resultado: ResultadoCasamento;
  selecionado: TreinoComCiclo | null;
  etapas: EtapaExecutada[];
  onSelecionar: (id: string) => void;
}) {
  const t = useT();
  const planSec = selecionado?.duracao_planejada_sec ?? null;
  const diffPct =
    planSec != null
      ? (Math.abs(fit.duracaoRealSec - planSec) / planSec) * 100
      : null;

  const bannerClasse =
    resultado.status === "auto_confirmado" ? "ok" : "aviso";

  const divergencias = etapas.filter(
    (e) => e.zona_planejada && e.zona_calculada && e.zona_planejada !== e.zona_calculada,
  ).length;

  return (
    <div>
      <div className="conf-summary">
        <div className="item">
          <div className="label">{t("confFit.fileWorkout")}</div>
          <div className="value">{fit.codigo ?? "?"}</div>
        </div>
        <div className="item">
          <div className="label">{t("confFit.executionDate")}</div>
          <div className="value num">{fit.dataExecucao}</div>
        </div>
        <div className="item">
          <div className="label">{t("confFit.realDuration")}</div>
          <div className="value num">{fmtSec(fit.duracaoRealSec)}</div>
        </div>
        <div className="item">
          <div className="label">{t("confFit.planned")}</div>
          <div className="value num">
            {planSec != null ? fmtSec(planSec) : "—"}
          </div>
        </div>
        <div className="item">
          <div className="label">{t("confFit.difference")}</div>
          <div className="value num">
            {diffPct != null ? `${diffPct.toFixed(1)}%` : "—"}
          </div>
        </div>
      </div>

      <div className={`conf-banner ${bannerClasse}`}>
        {resultado.motivoKey
          ? t(resultado.motivoKey as TKey, resultado.motivoParams)
          : ""}
      </div>

      <div className="field form-narrow">
        <label htmlFor="treino-sel">{t("confFit.matchWith")}</label>
        <select
          id="treino-sel"
          value={selecionado?.id ?? ""}
          onChange={(e) => onSelecionar(e.target.value)}
        >
          <option value="">{t("common.none")}</option>
          {resultado.todos.map((tp) => (
            <option key={tp.id} value={tp.id}>
              {tp.codigo} · {tp.tipo ?? "—"} · {tp.ciclo.objetivo} #
              {tp.ciclo.sequencia} ({tp.ciclo.data_inicio} a {tp.ciclo.data_fim})
            </option>
          ))}
        </select>
      </div>

      <div className="section-title" style={{ marginTop: 20 }}>
        {t("confFit.stageComparisonTitle")}
      </div>
      {divergencias > 0 ? (
        <div className="conf-banner aviso">
          {divergencias === 1
            ? t("confFit.stagesOutOfZone_one", { count: divergencias })
            : t("confFit.stagesOutOfZone_other", { count: divergencias })}
        </div>
      ) : (
        <div className="conf-banner ok">{t("confFit.allInZone")}</div>
      )}

      <TabelaEtapas etapas={etapas} />
    </div>
  );
}
