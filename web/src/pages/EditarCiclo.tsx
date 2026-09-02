import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import type { Ciclo, CodigoZona, Zona } from "@/types/database";
import { fmtSec, parseTempo } from "@/lib/format";
import { Voltar } from "@/components/Voltar";
import { useT } from "@/lib/i18n";

interface LinhaZona {
  id: string;
  codigo: CodigoZona;
  rapido: string; // "M:SS" ou ""
  lento: string;
}

export function EditarCicloPage() {
  const t = useT();
  const { id: alunoId, cicloId } = useParams<{ id: string; cicloId: string }>();
  const navigate = useNavigate();

  const [ciclo, setCiclo] = useState<Ciclo | null>(null);
  const [objetivo, setObjetivo] = useState("");
  const [sequencia, setSequencia] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [ftpPace, setFtpPace] = useState("");
  const [ftpData, setFtpData] = useState("");
  const [zonas, setZonas] = useState<LinhaZona[]>([]);

  const [erro, setErro] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!cicloId) return;
    Promise.all([
      supabase.from("ciclo").select("*").eq("id", cicloId).single(),
      supabase.from("zona").select("*").eq("ciclo_id", cicloId).order("codigo"),
    ]).then(([c, z]) => {
      if (c.data) {
        const cc = c.data as Ciclo;
        setCiclo(cc);
        setObjetivo(cc.objetivo);
        setSequencia(String(cc.sequencia));
        setDataInicio(cc.data_inicio);
        setDataFim(cc.data_fim);
        setFtpPace(cc.ftp_pace_sec ? fmtSec(cc.ftp_pace_sec) : "");
        setFtpData(cc.ftp_data_teste ?? "");
      }
      setZonas(
        ((z.data ?? []) as Zona[]).map((zn) => ({
          id: zn.id,
          codigo: zn.codigo,
          rapido: zn.pace_rapido_sec ? fmtSec(zn.pace_rapido_sec) : "",
          lento: zn.pace_lento_sec ? fmtSec(zn.pace_lento_sec) : "",
        })),
      );
      setCarregando(false);
    });
  }, [cicloId]);

  function setZona(i: number, campo: "rapido" | "lento", v: string) {
    setZonas((zs) => zs.map((z, k) => (k === i ? { ...z, [campo]: v } : z)));
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!cicloId) return;

    // valida os tempos das zonas
    for (const z of zonas) {
      if (z.rapido && parseTempo(z.rapido) == null)
        return setErro(
          t("editarCiclo.badFast", { zona: z.codigo, valor: z.rapido }),
        );
      if (z.lento && parseTempo(z.lento) == null)
        return setErro(
          t("editarCiclo.badSlow", { zona: z.codigo, valor: z.lento }),
        );
    }
    if (ftpPace && parseTempo(ftpPace) == null)
      return setErro(t("editarCiclo.badFtp", { valor: ftpPace }));

    setBusy(true);
    setErro(null);

    const upC = await supabase
      .from("ciclo")
      .update({
        objetivo: objetivo.trim(),
        sequencia: Number(sequencia) || 1,
        data_inicio: dataInicio,
        data_fim: dataFim,
        ftp_pace_sec: ftpPace ? parseTempo(ftpPace) : null,
        ftp_data_teste: ftpData || null,
      })
      .eq("id", cicloId);
    if (upC.error) {
      setBusy(false);
      setErro(upC.error.message);
      return;
    }

    for (const z of zonas) {
      const upZ = await supabase
        .from("zona")
        .update({
          pace_rapido_sec: z.rapido ? parseTempo(z.rapido) : null,
          pace_lento_sec: z.lento ? parseTempo(z.lento) : null,
        })
        .eq("id", z.id);
      if (upZ.error) {
        setBusy(false);
        setErro(`${z.codigo}: ${upZ.error.message}`);
        return;
      }
    }

    setBusy(false);
    navigate(`/aluno/${alunoId}?ciclo=${cicloId}`);
  }

  async function apagar() {
    if (!cicloId || !ciclo) return;
    if (
      !window.confirm(
        t("editarCiclo.confirmDelete", {
          objetivo: ciclo.objetivo,
          seq: ciclo.sequencia,
        }),
      )
    )
      return;
    setBusy(true);
    const { error } = await supabase.from("ciclo").delete().eq("id", cicloId);
    setBusy(false);
    if (error) {
      setErro(error.message);
      return;
    }
    navigate(`/aluno/${alunoId}`);
  }

  if (carregando)
    return <div style={{ color: "var(--muted)" }}>{t("common.loading")}</div>;
  if (!ciclo)
    return <div className="form-msg-erro">{t("editarCiclo.notFound")}</div>;

  return (
    <>
      <Voltar to={`/aluno/${alunoId}?ciclo=${cicloId}`}>
        {t("common.backToAthlete")}
      </Voltar>
      <div className="page-header">
        <div>
          <h1>{t("editarCiclo.title")}</h1>
          <div className="meta">{t("editarCiclo.subtitle")}</div>
        </div>
      </div>

      <form onSubmit={salvar}>
        {erro && <div className="form-msg-erro">{erro}</div>}

        <div className="section-title">{t("editarCiclo.cycle")}</div>
        <div className="form-narrow">
          <div className="field">
            <label htmlFor="obj">{t("editarCiclo.goal")}</label>
            <input id="obj" value={objetivo} onChange={(e) => setObjetivo(e.target.value)} required />
          </div>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="seq">{t("editarCiclo.sequence")}</label>
              <input
                id="seq"
                type="number"
                min={1}
                value={sequencia}
                onChange={(e) => setSequencia(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="ftp">{t("editarCiclo.ftpPace")}</label>
              <input id="ftp" value={ftpPace} onChange={(e) => setFtpPace(e.target.value)} placeholder="4:36" />
            </div>
          </div>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="di">{t("editarCiclo.startDate")}</label>
              <input id="di" type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="df">{t("editarCiclo.endDate")}</label>
              <input id="df" type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} required />
            </div>
          </div>
          <div className="field">
            <label htmlFor="ftpd">{t("editarCiclo.thresholdTestDate")}</label>
            <input id="ftpd" type="date" value={ftpData} onChange={(e) => setFtpData(e.target.value)} />
          </div>
        </div>

        <div className="section-title" style={{ marginTop: 22 }}>
          {t("editarCiclo.zonesTitle")}
        </div>
        <div className="conf-table-wrap">
          <table className="conf" style={{ minWidth: 420 }}>
            <thead>
              <tr>
                <th>{t("editarCiclo.colZone")}</th>
                <th>{t("editarCiclo.colFast")}</th>
                <th>{t("editarCiclo.colSlow")}</th>
              </tr>
            </thead>
            <tbody>
              {zonas.map((z, i) => (
                <tr key={z.id}>
                  <td className="campo">{z.codigo}</td>
                  <td>
                    <input
                      className="input-cel"
                      value={z.rapido}
                      onChange={(e) => setZona(i, "rapido", e.target.value)}
                      placeholder={
                        z.codigo === "Z5" ? t("editarCiclo.z5Placeholder") : "4:00"
                      }
                    />
                  </td>
                  <td>
                    <input
                      className="input-cel"
                      value={z.lento}
                      onChange={(e) => setZona(i, "lento", e.target.value)}
                      placeholder="4:36"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="form-row">
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? t("common.saving") : t("common.save")}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => navigate(`/aluno/${alunoId}?ciclo=${cicloId}`)}
          >
            {t("common.cancel")}
          </button>
        </div>
      </form>

      <div className="zona-danger">
        <div className="section-title danger">{t("common.dangerZone")}</div>
        <button className="btn btn-danger" onClick={apagar} disabled={busy}>
          {t("editarCiclo.deleteCycle")}
        </button>
      </div>
    </>
  );
}
