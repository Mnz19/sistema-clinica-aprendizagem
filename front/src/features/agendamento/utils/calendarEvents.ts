/**
 * Utilitários para integração de agendamentos com o FullCalendar.
 */
import type { EventInput } from "@fullcalendar/core"

import type { Agendamento, StatusAgendamento } from "@/types/agendamento"

const CORES_STATUS: Record<StatusAgendamento, string> = {
  AGENDADO:       "#3b82f6",
  PRE_CONFIRMADO: "#8b5cf6",
  CONFIRMADO:     "#22c55e",
  EM_ATENDIMENTO: "#0ea5e9",
  ATENDIDO:       "#16a34a",
  FALTA:          "#ef4444",
  DESMARCADO:     "#9ca3af",
}

function combinarDataHorario(data: string, horario: string): string {
  const hora = horario.length >= 8 ? horario.slice(0, 8) : `${horario.slice(0, 5)}:00`
  return `${data}T${hora}`
}

/** Retorna a cor semântica do evento conforme o status do agendamento. */
export function corEventoPorStatus(status: StatusAgendamento): string {
  return CORES_STATUS[status]
}

// Aguardando confirmação (mensagem enviada, sem resposta) → âmbar
const COR_AGUARDANDO = "#f59e0b"

/** Cor do evento: destaca "aguardando confirmação"; senão, usa o status. */
export function corEvento(agendamento: Agendamento): string {
  if (agendamento.confirmacao === "AGUARDANDO") return COR_AGUARDANDO
  return corEventoPorStatus(agendamento.status)
}

/** Converte agendamentos do domínio para eventos do FullCalendar. */
export function mapAgendamentosParaEventos(agendamentos: Agendamento[]): EventInput[] {
  return agendamentos.map((agendamento) => {
    const cor = corEvento(agendamento)
    return {
      id: String(agendamento.id),
      title: `${agendamento.paciente_nome} — ${agendamento.servico_nome}`,
      start: combinarDataHorario(agendamento.data, agendamento.horario_inicio),
      end: combinarDataHorario(agendamento.data, agendamento.horario_fim),
      backgroundColor: cor,
      borderColor: cor,
      extendedProps: { agendamento },
    }
  })
}

/** Legenda de cores exibida acima do calendário. */
export const LEGENDA_STATUS: { label: string; cor: string }[] = [
  { label: "Agendado", cor: CORES_STATUS.AGENDADO },
  { label: "Pré-confirmado", cor: CORES_STATUS.PRE_CONFIRMADO },
  { label: "Aguardando confirmação", cor: COR_AGUARDANDO },
  { label: "Confirmado", cor: CORES_STATUS.CONFIRMADO },
  { label: "Em atendimento", cor: CORES_STATUS.EM_ATENDIMENTO },
  { label: "Atendido", cor: CORES_STATUS.ATENDIDO },
  { label: "Desmarcado", cor: CORES_STATUS.DESMARCADO },
  { label: "Falta", cor: CORES_STATUS.FALTA },
]
