import { useEffect, useRef, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import type { Teste3km } from "@/types/database";
import { fmtSec, parseTempo } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { SecaoColapsavel } from "@/components/SecaoColapsavel";

const W = 640;
const H = 150;
const PAD_L = 46;
const PAD_R = 46;
const PAD_T = 14;
const PAD_B = 22;

const COR_TEMPO = "#7BD88F";
const COR_FTP = "#4C8CFF";

function dominio(valores: number[]): [number, number] {
  const vMin = Math.min(...valores);
  const vMax = Math.max(...valores);
  const folga = vMax === vMin ? Math.max(10, vMin * 0.05) : (vMax - vMin) * 0.2;
  return [vMin - folga, vMax + folga];
}

/** % de melhora entre o primeiro e o último teste — valor menor (mais
 *  rápido) é evolução, então a % é (inicial - final) / inicial. */
function formatoMelhora(inicial: number, final: number): { texto: string; classe: string } {
  const pct = ((inicial - final) / inicial) * 100;
  if (Math.abs(pct) < 0.05) return { texto: "0%", classe: "neutro" };
  return {
    texto: `${pct > 0 ? "▲" : "▼"} ${Math.abs(pct).toFixed(1)}%`,
    classe: pct > 0 ? "up" : "down",
  };
}

function formatoMelhoraPorMes(pct: number): { texto: string; classe: string } {
  if (Math.abs(pct) < 0.05) return { texto: "0%/mês", classe: "neutro" };
  return {
    texto: `${pct > 0 ? "▲" : "▼"} ${Math.abs(pct).toFixed(1)}%/mês`,
    classe: pct > 0 ? "up" : "down",
  };
}

/** Inclinação da reta de regressão linear (mínimos quadrados) — variação de
 *  `valor` por unidade de `dias`. Usa TODOS os pontos, não só o primeiro e o
 *  último, então um teste isolado fora da curva pesa menos no resultado. */
function inclinacaoRegressao(pontos: { dias: number; valor: number }[]): number {
  const n = pontos.length;
  const somaX = pontos.reduce((s, p) => s + p.dias, 0);
  const somaY = pontos.reduce((s, p) => s + p.valor, 0);
  const somaXY = pontos.reduce((s, p) => s + p.dias * p.valor, 0);
  const somaXX = pontos.reduce((s, p) => s + p.dias * p.dias, 0);
  const denominador = n * somaXX - somaX * somaX;
  return denominador === 0 ? 0 : (n * somaXY - somaX * somaY) / denominador;
}

/** % média de evolução por mês, pela reta de regressão dos tempos ao longo
 *  das datas — mais robusta que "primeiro → último" quando há vários testes,
 *  pois não depende só das duas pontas. */
function mediaPorMes(pontos: { data: string; tempo: number }[]): number {
  const base = new Date(pontos[0].data).getTime();
  const comDias = pontos.map((p) => ({
    dias: (new Date(p.data).getTime() - base) / 86400000,
    valor: p.tempo,
  }));
  const inclinacao = inclinacaoRegressao(comDias); // segundos por dia
  const mudancaMes = inclinacao * 30; // segundos por mês
  return (-mudancaMes / pontos[0].tempo) * 100;
}

/** Gráfico único de evolução: tempo do teste (eixo esquerdo, verde) e FTP pace
 *  resultante (eixo direito, azul, tracejado) no mesmo plot, 1 ponto por
 *  teste, datas no eixo X. Y invertido nos dois — valor menor (mais rápido)
 *  fica mais alto, mesma convenção dos gráficos de treino. */
function EvolucaoChart({
  pontos,
  tituloTempo,
  tituloFtp,
  tituloMelhora,
  tituloMedia,
  tituloVsAnterior,
}: {
  pontos: { data: string; tempo: number; ftp: number | null }[];
  tituloTempo: string;
  tituloFtp: string;
  tituloMelhora: string;
  tituloMedia: string;
  tituloVsAnterior: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const comFtp = pontos
    .map((p, i) => ({ i, data: p.data, ftp: p.ftp }))
    .filter((p): p is { i: number; data: string; ftp: number } => p.ftp != null);

  const domTempo = dominio(pontos.map((p) => p.tempo));
  const domFtp = comFtp.length ? dominio(comFtp.map((p) => p.ftp)) : null;

  const sx = (i: number) =>
    pontos.length <= 1 ? PAD_L + plotW / 2 : PAD_L + (i / (pontos.length - 1)) * plotW;
  const syTempo = (v: number) =>
    PAD_T + (1 - (v - domTempo[0]) / (domTempo[1] - domTempo[0] || 1)) * plotH;
  const syFtp = (v: number) =>
    domFtp ? PAD_T + (1 - (v - domFtp[0]) / (domFtp[1] - domFtp[0] || 1)) * plotH : 0;

  const linhaTempo = pontos.map((p, i) => `${sx(i).toFixed(1)},${syTempo(p.tempo).toFixed(1)}`).join(" ");
  const linhaFtp = comFtp.map((p) => `${sx(p.i).toFixed(1)},${syFtp(p.ftp).toFixed(1)}`).join(" ");

  const ticksTempo = [domTempo[0], (domTempo[0] + domTempo[1]) / 2, domTempo[1]];
  const ticksFtp = domFtp ? [domFtp[0], (domFtp[0] + domFtp[1]) / 2, domFtp[1]] : [];

  function onMove(e: React.MouseEvent) {
    const el = wrapRef.current;
    if (!el || pontos.length === 0) return;
    if (pontos.length === 1) {
      setHover(0);
      return;
    }
    const rect = el.getBoundingClientRect();
    const vbX = ((e.clientX - rect.left) / rect.width) * W;
    const idx = Math.round(((vbX - PAD_L) / plotW) * (pontos.length - 1));
    setHover(Math.max(0, Math.min(pontos.length - 1, idx)));
  }

  const hp = hover != null ? pontos[hover] : null;
  const mVsAnterior = hp && hover! > 0 ? formatoMelhora(pontos[hover! - 1].tempo, hp.tempo) : null;

  return (
    <div className="grafico-row">
      <div className="grafico-stats">
        <div className="stat-line">
          <i className="grafico-dot" style={{ background: COR_TEMPO }} />
          {tituloTempo}
          <div>
            {fmtSec(pontos[0].tempo)} → <b>{fmtSec(pontos[pontos.length - 1].tempo)}</b>
            {pontos.length > 1 &&
              (() => {
                const m = formatoMelhora(pontos[0].tempo, pontos[pontos.length - 1].tempo);
                return (
                  <span className={`evolucao-pct ${m.classe}`} title={tituloMelhora}>
                    {m.texto}
                  </span>
                );
              })()}
          </div>
        </div>
        {domFtp && (
          <div className="stat-line" style={{ marginTop: 10 }}>
            <i className="grafico-dot" style={{ background: COR_FTP }} />
            {tituloFtp}
            <div>
              {fmtSec(comFtp[0].ftp)}/km →{" "}
              <b>{fmtSec(comFtp[comFtp.length - 1].ftp)}/km</b>
              {comFtp.length > 1 &&
                (() => {
                  const m = formatoMelhora(comFtp[0].ftp, comFtp[comFtp.length - 1].ftp);
                  return (
                    <span className={`evolucao-pct ${m.classe}`} title={tituloMelhora}>
                      {m.texto}
                    </span>
                  );
                })()}
            </div>
          </div>
        )}
        {pontos.length >= 3 &&
          (() => {
            const m = formatoMelhoraPorMes(mediaPorMes(pontos));
            return (
              <div className="stat-line evolucao-media" style={{ marginTop: 10 }}>
                {tituloMedia}
                <div>
                  <span className={`evolucao-pct ${m.classe}`}>{m.texto}</span>
                </div>
              </div>
            );
          })()}
      </div>
      <div
        className="grafico-canvas grande"
        ref={wrapRef}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        {ticksTempo.map((tk, i) => (
          <span
            key={`t${i}`}
            className="grafico-tick"
            style={{ top: `calc(10px + ${syTempo(tk)}px)`, color: COR_TEMPO }}
          >
            {fmtSec(tk)}
          </span>
        ))}
        {ticksFtp.map((tk, i) => (
          <span
            key={`f${i}`}
            className="grafico-tick-right"
            style={{ top: `calc(10px + ${syFtp(tk)}px)`, color: COR_FTP }}
          >
            {fmtSec(tk)}/km
          </span>
        ))}
        <svg className="grafico-svg alto" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
          {ticksTempo.map((tk, i) => (
            <line
              key={i}
              x1={PAD_L}
              y1={syTempo(tk)}
              x2={W - PAD_R}
              y2={syTempo(tk)}
              stroke="#2C3541"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <polyline
            points={linhaTempo}
            fill="none"
            stroke={COR_TEMPO}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          {pontos.map((p, i) => (
            <circle key={i} cx={sx(i)} cy={syTempo(p.tempo)} r={3.5} fill={COR_TEMPO} />
          ))}
          {domFtp && (
            <>
              <polyline
                points={linhaFtp}
                fill="none"
                stroke={COR_FTP}
                strokeWidth={2}
                strokeDasharray="5 4"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              {comFtp.map((p) => (
                <circle key={p.i} cx={sx(p.i)} cy={syFtp(p.ftp)} r={3.5} fill={COR_FTP} />
              ))}
            </>
          )}
          {hp && (
            <>
              <line
                x1={sx(hover!)}
                y1={PAD_T}
                x2={sx(hover!)}
                y2={H - PAD_B}
                stroke="#EDEFF2"
                strokeOpacity={0.4}
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
              <circle
                cx={sx(hover!)}
                cy={syTempo(hp.tempo)}
                r={4.5}
                fill="#EDEFF2"
                stroke={COR_TEMPO}
                strokeWidth={2}
              />
              {hp.ftp != null && domFtp && (
                <circle
                  cx={sx(hover!)}
                  cy={syFtp(hp.ftp)}
                  r={4.5}
                  fill="#EDEFF2"
                  stroke={COR_FTP}
                  strokeWidth={2}
                />
              )}
            </>
          )}
        </svg>
        {pontos.map((p, i) => (
          <span key={i} className="grafico-tick-x" style={{ left: `${(sx(i) / W) * 100}%` }}>
            {p.data.slice(5)}
          </span>
        ))}
        {hp && (
          <div
            className="grafico-tooltip"
            style={{ left: `${Math.min(78, (sx(hover!) / W) * 100)}%` }}
          >
            <div className="tt-x">{hp.data}</div>
            <div>
              <i className="grafico-dot" style={{ background: COR_TEMPO }} />
              {fmtSec(hp.tempo)}
            </div>
            {hp.ftp != null && (
              <div>
                <i className="grafico-dot" style={{ background: COR_FTP }} />
                {fmtSec(hp.ftp)}/km
              </div>
            )}
            {mVsAnterior && (
              <div className="tt-plano">
                <span className={`evolucao-pct ${mVsAnterior.classe}`}>{mVsAnterior.texto}</span>{" "}
                {tituloVsAnterior}
              </div>
            )}
          </div>
        )}
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

  return (
    <SecaoColapsavel
      chave="aluno.evolucao3km"
      titulo={t("teste3km.title")}
      style={{ marginTop: 28 }}
      acoes={
        !mostrarForm && (
          <button className="btn btn-ghost" onClick={abrirForm}>
            {t("teste3km.addNew")}
          </button>
        )
      }
    >
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
            <EvolucaoChart
              pontos={testes.map((tt) => ({
                data: tt.data_teste,
                tempo: tt.tempo_sec,
                ftp: tt.ftp_pace_sec,
              }))}
              tituloTempo={t("teste3km.chartTime")}
              tituloFtp={t("teste3km.chartFtp")}
              tituloMelhora={t("teste3km.improvementTitle")}
              tituloMedia={t("teste3km.avgPerMonth")}
              tituloVsAnterior={t("teste3km.vsPrevious")}
            />
          </div>
        </>
      )}
    </SecaoColapsavel>
  );
}
