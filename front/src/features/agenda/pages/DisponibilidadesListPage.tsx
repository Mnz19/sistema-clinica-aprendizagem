/** Página de listagem das grades semanais de disponibilidade, agrupadas por profissional. */
import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { CalendarDaysIcon, EyeIcon, PencilIcon, PlusIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useClinicaStore } from "@/store/clinicaStore"
import { DIA_SEMANA_ABREV, nomeProfissional } from "@/types/clinica"

interface GradeResumo {
  profissional_id: number
  diasAtendimento: number[]
}

export default function DisponibilidadesListPage() {
  const navigate = useNavigate()
  const disponibilidades = useClinicaStore((s) => s.disponibilidades)
  const profissionais = useClinicaStore((s) => s.profissionais)
  const erro = useClinicaStore((s) => s.erro)
  const buscarDisponibilidades = useClinicaStore((s) => s.buscarDisponibilidades)
  const buscarProfissionais = useClinicaStore((s) => s.buscarProfissionais)

  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setCarregando(true)
      Promise.all([buscarDisponibilidades(), buscarProfissionais()]).finally(() =>
        setCarregando(false)
      )
    }, 300)
    return () => clearTimeout(timer)
  }, [buscarDisponibilidades, buscarProfissionais])

  const gradesPorProfissional = useMemo(() => {
    const mapa = new Map<number, Set<number>>()

    for (const disp of disponibilidades) {
      if (!disp.ativo) continue
      const dias = mapa.get(disp.profissional_id) ?? new Set<number>()
      dias.add(disp.dia_semana)
      mapa.set(disp.profissional_id, dias)
    }

    const grades: GradeResumo[] = Array.from(mapa.entries()).map(([profissional_id, dias]) => ({
      profissional_id,
      diasAtendimento: Array.from(dias).sort((a, b) => a - b),
    }))

    return grades.sort((a, b) =>
      nomeProfissional(a.profissional_id, profissionais).localeCompare(
        nomeProfissional(b.profissional_id, profissionais)
      )
    )
  }, [disponibilidades, profissionais])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Disponibilidades</h1>
          <p className="text-sm text-muted-foreground">
            Grades semanais de atendimento configuradas por profissional.
          </p>
        </div>
        <Button onClick={() => navigate("/agenda/disponibilidades/novo")}>
          <PlusIcon className="size-4" /> Nova grade
        </Button>
      </div>

      {erro && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {erro}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">Profissional</th>
              <th className="px-4 py-2.5 font-medium">Dias de atendimento</th>
              <th className="px-4 py-2.5 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {carregando ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="px-4 py-3" colSpan={3}>
                    <Skeleton className="h-5 w-full" />
                  </td>
                </tr>
              ))
            ) : gradesPorProfissional.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-12 text-center">
                  <CalendarDaysIcon className="mx-auto mb-2 size-8 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">
                    Nenhuma grade semanal cadastrada ainda.
                  </p>
                </td>
              </tr>
            ) : (
              gradesPorProfissional.map((grade) => (
                <tr
                  key={grade.profissional_id}
                  className="border-b border-border last:border-0 hover:bg-muted/30"
                >
                  <td className="px-4 py-3">
                    <span className="font-medium text-foreground">
                      {nomeProfissional(grade.profissional_id, profissionais)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {grade.diasAtendimento.map((dia) => (
                        <Badge key={dia} variant="secondary">
                          {DIA_SEMANA_ABREV[dia]}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() =>
                          navigate(`/agenda/disponibilidades/${grade.profissional_id}`)
                        }
                        title="Ver grade"
                      >
                        <EyeIcon className="size-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          navigate(`/agenda/disponibilidades/${grade.profissional_id}/editar`)
                        }
                      >
                        <PencilIcon className="size-4" /> Editar grade
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
