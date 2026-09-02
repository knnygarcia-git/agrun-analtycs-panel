export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** segundos -> "M:SS" ou "H:MM:SS" */
export function fmtSec(total: number | null | undefined): string {
  if (total == null || !Number.isFinite(total)) return "—";
  const s = Math.round(total);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return h > 0 ? `${h}:${pad2(m)}:${pad2(ss)}` : `${m}:${pad2(ss)}`;
}

/** "M:SS" / "MM:SS" / "H:MM:SS" -> segundos. null se vazio ou inválido. */
export function parseTempo(txt: string): number | null {
  const t = txt.trim();
  if (!t) return null;
  const partes = t.split(":").map((p) => Number(p));
  if (partes.some((n) => !Number.isFinite(n) || n < 0)) return null;
  if (partes.length === 2) return partes[0] * 60 + partes[1];
  if (partes.length === 3) return partes[0] * 3600 + partes[1] * 60 + partes[2];
  return null;
}
