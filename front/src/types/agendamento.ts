/**
 * Tipos do domínio de agendamentos.
 *
 * Espelham o contrato da API do backend (`apps.clinica.Agendamento`).
 */

/** Status do agendamento (enum `StatusAgendamento` do backend — 7 estados). */
export const STATUS_AGENDAMENTO = {
  AGENDADO:       "Agendado",
  PRE_CONFIRMADO: "Pré-confirmado",
  CONFIRMADO:     "Confirmado",
  EM_ATENDIMENTO: "Em atendimento",
  ATENDIDO:       "Atendido",
  FALTA:          "Falta",
  DESMARCADO:     "Desmarcado",
} as const

export type StatusAgendamento = keyof typeof STATUS_AGENDAMENTO

/** Status que exigem preenchimento de `parecer_status`. */
export function statusExigeParecer(status: StatusAgendamento): boolean {
  return status === "FALTA" || status === "DESMARCADO"
}

/** Estado de confirmação por WhatsApp (derivado no backend). */
export type EstadoConfirmacao = "CONFIRMADO" | "AGUARDANDO" | "DESMARCADO" | null

/** Agendamento retornado pela API (leitura). */
export interface Agendamento {
  id: number
  paciente: number
  paciente_id?: number
  paciente_nome: string
  profissional: number
  profissional_id?: number
  profissional_nome: string
  sala: number
  sala_id?: number
  sala_nome: string
  servico: number
  servico_id?: number
  servico_nome: string
  data: string
  horario_inicio: string
  horario_fim: string
  status: StatusAgendamento
  status_display: string
  confirmacao: EstadoConfirmacao
  parecer_status: string | null
  observacoes: string | null
  serie?: number | null
  numero_na_serie?: number | null
  /** Início do cronômetro do atendimento (ISO). `null` se ainda não iniciado. */
  atendimento_iniciado_em: string | null
  /** Fim do atendimento (ISO). `null` enquanto em andamento ou não iniciado. */
  atendimento_finalizado_em: string | null
  /** Duração do atendimento em segundos (decorrido se em andamento). `null` se não iniciado. */
  duracao_atendimento_segundos: number | null
  criado_em: string
  atualizado_em: string
}

/** `true` quando o atendimento foi iniciado e ainda não finalizado (ocupa a sala). */
export function atendimentoEmAndamento(agendamento: Agendamento): boolean {
  return Boolean(agendamento.atendimento_iniciado_em && !agendamento.atendimento_finalizado_em)
}

/** Payload de criação/edição enviado ao backend. */
export interface AgendamentoPayload {
  paciente: number
  profissional: number
  sala: number
  servico: number
  data: string
  horario_inicio: string
  observacoes?: string
  /** Somente em edição — na criação o backend define `AGENDADO`. */
  status?: StatusAgendamento
  /** Obrigatório quando `status` for `FALTA` ou `DESMARCADO`. */
  parecer_status?: string
}

/** Frequência de uma série recorrente. */
export type Frequencia = "SEMANAL" | "QUINZENAL" | "MENSAL"

export const FREQUENCIA_LABELS: Record<Frequencia, string> = {
  SEMANAL:   "Semanal",
  QUINZENAL: "Quinzenal",
  MENSAL:    "Mensal",
}

/** Payload para criar série recorrente a partir de um agendamento existente. */
export interface AgendamentoRecorrentePayload {
  frequencia: Frequencia
  data_fim_recorrencia: string
}

/** Resposta da action recorrente/. */
export interface SerieRecorrenteResponse {
  criados: Agendamento[]
  total_criados: number
  nao_criados: Array<{ data: string; motivo: string }>
}

/** Baixa de pagamento de um agendamento. */
export type FormaPagamento = "DINHEIRO" | "PIX" | "CARTAO_CREDITO" | "CARTAO_DEBITO" | "CONVENIO"

export const FORMA_PAGAMENTO_LABELS: Record<FormaPagamento, string> = {
  DINHEIRO:       "Dinheiro",
  PIX:            "Pix",
  CARTAO_CREDITO: "Cartão de Crédito",
  CARTAO_DEBITO:  "Cartão de Débito",
  CONVENIO:       "Convênio",
}

export interface PagamentoAgendamento {
  id: number
  agendamento: number
  valor_pago: string
  forma_pagamento: FormaPagamento
  valor_repasse_calculado: string
  registrado_por: number
  registrado_por_nome: string
  criado_em: string
}

/** Erro de validação 400 com mensagens por campo (ex.: conflito de horário). */
export interface ErroValidacaoAgendamento {
  mensagem: string
  mensagens: string[]
  campos: Record<string, string[]>
  isConflitoHorario: boolean
}

/**
 * Resultado de uma transferência de profissional.
 *
 * - `requer_confirmacao`: `true` quando há avisos (ex.: fora da disponibilidade
 *   semanal do destino) e a transferência ainda NÃO foi efetivada — reenvie com
 *   `confirmar=true`. `false` quando a transferência foi salva.
 * - `avisos`: alertas não bloqueantes a exibir para o usuário.
 * - `agendamento`: estado atual (atualizado quando efetivada).
 */
export interface TransferenciaResultado {
  requer_confirmacao: boolean
  avisos: string[]
  agendamento: Agendamento
}
