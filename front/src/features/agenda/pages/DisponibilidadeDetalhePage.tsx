/** Página de detalhe (somente leitura) da grade semanal de um profissional. */
import { useEffect, useMemo } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { ArrowLeftIcon, CalendarDaysIcon, PencilIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatarHorario } from "@/utils/format"
import { useClinicaStore } from "@/store/clinicaStore"
import { DIA_SEMANA_LABELS, nomeProfissional } from "@/types/clinica"
import type { Disponibilidade } from "@/types/clinica"

export default function DisponibilidadeDetalhePage() {
  const { profissionalId } = useParams()
  const navigate = useNavigate()

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

  const slotsAtivos = useMemo<Disponibilidade[]>(() => {
    if (idNumerico == null) return []
    return disponibilidades
      .filter((d) => d.profissional_id === idNumerico && d.ativo)
      .sort(
        (a, b) => a.dia_semana - b.dia_semana || a.horario_inicio.localeCompare(b.horario_inicio)
      )
  }, [disponibilidades, idNumerico])

  const slotsPorDia = useMemo(() => {
    const mapa = new Map<number, Disponibilidade[]>()
    for (const slot of slotsAtivos) {
      const lista = mapa.get(slot.dia_semana) ?? []
      lista.push(slot)
      mapa.set(slot.dia_semana, lista)
    }
    return Array.from(mapa.entries()).sort(([a], [b]) => a - b)
  }, [slotsAtivos])

  if (!idNumerico || (!isLoading && slotsAtivos.length === 0)) {
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon-sm" onClick={() => navigate("/agenda/disponibilidades")}>
            <ArrowLeftIcon className="size-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight text-foreground">
                {nomeProfissional(idNumerico, profissionais)}
              </h1>
              <Badge variant="success">Grade ativa</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {slotsPorDia.length} dia{slotsPorDia.length !== 1 ? "s" : ""} de atendimento ·{" "}
              {slotsAtivos.length} turno{slotsAtivos.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(`/agenda/disponibilidades/${idNumerico}/editar`)}
        >
          <PencilIcon className="size-4" /> Editar grade
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CalendarDaysIcon className="size-4 text-muted-foreground" />
            <CardTitle>Grade semanal</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {slotsPorDia.map(([diaSemana, turnos]) => (
            <div
              key={diaSemana}
              className="rounded-lg border border-border/60 bg-muted/20 px-4 py-3"
            >
              <p className="mb-2 text-sm font-medium text-foreground">
                {DIA_SEMANA_LABELS[diaSemana]}
              </p>
              <div className="flex flex-wrap gap-2">
                {turnos.map((turno) => (
                  <Badge key={turno.id} variant="secondary" className="font-normal">
                    {formatarHorario(turno.horario_inicio)} – {formatarHorario(turno.horario_fim)}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
