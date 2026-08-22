/**
 * Tipos da trilha de auditoria (aba "Logs").
 *
 * Espelham o `LogEntrySerializer` do backend (`apps.auditoria`), que expõe os
 * eventos capturados pelo django-auditlog.
 */

/** Ações registradas pelo auditlog (0=criação, 1=edição, 2=exclusão, 3=acesso). */
export const ACAO = {
  CRIACAO: 0,
  EDICAO: 1,
  EXCLUSAO: 2,
  ACESSO: 3,
} as const

export type Acao = (typeof ACAO)[keyof typeof ACAO]

/** Rótulos das ações, para o filtro e os badges. */
export const ACAO_LABELS: Record<number, string> = {
  0: "Criação",
  1: "Edição",
  2: "Exclusão",
  3: "Acesso",
}

/** Autor da alteração (nulo quando feita fora de um request: shell, comando, ETL). */
export interface LogUsuario {
  id: number
  nome: string
  email: string
}

/**
 * Diff campo-a-campo: para cada campo, uma tupla `[valor_antigo, valor_novo]`.
 * Numa criação, o valor antigo costuma ser "None"; numa exclusão, o novo.
 */
export type LogAlteracoes = Record<string, [unknown, unknown]>

/** Um evento da trilha de auditoria. */
export interface LogEntry {
  id: number
  acao: number
  acao_label: string
  /** Nome do model alterado (ex.: "paciente", "usuario"). */
  tabela: string
  /** Nome legível do model (ex.: "Paciente"). */
  tabela_label: string
  /** Id do objeto alterado (texto — cobre PK de qualquer tipo). */
  objeto_id: string
  /** Representação textual do objeto no momento do evento. */
  objeto_repr: string
  usuario: LogUsuario | null
  ip: string | null
  data_hora: string
  alteracoes: LogAlteracoes
}

/** Item de `/api/logs/modelos/` — tabela presente na trilha, para o filtro. */
export interface LogModelo {
  tabela: string
  tabela_label: string
}
