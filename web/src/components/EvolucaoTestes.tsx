import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import type { Teste3km } from "@/types/database";
import { fmtSec, parseTempo } from "@/lib/format";
import { useT } from "@/lib/i18n";

const W = 640;
const H = 120;
const PAD_L = 46;
const PAD_R = 14;
const PAD_T = 14;
const PAD_B = 22;

/** Mini-gráfico de evolução: 1 linha, poucos pontos (1 por teste), datas no eixo X.
 *  Y invertido — valor menor (mais rápido) fica mais alto, mesma convenção
 *  usada nos gráficos de treino (melhor desempenho = mais em cima). */
function MiniEvolucao({
  titulo,
  pontos,
  fmtValor,
  cor,
}: {
  titulo: string;
  pontos: { data: string; valor: number }[];
  fmtValor: (v: number) => string;
  cor: string;
}) {
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const valores = pontos.map((p) => p.valor);
  const vMin = Math.min(...valores);
  const vMax = Math.max(...valores);
  const folga = vMax === vMin ? Math.max(10, vMin * 0.05) : (vMax - vMin) * 0.2;
  const dom: [number, number] = [vMin - folga, vMax + folga];

  const sx = (i: number) =>
    pontos.length <= 1 ? PAD_L + plotW / 2 : PAD_L + (i / (pontos.length - 1)) * plotW;
  const sy = (v: number) =>
    PAD_T + (1 - (v - dom[0]) / (dom[1] - dom[0] || 1)) * plotH;

  const linha = pontos.map((p, i) => `${sx(i).toFixed(1)},${sy(p.valor).toFixed(1)}`).join(" ");
  const ticksY = [dom[0], (dom[0] + dom[1]) / 2, dom[1]];

  return (
    <div className="grafico-row">
      <div className="grafico-stats">
        <div className="display">{titulo}</div>
        <div className="stat-line">
          {fmtValor(pontos[0].valor)} → <b>{fmtValor(pontos[pontos.length - 1].valor)}</b>
        </div>
      </div>
      <div className="grafico-canvas">
        {ticksY.map((tk, i) => (
          <span key={i} className="grafico-tick" style={{ top: `calc(10px + ${sy(tk)}px)` }}>
            {fmtValor(tk)}
          </span>
        ))}
        <svg className="grafico-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
          {ticksY.map((tk, i) => (
            <line
              key={i}
              x1={PAD_L}
              y1={sy(tk)}
              x2={W - PAD_R}
              y2={sy(tk)}
              stroke="#2C3541"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <polyline
            points={linha}
            fill="none"
            stroke={cor}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          {pontos.map((p, i) => (
            <circle key={i} cx={sx(i)} cy={sy(p.valor)} r={3.5} fill={cor} />
          ))}
        </svg>
        {pontos.map((p, i) => (
          <span key={i} className="grafico-tick-x" style={{ left: `${(sx(i) / W) * 100}%` }}>
            {p.data.slice(5)}
          </span>
        ))}
      </div>
    </div>
  );
}

export function EvolucaoTestes({ alunoId }: { alunoId: string }) {
  const t = useT();
  const [testes, setTestes] = useState<Teste3km[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [dataTeste, setDataTeste] = useState("");
  const [tempo, setTempo] = useState("");
  const [ftp, setFtp] = useState("");
  const [ftpManual, setFtpManual] = useState(false);
  const [obs, setObs] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alunoId]);

  async function carregar() {
    setCarregando(true);
    const { data } = await supabase
      .from("teste_3km")
      .select("*")
      .eq("aluno_id", alunoId)
      .order("data_teste");
    setTestes((data ?? []) as Teste3km[]);
    setCarregando(false);
  }

  function aoMudarTempo(v: string) {
    setTempo(v);
    if (!ftpManual) {
      const s = parseTempo(v);
      setFtp(s != null ? fmtSec(Math.round(s / 3)) : "");
    }
  }

  function abrirForm() {
    setMostrarForm(true);
    setDataTeste(new Date().toISOString().slice(0, 10));
    setTempo("");
    setFtp("");
    setFtpManual(false);
    setObs("");
    setErro(null);
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    const tempoSec = parseTempo(tempo);
    if (!dataTeste || tempoSec == null) {
      setErro(t("teste3km.erroCampos"));
      return;
    }
    let ftpSec: number | null = null;
    if (ftp.trim()) {
      ftpSec = parseTempo(ftp);
      if (ftpSec == null) {
        setErro(t("teste3km.erroFtp"));
        return;
      }
    }
    setBusy(true);
    setErro(null);
    const { error } = await supabase.from("teste_3km").insert({
      aluno_id: alunoId,
      data_teste: dataTeste,
      tempo_sec: tempoSec,
      ftp_pace_sec: ftpSec,
      observacoes: obs.trim() || null,
    });
    setBusy(false);
    if (error) {
      setErro(error.message);
      return;
    }
    setMostrarForm(false);
    carregar();
  }

  async function apagar(id: string) {
    if (!window.confirm(t("teste3km.confirmarApagar"))) return;
    await supabase.from("teste_3km").delete().eq("id", id);
    carregar();
  }

  if (carregando) return null;

  const comFtp = testes.filter((tt) => tt.ftp_pace_sec != null);

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          marginTop: 28,
          marginBottom: 14,
        }}
      >
        <div className="section-title" style={{ marginBottom: 0 }}>
          {t("teste3km.title")}
        </div>
        {!mostrarForm && (
          <button className="btn btn-ghost" onClick={abrirForm}>
            {t("teste3km.addNew")}
          </button>
        )}
      </div>

      {mostrarForm && (
        <form className="form-narrow" onSubmit={salvar} style={{ marginBottom: 18 }}>
          {erro && <div className="form-msg-erro">{erro}</div>}
          <div className="grid-2">
            <div className="field">
              <label htmlFor="teste-data">{t("teste3km.date")}</label>
              <input
                id="teste-data"
                type="date"
                value={dataTeste}
                onChange={(e) => setDataTeste(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="teste-tempo">{t("teste3km.time")}</label>
              <input
                id="teste-tempo"
                value={tempo}
                onChange={(e) => aoMudarTempo(e.target.value)}
                placeholder="12:45"
                required
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="teste-ftp">{t("teste3km.ftpResult")}</label>
            <input
              id="teste-ftp"
              value={ftp}
              onChange={(e) => {
                setFtp(e.target.value);
                setFtpManual(true);
              }}
              placeholder="4:15"
            />
          </div>
          <div className="field">
            <label htmlFor="teste-obs">{t("teste3km.notes")}</label>
            <input
              id="teste-obs"
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder={t("teste3km.notesPlaceholder")}
            />
          </div>
          <div className="form-row">
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? t("common.saving") : t("common.save")}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setMostrarForm(false)}
              disabled={busy}
            >
              {t("common.cancel")}
            </button>
          </div>
        </form>
      )}

      {testes.length === 0 ? (
        !mostrarForm && <div className="placeholder-box">{t("teste3km.empty")}</div>
      ) : (
        <>
          <div className="conf-table-wrap">
            <table className="conf">
              <thead>
                <tr>
                  <th>{t("teste3km.date")}</th>
                  <th>{t("teste3km.time")}</th>
                  <th>{t("teste3km.ftpResult")}</th>
                  <th>{t("teste3km.notes")}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {testes.map((tt) => (
                  <tr key={tt.id}>
                    <td className="num">{tt.data_teste}</td>
                    <td className="num">{fmtSec(tt.tempo_sec)}</td>
                    <td className="num">
                      {tt.ftp_pace_sec != null ? `${fmtSec(tt.ftp_pace_sec)}/km` : "—"}
                    </td>
                    <td className="livre" style={{ color: "var(--muted)" }}>
                      {tt.observacoes ?? "—"}
                    </td>
                    <td>
                      <button
                        className="btn btn-danger"
                        style={{ padding: "4px 12px", fontSize: 11.5 }}
                        onClick={() => apagar(tt.id)}
                      >
                        {t("common.delete")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grafico-card" style={{ marginTop: 14 }}>
            <MiniEvolucao
              titulo={t("teste3km.chartTime")}
              pontos={testes.map((tt) => ({ data: tt.data_teste, valor: tt.tempo_sec }))}
              fmtValor={(v) => fmtSec(v)}
              cor="#7BD88F"
            />
            {comFtp.length > 0 && (
              <MiniEvolucao
                titulo={t("teste3km.chartFtp")}
                pontos={comFtp.map((tt) => ({ data: tt.data_teste, valor: tt.ftp_pace_sec! }))}
                fmtValor={(v) => `${fmtSec(v)}/km`}
                cor="#4C8CFF"
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
