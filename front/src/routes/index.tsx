import type { ReactNode } from "react"
import { createBrowserRouter, Navigate } from "react-router-dom"

import Login from "@/pages/Login.tsx"
import AuthLayout from "@/layouts/AuthLayout"
import MainLayout from "@/layouts/MainLayout.tsx"
import {
  ProtectedRoute,
  PublicOnlyRoute,
  RequerPapel,
  RequerSuperadmin,
} from "@/routes/guards"
import PacientesListPage from "@/features/pacientes/pages/PacientesListPage"
import PacienteFormPage from "@/features/pacientes/pages/PacienteFormPage"
import PacienteDetalhePage from "@/features/pacientes/pages/PacienteDetalhePage"
import SalasListPage from "@/features/salas/pages/SalasListPage"
import SalaFormPage from "@/features/salas/pages/SalaFormPage"
import SalaDetalhePage from "@/features/salas/pages/SalaDetalhePage"
import OcupacaoSalasPage from "@/features/salas/pages/OcupacaoSalasPage"
import ServicosListPage from "@/features/servicos/pages/ServicosListPage"
import ServicoFormPage from "@/features/servicos/pages/ServicoFormPage"
import ServicoDetalhePage from "@/features/servicos/pages/ServicoDetalhePage"
import DisponibilidadesListPage from "@/features/agenda/pages/DisponibilidadesListPage"
import DisponibilidadeFormPage from "@/features/agenda/pages/DisponibilidadeFormPage"
import DisponibilidadeDetalhePage from "@/features/agenda/pages/DisponibilidadeDetalhePage"
import AusenciasListPage from "@/features/agenda/pages/AusenciasListPage"
import AusenciaFormPage from "@/features/agenda/pages/AusenciaFormPage"
import AusenciaDetalhePage from "@/features/agenda/pages/AusenciaDetalhePage"
import AgendamentosListPage from "@/features/agendamento/pages/AgendamentosListPage"
import AgendamentoFormPage from "@/features/agendamento/pages/AgendamentoFormPage"
import AgendaVisualPage from "@/features/agendamento/pages/AgendaVisualPage"
import FilaEsperaPage from "@/features/fila-espera/pages/FilaEsperaPage"
import ProducaoListPage from "@/features/producao/pages/ProducaoListPage"
import RelatoriosPage from "@/features/relatorios/pages/RelatoriosPage"
import UsuariosListPage from "@/features/usuarios/pages/UsuariosListPage"
import EspecialidadesListPage from "@/features/especialidades/pages/EspecialidadesListPage"
import ConfirmacaoConfigPage from "@/features/whatsapp/pages/ConfirmacaoConfigPage"
import ProntuariosListPage from "@/features/prontuario/pages/ProntuariosListPage"
import ProntuarioPacientePage from "@/features/prontuario/pages/ProntuarioPacientePage"
import ImpressaoProntuarioPage from "@/features/prontuario/pages/ImpressaoProntuarioPage"
import ImpressaoAtestadoPage from "@/features/prontuario/pages/ImpressaoAtestadoPage"
import ConfiguracaoProntuarioPage from "@/features/prontuario/pages/ConfiguracaoProntuarioPage"
import PerfilPage from "@/features/perfil/pages/PerfilPage"
import TrocarSenhaObrigatoriaPage from "@/features/perfil/pages/TrocarSenhaObrigatoriaPage"
import ConvitePage from "@/features/perfil/pages/ConvitePage"
import DashboardPage from "@/features/dashboard/pages/DashboardPage"
import LogsPage from "@/features/logs/pages/LogsPage"
import NotFoundPage from "@/pages/errors/NotFoundPage"
import RouteErrorBoundary from "@/pages/errors/RouteErrorBoundary"
import { PAPEIS_GESTORES } from "@/types/usuario"
import { PAPEIS_CONFIG_WHATSAPP } from "@/types/whatsapp"
import { PAPEIS_PRONTUARIO, PAPEIS_CONFIG_PRONTUARIO } from "@/types/prontuario"

/** Envolve um elemento na área autenticada (guarda + layout principal). */
function protegido(elemento: ReactNode) {
  return (
    <ProtectedRoute>
      <MainLayout>{elemento}</MainLayout>
    </ProtectedRoute>
  )
}

const router = createBrowserRouter([
  {
    // Rota-mãe sem caminho: centraliza a fronteira de erro (500) para toda a
    // árvore e o "catch-all" 404 no fim. Sem `element`, o RR renderiza o Outlet.
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        path: "/login",
        element: (
          <PublicOnlyRoute>
            <AuthLayout>
              <Login />
            </AuthLayout>
          </PublicOnlyRoute>
        ),
      },
      {
        path: "/",
        element: protegido(<DashboardPage />),
      },
      {
        path: "/pacientes",
        element: protegido(<PacientesListPage />),
      },
      {
        path: "/pacientes/novo",
        element: protegido(<PacienteFormPage />),
      },
      {
        path: "/pacientes/:id",
        element: protegido(<PacienteDetalhePage />),
      },
      {
        path: "/pacientes/:id/editar",
        element: protegido(<PacienteFormPage />),
      },
      {
        path: "/salas",
        element: protegido(<SalasListPage />),
      },
      {
        path: "/ocupacao",
        element: protegido(<OcupacaoSalasPage />),
      },
      {
        path: "/salas/novo",
        element: protegido(<SalaFormPage />),
      },
      {
        path: "/salas/:id",
        element: protegido(<SalaDetalhePage />),
      },
      {
        path: "/salas/:id/editar",
        element: protegido(<SalaFormPage />),
      },
      {
        path: "/servicos",
        element: protegido(<ServicosListPage />),
      },
      {
        path: "/servicos/novo",
        element: protegido(<ServicoFormPage />),
      },
      {
        path: "/servicos/:id",
        element: protegido(<ServicoDetalhePage />),
      },
      {
        path: "/servicos/:id/editar",
        element: protegido(<ServicoFormPage />),
      },
      {
        // "Agenda" redireciona para o calendário visual (visão principal da recepção).
        path: "/agenda",
        element: <Navigate to="/agenda/calendario" replace />,
      },
      {
        path: "/agenda/calendario",
        element: protegido(<AgendaVisualPage />),
      },
      {
        path: "/agenda/disponibilidades",
        element: protegido(<DisponibilidadesListPage />),
      },
      {
        path: "/agenda/disponibilidades/novo",
        element: protegido(<DisponibilidadeFormPage />),
      },
      {
        path: "/agenda/disponibilidades/:profissionalId/editar",
        element: protegido(<DisponibilidadeFormPage />),
      },
      {
        path: "/agenda/disponibilidades/:profissionalId",
        element: protegido(<DisponibilidadeDetalhePage />),
      },
      {
        path: "/agenda/ausencias",
        element: protegido(<AusenciasListPage />),
      },
      {
        path: "/agenda/ausencias/novo",
        element: protegido(<AusenciaFormPage />),
      },
      {
        path: "/agenda/ausencias/:id",
        element: protegido(<AusenciaDetalhePage />),
      },
      {
        path: "/agenda/ausencias/:id/editar",
        element: protegido(<AusenciaFormPage />),
      },
      {
        path: "/agenda/agendamentos",
        element: protegido(<AgendamentosListPage />),
      },
      {
        path: "/agenda/fila-espera",
        element: protegido(<FilaEsperaPage />),
      },
      {
        path: "/agenda/agendamentos/novo",
        element: protegido(<AgendamentoFormPage />),
      },
      {
        path: "/prontuarios",
        element: protegido(
          <RequerPapel papeis={PAPEIS_PRONTUARIO}>
            <ProntuariosListPage />
          </RequerPapel>
        ),
      },
      {
        path: "/prontuarios/configuracao",
        element: protegido(
          <RequerPapel papeis={PAPEIS_CONFIG_PRONTUARIO}>
            <ConfiguracaoProntuarioPage />
          </RequerPapel>
        ),
      },
      {
        path: "/prontuarios/:id",
        element: protegido(
          <RequerPapel papeis={PAPEIS_PRONTUARIO}>
            <ProntuarioPacientePage />
          </RequerPapel>
        ),
      },
      {
        // Versão de impressão: sem o layout principal (mais limpa para o papel).
        path: "/prontuarios/:id/impressao",
        element: (
          <ProtectedRoute>
            <RequerPapel papeis={PAPEIS_PRONTUARIO}>
              <ImpressaoProntuarioPage />
            </RequerPapel>
          </ProtectedRoute>
        ),
      },
      {
        // Impressão de um atestado gerado (sem layout principal).
        path: "/prontuarios/:id/atestado/:atestadoId/impressao",
        element: (
          <ProtectedRoute>
            <RequerPapel papeis={PAPEIS_PRONTUARIO}>
              <ImpressaoAtestadoPage />
            </RequerPapel>
          </ProtectedRoute>
        ),
      },
      {
        path: "/producao",
        element: protegido(<ProducaoListPage />),
      },
      {
        path: "/relatorios",
        element: protegido(<RelatoriosPage />),
      },
      {
        path: "/usuarios",
        element: protegido(
          <RequerPapel papeis={PAPEIS_GESTORES}>
            <UsuariosListPage />
          </RequerPapel>
        ),
      },
      {
        path: "/especialidades",
        element: protegido(
          <RequerPapel papeis={PAPEIS_GESTORES}>
            <EspecialidadesListPage />
          </RequerPapel>
        ),
      },
      {
        path: "/confirmacoes",
        element: protegido(
          <RequerPapel papeis={PAPEIS_CONFIG_WHATSAPP}>
            <ConfirmacaoConfigPage />
          </RequerPapel>
        ),
      },
      {
        path: "/logs",
        element: protegido(
          <RequerSuperadmin>
            <LogsPage />
          </RequerSuperadmin>
        ),
      },
      {
        path: "/perfil",
        element: protegido(<PerfilPage />),
      },
      {
        // Troca de senha obrigatória: exige sessão, mas sem o layout principal.
        path: "/trocar-senha",
        element: (
          <ProtectedRoute>
            <TrocarSenhaObrigatoriaPage />
          </ProtectedRoute>
        ),
      },
      {
        // Aceitação de convite (público, via link de e-mail).
        path: "/convite",
        element: <ConvitePage />,
      },
      {
        path: "/paciente/:token",
        element: <div>Área do Paciente (Exame)</div>,
      },
      {
        // Catch-all: qualquer rota desconhecida cai na página 404.
        path: "*",
        element: <NotFoundPage />,
      },
    ],
  },
])

export default router
