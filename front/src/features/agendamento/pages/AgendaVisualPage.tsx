/** Visualização estilo Google Agenda dos agendamentos (FullCalendar). */
import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import FullCalendar from "@fullcalendar/react"
import dayGridPlugin from "@fullcalendar/daygrid"
import timeGridPlugin from "@fullcalendar/timegrid"
import interactionPlugin from "@fullcalendar/interaction"
import ptBrLocale from "@fullcalendar/core/locales/pt-br"
import type { DateClickArg } from "@fullcalendar/interaction"
import type { EventClickArg } from "@fullcalendar/core"
import { CalendarDaysIcon, ListChecksIcon, Loader2Icon, PlusIcon, SearchIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ComboboxMulti } from "@/components/ui/combobox"
import { Drawer } from "@/components/ui/Drawer"
import { Label } from "@/components/ui/label"
import { AgendamentoForm } from "@/features/agendamento/components/AgendamentoForm"
import { BuscarNaFilaModal } from "@/features/fila-espera/components/BuscarNaFilaModal"
import { TransferirAgendamentoModal } from "@/features/agendamento/components/TransferirAgendamentoModal"
import type { FilaEsperaItem } from "@/types/filaEspera"
import {
  LEGENDA_STATUS,
  mapAgendamentosParaEventos,
} from "@/features/agendamento/utils/calendarEvents"
import { useAgendamentoStore } from "@/store/agendamentoStore"
import { useClinicaStore } from "@/store/clinicaStore"
import { formatarData, formatarHorario } from "@/utils/format"
import type { Agendamento } from "@/types/agendamento"

function dataLocalISO(date = new Date()): string {
  const ano = date.getFullYear()
  const mes = String(date.getMonth() + 1).padStart(2, "0")
  const dia = String(date.getDate()).padStart(2, "0")
  return `${ano}-${mes}-${dia}`
}

export default function AgendaVisualPage() {
  const agendamentos = useAgendamentoStore((s) => s.agendamentos)
  const isLoading = useAgendamentoStore((s) => s.isLoading)
  const erro = useAgendamentoStore((s) => s.erro)
  const buscarAgendamentos = useAgendamentoStore((s) => s.buscarAgendamentos)

  const profissionais = useClinicaStore((s) => s.profissionais)
  const buscarProfissionais = useClinicaStore((s) => s.buscarProfissionais)

  const [profissionaisFiltro, setProfissionaisFiltro] = useState<number[]>([])
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedAgendamentoId, setSelectedAgendamentoId] = useState<number | null>(null)
  const [transferAgendamento, setTransferAgendamento] = useState<Agendamento | null>(null)
  const [buscarNaFilaAberto, setBuscarNaFilaAberto] = useState(false)
  const [filaConverterItem, setFilaConverterItem] = useState<FilaEsperaItem | null>(null)

  const navigate = useNavigate()

  useEffect(() => {
    void buscarProfissionais()
  }, [buscarProfissionais])

  useEffect(() => {
    // Busca todos e filtra por profissional no cliente (suporta múltiplos).
    void buscarAgendamentos()
  }, [buscarAgendamentos])

  const agendamentosVisiveis = useMemo(
    () =>
      profissionaisFiltro.length === 0
        ? agendamentos
        : agendamentos.filter((a) => profissionaisFiltro.includes(a.profissional)),
    [agendamentos, profissionaisFiltro]
  )
  const eventos = useMemo(
    () => mapAgendamentosParaEventos(agendamentosVisiveis),
    [agendamentosVisiveis]
  )

  const agendamentoSelecionado = useMemo(
    () =>
      selectedAgendamentoId != null
        ? agendamentos.find((a) => a.id === selectedAgendamentoId)
        : undefined,
    [agendamentos, selectedAgendamentoId]
  )

  const slotInicial = useMemo(() => {
    if (!selectedDate || selectedAgendamentoId != null) return undefined

    const data = selectedDate.slice(0, 10)
    const horario = selectedDate.length > 10 ? selectedDate.slice(11, 16) : undefined

    return {
      data,
      horario,
      profissional_id: profissionaisFiltro.length === 1 ? profissionaisFiltro[0] : undefined,
    }
  }, [selectedDate, selectedAgendamentoId, profissionaisFiltro])

  const fecharDrawer = useCallback(() => {
    setIsDrawerOpen(false)
    setSelectedDate(null)
    setSelectedAgendamentoId(null)
    setFilaConverterItem(null)
  }, [])

  // Slot para conversão a partir da fila: mantém data/horário do slot e força
  // o paciente/profissional preferido da entrada escolhida.
  const converterSlot = useMemo(() => {
    if (!filaConverterItem) return slotInicial
    return {
      data: slotInicial?.data ?? dataLocalISO(),
      horario: slotInicial?.horario,
      profissional_id: filaConverterItem.profissional ?? slotInicial?.profissional_id,
      paciente_id: filaConverterItem.paciente,
    }
  }, [filaConverterItem, slotInicial])

  const abrirNovoAgendamento = useCallback(() => {
    const agora = new Date()
    const horario = `${String(agora.getHours()).padStart(2, "0")}:${String(Math.floor(agora.getMinutes() / 30) * 30).padStart(2, "0")}`
    setSelectedDate(`${dataLocalISO(agora)}T${horario}:00`)
    setSelectedAgendamentoId(null)
    setIsDrawerOpen(true)
  }, [])

  function aoClicarData(info: DateClickArg) {
    const data = info.dateStr.slice(0, 10)
    const horario = info.dateStr.length > 10 ? info.dateStr.slice(11, 16) : "08:00"

    setSelectedDate(`${data}T${horario}:00`)
    setSelectedAgendamentoId(null)
    setIsDrawerOpen(true)
  }

  function aoClicarEvento(info: EventClickArg) {
    const agendamento = info.event.extendedProps.agendamento as Agendamento | undefined
    if (!agendamento) return

    setSelectedAgendamentoId(agendamento.id)
    setSelectedDate(null)
    setIsDrawerOpen(true)
  }

  async function aoSalvarAgendamento(_agendamento: Agendamento) {
    await buscarAgendamentos()
    fecharDrawer()
  }

  const criandoNovo = agendamentoSelecionado == null
  const tituloDrawer = agendamentoSelecionado
    ? "Editar agendamento"
    : filaConverterItem
      ? "Agendar da fila de espera"
      : "Novo agendamento"
  const descricaoDrawer = agendamentoSelecionado
    ? `${agendamentoSelecionado.paciente_nome} · ${formatarData(agendamentoSelecionado.data)} ${formatarHorario(agendamentoSelecionado.horario_inicio)}`
    : filaConverterItem
      ? `${filaConverterItem.paciente_nome} · confirme os dados do atendimento`
      : selectedDate
        ? `Horário selecionado: ${formatarData(selectedDate.slice(0, 10))}${selectedDate.length > 10 ? ` às ${selectedDate.slice(11, 16)}` : ""}`
        : "Preencha os dados do atendimento."

  const drawerKey =
    selectedAgendamentoId != null
      ? `edit-${selectedAgendamentoId}`
      : filaConverterItem
        ? `converter-${filaConverterItem.id}`
        : `new-${selectedDate ?? "vazio"}`

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-2 overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <CalendarDaysIcon className="size-5 shrink-0 text-primary" />
          <h1 className="truncate text-lg font-semibold tracking-tight text-foreground">
            Calendário
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate("/agenda/fila-espera")}
          >
            <ListChecksIcon className="size-4" /> Fila de espera
          </Button>
          <Button size="sm" onClick={abrirNovoAgendamento}>
            <PlusIcon className="size-4" /> Novo
          </Button>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-3 py-2">
        <div className="flex min-w-[14rem] flex-1 items-center gap-2 sm:max-w-md">
          <Label htmlFor="filtro-profissional" className="sr-only">
            Profissionais
          </Label>
          <div className="flex-1">
            <ComboboxMulti
              id="filtro-profissional"
              options={profissionais.map((p) => ({ value: p.id, label: p.nome }))}
              value={profissionaisFiltro}
              onChange={setProfissionaisFiltro}
              placeholder="Todos os profissionais"
              emptyText="Nenhum profissional encontrado."
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {LEGENDA_STATUS.map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-1 text-[0.65rem] text-muted-foreground"
            >
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: item.cor }}
                aria-hidden
              />
              {item.label}
            </div>
          ))}
        </div>
      </div>

      {erro && (
        <div className="shrink-0 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-1.5 text-xs text-destructive">
          {erro}
        </div>
      )}

      <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-card p-1 sm:p-2">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-[1px]">
            <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
          </div>
        )}

        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "timeGridDay,timeGridWeek,dayGridMonth",
          }}
          locale={ptBrLocale}
          slotMinTime="07:30:00"
          slotMaxTime="20:30:00"
          allDaySlot={false}
          height="calc(100vh - 160px)"
          stickyHeaderDates
          nowIndicator
          selectable
          slotDuration="00:30:00"
          slotLabelInterval="01:00:00"
          weekends
          events={eventos}
          dateClick={aoClicarData}
          eventClick={aoClicarEvento}
          buttonText={{
            today: "Hoje",
            month: "Mês",
            week: "Semana",
            day: "Dia",
          }}
        />
      </div>

      <Drawer
        open={isDrawerOpen}
        onClose={fecharDrawer}
        title={tituloDrawer}
        description={descricaoDrawer}
      >
        {criandoNovo && !filaConverterItem && (
          <div className="mb-3 flex items-center justify-between gap-2 rounded-lg border border-dashed border-border bg-muted/40 px-3 py-2">
            <span className="text-sm text-muted-foreground">
              Preencher este horário com um paciente que já aguarda?
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setBuscarNaFilaAberto(true)}
            >
              <SearchIcon className="size-4" /> Buscar na fila
            </Button>
          </div>
        )}

        <AgendamentoForm
          key={drawerKey}
          modoDrawer
          agendamentoInicial={agendamentoSelecionado}
          slotInicial={filaConverterItem ? converterSlot : slotInicial}
          converterFilaId={filaConverterItem?.id}
          onSalvo={aoSalvarAgendamento}
          onCancelar={fecharDrawer}
          onTransferir={(ag) => {
            fecharDrawer()
            setTransferAgendamento(ag)
          }}
        />
      </Drawer>

      <BuscarNaFilaModal
        open={buscarNaFilaAberto}
        profissionalId={slotInicial?.profissional_id}
        descricaoSlot={
          selectedDate
            ? `Horário: ${formatarData(selectedDate.slice(0, 10))}${selectedDate.length > 10 ? ` às ${selectedDate.slice(11, 16)}` : ""}`
            : undefined
        }
        onSelecionar={(item) => {
          setFilaConverterItem(item)
          setBuscarNaFilaAberto(false)
        }}
        onClose={() => setBuscarNaFilaAberto(false)}
      />

      <TransferirAgendamentoModal
        open={transferAgendamento != null}
        agendamento={transferAgendamento}
        onTransferido={async () => {
          setTransferAgendamento(null)
          await buscarAgendamentos()
        }}
        onCancelar={() => setTransferAgendamento(null)}
      />
    </div>
  )
}
