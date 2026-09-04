import { useState, type ReactNode } from "react";

const CHAVE_PREFIXO = "agrun.secao.";

function lerEstado(chave: string, padrao: boolean): boolean {
  try {
    const v = localStorage.getItem(CHAVE_PREFIXO + chave);
    return v == null ? padrao : v === "1";
  } catch {
    return padrao;
  }
}

function salvarEstado(chave: string, aberto: boolean) {
  try {
    localStorage.setItem(CHAVE_PREFIXO + chave, aberto ? "1" : "0");
  } catch {
    /* localStorage indisponível — a preferência só não persiste */
  }
}

/** Seção com título recolhível — lembra a escolha (aberta/fechada) no
 *  navegador, entre alunos e entre sessões, pra reduzir o scroll em
 *  páginas com muita coisa. `chave` deve ser única por seção (ex:
 *  "aluno.zonas"). `acoes` some quando a seção está fechada. */
export function SecaoColapsavel({
  chave,
  titulo,
  acoes,
  abertoPorPadrao = true,
  style,
  children,
}: {
  chave: string;
  titulo: ReactNode;
  acoes?: ReactNode;
  abertoPorPadrao?: boolean;
  style?: React.CSSProperties;
  children: ReactNode;
}) {
  const [aberto, setAberto] = useState(() => lerEstado(chave, abertoPorPadrao));

  function alternar() {
    setAberto((a) => {
      const novo = !a;
      salvarEstado(chave, novo);
      return novo;
    });
  }

  return (
    <div style={style}>
      <div className="secao-colapsavel-header">
        <button
          type="button"
          className="secao-colapsavel-toggle"
          onClick={alternar}
          aria-expanded={aberto}
        >
          <span className={`secao-colapsavel-seta ${aberto ? "aberta" : ""}`}>▸</span>
          <span className="section-title" style={{ marginBottom: 0 }}>
            {titulo}
          </span>
        </button>
        {aberto && acoes}
      </div>
      {aberto && <div className="secao-colapsavel-corpo">{children}</div>}
    </div>
  );
}
