import { useMemo, useRef, useState } from "react";
import type { PontoSerie } from "@/lib/fit/serie";
import { classificarZona, type FaixaZona } from "@/lib/fit/zones";
import { fmtSec } from "@/lib/format";
import { useT } from "@/lib/i18n";

const COR_ZONA: Record<string, string> = {
  Z1: "#4C8CFF",
  Z2: "#35B7A0",
  Z3: "#E8C547",
  Z4: "#F2874A",
  Z5: "#E23B3B",
};

const W = 680;
const H = 130;
const PAD_L = 34;
const PAD_R = 8;
const PAD_Y = 10;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_Y * 2;

interface Serie {
  valorDe: (p: PontoSerie) => number | null;
  dominio: [number, number];
  inverter?: boolean; // true: valor menor em baixo (FC); false: valor menor em cima (pace)
}

function Painel({
  serie,
  faixas,
  cfg,
  titulo,
  linhasStat,
  fmtTick,
  fmtHover,
}: {
  serie: PontoSerie[];
  faixas: FaixaZona[];
  cfg: Serie;
  titulo: string;
  linhasStat: { rot: string; val: string }[];
  fmtTick: (v: number) => string;
  fmtHover: (v: number) => string;
}) {
  const tr = useT();
  const tMax = serie.length ? serie[serie.length - 1].t : 1;
  const [dMin, dMax] = cfg.dominio;
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const x = (t: number) => PAD_L + (t / tMax) * PLOT_W;
  const y = (v: number) => {
    const frac = (v - dMin) / (dMax - dMin || 1);
    const f = cfg.inverter ? 1 - frac : frac;
    return PAD_Y + f * PLOT_H;
  };

  function onMove(e: React.MouseEvent) {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vbX = ((e.clientX - rect.left) / rect.width) * W;
    const tData = ((vbX - PAD_L) / PLOT_W) * tMax;
    let melhor = 0;
    let d = Infinity;
    serie.forEach((p, i) => {
      const dd = Math.abs(p.t - tData);
      if (dd < d) {
        d = dd;
        melhor = i;
      }
    });
    setHover(melhor);
  }

  const hp = hover != null ? serie[hover] : null;
  const hpVal = hp ? cfg.valorDe(hp) : null;
  const hZona = hp?.paceSec != null ? classificarZona(hp.paceSec, faixas) : null;

  const segmentos = useMemo(() => {
    const segs: { x1: number; y1: number; x2: number; y2: number; cor: string }[] = [];
    for (let i = 1; i < serie.length; i++) {
      const a = serie[i - 1];
      const b = serie[i];
      const va = cfg.valorDe(a);
      const vb = cfg.valorDe(b);
      if (va == null || vb == null) continue;
      const z =
        b.paceSec != null ? classificarZona(b.paceSec, faixas) : null;
      segs.push({
        x1: x(a.t),
        y1: y(va),
        x2: x(b.t),
        y2: y(vb),
        cor: (z && COR_ZONA[z]) || "#8B94A3",
      });
    }
    return segs;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serie, faixas, dMin, dMax]);

  const ticks = [dMin, (dMin + dMax) / 2, dMax];

  return (
    <div className="grafico-row">
      <div className="grafico-stats">
        <div className="display">{titulo}</div>
        {linhasStat.map((l, i) => (
          <div key={i} className="stat-line">
            {l.rot} <b>{l.val}</b>
          </div>
        ))}
      </div>
      <div
        className="grafico-canvas"
        ref={wrapRef}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        {ticks.map((tk, i) => (
          <span
            key={i}
            className="grafico-tick"
            style={{ top: `calc(10px + ${y(tk)}px)` }}
          >
            {fmtTick(tk)}
          </span>
        ))}
        <svg
          className="grafico-svg"
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
        >
          {ticks.map((tk, i) => {
            const yy = y(tk);
            return (
              <line
                key={i}
                x1={PAD_L}
                y1={yy}
                x2={W - PAD_R}
                y2={yy}
                stroke="#2C3541"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
          {segmentos.map((s, i) => (
            <line
              key={i}
              x1={s.x1}
              y1={s.y1}
              x2={s.x2}
              y2={s.y2}
              stroke={s.cor}
              strokeWidth={1.6}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {hp && hpVal != null && (
            <>
              <line
                x1={x(hp.t)}
                y1={PAD_Y}
                x2={x(hp.t)}
                y2={H - PAD_Y}
                stroke="#EDEFF2"
                strokeOpacity={0.4}
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
              <circle cx={x(hp.t)} cy={y(hpVal)} r={3} fill="#EDEFF2" />
            </>
          )}
        </svg>
        {hp && hpVal != null && (
          <div
            className="grafico-tooltip"
            style={{ left: `${Math.min(78, (x(hp.t) / W) * 100)}%` }}
          >
            <div className="tt-x">{fmtSec(hp.t)}</div>
            <div>
              <b>{fmtHover(hpVal)}</b>
            </div>
            {hZona && (
              <div className="tt-plano">{tr("grafico.zone", { z: hZona })}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function GraficoTreino({
  serie,
  faixas,
}: {
  serie: PontoSerie[];
  faixas: FaixaZona[];
}) {
  const t = useT();
  const paces = serie.map((p) => p.paceSec).filter((x): x is number => x != null);
  const hrs = serie.map((p) => p.hr).filter((x): x is number => x != null);

  if (!paces.length && !hrs.length) {
    return (
      <div className="grafico-card">
        <div style={{ padding: 16, color: "var(--muted-2)", fontSize: 12 }}>
          {t("grafico.noSeries")}
        </div>
      </div>
    );
  }

  const paceMin = Math.min(...paces);
  const paceMax = Math.max(...paces);
  const hrMin = Math.min(...hrs);
  const hrMax = Math.max(...hrs);

  return (
    <div className="grafico-card">
      <Painel
        serie={serie}
        faixas={faixas}
        titulo={t("grafico.pace")}
        cfg={{
          valorDe: (p) => p.paceSec,
          // teto em ~11:00/km: pontos mais lentos (glitch de GPS parado) saem da moldura
          dominio: [Math.max(180, paceMin - 15), Math.min(660, paceMax + 15)],
        }}
        linhasStat={[
          { rot: t("grafico.max"), val: `${fmtSec(paceMin)} ${t("grafico.perKm")}` },
          {
            rot: t("grafico.avg"),
            val: `${fmtSec(Math.round(paces.reduce((a, b) => a + b, 0) / paces.length))} ${t("grafico.perKm")}`,
          },
          { rot: t("grafico.min"), val: `${fmtSec(paceMax)} ${t("grafico.perKm")}` },
        ]}
        fmtTick={(v) => fmtSec(Math.round(v))}
        fmtHover={(v) => `${fmtSec(v)}${t("grafico.perKm")}`}
      />
      <Painel
        serie={serie}
        faixas={faixas}
        titulo={t("grafico.hr")}
        cfg={{
          valorDe: (p) => p.hr,
          dominio: [hrMin - 4, hrMax + 4],
          inverter: true,
        }}
        linhasStat={[
          { rot: t("grafico.max"), val: `${hrMax} ${t("grafico.bpm")}` },
          {
            rot: t("grafico.avg"),
            val: `${Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length)} ${t("grafico.bpm")}`,
          },
          { rot: t("grafico.min"), val: `${hrMin} ${t("grafico.bpm")}` },
        ]}
        fmtTick={(v) => `${Math.round(v)}`}
        fmtHover={(v) => `${Math.round(v)} ${t("grafico.bpm")}`}
      />
    </div>
  );
}
