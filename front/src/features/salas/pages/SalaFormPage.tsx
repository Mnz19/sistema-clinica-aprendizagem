/** Página de cadastro (nova) e edição de sala. */
import { useEffect, useMemo } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { ArrowLeftIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useClinicaStore } from "@/store/clinicaStore"
import type { Sala } from "@/types/clinica"
import { SalaForm } from "@/features/salas/components/SalaForm"

export default function SalaFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const editando = Boolean(id)

  const salas = useClinicaStore((s) => s.salas)
  const isLoading = useClinicaStore((s) => s.isLoading)
  const buscarSalas = useClinicaStore((s) => s.buscarSalas)
  const sala = useMemo<Sala | undefined>(
    () => (id ? salas.find((s) => s.id === Number(id)) : undefined),
    [salas, id]
  )

  useEffect(() => {
    if (editando) void buscarSalas()
  }, [editando, buscarSalas])

  function aoSalvar(salva: Sala) {
    navigate(`/salas/${salva.id}`, { replace: true })
  }

  function aoCancelar() {
    navigate(editando && id ? `/salas/${id}` : "/salas")
  }

  if (editando && isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        Carregando…
      </div>
    )
  }

  if (editando && !sala) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/salas")}>
          <ArrowLeftIcon className="size-4" /> Voltar
        </Button>
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          Sala não encontrada.
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
          {editando ? "Editar sala" : "Nova sala"}
        </h1>
      </div>

      <SalaForm salaInicial={sala} onSalvo={aoSalvar} onCancelar={aoCancelar} />
    </div>
  )
}
