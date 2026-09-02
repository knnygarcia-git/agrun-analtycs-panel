import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Feedback } from "@/types/database";
import { gerarRascunho } from "@/lib/feedback/api";
import { useI18n, type TKey } from "@/lib/i18n";

const ROTULO_STATUS: Record<string, string> = {
  pendente: "feedback.statusPendente",
  rascunho: "feedback.statusRascunho",
  aprovado: "feedback.statusAprovado",
  enviado: "feedback.statusEnviado",
};

export function FeedbackSection({
  treinoExecutadoId,
}: {
  treinoExecutadoId: string;
}) {
  const { t, lang } = useI18n();
  const locale = lang === "pt" ? "pt-BR" : "en";
  const [fb, setFb] = useState<Feedback | null>(null);
  const [texto, setTexto] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("feedback")
      .select("*")
      .eq("treino_executado_id", treinoExecutadoId)
      .maybeSingle()
      .then(({ data }) => {
        setFb(data);
        setTexto(data?.texto_final ?? data?.texto_rascunho ?? "");
        setCarregando(false);
      });
  }, [treinoExecutadoId]);

  const status = fb?.status ?? "pendente";

  async function gerar() {
    setOcupado(true);
    setErro(null);
    try {
      const t = await gerarRascunho(treinoExecutadoId);
      const { data, error } = await supabase
        .from("feedback")
        .upsert(
          {
            treino_executado_id: treinoExecutadoId,
            texto_rascunho: t,
            texto_final: null,
            status: "rascunho",
            gerado_em: new Date().toISOString(),
            aprovado_em: null,
            enviado_em: null,
          },
          { onConflict: "treino_executado_id" },
        )
        .select()
        .single();
      if (error) throw new Error(error.message);
      setFb(data);
      setTexto(t);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  async function atualizar(patch: Partial<Feedback>, textoNovo?: string) {
    if (!fb) return;
    setOcupado(true);
    setErro(null);
    const { data, error } = await supabase
      .from("feedback")
      .update(patch)
      .eq("id", fb.id)
      .select()
      .single();
    setOcupado(false);
    if (error) {
      setErro(error.message);
      return;
    }
    setFb(data);
    if (textoNovo !== undefined) setTexto(textoNovo);
  }

  const aprovar = () =>
    atualizar({
      texto_final: texto,
      status: "aprovado",
      aprovado_em: new Date().toISOString(),
    });

  const marcarEnviado = () =>
    atualizar({ status: "enviado", enviado_em: new Date().toISOString() });

  const voltarRascunho = () =>
    atualizar({ status: "rascunho", aprovado_em: null });

  const descartar = () =>
    atualizar(
      {
        status: "pendente",
        texto_rascunho: null,
        texto_final: null,
        gerado_em: null,
        aprovado_em: null,
      },
      "",
    );

  if (carregando)
    return <div style={{ color: "var(--muted-2)" }}>{t("feedback.loading")}</div>;

  return (
    <div>
      <div className="fb-status-row">
        <span className={`status-pill s-${status}`}>
          {t(ROTULO_STATUS[status] as TKey)}
        </span>
        {fb?.gerado_em && status !== "pendente" && (
          <span className="fb-meta">
            {t("feedback.draftGeneratedAt", {
              data: new Date(fb.gerado_em).toLocaleString(locale),
            })}
          </span>
        )}
      </div>

      {erro && <div className="form-msg-erro">{erro}</div>}

      {status === "pendente" && (
        <div className="placeholder-box">
          {t("feedback.noDraft")}
          <div style={{ marginTop: 14 }}>
            <button className="btn btn-primary" onClick={gerar} disabled={ocupado}>
              {ocupado ? t("feedback.generating") : t("feedback.generate")}
            </button>
          </div>
        </div>
      )}

      {status !== "pendente" && (
        <>
          <div className={`draft-box ${status === "aprovado" || status === "enviado" ? "approved" : ""}`}>
            <div className="draft-label">
              {status === "enviado"
                ? t("feedback.labelSent")
                : status === "aprovado"
                  ? t("feedback.labelApproved")
                  : t("feedback.labelDraft")}
            </div>
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              readOnly={status === "enviado"}
              rows={9}
            />
          </div>

          <div className="fb-actions">
            {status === "rascunho" && (
              <>
                <button className="btn btn-approve" onClick={aprovar} disabled={ocupado}>
                  {t("feedback.approve")}
                </button>
                <button className="btn btn-ghost" onClick={gerar} disabled={ocupado}>
                  {ocupado ? "…" : t("feedback.regenerate")}
                </button>
                <button className="btn btn-ghost" onClick={descartar} disabled={ocupado}>
                  {t("feedback.discard")}
                </button>
              </>
            )}
            {status === "aprovado" && (
              <>
                <button className="btn btn-approve" onClick={marcarEnviado} disabled={ocupado}>
                  {t("feedback.markSent")}
                </button>
                <button className="btn btn-ghost" onClick={voltarRascunho} disabled={ocupado}>
                  {t("feedback.backToDraft")}
                </button>
              </>
            )}
            {status === "enviado" && (
              <span className="fb-sent">
                {fb?.enviado_em
                  ? t("feedback.sentAt", {
                      data: new Date(fb.enviado_em).toLocaleString(locale),
                    })
                  : t("feedback.sentNoDate")}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
