/**
 * Dashboard individual do terapeuta.
 * Mostra métricas do mês: atendimentos por status, repasse acumulado e próximas consultas.
 */
import { useEffect, useState } from "react"
import { Loader2Icon } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { api } from "@/services/api"
import { STATUS_AGENDAMENTO, type StatusAgendamento } from "@/types/agendamento"
import type { Agendamento } from "@/types/agendamento"

interface DashboardData {
  por_status: Record<StatusAgendamento, number>
  repasse_mes: string
  proximas_consultas: Agendamento[]
}

export function DashboardTerapeutaPage() {
  const [dados, setDados] = useState<DashboardData | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    api.get("/dashboard/terapeuta/")
      .then(({ data }) => setDados(data as DashboardData))
      .catch(() => {})
      .finally(() => setCarregando(false))
  }, [])

  if (carregando) {
    return (
      <div className="flex justify-center p-8">
        <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!dados) {
    return <p className="p-6 text-muted-foreground text-sm">Não foi possível carregar o dashboard.</p>
  }

  const totalAtendimentos = Object.values(dados.por_status).reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-xl font-semibold">Meu Dashboard</h1>

      {/* Métricas do mês */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total do mês</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalAtendimentos}</p>
            <p className="text-xs text-muted-foreground">agendamentos</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Repasse do mês</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              R$ {parseFloat(dados.repasse_mes).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Atendidos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{dados.por_status.ATENDIDO ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Por status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Atendimentos por status (mês atual)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {(Object.entries(STATUS_AGENDAMENTO) as [StatusAgendamento, string][]).map(([key, label]) => (
            <div key={key} className="flex items-center gap-1.5">
              <Badge variant="outline">{label}</Badge>
              <span className="text-sm font-medium">{dados.por_status[key] ?? 0}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Próximas consultas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Próximas consultas (7 dias)</CardTitle>
        </CardHeader>
        <CardContent>
          {dados.proximas_consultas.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhuma consulta nos próximos 7 dias.</p>
          ) : (
            <ul className="space-y-2">
              {dados.proximas_consultas.map((ag) => (
                <li key={ag.id} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                  <div>
                    <p className="font-medium">{ag.paciente_nome}</p>
                    <p className="text-xs text-muted-foreground">{ag.sala_nome}</p>
                  </div>
                  <div className="text-right">
                    <p>{new Date(ag.data + "T00:00:00").toLocaleDateString("pt-BR")}</p>
                    <p className="text-xs text-muted-foreground">{ag.horario_inicio.slice(0, 5)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
