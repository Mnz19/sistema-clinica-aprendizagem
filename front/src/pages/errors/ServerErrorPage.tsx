import { useNavigate } from "react-router-dom"
import { HouseIcon, RotateCwIcon, ServerCrashIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import ErrorScreen from "@/pages/errors/ErrorScreen"

interface ServerErrorPageProps {
  /** Código a exibir (padrão 500); um erro pode chegar como 502, 503... */
  code?: string
}

/** Página 500 — falha inesperada no sistema ou no servidor. */
export default function ServerErrorPage({ code = "500" }: ServerErrorPageProps) {
  const navigate = useNavigate()

  return (
    <ErrorScreen
      code={code}
      icon={ServerCrashIcon}
      title="Algo deu errado"
      description={
        <>
          Tivemos um problema inesperado ao processar sua solicitação. Nossa
          equipe já foi notificada. Tente novamente em instantes — se o problema
          continuar, entre em contato com o suporte.
        </>
      }
      actions={
        <>
          <Button
            variant="outline"
            size="lg"
            onClick={() => navigate("/")}
            className="border-zinc-200"
          >
            <HouseIcon />
            Ir para o início
          </Button>
          <Button
            size="lg"
            onClick={() => window.location.reload()}
            className="bg-zinc-900 text-white hover:bg-zinc-800"
          >
            <RotateCwIcon />
            Recarregar página
          </Button>
        </>
      }
    />
  )
}
