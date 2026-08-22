/** Página de cadastro (novo) e edição de paciente. */
import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { ArrowLeftIcon, Loader2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { mensagemDeErro } from "@/utils/apiError"
import { obterPaciente } from "@/services/pacientes"
import type { Paciente } from "@/types/paciente"
import { PacienteForm } from "@/features/pacientes/components/PacienteForm"

export default function PacienteFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const editando = Boolean(id)

  const [paciente, setPaciente] = useState<Paciente | undefined>(undefined)
  const [carregando, setCarregando] = useState(editando)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    obterPaciente(Number(id))
      .then(setPaciente)
      .catch((e) => setErro(mensagemDeErro(e)))
      .finally(() => setCarregando(false))
  }, [id])

  function aoSalvar(salvo: Paciente) {
    navigate(`/pacientes/${salvo.id}`, { replace: true })
  }

  function aoCancelar() {
    navigate(editando && id ? `/pacientes/${id}` : "/pacientes")
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" onClick={aoCancelar}>
          <ArrowLeftIcon className="size-4" />
        </Button>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {editando ? "Editar paciente" : "Novo paciente"}
        </h1>
      </div>

      {carregando ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" /> Carregando…
        </div>
      ) : erro ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {erro}
        </div>
      ) : (
        <PacienteForm
          pacienteInicial={paciente}
          onSalvo={aoSalvar}
          onCancelar={aoCancelar}
        />
      )}
    </div>
  )
}
