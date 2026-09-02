import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useT } from "@/lib/i18n";

export function Voltar({
  to,
  children,
}: {
  to: string;
  children?: ReactNode;
}) {
  const t = useT();
  return (
    <Link to={to} className="voltar-link">
      ← {children ?? t("common.back")}
    </Link>
  );
}
