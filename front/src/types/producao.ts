/**
 * Tipos do domínio de Produção (ledger financeiro de atendimentos).
 *
 * Espelham o contrato da API (`apps.clinica.Producao`) — somente leitura.
 */
import type { Papel } from "@/types/auth"

/**
 * Papéis que podem ver a aba "Produção".
 *
 * A tela expõe o valor cobrado por atendimento de toda a clínica, então só o
 * FINANCEIRO e a DIREÇÃO têm acesso — espelha a permissão do `ProducaoViewSet`.
 */
export const PAPEIS_PRODUCAO: Papel[] = ["FINANCEIRO", "DIRECAO"]

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
