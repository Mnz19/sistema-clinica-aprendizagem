/**
 * Tipos do domínio de clínica (Fase 1 — Fundações Operacionais).
 *
 * Espelham o contrato da API do backend (`apps.clinica`): salas de
 * atendimento, serviços prestados (vinculados a um profissional) e a agenda
 * dos profissionais — disponibilidades recorrentes (`DisponibilidadeProfissional`)
 * e ausências pontuais (`AusenciaProfissional`).
 */

/** Dia da semana (`0` = segunda-feira … `6` = domingo), igual ao backend. */
export const DIA_SEMANA_LABELS: Record<number, string> = {
  0: "Segunda-feira",
  1: "Terça-feira",
  2: "Quarta-feira",
  3: "Quinta-feira",
  4: "Sexta-feira",
  5: "Sábado",
  6: "Domingo",
}

export const DIAS_SEMANA = Object.entries(DIA_SEMANA_LABELS).map(([value, label]) => ({
  value: Number(value),
  label,
}))

/** Abreviações para badges na listagem de grades semanais. */
export const DIA_SEMANA_ABREV: Record<number, string> = {
  0: "Seg",
  1: "Ter",
  2: "Qua",
  3: "Qui",
  4: "Sex",
  5: "Sáb",
  6: "Dom",
}

import type { Usuario } from "@/types/auth"

/** Nome de exibição do profissional a partir do `profissional_id` e da lista carregada. */
export function nomeProfissional(profissionalId: number, profissionais: Usuario[]): string {
  return profissionais.find((p) => p.id === profissionalId)?.nome ?? "—"
}

/** Nomes de exibição de vários profissionais, separados por vírgula. */
export function nomesProfissionais(ids: number[], profissionais: Usuario[]): string {
  const nomes = ids
    .map((id) => profissionais.find((p) => p.id === id)?.nome)
    .filter((nome): nome is string => Boolean(nome))
  return nomes.length > 0 ? nomes.join(", ") : "—"
}

/** Espaço físico de atendimento (sala de consulta, avaliação, etc.). */
export interface Sala {
  id: number
  nome: string
  descricao: string
  ativa: boolean
  criado_em: string
  atualizado_em: string
}

/** Payload de criação/edição de sala. */
export interface SalaPayload {
  nome: string
  descricao?: string
}

/** Atendimento que ocupa uma sala no momento (cronômetro em andamento). */
export interface AtendimentoEmAndamento {
  agendamento_id: number
  paciente_id: number
  paciente_nome: string
  profissional_id: number
  profissional_nome: string
  servico_nome: string
  atendimento_iniciado_em: string
  duracao_atendimento_segundos: number
}

/** Estado de ocupação de uma sala (visão de ocupação por sala). */
export interface SalaOcupacao {
  sala_id: number
  sala_nome: string
  em_uso: boolean
  atendimento: AtendimentoEmAndamento | null
}

/** Serviço prestado pela clínica (tipo de atendimento), vinculado a um ou mais profissionais. */
export interface Servico {
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

/** Payload de criação/edição de serviço. */
export interface ServicoPayload {
  nome: string
  descricao?: string
  duracao_minutos: number
  valor_clinica: string
  valor_repasse: string
  profissionais: number[]
}

/** Janela recorrente de disponibilidade de um profissional em um dia da semana. */
export interface Disponibilidade {
  id: number
  profissional_id: number
  dia_semana: number
  horario_inicio: string
  horario_fim: string
  ativo: boolean
  criado_em: string
  atualizado_em: string
}

/** Payload de criação/edição de disponibilidade. */
export interface DisponibilidadePayload {
  profissional_id: number
  dia_semana: number
  horario_inicio: string
  horario_fim: string
}

/** Slot individual da grade semanal (sem `profissional_id`; informado na ação de salvar). */
export interface GradeSemanalSlot {
  dia_semana: number
  horario_inicio: string
  horario_fim: string
}

/** Período de ausência (férias, licença, folga) de um profissional. */
export interface Ausencia {
  id: number
  profissional_id: number
  data_inicio: string
  data_fim: string
  motivo: string
  ativo: boolean
  criado_em: string
  atualizado_em: string
}

/** Payload de criação/edição de ausência. */
export interface AusenciaPayload {
  profissional_id: number
  data_inicio: string
  data_fim: string
  motivo?: string
}
