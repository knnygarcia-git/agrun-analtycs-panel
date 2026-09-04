import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import type { Aluno, EtapaExecutada, Zona } from "@/types/database";
import { parseFitResultado, calcularEtapas } from "@/lib/fit/parse";
import { extrairFits } from "@/lib/fit/arquivo";
import { faixasDeZonas } from "@/lib/fit/zones";
import {
  casarTreino,
  statusMatchParaBanco,
  type ResultadoCasamento,
  type TreinoComCiclo,
} from "@/lib/fit/match";
import type { FitParsed } from "@/lib/fit/types";
import { ConferenciaFit } from "@/components/ConferenciaFit";
import { ConferenciaLote, type ItemLote } from "@/components/ConferenciaLote";
import { Voltar } from "@/components/Voltar";
import { useT } from "@/lib/i18n";

type Fase = "selecao" | "conferencia" | "lote" | "salvando" | "ok";

export function ImportarFitPage() {
  const t = useT();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const alunoPre = params.get("aluno");

  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [alunosCarregados, setAlunosCarregados] = useState(false);
  const [alunoId, setAlunoId] = useState(alunoPre ?? "");
  const [fase, setFase] = useState<Fase>("selecao");
  const [erro, setErro] = useState<string | null>(null);
  const [lendo, setLendo] = useState(false);
  const [progresso, setProgresso] = useState<{ i: number; total: number } | null>(
    null,
  );

  // bytes do .FIT já descompactado (se veio .gz) + nome limpo, para subir ao Storage
  const [arquivoFit, setArquivoFit] = useState<{ blob: Blob; nome: string } | null>(
    null,
  );
  const [fit, setFit] = useState<FitParsed | null>(null);
  const [resultado, setResultado] = useState<ResultadoCasamento | null>(null);
  const [selecionadoId, setSelecionadoId] = useState<string>("");
  const [zonasSel, setZonasSel] = useState<Zona[]>([]);

  // importação em lote (.zip com vários .fit.gz)
  const [lote, setLote] = useState<ItemLote[]>([]);
  const [salvandoLote, setSalvandoLote] = useState(false);

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
  const selecionado: TreinoComCiclo | null = useMemo(
    () => resultado?.todos.find((t) => t.id === selecionadoId) ?? null,
    [resultado, selecionadoId],
  );

  const etapas: EtapaExecutada[] = useMemo(() => {
    if (!fit || !selecionado) return [];
    return calcularEtapas(fit, faixasDeZonas(zonasSel), selecionado.estrutura);
  }, [fit, selecionado, zonasSel]);

  async function onArquivo(file: File) {
    if (!aluno) return;
    setErro(null);
    setLendo(true);
    setProgresso(null);
    try {
      const extraidos = await extrairFits(file);

      if (extraidos.length === 1) {
        const { bytes, nome } = extraidos[0];
        setArquivoFit({ blob: new Blob([bytes]), nome });
        const parsed = await parseFitResultado(bytes);
        const r = await casarTreino(parsed, aluno.id);
        setFit(parsed);
        setResultado(r);
        setSelecionadoId(r.escolhido?.id ?? "");
        setZonasSel(r.zonas);
        setFase("conferencia");
        return;
      }

      // vários treinos → conferência em lote
      const itens: ItemLote[] = [];
      // ids já palpitados por outro arquivo deste lote (sem código no
      // arquivo) — passado adiante pra não sugerir o mesmo treino 2x
      const palpitesUsados = new Set<string>();
      for (let k = 0; k < extraidos.length; k++) {
        const ex = extraidos[k];
        setProgresso({ i: k + 1, total: extraidos.length });
        await new Promise((r) => setTimeout(r, 0)); // deixa a UI repintar
        const parsed = await parseFitResultado(ex.bytes);
        const r = await casarTreino(parsed, aluno.id, palpitesUsados);
        if (r.escolhido && r.motivoKey === "match.noCodeGuessed") {
          palpitesUsados.add(r.escolhido.id);
        }
        itens.push({
          nome: ex.nome,
          bytes: ex.bytes,
          fit: parsed,
          resultado: r,
          selecionadoId: r.escolhido?.id ?? "",
          zonas: r.zonas,
          incluir: !!r.escolhido,
          jaImportado: false,
          statusImport: "pendente",
        });
      }

      const { data: exec } = await supabase
        .from("treino_executado")
        .select("treino_planejado_id")
        .eq("aluno_id", aluno.id);
      const jaSet = new Set((exec ?? []).map((e) => e.treino_planejado_id));
      for (const it of itens)
        it.jaImportado = it.selecionadoId ? jaSet.has(it.selecionadoId) : false;

      setLote(itens);
      setFase("lote");
    } catch (e) {
      setErro(t("importFit.readError", { msg: (e as Error).message }));
    } finally {
      setLendo(false);
      setProgresso(null);
    }
  }

  async function onSelecionar(id: string) {
    setSelecionadoId(id);
    const t = resultado?.todos.find((x) => x.id === id);
    if (!t) {
      setZonasSel([]);
      return;
    }
    const { data } = await supabase
      .from("zona")
      .select("*")
      .eq("ciclo_id", t.ciclo_id)
      .order("codigo");
    setZonasSel((data ?? []) as Zona[]);
  }

  function patchItem(i: number, patch: Partial<ItemLote>) {
    setLote((prev) => prev.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }

  async function onSelecionarLote(i: number, treinoId: string) {
    patchItem(i, { selecionadoId: treinoId, incluir: !!treinoId });
    if (!treinoId) {
      patchItem(i, { zonas: [], jaImportado: false });
      return;
    }
    const t = lote[i]?.resultado.todos.find((x) => x.id === treinoId);
    if (!t) return;
    const [{ data: zonas }, { data: ex }] = await Promise.all([
      supabase.from("zona").select("*").eq("ciclo_id", t.ciclo_id).order("codigo"),
      supabase
        .from("treino_executado")
        .select("id")
        .eq("treino_planejado_id", treinoId),
    ]);
    patchItem(i, {
      zonas: (zonas ?? []) as Zona[],
      jaImportado: (ex?.length ?? 0) > 0,
    });
  }

  function onToggleLote(i: number) {
    patchItem(i, { incluir: !lote[i].incluir });
  }

  async function confirmar() {
    if (!fit || !aluno || !arquivoFit || !selecionado || !resultado) return;

    // já existe execução para esse treino planejado? oferece substituir
    const { data: existentes } = await supabase
      .from("treino_executado")
      .select("id, data_execucao, arquivo_fit_path")
      .eq("treino_planejado_id", selecionado.id);
    if (existentes && existentes.length > 0) {
      const ok = window.confirm(
        t("importFit.replacePrompt", {
          codigo: selecionado.codigo,
          data: existentes[0].data_execucao,
        }),
      );
      if (!ok) return;
      for (const ex of existentes) {
        if (ex.arquivo_fit_path)
          await supabase.storage.from("fit-files").remove([ex.arquivo_fit_path]);
        await supabase.from("treino_executado").delete().eq("id", ex.id);
      }
    }

    setFase("salvando");
    setErro(null);
    try {
      const path = `${aluno.id}/${Date.now()}_${arquivoFit.nome.replace(/[^\w.\-]+/g, "_")}`;
      const up = await supabase.storage
        .from("fit-files")
        .upload(path, arquivoFit.blob, { contentType: "application/octet-stream" });
      if (up.error) throw new Error(up.error.message);

      const ins = await supabase.from("treino_executado").insert({
        treino_planejado_id: selecionado.id,
        aluno_id: aluno.id,
        data_execucao: fit.dataExecucao,
        duracao_real_sec: fit.duracaoRealSec,
        arquivo_fit_path: path,
        status_match: statusMatchParaBanco(resultado.status),
        etapas,
      });
      if (ins.error) throw new Error(ins.error.message);

      setFase("ok");
      setTimeout(
        () => navigate(`/aluno/${aluno.id}?ciclo=${selecionado.ciclo_id}`),
        900,
      );
    } catch (e) {
      setErro(t("importFit.saveError", { msg: (e as Error).message }));
      setFase("conferencia");
    }
  }

  async function importarLote() {
    if (!aluno) return;
    setSalvandoLote(true);
    setErro(null);

    for (let i = 0; i < lote.length; i++) {
      const it = lote[i];
      if (!it.incluir || !it.selecionadoId || it.statusImport === "ok") continue;
      const treino = it.resultado.todos.find((t) => t.id === it.selecionadoId);
      if (!treino) {
        patchItem(i, { statusImport: "erro", erroMsg: "nenhum treino escolhido" });
        continue;
      }
      patchItem(i, { statusImport: "salvando", erroMsg: undefined });
      try {
        const { data: existentes } = await supabase
          .from("treino_executado")
          .select("id, arquivo_fit_path")
          .eq("treino_planejado_id", treino.id);
        for (const ex of existentes ?? []) {
          if (ex.arquivo_fit_path)
            await supabase.storage.from("fit-files").remove([ex.arquivo_fit_path]);
          await supabase.from("treino_executado").delete().eq("id", ex.id);
        }

        const etapasLote = calcularEtapas(
          it.fit,
          faixasDeZonas(it.zonas),
          treino.estrutura,
        );
        const path = `${aluno.id}/${Date.now()}_${i}_${it.nome.replace(
          /[^\w.\-]+/g,
          "_",
        )}`;
        const up = await supabase.storage
          .from("fit-files")
          .upload(path, new Blob([it.bytes]), {
            contentType: "application/octet-stream",
          });
        if (up.error) throw new Error(up.error.message);

        const ins = await supabase.from("treino_executado").insert({
          treino_planejado_id: treino.id,
          aluno_id: aluno.id,
          data_execucao: it.fit.dataExecucao,
          duracao_real_sec: it.fit.duracaoRealSec,
          arquivo_fit_path: path,
          status_match: statusMatchParaBanco(it.resultado.status),
          etapas: etapasLote,
        });
        if (ins.error) throw new Error(ins.error.message);

        patchItem(i, { statusImport: "ok", jaImportado: true });
      } catch (e) {
        patchItem(i, { statusImport: "erro", erroMsg: (e as Error).message });
      }
    }

    setSalvandoLote(false);
  }

  function reiniciar() {
    setArquivoFit(null);
    setFit(null);
    setResultado(null);
    setSelecionadoId("");
    setZonasSel([]);
    setLote([]);
    setSalvandoLote(false);
    setProgresso(null);
    setFase("selecao");
  }

  function concluirLote() {
    const alvo = lote.find((it) => it.statusImport === "ok" && it.selecionadoId);
    const t = alvo?.resultado.todos.find((x) => x.id === alvo.selecionadoId);
    if (aluno && t) {
      navigate(`/aluno/${aluno.id}?ciclo=${t.ciclo_id}`);
    } else {
      reiniciar();
    }
  }

  return (
    <>
      <Voltar to={alunoPre ? `/aluno/${alunoPre}` : "/"}>
        {alunoPre ? t("common.backToAthlete") : t("common.backToPanel")}
      </Voltar>
      <div className="page-header">
        <div>
          <h1>{t("importFit.title")}</h1>
          <div className="meta">{t("importFit.subtitle")}</div>
        </div>
      </div>

      {erro && <div className="form-msg-erro">{erro}</div>}

      {fase === "selecao" && (
        <div className="form-narrow">
          {!alunosCarregados ? (
            <div style={{ color: "var(--muted)" }}>{t("common.loading")}</div>
          ) : alunos.length === 0 ? (
            <div className="conf-banner aviso">
              {t("importFit.noAthletes")}{" "}
              <Link to="/alunos/novo">{t("importFit.registerFirst")}</Link>{" "}
              {t("importFit.registerFirstTail")}
            </div>
          ) : (
            <>
              <div className="field">
                <label htmlFor="aluno">{t("importFit.athlete")}</label>
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
                <label>{t("importFit.fileLabel")}</label>
                <div className="dropzone">
                  <input
                    type="file"
                    accept=".fit,.FIT,.gz,.zip"
                    disabled={!alunoId || lendo}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onArquivo(f);
                    }}
                  />
                  <div style={{ marginTop: 8 }}>
                    {lendo
                      ? progresso
                        ? t("importFit.readingProgress", {
                            i: progresso.i,
                            total: progresso.total,
                          })
                        : t("importFit.reading")
                      : !alunoId
                        ? t("importFit.chooseAthleteFirst")
                        : t("importFit.accepts")}
                  </div>
                  {lendo && progresso && (
                    <div className="lote-progress">
                      <div
                        className="lote-progress-bar"
                        style={{
                          width: `${(progresso.i / progresso.total) * 100}%`,
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {(fase === "conferencia" || fase === "salvando") && fit && resultado && (
        <>
          <ConferenciaFit
            fit={fit}
            resultado={resultado}
            selecionado={selecionado}
            etapas={etapas}
            onSelecionar={onSelecionar}
          />
          <div className="form-row">
            <button
              className="btn btn-primary"
              disabled={!selecionado || etapas.length === 0 || fase === "salvando"}
              onClick={confirmar}
            >
              {fase === "salvando"
                ? t("common.saving")
                : resultado.status === "auto_confirmado"
                  ? t("importFit.confirmProcess")
                  : t("importFit.confirmManualProcess")}
            </button>
            <button className="btn btn-ghost" onClick={reiniciar} disabled={fase === "salvando"}>
              {t("common.cancel")}
            </button>
          </div>
        </>
      )}

      {fase === "lote" && (
        <ConferenciaLote
          itens={lote}
          salvando={salvandoLote}
          onSelecionar={onSelecionarLote}
          onToggle={onToggleLote}
          onImportar={importarLote}
          onCancelar={concluirLote}
        />
      )}

      {fase === "ok" && (
        <div className="conf-banner ok">{t("importFit.processed")}</div>
      )}
    </>
  );
}
