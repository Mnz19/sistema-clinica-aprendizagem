/** Página de cadastro (novo) e edição de serviço. */
import { useEffect, useMemo } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { ArrowLeftIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useClinicaStore } from "@/store/clinicaStore"
import type { Servico } from "@/types/clinica"
import { ServicoForm } from "@/features/servicos/components/ServicoForm"

export default function ServicoFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const editando = Boolean(id)

  const servicos = useClinicaStore((s) => s.servicos)
  const isLoading = useClinicaStore((s) => s.isLoading)
  const buscarServicos = useClinicaStore((s) => s.buscarServicos)
  const servico = useMemo<Servico | undefined>(
    () => (id ? servicos.find((s) => s.id === Number(id)) : undefined),
    [servicos, id]
  )

  useEffect(() => {
    if (editando) void buscarServicos()
  }, [editando, buscarServicos])

  function aoSalvar(salvo: Servico) {
    navigate(`/servicos/${salvo.id}`, { replace: true })
  }

  function aoCancelar() {
    navigate(editando && id ? `/servicos/${id}` : "/servicos")
  }

  if (editando && isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        Carregando…
      </div>
    )
  }

  if (editando && !servico) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/servicos")}>
          <ArrowLeftIcon className="size-4" /> Voltar
        </Button>
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          Serviço não encontrado.
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" onClick={aoCancelar}>
          <ArrowLeftIcon className="size-4" />
        </Button>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {editando ? "Editar serviço" : "Novo serviço"}
        </h1>
      </div>

      <ServicoForm servicoInicial={servico} onSalvo={aoSalvar} onCancelar={aoCancelar} />
    </div>
  )
}
