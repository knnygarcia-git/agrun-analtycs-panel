import { useMemo, useRef, useState } from "react";
import type { PontoSerie } from "@/lib/fit/serie";
import { faixaPlanejada } from "@/lib/fit/serie";
import type { FaixaZona } from "@/lib/fit/zones";
import { fmtSec } from "@/lib/format";
import { useT } from "@/lib/i18n";

const COR_ZONA: Record<string, string> = {
  Z1: "#4C8CFF",
  Z2: "#35B7A0",
  Z3: "#E8C547",
  Z4: "#F2874A",
  Z5: "#E23B3B",
};
const COR_REAL = "#7BD88F";

const W = 680;
const H = 190;
const PAD_L = 40;
const PAD_R = 10;
const PAD_T = 10;
const PAD_B = 22;

export function GraficoPlanoRealizado({
  serie,
  faixas,
  estrutura,
}: {
  serie: PontoSerie[];
  faixas: FaixaZona[];
  estrutura: string | null;
}) {
  const t = useT();
  const [eixo, setEixo] = useState<"tempo" | "dist">("tempo");
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const dados = useMemo(() => {
    const xDe = (p: PontoSerie) => (eixo === "tempo" ? p.t : p.dist);
    const pts = serie
      .map((p) => ({ x: xDe(p), pace: p.paceSec, hr: p.hr }))
      .filter((p) => p.pace != null) as { x: number; pace: number; hr: number | null }[];
    if (!pts.length) return null;

    const xMax = Math.max(...pts.map((p) => p.x), 1);
    const bandas = faixaPlanejada(estrutura, faixas, eixo, serie);
    const bandaMax = bandas.length ? bandas[bandas.length - 1].x1 : 0;

    const paces = pts.map((p) => p.pace);
    const bandPaces = bandas.flatMap((b) =>
      [b.rapidoSec, b.lentoSec].filter((n): n is number => n != null),
    );
    const pMin = Math.min(...paces, ...bandPaces);
    const pMax = Math.max(...paces.filter((p) => p < 660), ...bandPaces, pMin + 60);
    const domY: [number, number] = [Math.max(150, pMin - 15), pMax + 15];

    return { pts, xMax: Math.max(xMax, bandaMax), bandas, domY };
  }, [serie, faixas, estrutura, eixo]);

  if (!dados) {
    return (
      <div className="grafico-card">
        <div style={{ padding: 16, color: "var(--muted-2)", fontSize: 12 }}>
          {t("grafico.noPaceSeries")}
        </div>
      </div>
    );
  }

  const { pts, xMax, bandas, domY } = dados;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const sx = (x: number) => PAD_L + (x / xMax) * plotW;
  const sy = (p: number) =>
    PAD_T + ((p - domY[0]) / (domY[1] - domY[0] || 1)) * plotH;

  const linha = pts.map((p) => `${sx(p.x).toFixed(1)},${sy(p.pace).toFixed(1)}`).join(" ");

  const fmtX = (x: number) =>
    eixo === "tempo" ? fmtSec(x) : `${(x / 1000).toFixed(2)} ${t("etapas.km").toLowerCase()}`;

  const ticksY = [domY[0], (domY[0] + domY[1]) / 2, domY[1]];
  const ticksX = [0, xMax / 2, xMax];

  function onMove(e: React.MouseEvent) {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vbX = ((e.clientX - rect.left) / rect.width) * W;
    const xData = ((vbX - PAD_L) / plotW) * xMax;
    let melhor = 0;
    let dist = Infinity;
    pts.forEach((p, i) => {
      const d = Math.abs(p.x - xData);
      if (d < dist) {
        dist = d;
        melhor = i;
      }
    });
    setHover(melhor);
  }

  const hp = hover != null ? pts[hover] : null;
  const hoverBanda =
    hp != null ? bandas.find((b) => hp.x >= b.x0 && hp.x <= b.x1) : null;

  return (
    <div className="grafico-card">
      <div className="grafico-topo">
        <span className="grafico-titulo">{t("grafico.planVsReal")}</span>
        <div className="toggle-eixo">
          <button
            className={eixo === "tempo" ? "on" : ""}
            onClick={() => setEixo("tempo")}
          >
            {t("grafico.time")}
          </button>
          <button
            className={eixo === "dist" ? "on" : ""}
            onClick={() => setEixo("dist")}
          >
            {t("grafico.distance")}
          </button>
        </div>
      </div>

      <div
        className="grafico-canvas grande"
        ref={wrapRef}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        {ticksY.map((t, i) => (
          <span key={i} className="grafico-tick" style={{ top: `${sy(t)}px` }}>
            {fmtSec(Math.round(t))}
          </span>
        ))}

        <svg
          className="grafico-svg alto"
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
        >
          {/* bandas planejadas */}
          {bandas.map((b, i) => {
            if (b.zona == null || (b.rapidoSec == null && b.lentoSec == null))
              return null;
            const cor = (b.zona && COR_ZONA[b.zona]) || "#8B94A3";
            // Z5 não tem limite rápido → banda sobe até o topo do gráfico;
            // Z1 não tem limite lento → banda desce até a base.
            const yTop = sy(b.rapidoSec ?? domY[0]);
            const yBot = sy(b.lentoSec ?? domY[1]);
            return (
              <rect
                key={i}
                x={sx(b.x0)}
                y={yTop}
                width={Math.max(0, sx(b.x1) - sx(b.x0))}
                height={Math.max(0, yBot - yTop)}
                fill={cor}
                fillOpacity={0.18}
                stroke={cor}
                strokeOpacity={0.35}
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}

          {/* grade y */}
          {ticksY.map((t, i) => (
            <line
              key={i}
              x1={PAD_L}
              y1={sy(t)}
              x2={W - PAD_R}
              y2={sy(t)}
              stroke="#2C3541"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {/* linha realizada */}
          <polyline
            points={linha}
            fill="none"
            stroke={COR_REAL}
            strokeWidth={1.6}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />

          {/* crosshair */}
          {hp && (
            <>
              <line
                x1={sx(hp.x)}
                y1={PAD_T}
                x2={sx(hp.x)}
                y2={H - PAD_B}
                stroke="#EDEFF2"
                strokeOpacity={0.4}
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
              <circle cx={sx(hp.x)} cy={sy(hp.pace)} r={3.2} fill={COR_REAL} />
            </>
          )}
        </svg>

        {ticksX.map((t, i) => (
          <span
            key={i}
            className="grafico-tick-x"
            style={{ left: `${(sx(t) / W) * 100}%` }}
          >
            {fmtX(t)}
          </span>
        ))}

        {hp && (
          <div
            className="grafico-tooltip"
            style={{
              left: `${Math.min(80, (sx(hp.x) / W) * 100)}%`,
            }}
          >
            <div className="tt-x">{fmtX(hp.x)}</div>
            <div>
              {t("grafico.paceLabel")}{" "}
              <b>
                {fmtSec(hp.pace)}
                {t("grafico.perKm")}
              </b>
            </div>
            {hp.hr != null && (
              <div>
                {t("grafico.hrLabel")} <b>{hp.hr} {t("grafico.bpm")}</b>
              </div>
            )}
            {hoverBanda?.zona &&
              (hoverBanda.rapidoSec != null || hoverBanda.lentoSec != null) && (
                <div className="tt-plano">
                  {t("grafico.planLabel", {
                    zona: hoverBanda.zona,
                    rapido:
                      hoverBanda.rapidoSec != null
                        ? fmtSec(hoverBanda.rapidoSec)
                        : t("aluno.max"),
                    lento:
                      hoverBanda.lentoSec != null
                        ? fmtSec(hoverBanda.lentoSec)
                        : t("aluno.max"),
                  })}
                </div>
              )}
          </div>
        )}
      </div>

      <div className="grafico-legenda">
        <span>
          <i style={{ background: COR_REAL }} /> {t("grafico.legendReal")}
        </span>
        <span>
          <i style={{ background: "#35B7A0", opacity: 0.4 }} />{" "}
          {t("grafico.legendPlanned")}
        </span>
      </div>
    </div>
  );
}
