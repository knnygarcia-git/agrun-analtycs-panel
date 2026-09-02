import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Voltar } from "@/components/Voltar";
import { useT } from "@/lib/i18n";

/* Formulário mínimo de cadastro de aluno.
   O passo 5 do roteiro expande isso (zonas, etc.); por ora só o necessário
   para conseguir importar uma planilha. */
export function NovoAlunoPage() {
  const t = useT();
  const navigate = useNavigate();
  const [nome, setNome] = useState("");
  const [objetivo, setObjetivo] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErro(null);
    const { data, error } = await supabase
      .from("aluno")
      .insert({
        nome: nome.trim(),
        objetivo_atual: objetivo.trim() || null,
        observacoes: observacoes.trim() || null,
      })
      .select("id")
      .single();
    setBusy(false);
    if (error) {
      setErro(error.message);
      return;
    }
    navigate(`/aluno/${data.id}`);
  }

  return (
    <>
      <Voltar to="/">{t("common.backToPanel")}</Voltar>
      <div className="page-header">
        <div>
          <h1>{t("novoAluno.title")}</h1>
        </div>
      </div>

      <form className="form-narrow" onSubmit={onSubmit}>
        {erro && <div className="form-msg-erro">{erro}</div>}

        <div className="field">
          <label htmlFor="nome">{t("novoAluno.name")}</label>
          <input
            id="nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
            autoFocus
          />
        </div>
        <div className="field">
          <label htmlFor="objetivo">{t("novoAluno.goal")}</label>
          <input
            id="objetivo"
            value={objetivo}
            onChange={(e) => setObjetivo(e.target.value)}
            placeholder={t("novoAluno.goalPlaceholder")}
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
            {busy ? t("common.saving") : t("novoAluno.saveAthlete")}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>
            {t("common.cancel")}
          </button>
        </div>
      </form>
    </>
  );
}
