import { useNavigate } from "react-router-dom"
import { ArrowLeftIcon, CompassIcon, HouseIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import ErrorScreen from "@/pages/errors/ErrorScreen"

/** Página 404 — rota inexistente ou recurso não encontrado. */
export default function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <ErrorScreen
      code="404"
      icon={CompassIcon}
      title="Página não encontrada"
      description={
        <>
          O endereço que você tentou acessar não existe, foi movido ou o link
          está incorreto. Confira o endereço ou volte para uma área conhecida.
        </>
      }
      actions={
        <>
          <Button
            variant="outline"
            size="lg"
            onClick={() => navigate(-1)}
          >
            <ArrowLeftIcon />
            Voltar
          </Button>
          <Button
            size="lg"
            onClick={() => navigate("/")}
          >
            <HouseIcon />
            Ir para o início
          </Button>
        </>
      }
    />
  )
}
