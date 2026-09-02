/** Parser do texto de estrutura de um treino planejado em segmentos ordenados.
 *
 * Exemplos que precisa cobrir:
 *   "5min Z1 · 30min Z2 · 5min Z1"
 *   "5min Z1 + 5min Z2 · 18min Z3 · 5min Z2 + 5min Z1"
 *   "2000m Z1 · 13000m Z2 · 1000m Z1"
 *   "3 x (2min Z4 + 2min Z1)"
 *   "10 x (30seg Z5 + 1min30seg Z1)"
 *   "500m Z1 · 500m Z2 · 3000m"   (último trecho sem zona)
 */

export interface SegmentoPlano {
  eixo: "tempo" | "dist";
  /** segundos (eixo tempo) ou metros (eixo dist) */
  valor: number;
  zona: string | null;
  /** texto original do trecho, para depuração/exibição */
  bruto: string;
}

const RE_REPEAT = /(\d+)\s*x\s*\(([^)]+)\)/gi;

function parseToken(raw: string): SegmentoPlano | null {
  const t = raw.trim();
  if (!t) return null;

  const zona = t.match(/Z[1-5]/i)?.[0].toUpperCase() ?? null;
  const semZona = t.replace(/Z[1-5]/i, " ").trim();

  const mMin = semZona.match(/(\d+)\s*min/i);
  const mSegExpl = semZona.match(/(\d+)\s*seg/i);
  const mSegAposMin = semZona.match(/min\s*(\d+)(?!\s*seg)/i);

  if (mMin || mSegExpl) {
    let sec = 0;
    if (mMin) sec += Number(mMin[1]) * 60;
    if (mSegExpl) sec += Number(mSegExpl[1]);
    else if (mSegAposMin) sec += Number(mSegAposMin[1]);
    if (sec > 0) return { eixo: "tempo", valor: sec, zona, bruto: t };
  }

  // distância: número seguido de "m" que NÃO é começo de "min"
  const md = semZona.match(/(\d+)\s*m(?!in)/i);
  if (md) return { eixo: "dist", valor: Number(md[1]), zona, bruto: t };

  return null;
}

export function parseEstrutura(estrutura: string | null): SegmentoPlano[] {
  if (!estrutura) return [];

  const grupos: SegmentoPlano[][] = [];
  const semGrupos = estrutura.replace(RE_REPEAT, (_m, n: string, inner: string) => {
    const rep = Number(n);
    const base = inner
      .split(/\s*\+\s*/)
      .map(parseToken)
      .filter((s): s is SegmentoPlano => s != null);
    const exp: SegmentoPlano[] = [];
    for (let i = 0; i < rep; i++) exp.push(...base);
    grupos.push(exp);
    return ` <<G${grupos.length - 1}>> `;
  });

  const out: SegmentoPlano[] = [];
  for (const parte of semGrupos.split(/\s*[·•+]\s*/)) {
    const g = parte.trim().match(/^<<G(\d+)>>$/);
    if (g) {
      out.push(...grupos[Number(g[1])]);
      continue;
    }
    const seg = parseToken(parte);
    if (seg) out.push(seg);
  }
  return out;
}

/** Sequência de zonas planejadas (uma por segmento). */
export function zonasDaEstrutura(estrutura: string | null): (string | null)[] {
  return parseEstrutura(estrutura).map((s) => s.zona);
}
