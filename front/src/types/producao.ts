/**
 * Tipos do domínio de Produção (ledger financeiro de atendimentos).
 *
 * Espelham o contrato da API (`apps.clinica.Producao`) — somente leitura.
 */

/** Motivos gerados pelo signal de Agendamento. */
export const MOTIVOS_PRODUCAO = {
  REALIZADO: "Atendimento Realizado",
  FALTA: "Falta do Paciente",
  CANCELAMENTO_TARDIO: "Cancelamento Tardio (< 8h)",
} as const

export type MotivoProducao = (typeof MOTIVOS_PRODUCAO)[keyof typeof MOTIVOS_PRODUCAO]

/** Lançamento de produção retornado pela API. */
export interface Producao {
  id: number
  agendamento: number
  paciente: number
  paciente_nome: string
  profissional: number
  profissional_nome: string
  data: string
  servico_nome: string
  valor: number
  motivo: string
  criado_em: string
  atualizado_em: string
}

/** Filtros da listagem GET `/producoes/`. */
export interface ProducaoFiltros {
  data__gte?: string
  data__lte?: string
  profissional?: number
  paciente?: number
}
