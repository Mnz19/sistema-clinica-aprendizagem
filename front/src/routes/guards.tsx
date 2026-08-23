/**
 * Guards de rota baseados no estado de autenticação.
 *
 * - `ProtectedRoute`: exige sessão; redireciona para `/login` guardando a rota
 *   de origem (para voltar a ela após o login).
 * - `PublicOnlyRoute`: para páginas como o login; se já houver sessão, manda
 *   para a home.
 */
import type { ReactNode } from "react"
import { Navigate, useLocation } from "react-router-dom"

import { useAuthStore } from "@/store/authStore"
import { podeVerLogs } from "@/types/auth"
import { temPapel, type Papel } from "@/types/auth"

interface GuardProps {
  children: ReactNode
}

export function ProtectedRoute({ children }: GuardProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const user = useAuthStore((s) => s.user)
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  // Troca de senha obrigatória no 1º acesso: bloqueia o resto do sistema.
  if (
    user?.precisa_trocar_senha &&
    location.pathname !== "/trocar-senha"
  ) {
    return <Navigate to="/trocar-senha" replace />
  }

  return <>{children}</>
}

export function PublicOnlyRoute({ children }: GuardProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

/**
 * Restringe uma rota a determinados papéis. Se o usuário autenticado não tiver
 * um papel permitido, é redirecionado para a home (não expõe a tela).
 */
export function RequerPapel({
  papeis,
  children,
}: GuardProps & { papeis: Papel[] }) {
  const user = useAuthStore((s) => s.user)

  if (!user || !temPapel(user, ...papeis)) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

/**
 * Restringe uma rota à trilha de auditoria: DIREÇÃO ou superusuário. Quem não
 * puder ver os logs é mandado para a home (não expõe a tela).
 */
export function RequerSuperadmin({ children }: GuardProps) {
  const user = useAuthStore((s) => s.user)

  if (!podeVerLogs(user)) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
