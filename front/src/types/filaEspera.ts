/**
 * Tipos do domínio de fila de espera.
 *
 * Espelham o ``FilaEsperaSerializer`` do backend (`apps.fila_espera`). Uma entrada
 * representa um paciente aguardando horário; a ordenação é FIFO (por ``criado_em``).
 */

export type StatusFila = "AGUARDANDO" | "CONVERTIDO" | "RECUSADO"

export interface FilaEsperaItem {
  id: number
  paciente: number
  paciente_nome: string
  paciente_telefone: string
  profissional: number | null
  profissional_nome: string | null
  especialidade: number | null
  especialidade_nome: string | null
  preferencia_horario: string
  observacoes: string
  status: StatusFila
  agendamento_resultado: number | null
  criado_em: string
  atualizado_em: string
}

/** Payload de criação/edição de uma entrada na fila. */
export interface FilaEsperaPayload {
  paciente: number
  profissional?: number | null
  especialidade?: number | null
  preferencia_horario?: string
  observacoes?: string
}
