import { useMemo, useState } from "react";
import type { Zona } from "@/types/database";
import { fmtSec } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { calcularEtapas } from "@/lib/fit/parse";
import { faixasDeZonas } from "@/lib/fit/zones";
import type { FitParsed } from "@/lib/fit/types";
import type { ResultadoCasamento } from "@/lib/fit/match";
import { TabelaEtapas } from "@/components/TabelaEtapas";

export type StatusImport = "pendente" | "salvando" | "ok" | "erro";

export interface ItemLote {
  nome: string;
  bytes: ArrayBuffer;
  fit: FitParsed;
  resultado: ResultadoCasamento;
  selecionadoId: string;
  zonas: Zona[];
  incluir: boolean;
  jaImportado: boolean;
  statusImport: StatusImport;
  erroMsg?: string;
}

type T = ReturnType<typeof useT>;

function situacao(it: ItemLote, t: T): { texto: string; classe: string } {
  if (it.statusImport === "salvando") return { texto: t("lote.saving"), classe: "" };
  if (it.statusImport === "ok") return { texto: t("lote.imported"), classe: "ok" };
  if (it.statusImport === "erro")
    return {
      texto: t("lote.failed", { msg: it.erroMsg ?? t("lote.failedGeneric") }),
      classe: "erro",
    };

  const sufixo =
    it.incluir && it.selecionadoId && it.jaImportado
      ? t("lote.replaceSuffix")
      : "";

  switch (it.resultado.status) {
    case "auto_confirmado":
      return { texto: `${t("lote.matchedAuto")}${sufixo}`, classe: "ok" };
    case "multiplos":
    case "pendente_revisao":
      return { texto: `${t("lote.reviewFirst")}${sufixo}`, classe: "aviso" };
    default:
      return { texto: t("lote.noPlanMatch"), classe: "aviso" };
  }
}

/** Linha expandida: recalcula as etapas do treino e mostra a tabela plano×realizado. */
function DetalheItem({ it }: { it: ItemLote }) {
  const t = useT();
  const treino = it.resultado.todos.find((x) => x.id === it.selecionadoId) ?? null;
  const etapas = useMemo(
    () =>
      calcularEtapas(it.fit, faixasDeZonas(it.zonas), treino?.estrutura ?? null),
    [it.fit, it.zonas, treino?.estrutura],
  );
  const planSec = treino?.duracao_planejada_sec ?? null;
  const diffPct =
    planSec != null
      ? (Math.abs(it.fit.duracaoRealSec - planSec) / planSec) * 100
      : null;
  const divergencias = etapas.filter(
    (e) =>
      e.zona_planejada &&
      e.zona_calculada &&
      e.zona_planejada !== e.zona_calculada,
  ).length;

  return (
    <div className="lote-detalhe-box">
      <div className="lote-detalhe-meta">
        <span>
          {t("lote.detailRealDuration")} <b>{fmtSec(it.fit.duracaoRealSec)}</b>
        </span>
        <span>
          {t("lote.detailPlanned")}{" "}
          <b>{planSec != null ? fmtSec(planSec) : "—"}</b>
        </span>
        <span>
          {t("lote.detailDifference")}{" "}
          <b>{diffPct != null ? `${diffPct.toFixed(1)}%` : "—"}</b>
        </span>
        <span>
          {t("lote.detailStagesOutOfZone")} <b>{divergencias}</b>
        </span>
      </div>
      {etapas.length === 0 ? (
        <div className="conf-note">{t("lote.noStages")}</div>
      ) : (
        <TabelaEtapas etapas={etapas} wrapClassName="conf-table-wrap" />
      )}
    </div>
  );
}

export function ConferenciaLote({
  itens,
  salvando,
  onSelecionar,
  onToggle,
  onImportar,
  onCancelar,
}: {
  itens: ItemLote[];
  salvando: boolean;
  onSelecionar: (i: number, treinoId: string) => void;
  onToggle: (i: number) => void;
  onImportar: () => void;
  onCancelar: () => void;
}) {
  const t = useT();
  const [aberto, setAberto] = useState<number | null>(null);

  const todos = itens[0]?.resultado.todos ?? [];
  const selecionaveis = itens.filter((it) => it.incluir && it.selecionadoId);
  const paraRevisar = itens.filter(
    (it) =>
      it.incluir &&
      it.selecionadoId &&
      it.resultado.status !== "auto_confirmado",
  ).length;
  const substituir = selecionaveis.filter((it) => it.jaImportado).length;
  const importados = itens.filter((it) => it.statusImport === "ok").length;
  const falhas = itens.filter((it) => it.statusImport === "erro").length;
  const terminou = importados + falhas > 0 && !salvando;

  return (
    <div>
      <div className="conf-banner ok">
        {t("lote.summary", {
          total: itens.length,
          pluralTotal: itens.length > 1 ? "s" : "",
          marcados: selecionaveis.length,
          pluralMarcados: selecionaveis.length > 1 ? "s" : "",
        })}
        {paraRevisar > 0 && t("lote.summaryReview", { count: paraRevisar })}
        {substituir === 1 && t("lote.summaryReplaceOne")}
        {substituir > 1 && t("lote.summaryReplaceMany", { count: substituir })}
      </div>

      {terminou && (
        <div className={`conf-banner ${falhas > 0 ? "aviso" : "ok"}`}>
          {falhas > 0
            ? importados + falhas === 1
              ? t("lote.resultWithFails_one", { ok: importados, fail: falhas })
              : t("lote.resultWithFails_other", { ok: importados, fail: falhas })
            : importados === 1
              ? t("lote.result_one", { count: importados })
              : t("lote.result_other", { count: importados })}
        </div>
      )}

      <div className="conf-table-wrap full">
        <table className="conf densa">
          <thead>
            <tr>
              <th style={{ width: 34 }}>{t("lote.colCheck")}</th>
              <th>{t("lote.colWorkout")}</th>
              <th>{t("lote.colDate")}</th>
              <th>{t("lote.colRealPlan")}</th>
              <th>{t("lote.colMatchWith")}</th>
              <th>{t("lote.colStatus")}</th>
              <th style={{ width: 90 }}></th>
            </tr>
          </thead>
          <tbody>
            {itens.map((it, i) => {
              const sel = todos.find((x) => x.id === it.selecionadoId) ?? null;
              const planSec = sel?.duracao_planejada_sec ?? null;
              const s = situacao(it, t);
              const estaAberto = aberto === i;
              return [
                <tr key={i} className={s.classe === "aviso" ? "sev-aviso" : ""}>
                  <td>
                    <input
                      type="checkbox"
                      checked={it.incluir && !!it.selecionadoId}
                      disabled={!it.selecionadoId || salvando}
                      onChange={() => onToggle(i)}
                    />
                  </td>
                  <td className="campo">{it.fit.codigo ?? "?"}</td>
                  <td className="num">{it.fit.dataExecucao}</td>
                  <td className="num">
                    {fmtSec(it.fit.duracaoRealSec)} /{" "}
                    {planSec != null ? fmtSec(planSec) : "—"}
                  </td>
                  <td>
                    <select
                      value={it.selecionadoId}
                      disabled={salvando}
                      style={{ maxWidth: 240 }}
                      onChange={(e) => onSelecionar(i, e.target.value)}
                    >
                      <option value="">{t("common.none")}</option>
                      {todos.map((tp) => (
                        <option key={tp.id} value={tp.id}>
                          {tp.codigo} · {tp.tipo ?? "—"} · {tp.ciclo.objetivo} #
                          {tp.ciclo.sequencia}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className={s.classe === "erro" ? "sev-erro" : ""}>
                    {s.texto}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="lote-expand"
                      onClick={() => setAberto(estaAberto ? null : i)}
                    >
                      {estaAberto ? t("lote.close") : t("lote.stages")}
                    </button>
                  </td>
                </tr>,
                estaAberto ? (
                  <tr key={`${i}-d`} className="lote-detalhe">
                    <td colSpan={7}>
                      <DetalheItem it={it} />
                    </td>
                  </tr>
                ) : null,
              ];
            })}
          </tbody>
        </table>
      </div>

      <div className="form-row">
        {terminou ? (
          <button className="btn btn-primary" onClick={onCancelar}>
            {t("lote.done")}
          </button>
        ) : (
          <>
            <button
              className="btn btn-primary"
              disabled={selecionaveis.length === 0 || salvando}
              onClick={onImportar}
            >
              {salvando
                ? t("lote.importing")
                : selecionaveis.length === 1
                  ? t("lote.importN_one", { count: selecionaveis.length })
                  : t("lote.importN_other", { count: selecionaveis.length })}
            </button>
            <button
              className="btn btn-ghost"
              onClick={onCancelar}
              disabled={salvando}
            >
              {t("common.cancel")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
