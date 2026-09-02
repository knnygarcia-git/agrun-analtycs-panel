import { Link } from "react-router-dom";
import { useT } from "@/lib/i18n";

export function HomePage() {
  const t = useT();
  return (
    <>
      <div className="page-header">
        <div>
          <h1>{t("home.title")}</h1>
          <div className="meta">{t("home.subtitle")}</div>
        </div>
      </div>

      <div className="section-title">{t("home.start")}</div>
      <div className="placeholder-box">
        <Link to="/alunos/novo">{t("home.startHintNewAthlete")}</Link>
        {" — "}
        {t("home.startHint")}
      </div>
    </>
  );
}
