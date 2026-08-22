/** Página de cadastro (nova) e edição de ausência de profissional. */
import { useEffect, useMemo } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { ArrowLeftIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useClinicaStore } from "@/store/clinicaStore"
import type { Ausencia } from "@/types/clinica"
import { AusenciaForm } from "@/features/agenda/components/AusenciaForm"

export default function AusenciaFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const editando = Boolean(id)

  const ausencias = useClinicaStore((s) => s.ausencias)
  const isLoading = useClinicaStore((s) => s.isLoading)
  const buscarAusencias = useClinicaStore((s) => s.buscarAusencias)
  const ausencia = useMemo<Ausencia | undefined>(
    () => (id ? ausencias.find((a) => a.id === Number(id)) : undefined),
    [ausencias, id]
  )

  useEffect(() => {
    if (editando) void buscarAusencias()
  }, [editando, buscarAusencias])

  function aoSalvar(salva: Ausencia) {
    navigate(`/agenda/ausencias/${salva.id}`, { replace: true })
  }

  function aoCancelar() {
    navigate(editando && id ? `/agenda/ausencias/${id}` : "/agenda/ausencias")
  }

  if (editando && isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        Carregando…
      </div>
    )
  }

  if (editando && !ausencia) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/agenda/ausencias")}>
          <ArrowLeftIcon className="size-4" /> Voltar
        </Button>
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          Ausência não encontrada.
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
          {editando ? "Editar ausência" : "Nova ausência"}
        </h1>
      </div>

      <AusenciaForm ausenciaInicial={ausencia} onSalvo={aoSalvar} onCancelar={aoCancelar} />
    </div>
  )
}
