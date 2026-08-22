/**
 * Serviço da trilha de auditoria (aba "Logs").
 *
 * Endpoint `/api/logs/` (restrito a DIREÇÃO/superusuário). Diferente das demais
 * listagens, a resposta é **paginada** (`PaginatedResponse`).
 */
import { api } from "@/services/api"
import type { PaginatedResponse } from "@/types/common"
import type { LogEntry, LogModelo } from "@/types/log"

export interface ListarLogsParams {
  /** Busca livre (objeto, nome/e-mail do autor). */
  search?: string
  /** Id do usuário (autor) que fez a alteração. */
  usuario?: number | string
  /** Tabela alterada (nome do model, ex.: "paciente"). */
  tabela?: string
  /** Id do objeto alterado. */
  objeto_id?: string
  /** Ação: 0=criação, 1=edição, 2=exclusão, 3=acesso. */
  acao?: number | string
  /** Intervalo de datas (YYYY-MM-DD), inclusive. */
  data_inicio?: string
  data_fim?: string
  /** Página (1-based). */
  page?: number
}

/** Lista os eventos de auditoria (paginado, mais recentes primeiro). */
export async function listarLogs(
  params: ListarLogsParams = {}
): Promise<PaginatedResponse<LogEntry>> {
  const { data } = await api.get<PaginatedResponse<LogEntry>>("/logs/", {
    params: {
      search: params.search || undefined,
      usuario: params.usuario || undefined,
      tabela: params.tabela || undefined,
      objeto_id: params.objeto_id || undefined,
      acao: params.acao !== "" ? params.acao : undefined,
      data_inicio: params.data_inicio || undefined,
      data_fim: params.data_fim || undefined,
      page: params.page || undefined,
    },
  })
  return data
}

/** Tabelas que possuem registros na trilha, para popular o filtro de tabela. */
export async function listarModelosLog(): Promise<LogModelo[]> {
  const { data } = await api.get<LogModelo[]>("/logs/modelos/")
  return data
}
