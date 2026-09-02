import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import type { Aluno } from "@/types/database";
import { Voltar } from "@/components/Voltar";
import { useT } from "@/lib/i18n";

export function EditarAlunoPage() {
  const t = useT();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [aluno, setAluno] = useState<Aluno | null>(null);
  const [nome, setNome] = useState("");
  const [objetivo, setObjetivo] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!id) return;
    supabase
      .from("aluno")
      .select("*")
      .eq("id", id)
      .single()
      .then(({ data }) => {
        if (data) {
          setAluno(data);
          setNome(data.nome);
          setObjetivo(data.objetivo_atual ?? "");
          setObservacoes(data.observacoes ?? "");
        }
        setCarregando(false);
      });
  }, [id]);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    setBusy(true);
    setErro(null);
    const { error } = await supabase
      .from("aluno")
      .update({
        nome: nome.trim(),
        objetivo_atual: objetivo.trim() || null,
        observacoes: observacoes.trim() || null,
      })
      .eq("id", id);
    setBusy(false);
    if (error) {
      setErro(error.message);
      return;
    }
    navigate(`/aluno/${id}`);
  }

  async function apagar() {
    if (!id || !aluno) return;
    if (!window.confirm(t("editarAluno.confirmDelete", { nome: aluno.nome })))
      return;
    setBusy(true);
    const { error } = await supabase.from("aluno").delete().eq("id", id);
    setBusy(false);
    if (error) {
      setErro(error.message);
      return;
    }
    navigate("/");
  }

  if (carregando)
    return <div style={{ color: "var(--muted)" }}>{t("common.loading")}</div>;
  if (!aluno)
    return <div className="form-msg-erro">{t("aluno.notFound")}</div>;

  return (
    <>
      <Voltar to={`/aluno/${id}`}>{t("common.backToAthlete")}</Voltar>
      <div className="page-header">
        <div>
          <h1>{t("editarAluno.title")}</h1>
        </div>
      </div>

      <form className="form-narrow" onSubmit={salvar}>
        {erro && <div className="form-msg-erro">{erro}</div>}

        <div className="field">
          <label htmlFor="nome">{t("novoAluno.name")}</label>
          <input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="objetivo">{t("novoAluno.goal")}</label>
          <input
            id="objetivo"
            value={objetivo}
            onChange={(e) => setObjetivo(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="obs">{t("novoAluno.notes")}</label>
          <textarea
            id="obs"
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder={t("novoAluno.notesPlaceholder")}
          />
        </div>

        <div className="form-row">
          <button type="submit" className="btn btn-primary" disabled={busy || !nome.trim()}>
            {busy ? t("common.saving") : t("common.save")}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => navigate(`/aluno/${id}`)}
          >
            {t("common.cancel")}
          </button>
        </div>
      </form>

      <div className="zona-danger">
        <div className="section-title danger">{t("common.dangerZone")}</div>
        <button className="btn btn-danger" onClick={apagar} disabled={busy}>
          {t("editarAluno.deleteAthlete")}
        </button>
      </div>
    </>
  );
}
