import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { RequireAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";
import { LoginPage } from "@/pages/Login";
import { AppShell } from "@/components/AppShell";
import { HomePage } from "@/pages/Home";
import { NovoAlunoPage } from "@/pages/NovoAluno";
import { AlunoDetalhePage } from "@/pages/AlunoDetalhe";
import { EditarAlunoPage } from "@/pages/EditarAluno";
import { EditarCicloPage } from "@/pages/EditarCiclo";

// carrega SheetJS só quando o coach abre a importação
const ImportarPlanilhaPage = lazy(() =>
  import("@/pages/ImportarPlanilha").then((m) => ({ default: m.ImportarPlanilhaPage })),
);
// carrega o parser de .FIT só quando necessário
const ImportarFitPage = lazy(() =>
  import("@/pages/ImportarFit").then((m) => ({ default: m.ImportarFitPage })),
);
const TreinoDetalhePage = lazy(() =>
  import("@/pages/TreinoDetalhe").then((m) => ({ default: m.TreinoDetalhePage })),
);

export function App() {
  const t = useT();
  const carregando = (
    <div style={{ color: "var(--muted)" }}>{t("common.loading")}</div>
  );
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={<HomePage />} />
        <Route path="alunos/novo" element={<NovoAlunoPage />} />
        <Route path="aluno/:id" element={<AlunoDetalhePage />} />
        <Route path="aluno/:id/editar" element={<EditarAlunoPage />} />
        <Route
          path="aluno/:id/ciclo/:cicloId/editar"
          element={<EditarCicloPage />}
        />
        <Route
          path="aluno/:id/treino/:execId"
          element={
            <Suspense fallback={carregando}>
              <TreinoDetalhePage />
            </Suspense>
          }
        />
        <Route
          path="importar"
          element={
            <Suspense fallback={carregando}>
              <ImportarPlanilhaPage />
            </Suspense>
          }
        />
        <Route
          path="importar-fit"
          element={
            <Suspense fallback={carregando}>
              <ImportarFitPage />
            </Suspense>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
