import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { pt, type TKey } from "./pt";
import { en } from "./en";

export type Lang = "pt" | "en";
export type { TKey };

const DICTS: Record<Lang, Record<string, string>> = { pt, en };
const STORAGE_KEY = "agrun.lang";

type Params = Record<string, string | number>;

function interpolate(raw: string, params?: Params): string {
  if (!params) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, p: string) =>
    params[p] != null ? String(params[p]) : `{${p}}`,
  );
}

interface I18nValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  /** traduz uma chave, com interpolação de {params} */
  t: (key: TKey, params?: Params) => string;
  /** plural: escolhe `${base}_one` (count === 1) ou `${base}_other` */
  tc: (base: string, count: number, params?: Params) => string;
}

const Ctx = createContext<I18nValue | null>(null);

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "pt" || saved === "en") return saved;
  } catch {
    /* localStorage indisponível */
  }
  return "pt";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignora */
    }
    try {
      document.documentElement.lang = l === "pt" ? "pt-BR" : "en";
    } catch {
      /* ignora */
    }
  }, []);

  const value = useMemo<I18nValue>(() => {
    const lookup = (key: string): string =>
      DICTS[lang][key] ?? DICTS.pt[key] ?? key;
    const t = (key: TKey, params?: Params) => interpolate(lookup(key), params);
    const tc = (base: string, count: number, params?: Params) =>
      interpolate(lookup(`${base}_${count === 1 ? "one" : "other"}`), {
        count,
        ...params,
      });
    return { lang, setLang, t, tc };
  }, [lang, setLang]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18nValue {
  const c = useContext(Ctx);
  if (!c) throw new Error("useI18n fora de <I18nProvider>");
  return c;
}

/** atalho: só a função de tradução */
export function useT() {
  return useI18n().t;
}
