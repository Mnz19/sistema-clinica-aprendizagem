/**
 * Serviço do módulo de clínica (Fase 1 — Fundações Operacionais).
 *
 * Endpoints (`/api/`):
 *   salas/, servicos/, disponibilidades/, ausencias/
 */
import { api } from "@/services/api"
import { listarUsuarios } from "@/services/usuarios"
import { PAPEIS } from "@/types/auth"
import type { Usuario } from "@/types/auth"
import type {
  Ausencia,
  AusenciaPayload,
  Disponibilidade,
  GradeSemanalSlot,
  Sala,
  SalaOcupacao,
  SalaPayload,
  Servico,
  ServicoPayload,
} from "@/types/clinica"

// --- Tipos brutos da API (DRF) ------------------------------------------------

interface SalaApi {
  id: number
  nome: string
  descricao: string
  ativa: boolean
  criado_em: string
  atualizado_em: string
}

interface ServicoApi {
  id: number
  nome: string
  descricao: string
  duracao_minutos: number
  valor_clinica: string
  valor_repasse: string
  margem: string
  profissionais: number[]
  ativo: boolean
  criado_em: string
  atualizado_em: string
}

interface DisponibilidadeApi {
  id: number
  profissional: number
  dia_semana: number
  horario_inicio: string
  horario_fim: string
  ativo: boolean
  criado_em: string
  atualizado_em: string
}

interface AusenciaApi {
  id: number
  profissional: number
  data_inicio: string
  data_fim: string
  motivo: string
  ativo: boolean
  criado_em: string
  atualizado_em: string
}

// --- Mapeadores API ↔ domínio front-end ---------------------------------------

function normalizarHorario(hora: string): string {
  return hora.slice(0, 5)
}

function mapSala(sala: SalaApi): Sala {
  return { ...sala }
}

function mapServico(servico: ServicoApi): Servico {
  return {
    id: servico.id,
    nome: servico.nome,
    descricao: servico.descricao,
    duracao_minutos: servico.duracao_minutos,
    valor_clinica: servico.valor_clinica,
    valor_repasse: servico.valor_repasse,
    margem: servico.margem,
    profissionais: servico.profissionais,
    ativo: servico.ativo,
    criado_em: servico.criado_em,
    atualizado_em: servico.atualizado_em,
  }
}

function mapDisponibilidade(disponibilidade: DisponibilidadeApi): Disponibilidade {
  return {
    id: disponibilidade.id,
    profissional_id: disponibilidade.profissional,
    dia_semana: disponibilidade.dia_semana,
    horario_inicio: normalizarHorario(disponibilidade.horario_inicio),
    horario_fim: normalizarHorario(disponibilidade.horario_fim),
    ativo: disponibilidade.ativo,
    criado_em: disponibilidade.criado_em,
    atualizado_em: disponibilidade.atualizado_em,
  }
}

function mapAusencia(ausencia: AusenciaApi): Ausencia {
  return {
    id: ausencia.id,
    profissional_id: ausencia.profissional,
    data_inicio: ausencia.data_inicio,
    data_fim: ausencia.data_fim,
    motivo: ausencia.motivo,
    ativo: ausencia.ativo,
    criado_em: ausencia.criado_em,
    atualizado_em: ausencia.atualizado_em,
  }
}

function toServicoBody(payload: ServicoPayload) {
  return {
    nome: payload.nome,
    descricao: payload.descricao ?? "",
    duracao_minutos: payload.duracao_minutos,
    valor_clinica: payload.valor_clinica,
    valor_repasse: payload.valor_repasse,
    profissionais: payload.profissionais,
  }
}

function toAusenciaBody(payload: AusenciaPayload) {
  return {
    profissional: payload.profissional_id,
    data_inicio: payload.data_inicio,
    data_fim: payload.data_fim,
    motivo: payload.motivo ?? "",
  }
}

// --- Profissionais ------------------------------------------------------------

export async function listarProfissionaisClinica(): Promise<Usuario[]> {
  return listarUsuarios({ role: PAPEIS.PROFISSIONAL, is_active: true })
}

// --- Salas --------------------------------------------------------------------

export async function listarSalas(): Promise<Sala[]> {
  const { data } = await api.get<SalaApi[]>("/salas/")
  return data.map(mapSala)
}

export async function criarSala(payload: SalaPayload): Promise<Sala> {
  const { data } = await api.post<SalaApi>("/salas/", payload)
  return mapSala(data)
}

export async function atualizarSala(id: number, payload: SalaPayload): Promise<Sala> {
  const { data } = await api.patch<SalaApi>(`/salas/${id}/`, payload)
  return mapSala(data)
}

export async function desativarSala(id: number): Promise<void> {
  await api.delete(`/salas/${id}/`)
}

export async function reativarSalaApi(id: number): Promise<Sala> {
  const { data } = await api.patch<SalaApi>(`/salas/${id}/`, { ativa: true })
  return mapSala(data)
}

/** Ocupação atual de cada sala ativa (base da visão de ocupação por sala). */
export async function listarOcupacaoSalas(): Promise<SalaOcupacao[]> {
  const { data } = await api.get<SalaOcupacao[]>("/salas/ocupacao/")
  return data
}

// --- Serviços -----------------------------------------------------------------

export async function listarServicos(): Promise<Servico[]> {
  const { data } = await api.get<ServicoApi[]>("/servicos/")
  return data.map(mapServico)
}

export async function criarServico(payload: ServicoPayload): Promise<Servico> {
  const { data } = await api.post<ServicoApi>("/servicos/", toServicoBody(payload))
  return mapServico(data)
}

export async function atualizarServico(id: number, payload: ServicoPayload): Promise<Servico> {
  const { data } = await api.patch<ServicoApi>(`/servicos/${id}/`, toServicoBody(payload))
  return mapServico(data)
}

export async function desativarServico(id: number): Promise<void> {
  await api.delete(`/servicos/${id}/`)
}

export async function reativarServicoApi(id: number): Promise<Servico> {
  const { data } = await api.patch<ServicoApi>(`/servicos/${id}/`, { ativo: true })
  return mapServico(data)
}

// --- Disponibilidades ---------------------------------------------------------

interface ListarDisponibilidadesParams {
  profissional?: number
  ativo?: boolean
}

export async function listarDisponibilidades(
  params: ListarDisponibilidadesParams = {}
): Promise<Disponibilidade[]> {
  const { data } = await api.get<DisponibilidadeApi[]>("/disponibilidades/", {
    params: {
      profissional: params.profissional,
      ativo: params.ativo,
    },
  })
  return data.map(mapDisponibilidade)
}

export async function criarDisponibilidade(
  profissional_id: number,
  slot: GradeSemanalSlot
): Promise<Disponibilidade> {
  const { data } = await api.post<DisponibilidadeApi>("/disponibilidades/", {
    profissional: profissional_id,
    dia_semana: slot.dia_semana,
    horario_inicio: slot.horario_inicio,
    horario_fim: slot.horario_fim,
  })
  return mapDisponibilidade(data)
}

export async function desativarDisponibilidade(id: number): Promise<void> {
  await api.delete(`/disponibilidades/${id}/`)
}

export async function reativarDisponibilidadeApi(id: number): Promise<Disponibilidade> {
  const { data } = await api.patch<DisponibilidadeApi>(`/disponibilidades/${id}/`, {
    ativo: true,
  })
  return mapDisponibilidade(data)
}

// --- Ausências ----------------------------------------------------------------

interface ListarAusenciasParams {
  profissional?: number
  ativo?: boolean
}

export async function listarAusencias(params: ListarAusenciasParams = {}): Promise<Ausencia[]> {
  const { data } = await api.get<AusenciaApi[]>("/ausencias/", {
    params: {
      profissional: params.profissional,
      ativo: params.ativo,
    },
  })
  return data.map(mapAusencia)
}

export async function criarAusencia(payload: AusenciaPayload): Promise<Ausencia> {
  const { data } = await api.post<AusenciaApi>("/ausencias/", toAusenciaBody(payload))
  return mapAusencia(data)
}

export async function atualizarAusencia(id: number, payload: AusenciaPayload): Promise<Ausencia> {
  const { data } = await api.patch<AusenciaApi>(`/ausencias/${id}/`, toAusenciaBody(payload))
  return mapAusencia(data)
}

export async function desativarAusencia(id: number): Promise<void> {
  await api.delete(`/ausencias/${id}/`)
}

export async function reativarAusenciaApi(id: number): Promise<Ausencia> {
  const { data } = await api.patch<AusenciaApi>(`/ausencias/${id}/`, { ativo: true })
  return mapAusencia(data)
}
