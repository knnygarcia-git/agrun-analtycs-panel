import { useState, type FormEvent } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

export function LoginPage() {
  const { session, signIn } = useAuth();
  const { t, lang, setLang } = useI18n();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (session) {
    const to =
      (location.state as { from?: { pathname: string } } | null)?.from
        ?.pathname ?? "/";
    return <Navigate to={to} replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await signIn(email.trim(), password);
    setBusy(false);
    if (error) setError(traduzErro(error));
  }

  function traduzErro(msg: string): string {
    if (/invalid login credentials/i.test(msg)) return t("login.badCredentials");
    if (/email not confirmed/i.test(msg)) return t("login.notConfirmed");
    return msg;
  }

  return (
    <div className="login-wrap">
      <img
        className="login-logo"
        src="/logo/agrun-branco.png"
        alt="AGRUN"
        width={200}
      />
      <form className="login-card" onSubmit={onSubmit}>
        <div className="login-top">
          <div className="sub">{t("login.subtitle")}</div>
          <div className="lang-switch light">
            <button
              type="button"
              className={lang === "pt" ? "on" : ""}
              onClick={() => setLang("pt")}
            >
              PT
            </button>
            <button
              type="button"
              className={lang === "en" ? "on" : ""}
              onClick={() => setLang("en")}
            >
              EN
            </button>
          </div>
        </div>

        {error && <div className="login-error">{error}</div>}

        <div className="field">
          <label htmlFor="email">{t("login.email")}</label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="password">{t("login.password")}</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          style={{ width: "100%" }}
          disabled={busy}
        >
          {busy ? t("login.entering") : t("login.enter")}
        </button>
      </form>
    </div>
  );
}
