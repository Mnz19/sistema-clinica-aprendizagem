import { isRouteErrorResponse, useRouteError } from "react-router-dom"

import NotFoundPage from "@/pages/errors/NotFoundPage"
import ServerErrorPage from "@/pages/errors/ServerErrorPage"

/**
 * Fronteira de erro do roteador. É o `errorElement` da árvore de rotas e captura
 * tanto erros de renderização/loaders quanto respostas lançadas (`throw`).
 *
 * - Respostas 404 caem na página "não encontrado".
 * - Qualquer outra falha vira a página de erro do servidor (500), preservando o
 *   código HTTP real quando houver (502, 503, ...).
 */
export default function RouteErrorBoundary() {
  const error = useRouteError()

  // Ajuda a depurar em produção sem expor detalhes ao usuário.
  console.error("Erro de rota capturado:", error)

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      return <NotFoundPage />
    }
    return <ServerErrorPage code={String(error.status)} />
  }

  return <ServerErrorPage />
}
