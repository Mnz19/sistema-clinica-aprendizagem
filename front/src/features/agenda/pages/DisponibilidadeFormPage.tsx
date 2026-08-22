/** Página de cadastro (nova grade) e edição da grade semanal de um profissional. */
import { useEffect, useMemo } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { ArrowLeftIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useClinicaStore } from "@/store/clinicaStore"
import { nomeProfissional } from "@/types/clinica"
import { DisponibilidadeForm } from "@/features/agenda/components/DisponibilidadeForm"

export default function DisponibilidadeFormPage() {
  const { profissionalId } = useParams()
  const navigate = useNavigate()
  const editando = Boolean(profissionalId)

  const disponibilidades = useClinicaStore((s) => s.disponibilidades)
  const profissionais = useClinicaStore((s) => s.profissionais)
  const isLoading = useClinicaStore((s) => s.isLoading)
  const buscarDisponibilidades = useClinicaStore((s) => s.buscarDisponibilidades)
  const buscarProfissionais = useClinicaStore((s) => s.buscarProfissionais)
  const idNumerico = profissionalId ? Number(profissionalId) : undefined

  useEffect(() => {
    void buscarDisponibilidades()
    void buscarProfissionais()
  }, [buscarDisponibilidades, buscarProfissionais])

  const temGrade = useMemo(
    () =>
      idNumerico != null &&
      disponibilidades.some((d) => d.profissional_id === idNumerico && d.ativo),
    [disponibilidades, idNumerico]
  )

  function aoSalvar(salvoProfissionalId: number) {
    navigate(`/agenda/disponibilidades/${salvoProfissionalId}`, { replace: true })
  }

  function aoCancelar() {
    navigate(
      editando && profissionalId
        ? `/agenda/disponibilidades/${profissionalId}`
        : "/agenda/disponibilidades"
    )
  }

  if (editando && !isLoading && !temGrade) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/agenda/disponibilidades")}>
          <ArrowLeftIcon className="size-4" /> Voltar
        </Button>
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          Grade semanal não encontrada para este profissional.
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
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            {editando ? "Editar grade semanal" : "Nova grade semanal"}
          </h1>
          {editando && idNumerico != null && (
            <p className="text-sm text-muted-foreground">
              {nomeProfissional(idNumerico, profissionais)}
            </p>
          )}
        </div>
      </div>

      <DisponibilidadeForm
        profissionalId={idNumerico}
        onSalvo={aoSalvar}
        onCancelar={aoCancelar}
      />
    </div>
  )
}
