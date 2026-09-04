import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import type { Aluno } from "@/types/database";
import {
  IconeNovoAluno,
  IconeImportarPlanilha,
  IconeImportarFit,
  IconeMenu,
} from "@/components/icons";

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  const primeira = partes[0]?.[0] ?? "";
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return (primeira + ultima).toUpperCase();
}

const itemCls = ({ isActive }: { isActive: boolean }) =>
  "athlete-item" + (isActive ? " active" : "");

export function AppShell() {
  const { session, signOut } = useAuth();
  const { t, lang, setLang } = useI18n();
  const location = useLocation();
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [menuAberto, setMenuAberto] = useState(false);

  // re-busca ao trocar de rota, para a lista refletir um aluno recém-criado/editado
  useEffect(() => {
    supabase
      .from("aluno")
      .select("*")
      .order("nome")
      .then(({ data, error }) => {
        if (error) setErro(error.message);
        else setAlunos(data ?? []);
      });
  }, [location.pathname]);

  // fecha o menu off-canvas (tablet/celular) sempre que a rota muda
  useEffect(() => {
    setMenuAberto(false);
  }, [location.pathname]);

  return (
    <div className="app-shell">
      <div className="topbar">
        <button
          type="button"
          className="topbar-menu-btn"
          onClick={() => setMenuAberto(true)}
          aria-label={t("nav.openMenu")}
        >
          <IconeMenu />
        </button>
        <img className="topbar-logo" src="/logo/agrun-branco.png" alt="AGRUN" />
      </div>

      <div
        className={"sidebar-backdrop" + (menuAberto ? " visivel" : "")}
        onClick={() => setMenuAberto(false)}
      />

      <aside className={"sidebar" + (menuAberto ? " aberta" : "")}>
        <div className="sidebar-brand">
          <Link to="/">
            <img className="brand-logo" src="/logo/agrun-branco.png" alt="AGRUN" width={128} />
          </Link>
          <div className="sub">{t("nav.subtitle")}</div>
        </div>

        <nav className="athlete-list">
          {erro && (
            <div className="athlete-empty">{t("nav.loadError", { msg: erro })}</div>
          )}
          {!erro && alunos.length === 0 && (
            <div className="athlete-empty">{t("nav.noAthletes")}</div>
          )}
          {alunos.map((a) => (
            <NavLink key={a.id} to={`/aluno/${a.id}`} className={itemCls}>
              <span className="avatar">{iniciais(a.nome)}</span>
              <span className="name">{a.nome}</span>
            </NavLink>
          ))}

          <div className="sidebar-sep" />

          <NavLink to="/alunos/novo" className={itemCls}>
            <span className="avatar avatar-acao">
              <IconeNovoAluno />
            </span>
            <span className="name">{t("nav.newAthlete")}</span>
          </NavLink>
          <NavLink to="/importar" className={itemCls}>
            <span className="avatar avatar-acao">
              <IconeImportarPlanilha />
            </span>
            <span className="name">{t("nav.importPlan")}</span>
          </NavLink>
          <NavLink to="/importar-fit" className={itemCls}>
            <span className="avatar avatar-acao">
              <IconeImportarFit />
            </span>
            <span className="name">{t("nav.importFit")}</span>
          </NavLink>
        </nav>

        <div className="sidebar-foot">
          <div className="lang-switch" role="group" aria-label={t("nav.language")}>
            <button
              className={lang === "pt" ? "on" : ""}
              onClick={() => setLang("pt")}
            >
              PT
            </button>
            <button
              className={lang === "en" ? "on" : ""}
              onClick={() => setLang("en")}
            >
              EN
            </button>
          </div>
          <div className="who">{session?.user.email}</div>
          <button className="btn btn-ghost" onClick={() => signOut()}>
            {t("nav.signOut")}
          </button>
        </div>
      </aside>

      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
