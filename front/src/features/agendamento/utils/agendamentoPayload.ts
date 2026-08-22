import type { Agendamento, AgendamentoPayload, StatusAgendamento } from "@/types/agendamento"
import { statusExigeParecer } from "@/types/agendamento"

/** Monta payload completo a partir do registro existente (ação rápida de status). */
export function payloadAtualizacaoStatus(
  agendamento: Agendamento,
  novoStatus: StatusAgendamento,
  parecer?: string
): AgendamentoPayload {
  const payload: AgendamentoPayload = {
    paciente: agendamento.paciente,
    profissional: agendamento.profissional,
    servico: agendamento.servico,
    sala: agendamento.sala,
    data: agendamento.data,
    horario_inicio: agendamento.horario_inicio.slice(0, 5),
    observacoes: agendamento.observacoes ?? undefined,
    status: novoStatus,
  }

  if (statusExigeParecer(novoStatus) && parecer) {
    payload.parecer_status = parecer.trim()
  }

  return payload
}
