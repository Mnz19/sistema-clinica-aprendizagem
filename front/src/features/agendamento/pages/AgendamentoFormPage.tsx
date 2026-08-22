/** Página de cadastro de novo agendamento. */
import { useNavigate } from "react-router-dom"
import { ArrowLeftIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { Agendamento } from "@/types/agendamento"
import { AgendamentoForm } from "@/features/agendamento/components/AgendamentoForm"

export default function AgendamentoFormPage() {
  const navigate = useNavigate()

  function aoSalvar(_agendamento: Agendamento) {
    navigate("/agenda/agendamentos", { replace: true })
  }

  function aoCancelar() {
    navigate("/agenda/agendamentos")
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" onClick={aoCancelar}>
          <ArrowLeftIcon className="size-4" />
        </Button>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Novo agendamento</h1>
      </div>

      <AgendamentoForm onSalvo={aoSalvar} onCancelar={aoCancelar} />
    </div>
  )
}
