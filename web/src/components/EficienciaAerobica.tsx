import type { TreinoExecutado } from "@/types/database";
import { useT } from "@/lib/i18n";
import { SecaoColapsavel } from "@/components/SecaoColapsavel";

const W = 640;
const H = 150;
const PAD_L = 46;
const PAD_R = 46;
const PAD_T = 14;
const PAD_B = 22;
const COR_EF = "#7BD88F";
const MAX_TICKS_X = 6;

function dominio(valores: number[]): [number, number] {
  const vMin = Math.min(...valores);
  const vMax = Math.max(...valores);
  const folga = vMax === vMin ? Math.max(0.001, vMin * 0.05) : (vMax - vMin) * 0.2;
  return [vMin - folga, vMax + folga];
}

/** índices igualmente espaçados (no máximo `max`) — evita rótulos do eixo X
 *  amontoados quando há muitos treinos com bloco Z2 */
function indicesTicks(n: number, max = MAX_TICKS_X): number[] {
  if (n <= max) return Array.from({ length: n }, (_, i) => i);
  const passo = (n - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => Math.round(i * passo));
}

/** Fator de eficiência aeróbica: velocidade (m/s) ÷ FC média, calculado só
 *  com as etapas de Z2 (base aeróbica) do treino. Quanto maior, melhor — o
 *  aluno corre mais rápido pra mesma FC, ou a mesma velocidade com FC menor.
 *  Por ser uma razão, dá pra comparar treinos com durações/volumes bem
 *  diferentes ao longo do tempo, sem precisar de um treino padronizado. */
function calcularEF(etapas: TreinoExecutado["etapas"]): number | null {
  const z2 = (etapas ?? []).filter(
    (e) => e.zona_planejada === "Z2" && e.fc_med != null && e.pace_sec != null && e.pace_sec > 0,
  );
  if (!z2.length) return null;
  const fcMedia = z2.reduce((s, e) => s + e.fc_med!, 0) / z2.length;
  const paceMedia = z2.reduce((s, e) => s + e.pace_sec!, 0) / z2.length;
  const velocidade = 1000 / paceMedia;
  return velocidade / fcMedia;
}

/** % de melhora — EF maior é sempre melhor, então (final - inicial) / inicial. */
function formatoMelhora(inicial: number, final: number): { texto: string; classe: string } {
  const pct = ((final - inicial) / inicial) * 100;
  if (Math.abs(pct) < 0.05) return { texto: "0%", classe: "neutro" };
  return {
    texto: `${pct > 0 ? "▲" : "▼"} ${Math.abs(pct).toFixed(1)}%`,
    classe: pct > 0 ? "up" : "down",
  };
}

/** Tendência do fator de eficiência aeróbica (pace ÷ FC nos blocos Z2) ao
 *  longo do histórico do aluno — independe do ciclo selecionado, mesma
 *  lógica de "aluno-wide" da Evolução do teste de 3km. Só aparece quando há
 *  pelo menos 2 treinos com bloco Z2 pra comparar; não é uma métrica que o
 *  coach edita, então some sozinha em vez de mostrar um placeholder vazio. */
export function EficienciaAerobica({
  execucoes,
}: {
  execucoes: Pick<TreinoExecutado, "data_execucao" | "etapas">[];
}) {
  const t = useT();

  const pontos = execucoes
    .map((e) => ({ data: e.data_execucao, ef: calcularEF(e.etapas) }))
    .filter((p): p is { data: string; ef: number } => p.ef != null)
    .sort((a, b) => a.data.localeCompare(b.data));

  if (pontos.length < 2) return null;

  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const dom = dominio(pontos.map((p) => p.ef));
  const sx = (i: number) => PAD_L + (i / (pontos.length - 1)) * plotW;
  const sy = (v: number) => PAD_T + (1 - (v - dom[0]) / (dom[1] - dom[0] || 1)) * plotH;
  const linha = pontos.map((p, i) => `${sx(i).toFixed(1)},${sy(p.ef).toFixed(1)}`).join(" ");
  const ticksY = [dom[0], (dom[0] + dom[1]) / 2, dom[1]];
  const ticksX = indicesTicks(pontos.length);
  const m = formatoMelhora(pontos[0].ef, pontos[pontos.length - 1].ef);

  return (
    <SecaoColapsavel
      chave="aluno.eficiencia"
      titulo={t("aluno.efficiencyTitle")}
      style={{ marginTop: 28 }}
    >
      <div className="grafico-card">
        <div className="grafico-row">
          <div className="grafico-stats">
            <div className="stat-line">
              <i className="grafico-dot" style={{ background: COR_EF }} />
              {t("aluno.efficiencyStat", { count: pontos.length })}
              <div>
                <span className={`evolucao-pct ${m.classe}`} title={t("aluno.efficiencyHint")}>
                  {m.texto}
                </span>
              </div>
            </div>
          </div>
          <div className="grafico-canvas grande">
            {ticksY.map((tk, i) => (
              <span
                key={i}
                className="grafico-tick"
                style={{ top: `calc(10px + ${sy(tk)}px)`, color: COR_EF }}
              >
                {tk.toFixed(3)}
              </span>
            ))}
            <svg className="grafico-svg alto" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
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
                stroke={COR_EF}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              {pontos.map((p, i) => (
                <circle key={i} cx={sx(i)} cy={sy(p.ef)} r={3.5} fill={COR_EF} />
              ))}
            </svg>
            {ticksX.map((i) => (
              <span key={i} className="grafico-tick-x" style={{ left: `${(sx(i) / W) * 100}%` }}>
                {pontos[i].data.slice(5)}
              </span>
            ))}
          </div>
        </div>
      </div>
    </SecaoColapsavel>
  );
}
