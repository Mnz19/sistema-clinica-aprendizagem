/**
 * Serviço de agendamentos: chamadas à API do backend (`apps.clinica.Agendamento`).
 *
 * Endpoints: GET/POST/PATCH/DELETE `/agendamentos/`
 */
import { AxiosError } from "axios"

import { api } from "@/services/api"
import type {
  Agendamento,
  AgendamentoPayload,
  ErroValidacaoAgendamento,
  StatusAgendamento,
  TransferenciaResultado,
} from "@/types/agendamento"

// --- Tipos brutos da API (DRF) ------------------------------------------------

interface AgendamentoApi {
  id: number
  paciente: number
  paciente_nome: string
  profissional: number
  profissional_nome: string
  sala: number
  sala_nome: string
  servico: number
  servico_nome: string
  data: string
  horario_inicio: string
  horario_fim: string
  status: StatusAgendamento
  status_display: string
  confirmacao: "CONFIRMADO" | "AGUARDANDO" | "DESMARCADO" | null
  parecer_status: string | null
  observacoes: string | null
  atendimento_iniciado_em: string | null
  atendimento_finalizado_em: string | null
  duracao_atendimento_segundos: number | null
  criado_em: string
  atualizado_em: string
}

export interface ListarAgendamentosParams {
  data?: string
  profissional?: number
  sala?: number
  paciente?: number
  status?: StatusAgendamento
  ordering?: string
}

// --- Mapeadores API ↔ domínio front-end ---------------------------------------

function mapAgendamento(agendamento: AgendamentoApi): Agendamento {
  return {
    id: agendamento.id,
    paciente: agendamento.paciente,
    paciente_nome: agendamento.paciente_nome,
    profissional: agendamento.profissional,
    profissional_nome: agendamento.profissional_nome,
    sala: agendamento.sala,
    sala_nome: agendamento.sala_nome,
    servico: agendamento.servico,
    servico_nome: agendamento.servico_nome,
    data: agendamento.data,
    horario_inicio: agendamento.horario_inicio,
    horario_fim: agendamento.horario_fim,
    status: agendamento.status,
    status_display: agendamento.status_display,
    confirmacao: agendamento.confirmacao ?? null,
    parecer_status: agendamento.parecer_status,
    observacoes: agendamento.observacoes,
    atendimento_iniciado_em: agendamento.atendimento_iniciado_em,
    atendimento_finalizado_em: agendamento.atendimento_finalizado_em,
    duracao_atendimento_segundos: agendamento.duracao_atendimento_segundos,
    criado_em: agendamento.criado_em,
    atualizado_em: agendamento.atualizado_em,
  }
}

function toAgendamentoBody(payload: AgendamentoPayload) {
  const body: Record<string, unknown> = {
    paciente: payload.paciente,
    profissional: payload.profissional,
    sala: payload.sala,
    servico: payload.servico,
    data: payload.data,
    horario_inicio: normalizarHorarioApi(payload.horario_inicio),
    observacoes: payload.observacoes ?? "",
  }

  if (payload.status) {
    body.status = payload.status
  }

  if (payload.parecer_status !== undefined) {
    body.parecer_status = payload.parecer_status
  }

  return body
}

function normalizarHorarioApi(hora: string): string {
  return hora.length === 5 ? `${hora}:00` : hora
}

const PADRAO_CONFLITO = /agendamento neste horário/i

function extrairCamposValidacao(data: Record<string, unknown>): Record<string, string[]> {
  const campos: Record<string, string[]> = {}

  for (const [campo, valor] of Object.entries(data)) {
    if (campo === "detail") continue
    if (Array.isArray(valor)) {
      const mensagens = valor.filter((item): item is string => typeof item === "string")
      if (mensagens.length > 0) campos[campo] = mensagens
    } else if (typeof valor === "string") {
      campos[campo] = [valor]
    }
  }

  return campos
}

/** Converte erro 400 do DRF em estrutura tipada para a UI de agendamentos. */
export function parseErroValidacaoAgendamento(erro: unknown): ErroValidacaoAgendamento {
  if (erro instanceof AxiosError) {
    const data = erro.response?.data as Record<string, unknown> | undefined

    if (data) {
      if (typeof data.detail === "string") {
        return {
          mensagem: data.detail,
          mensagens: [data.detail],
          campos: {},
          isConflitoHorario: PADRAO_CONFLITO.test(data.detail),
        }
      }

      const campos = extrairCamposValidacao(data)
      const mensagens = Object.values(campos).flat()

      if (mensagens.length > 0) {
        const isConflitoHorario = mensagens.some((msg) => PADRAO_CONFLITO.test(msg))
        return {
          mensagem: mensagens.join(" "),
          mensagens,
          campos,
          isConflitoHorario,
        }
      }
    }
  }

  return {
    mensagem: "Não foi possível salvar o agendamento. Tente novamente.",
    mensagens: [],
    campos: {},
    isConflitoHorario: false,
  }
}

/** Erro lançado pela store/form com detalhes de validação do backend. */
export class AgendamentoValidacaoError extends Error {
  readonly validacao: ErroValidacaoAgendamento

  constructor(validacao: ErroValidacaoAgendamento) {
    super(validacao.mensagem)
    this.name = "AgendamentoValidacaoError"
    this.validacao = validacao
  }
}

// --- CRUD ---------------------------------------------------------------------

export async function listarAgendamentos(
  params: ListarAgendamentosParams = {}
): Promise<Agendamento[]> {
  const { data } = await api.get<AgendamentoApi[]>("/agendamentos/", {
    params: {
      data: params.data,
      profissional: params.profissional,
      sala: params.sala,
      paciente: params.paciente,
      status: params.status,
      ordering: params.ordering ?? "data,horario_inicio",
    },
  })
  return data.map(mapAgendamento)
}

export async function obterAgendamento(id: number): Promise<Agendamento> {
  const { data } = await api.get<AgendamentoApi>(`/agendamentos/${id}/`)
  return mapAgendamento(data)
}

export async function criarAgendamento(payload: AgendamentoPayload): Promise<Agendamento> {
  try {
    const { data } = await api.post<AgendamentoApi>("/agendamentos/", toAgendamentoBody(payload))
    return mapAgendamento(data)
  } catch (erro) {
    if (erro instanceof AxiosError && erro.response?.status === 400) {
      throw new AgendamentoValidacaoError(parseErroValidacaoAgendamento(erro))
    }
    throw erro
  }
}

export async function atualizarAgendamento(
  id: number,
  payload: AgendamentoPayload
): Promise<Agendamento> {
  try {
    const { data } = await api.patch<AgendamentoApi>(
      `/agendamentos/${id}/`,
      toAgendamentoBody(payload)
    )
    return mapAgendamento(data)
  } catch (erro) {
    if (erro instanceof AxiosError && erro.response?.status === 400) {
      throw new AgendamentoValidacaoError(parseErroValidacaoAgendamento(erro))
    }
    throw erro
  }
}

export async function removerAgendamento(id: number): Promise<void> {
  await api.delete(`/agendamentos/${id}/`)
}

// --- Transferência de profissional --------------------------------------------

/**
 * Transfere o agendamento para outro profissional.
 *
 * Estar fora da disponibilidade semanal do destino é apenas um aviso: com
 * `confirmar=false` o backend responde `requer_confirmacao=true` e NÃO salva;
 * reenvie com `confirmar=true` para efetivar. Ausência, serviço não oferecido
 * e choque de horário continuam bloqueando (400 → `AgendamentoValidacaoError`).
 */
export async function transferirAgendamento(
  id: number,
  profissional: number,
  confirmar = false
): Promise<TransferenciaResultado> {
  try {
    const { data } = await api.post<{
      requer_confirmacao: boolean
      avisos: string[]
      agendamento: AgendamentoApi
    }>(`/agendamentos/${id}/transferir/`, { profissional, confirmar })
    return {
      requer_confirmacao: data.requer_confirmacao,
      avisos: data.avisos ?? [],
      agendamento: mapAgendamento(data.agendamento),
    }
  } catch (erro) {
    if (erro instanceof AxiosError && erro.response?.status === 400) {
      throw new AgendamentoValidacaoError(parseErroValidacaoAgendamento(erro))
    }
    throw erro
  }
}

// --- Cronômetro do atendimento ------------------------------------------------

/**
 * Inicia o atendimento (cronômetro): marca `atendimento_iniciado_em`, move o
 * status para `EM_ATENDIMENTO` e deixa a sala em uso.
 *
 * Erros esperados: 400 (já iniciado / estado terminal), 403 (papel/dono),
 * 409 (sala já em uso por outro atendimento).
 */
export async function iniciarAtendimento(id: number): Promise<Agendamento> {
  const { data } = await api.post<AgendamentoApi>(`/agendamentos/${id}/iniciar-atendimento/`)
  return mapAgendamento(data)
}

/**
 * Finaliza o atendimento: marca `atendimento_finalizado_em`, move o status para
 * `ATENDIDO` (gera a produção) e libera a sala.
 */
export async function finalizarAtendimento(id: number): Promise<Agendamento> {
  const { data } = await api.post<AgendamentoApi>(`/agendamentos/${id}/finalizar-atendimento/`)
  return mapAgendamento(data)
}
