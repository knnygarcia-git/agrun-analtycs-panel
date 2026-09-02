import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import type { Aluno } from "@/types/database";
import {
  carregarWorkbook,
  listarAbasCiclo,
  parseAba,
} from "@/lib/excel/parse";
import type { PlanilhaParsed } from "@/lib/excel/types";
import { toImportPayload } from "@/lib/excel/toPayload";
import { ConferenciaCiclo } from "@/components/ConferenciaCiclo";
import { Voltar } from "@/components/Voltar";
import { useT } from "@/lib/i18n";
import type { WorkBook } from "xlsx";

type Fase = "selecao" | "aba" | "conferencia" | "salvando" | "ok";

function seParece(a: string, b: string): boolean {
  const n = (s: string) => s.toLowerCase().normalize("NFD").replace(/[^a-z ]/g, "").trim();
  const na = n(a);
  const nb = n(b);
  return na === nb || na.includes(nb) || nb.includes(na) || na.split(" ")[0] === nb.split(" ")[0];
}

export function ImportarPlanilhaPage() {
  const t = useT();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const alunoPre = params.get("aluno");

  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [alunosCarregados, setAlunosCarregados] = useState(false);
  const [alunoId, setAlunoId] = useState(alunoPre ?? "");
  const [fase, setFase] = useState<Fase>("selecao");
  const [erro, setErro] = useState<string | null>(null);

  const [wb, setWb] = useState<WorkBook | null>(null);
  const [abas, setAbas] = useState<string[]>([]);
  const [nomeArquivo, setNomeArquivo] = useState("");
  const [parsed, setParsed] = useState<PlanilhaParsed | null>(null);
  const [avisos, setAvisos] = useState<string[]>([]);

  useEffect(() => {
    supabase
      .from("aluno")
      .select("*")
      .order("nome")
      .then(({ data }) => {
        setAlunos(data ?? []);
        setAlunosCarregados(true);
      });
  }, []);

  const aluno = useMemo(
    () => alunos.find((a) => a.id === alunoId) ?? null,
    [alunos, alunoId],
  );

  async function onArquivo(file: File) {
    setErro(null);
    try {
      const buf = await file.arrayBuffer();
      const workbook = carregarWorkbook(buf);
      const cand = listarAbasCiclo(workbook);
      if (cand.length === 0) {
        setErro(t("importPlan.noSheetFound"));
        return;
      }
      setWb(workbook);
      setAbas(cand);
      setNomeArquivo(file.name);
      setFase("aba");
    } catch (e) {
      setErro(t("importPlan.readError", { msg: (e as Error).message }));
    }
  }

  async function escolherAba(aba: string) {
    if (!wb || !aluno) return;
    setErro(null);
    const p = parseAba(wb, aba);
    setParsed(p);

    const novosAvisos: string[] = [];
    if (
      p.ciclo.nomeAlunoPlanilha.valor &&
      !seParece(p.ciclo.nomeAlunoPlanilha.valor, aluno.nome)
    ) {
      novosAvisos.push(
        t("importPlan.nameMismatch", {
          planilha: p.ciclo.nomeAlunoPlanilha.valor,
          aluno: aluno.nome,
        }),
      );
    }

    if (p.ciclo.dataInicio.valor && p.ciclo.dataFim.valor) {
      const { data: ciclos } = await supabase
        .from("ciclo")
        .select("objetivo, sequencia, data_inicio, data_fim")
        .eq("aluno_id", aluno.id);
      const sobrepoe = (ciclos ?? []).filter(
        (cy) =>
          cy.data_inicio <= p.ciclo.dataFim.valor! &&
          cy.data_fim >= p.ciclo.dataInicio.valor!,
      );
      for (const cy of sobrepoe) {
        novosAvisos.push(
          t("importPlan.periodOverlap", {
            objetivo: cy.objetivo,
            seq: cy.sequencia,
            inicio: cy.data_inicio,
            fim: cy.data_fim,
          }),
        );
      }
    }

    setAvisos(novosAvisos);
    setFase("conferencia");
  }

  async function confirmar() {
    if (!parsed || !aluno || parsed.temErro) return;
    setFase("salvando");
    setErro(null);
    const payload = toImportPayload(parsed);
    const { data, error } = await supabase.rpc("importar_ciclo", {
      p_aluno_id: aluno.id,
      p_ciclo: payload.ciclo,
      p_zonas: payload.zonas,
      p_treinos: payload.treinos,
    });
    if (error) {
      setErro(t("importPlan.saveError", { msg: error.message }));
      setFase("conferencia");
      return;
    }
    setFase("ok");
    setTimeout(() => navigate(`/aluno/${aluno.id}?ciclo=${data}`), 900);
  }

  function reiniciar() {
    setWb(null);
    setAbas([]);
    setParsed(null);
    setAvisos([]);
    setNomeArquivo("");
    setFase("selecao");
  }

  return (
    <>
      <Voltar to={alunoPre ? `/aluno/${alunoPre}` : "/"}>
        {alunoPre ? t("common.backToAthlete") : t("common.backToPanel")}
      </Voltar>
      <div className="page-header">
        <div>
          <h1>{t("importPlan.title")}</h1>
          <div className="meta">{t("importPlan.subtitle")}</div>
        </div>
      </div>

      <div className="wizard-steps">
        <span className={`step ${fase === "selecao" ? "active" : "done"}`}>
          {t("importPlan.step1")}
        </span>
        <span>›</span>
        <span
          className={`step ${fase === "aba" ? "active" : fase === "selecao" ? "" : "done"}`}
        >
          {t("importPlan.step2")}
        </span>
        <span>›</span>
        <span
          className={`step ${fase === "conferencia" || fase === "salvando" ? "active" : fase === "ok" ? "done" : ""}`}
        >
          {t("importPlan.step3")}
        </span>
      </div>

      {erro && <div className="form-msg-erro">{erro}</div>}

      {fase === "selecao" && (
        <div className="form-narrow">
          {!alunosCarregados ? (
            <div style={{ color: "var(--muted)" }}>{t("common.loading")}</div>
          ) : alunos.length === 0 ? (
            <div className="conf-banner aviso">
              {t("importPlan.noAthletes")}{" "}
              <Link to="/alunos/novo">{t("importPlan.registerFirst")}</Link>{" "}
              {t("importPlan.registerFirstTail")}
            </div>
          ) : (
            <>
              <div className="field">
                <label htmlFor="aluno">{t("importPlan.athlete")}</label>
                <select
                  id="aluno"
                  value={alunoId}
                  onChange={(e) => setAlunoId(e.target.value)}
                >
                  <option value="">{t("common.none")}</option>
                  {alunos.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label>{t("importPlan.file")}</label>
                <div className="dropzone">
                  <input
                    type="file"
                    accept=".xlsx"
                    disabled={!alunoId}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onArquivo(f);
                    }}
                  />
                  {!alunoId && (
                    <div style={{ marginTop: 8 }}>
                      {t("importPlan.chooseAthleteFirst")}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {fase === "aba" && (
        <div className="form-narrow">
          <div className="meta" style={{ marginBottom: 10 }}>
            {t("importPlan.fileAthleteLine", {
              arquivo: nomeArquivo,
              nome: aluno?.nome ?? "",
            })}
          </div>
          <div className="section-title">
            {t("importPlan.whichCycle", {
              count: abas.length,
              plural: abas.length > 1 ? "s" : "",
            })}
          </div>
          <div className="sheet-pick">
            {abas.map((a) => (
              <button key={a} onClick={() => escolherAba(a)}>
                {a}
              </button>
            ))}
          </div>
          <button className="btn btn-ghost" onClick={reiniciar}>
            {t("importPlan.changeFile")}
          </button>
        </div>
      )}

      {(fase === "conferencia" || fase === "salvando") && parsed && (
        <>
          <ConferenciaCiclo parsed={parsed} avisos={avisos} />
          <div className="form-row">
            <button
              className="btn btn-primary"
              disabled={parsed.temErro || fase === "salvando"}
              onClick={confirmar}
            >
              {fase === "salvando"
                ? t("common.saving")
                : t("importPlan.confirmImport")}
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => setFase("aba")}
              disabled={fase === "salvando"}
            >
              {t("common.back")}
            </button>
            <button
              className="btn btn-ghost"
              onClick={reiniciar}
              disabled={fase === "salvando"}
            >
              {t("common.cancel")}
            </button>
          </div>
        </>
      )}

      {fase === "ok" && (
        <div className="conf-banner ok">{t("importPlan.cycleImported")}</div>
      )}
    </>
  );
}
