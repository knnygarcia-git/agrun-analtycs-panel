import type { EtapaExecutada } from "@/types/database";
import { fmtSec } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { NomeEtapa } from "@/components/NomeEtapa";

const COR_ZONA: Record<string, string> = {
  Z1: "var(--z1)",
  Z2: "var(--z2)",
  Z3: "var(--z3)",
  Z4: "var(--z4)",
  Z5: "var(--z5)",
};

export function ZonaTag({ z }: { z: string | null }) {
  if (!z) return <span style={{ color: "var(--muted-2)" }}>—</span>;
  return (
    <span
      className="mini-zone"
      style={{ background: `${COR_ZONA[z]}22`, color: COR_ZONA[z] }}
    >
      {z}
    </span>
  );
}

/** Tabela "Plano × realizado — por etapa". Compartilhada entre a conferência
 *  de 1 treino, a conferência em lote (linha expandida) e a página do treino. */
export function TabelaEtapas({
  etapas,
  wrapClassName = "conf-table-wrap full",
}: {
  etapas: EtapaExecutada[];
  wrapClassName?: string;
}) {
  const t = useT();
  return (
    <div className={wrapClassName}>
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
            <th>{t("etapas.hrMinAvgMax")}</th>
            <th>{t("etapas.cadAvgMax")}</th>
            <th>{t("etapas.elevMinAvgMax")}</th>
          </tr>
        </thead>
        <tbody>
          {etapas.map((e, i) => {
            const diverge =
              e.zona_planejada &&
              e.zona_calculada &&
              e.zona_planejada !== e.zona_calculada;
            return (
              <tr key={i} className={diverge ? "sev-aviso" : ""}>
                <td className="campo">
                  <NomeEtapa nome={e.nome} />
                </td>
                <td className="num">{fmtSec(e.inicio_sec)}</td>
                <td className="num">{fmtSec(e.fim_sec)}</td>
                <td className="num">{fmtSec(e.dur_sec)}</td>
                <td className="num">
                  {e.dist_m != null ? (e.dist_m / 1000).toFixed(2) : "—"}
                </td>
                <td className="num">
                  {e.pace_sec ? `${fmtSec(e.pace_sec)}/km` : "—"}
                </td>
                <td>
                  <ZonaTag z={e.zona_calculada} />
                  {diverge && (
                    <span className="alert-mismatch">≠ {e.zona_planejada}</span>
                  )}
                </td>
                <td>
                  <ZonaTag z={e.zona_planejada} />
                </td>
                <td className="num">
                  {e.fc_min ?? "—"} / {e.fc_med ?? "—"} / {e.fc_max ?? "—"}
                </td>
                <td className="num">
                  {e.cadencia_med ?? "—"} / {e.cadencia_max ?? "—"}
                </td>
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
  );
}
