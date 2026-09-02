import { useT, type TKey } from "@/lib/i18n";

/* Os nomes de etapa são gerados pelo nosso código (parse.ts), não vêm da
   planilha — então são traduzidos. Formato salvo: "<base>" ou
   "<base> — km N" ou "<base> — resto". */

const BASE_KEY: Record<string, string> = {
  Aquecimento: "etapa.warmup",
  Ativo: "etapa.active",
  Esfriar: "etapa.cooldown",
  Intervalo: "etapa.interval",
  Recuperação: "etapa.recovery",
  Etapa: "etapa.generic",
};

export function localizarEtapa(
  nome: string,
  t: ReturnType<typeof useT>,
): string {
  const [base, sufixo] = nome.split(" — ");
  const key = BASE_KEY[base];
  const baseTxt = key ? t(key as TKey) : base;
  if (!sufixo) return baseTxt;
  const m = sufixo.match(/^km\s+(\d+)$/i);
  if (m) return `${baseTxt} — ${t("etapa.km", { n: m[1] })}`;
  if (/^resto$/i.test(sufixo)) return `${baseTxt} — ${t("etapa.rest")}`;
  return `${baseTxt} — ${sufixo}`;
}

export function NomeEtapa({ nome }: { nome: string }) {
  const t = useT();
  return <>{localizarEtapa(nome, t)}</>;
}
