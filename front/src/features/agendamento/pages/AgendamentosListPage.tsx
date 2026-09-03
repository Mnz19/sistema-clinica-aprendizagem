/** Página de listagem de agendamentos (dia / semana). */
import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { CalendarCheckIcon, PlusIcon, SearchIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Drawer } from "@/components/ui/Drawer"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { AgendamentoAcoesMenu } from "@/features/agendamento/components/AgendamentoAcoesMenu"
import { AgendamentoForm } from "@/features/agendamento/components/AgendamentoForm"
import { StatusConfirmModal } from "@/features/agendamento/components/StatusConfirmModal"
import { TransferirAgendamentoModal } from "@/features/agendamento/components/TransferirAgendamentoModal"
import { ConfirmacaoBadge } from "@/features/agendamento/utils/confirmacao"
import { payloadAtualizacaoStatus } from "@/features/agendamento/utils/agendamentoPayload"
import { formatarData, formatarHorario } from "@/utils/format"
import { AgendamentoValidacaoError } from "@/services/agendamento"
import { useAgendamentoStore } from "@/store/agendamentoStore"
import { Select } from "@/components/ui/select"
import { STATUS_AGENDAMENTO, type Agendamento, type StatusAgendamento } from "@/types/agendamento"

type PeriodoVisualizacao = "hoje" | "semana"

interface StatusModalState {
  agendamento: Agendamento
  novoStatus: StatusAgendamento
}

function dataLocalISO(date = new Date()): string {
  const ano = date.getFullYear()
  const mes = String(date.getMonth() + 1).padStart(2, "0")
  const dia = String(date.getDate()).padStart(2, "0")
  return `${ano}-${mes}-${dia}`
}

function inicioSemanaISO(ref = new Date()): string {
  const d = new Date(ref)
  const diaSemana = d.getDay()
  const diff = diaSemana === 0 ? -6 : 1 - diaSemana
  d.setDate(d.getDate() + diff)
  return dataLocalISO(d)
}

function fimSemanaISO(ref = new Date()): string {
  const d = new Date(inicioSemanaISO(ref))
  d.setDate(d.getDate() + 6)
  return dataLocalISO(d)
}

function statusVariant(
  status: StatusAgendamento
): "default" | "secondary" | "success" | "destructive" {
  switch (status) {
    case "CONFIRMADO":
    case "ATENDIDO":
      return "success"
    case "EM_ATENDIMENTO":
      return "secondary"
    case "DESMARCADO":
    case "FALTA":
      return "destructive"
    default:
      return "default"
  }
}

function paramsBusca(periodo: PeriodoVisualizacao, hoje: string) {
  return periodo === "hoje" ? { data: hoje, ordering: "horario_inicio" } : { ordering: "data,horario_inicio" }
}

export default function AgendamentosListPage() {
  const navigate = useNavigate()
  const agendamentos = useAgendamentoStore((s) => s.agendamentos)
  const erro = useAgendamentoStore((s) => s.erro)
  const buscarAgendamentos = useAgendamentoStore((s) => s.buscarAgendamentos)
  const salvarAgendamento = useAgendamentoStore((s) => s.salvarAgendamento)

  const [periodo, setPeriodo] = useState<PeriodoVisualizacao>("semana")
  const [termoBusca, setTermoBusca] = useState("")
  const [filtroStatus, setFiltroStatus] = useState<StatusAgendamento | "">("")
  const [carregando, setCarregando] = useState(true)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [selectedAgendamentoId, setSelectedAgendamentoId] = useState<number | null>(null)
  const [statusModal, setStatusModal] = useState<StatusModalState | null>(null)
  const [salvandoStatus, setSalvandoStatus] = useState(false)
  const [erroParecerModal, setErroParecerModal] = useState<string | null>(null)
  const [transferAgendamento, setTransferAgendamento] = useState<Agendamento | null>(null)

  const hoje = dataLocalISO()
  const inicioSemana = inicioSemanaISO()
  const fimSemana = fimSemanaISO()

  const refetch = useCallback(async () => {
    await buscarAgendamentos(paramsBusca(periodo, hoje))
  }, [buscarAgendamentos, periodo, hoje])

  useEffect(() => {
    const timer = setTimeout(() => {
      setCarregando(true)
      void refetch().finally(() => setCarregando(false))
    }, 300)
    return () => clearTimeout(timer)
  }, [refetch])

  const agendamentosPorPeriodo = useMemo(() => {
    if (periodo === "hoje") {
      return agendamentos.filter((a) => a.data === hoje)
    }
    return agendamentos.filter((a) => a.data >= inicioSemana && a.data <= fimSemana)
  }, [agendamentos, periodo, hoje, inicioSemana, fimSemana])

  const agendamentosFiltrados = useMemo(() => {
    const termo = termoBusca.trim().toLowerCase()
    let lista = agendamentosPorPeriodo
    
    // Se nenhum filtro de status foi selecionado explicitamente, excluir DESMARCADO
    if (filtroStatus) {
      lista = lista.filter((a) => a.status === filtroStatus)
    } else {
      lista = lista.filter((a) => a.status !== "DESMARCADO")
    }
    
    if (!termo) return lista
    return lista.filter((a) =>
      a.paciente_nome.toLowerCase().includes(termo)
    )
  }, [agendamentosPorPeriodo, termoBusca, filtroStatus])

  const agendamentoSelecionado = useMemo(
    () =>
      selectedAgendamentoId != null
        ? agendamentos.find((a) => a.id === selectedAgendamentoId)
        : undefined,
    [agendamentos, selectedAgendamentoId]
  )

  const tituloPeriodo =
    periodo === "hoje"
      ? `Hoje (${formatarData(hoje)})`
      : `Esta semana (${formatarData(inicioSemana)} – ${formatarData(fimSemana)})`

  const fecharDrawer = useCallback(() => {
    setIsDrawerOpen(false)
    setSelectedAgendamentoId(null)
  }, [])

  function abrirEdicao(agendamento: Agendamento) {
    setSelectedAgendamentoId(agendamento.id)
    setIsDrawerOpen(true)
  }

  function abrirStatusRapido(agendamento: Agendamento, novoStatus: StatusAgendamento) {
    if (agendamento.status === novoStatus) return
    setErroParecerModal(null)
    setStatusModal({ agendamento, novoStatus })
  }

  function fecharStatusModal() {
    if (salvandoStatus) return
    setStatusModal(null)
    setErroParecerModal(null)
  }

  async function confirmarStatusRapido(parecer?: string) {
    if (!statusModal) return

    setSalvandoStatus(true)
    setErroParecerModal(null)

    try {
      const payload = payloadAtualizacaoStatus(
        statusModal.agendamento,
        statusModal.novoStatus,
        parecer
      )
      await salvarAgendamento(payload, statusModal.agendamento.id)
      await refetch()
      setStatusModal(null)
    } catch (err) {
      if (err instanceof AgendamentoValidacaoError) {
        const erroParecer = err.validacao.campos.parecer_status?.[0]
        if (erroParecer) {
          setErroParecerModal(erroParecer)
        }
      }
    } finally {
      setSalvandoStatus(false)
    }
  }

  async function aoSalvarDrawer(_agendamento: Agendamento) {
    await refetch()
    fecharDrawer()
  }

  const mensagemVazia =
    termoBusca.trim() && agendamentosPorPeriodo.length > 0
      ? "Nenhum agendamento encontrado para a busca."
      : "Nenhum agendamento encontrado para o período selecionado." +
        (!filtroStatus ? " (agendamentos desmarcados estão ocultos)" : "")

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Agendamentos</h1>
          <p className="text-sm text-muted-foreground">
            Consultas e sessões agendadas — {tituloPeriodo}.
          </p>
        </div>
        <Button onClick={() => navigate("/agenda/agendamentos/novo")}>
          <PlusIcon className="size-4" /> Novo agendamento
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant={periodo === "hoje" ? "default" : "outline"}
          onClick={() => setPeriodo("hoje")}
        >
          Hoje
        </Button>
        <Button
          type="button"
          size="sm"
          variant={periodo === "semana" ? "default" : "outline"}
          onClick={() => setPeriodo("semana")}
        >
          Esta semana
        </Button>

        <div className="relative min-w-[12rem] flex-1 sm:max-w-xs">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={termoBusca}
            onChange={(e) => setTermoBusca(e.target.value)}
            placeholder="Buscar paciente…"
            className="h-8 pl-8 text-sm"
          />
        </div>

        <Select
          className="h-8 text-sm w-44"
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value as StatusAgendamento | "")}
        >
          <option value="">Todos os status</option>
          {(Object.entries(STATUS_AGENDAMENTO) as [StatusAgendamento, string][]).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </Select>
      </div>

      {erro && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {erro}
        </div>
      )}

      <div className="overflow-x-auto overflow-y-visible rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">Data</th>
              <th className="px-4 py-2.5 font-medium">Horário</th>
              <th className="px-4 py-2.5 font-medium">Paciente</th>
              <th className="hidden px-4 py-2.5 font-medium md:table-cell">Profissional</th>
              <th className="hidden px-4 py-2.5 font-medium lg:table-cell">Sala / Serviço</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {carregando ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="px-4 py-3" colSpan={7}>
                    <Skeleton className="h-5 w-full" />
                  </td>
                </tr>
              ))
            ) : agendamentosFiltrados.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center">
                  <CalendarCheckIcon className="mx-auto mb-2 size-8 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">{mensagemVazia}</p>
                </td>
              </tr>
            ) : (
              agendamentosFiltrados.map((agendamento) => (
                <tr
                  key={agendamento.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30"
                >
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatarData(agendamento.data)}
                  </td>
                  <td className="px-4 py-3 text-foreground">
                    {formatarHorario(agendamento.horario_inicio)} –{" "}
                    {formatarHorario(agendamento.horario_fim)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-foreground">{agendamento.paciente_nome}</span>
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                    {agendamento.profissional_nome}
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
                    {agendamento.sala_nome} · {agendamento.servico_nome}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col items-start gap-1">
                      <Badge variant={statusVariant(agendamento.status)}>
                        {agendamento.status_display}
                      </Badge>
                      <ConfirmacaoBadge estado={agendamento.confirmacao} />
                    </div>
                  </td>
                  <td className="relative px-4 py-3 text-right">
                    <AgendamentoAcoesMenu
                      agendamento={agendamento}
                      onVerEditar={abrirEdicao}
                      onStatusRapido={abrirStatusRapido}
                      onTransferir={setTransferAgendamento}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Drawer
        open={isDrawerOpen}
        onClose={fecharDrawer}
        title="Editar agendamento"
        description={
          agendamentoSelecionado
            ? `${agendamentoSelecionado.paciente_nome} · ${formatarData(agendamentoSelecionado.data)} ${formatarHorario(agendamentoSelecionado.horario_inicio)}`
            : undefined
        }
      >
        {agendamentoSelecionado && (
          <AgendamentoForm
            key={`edit-${agendamentoSelecionado.id}`}
            modoDrawer
            agendamentoInicial={agendamentoSelecionado}
            onSalvo={aoSalvarDrawer}
            onCancelar={fecharDrawer}
            onTransferir={(ag) => {
              fecharDrawer()
              setTransferAgendamento(ag)
            }}
          />
        )}
      </Drawer>

      <StatusConfirmModal
        open={statusModal != null}
        agendamento={statusModal?.agendamento ?? null}
        novoStatus={statusModal?.novoStatus ?? null}
        salvando={salvandoStatus}
        erroParecer={erroParecerModal}
        onConfirmar={confirmarStatusRapido}
        onCancelar={fecharStatusModal}
      />

      <TransferirAgendamentoModal
        open={transferAgendamento != null}
        agendamento={transferAgendamento}
        onTransferido={async () => {
          setTransferAgendamento(null)
          await refetch()
        }}
        onCancelar={() => setTransferAgendamento(null)}
      />
    </div>
  )
}
