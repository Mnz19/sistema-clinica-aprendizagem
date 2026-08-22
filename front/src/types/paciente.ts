/**
 * Tipos do domínio de pacientes.
 *
 * Espelham o contrato da API do backend (`apps.pacientes`): cadastro do paciente,
 * responsáveis legais (estruturados) e anexos do cadastro.
 */
import type { Papel } from "@/types/auth"

/** Parentesco do responsável (enum `Parentesco` do backend). */
export const PARENTESCOS = {
  MAE: "Mãe",
  PAI: "Pai",
  AVO: "Avó/Avô",
  TIO: "Tia/Tio",
  TUTOR: "Tutor(a) legal",
  OUTRO: "Outro",
} as const

export type Parentesco = keyof typeof PARENTESCOS

/** Tipos de anexo do cadastro (enum `TipoDocumento` do backend). */
export const TIPOS_DOCUMENTO = {
  DOCUMENTO_PESSOAL: "Documento pessoal",
  SOLICITACAO_MEDICA: "Solicitação médica",
  RELATORIO: "Relatório",
  LAUDO: "Laudo",
  ENCAMINHAMENTO: "Encaminhamento",
  OUTRO: "Outro",
} as const

export type TipoDocumento = keyof typeof TIPOS_DOCUMENTO

/** Séries/anos escolares (enum `SerieEscolar` do backend). */
export const SERIES_ESCOLARES = {
  BERCARIO: "Berçário",
  MATERNAL: "Maternal",
  PRE_1: "Pré I (Jardim I)",
  PRE_2: "Pré II (Jardim II)",
  EF_1: "1º ano — Fundamental",
  EF_2: "2º ano — Fundamental",
  EF_3: "3º ano — Fundamental",
  EF_4: "4º ano — Fundamental",
  EF_5: "5º ano — Fundamental",
  EF_6: "6º ano — Fundamental",
  EF_7: "7º ano — Fundamental",
  EF_8: "8º ano — Fundamental",
  EF_9: "9º ano — Fundamental",
  EM_1: "1ª série — Médio",
  EM_2: "2ª série — Médio",
  EM_3: "3ª série — Médio",
} as const

export type SerieEscolar = keyof typeof SERIES_ESCOLARES

/** Unidades federativas. */
export const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const

export type UF = (typeof UFS)[number]

/** Resumo de um profissional vinculado (ou disponível para vínculo). */
export interface ProfissionalResumo {
  id: number
  nome: string
  email: string
  role: Papel
}

/** Responsável legal (pai/mãe/tutor) do paciente. */
export interface Responsavel {
  id?: number
  nome: string
  parentesco: Parentesco
  cpf: string
  telefone: string
  email: string
  principal: boolean
}

/** Anexo do cadastro do paciente. */
export interface DocumentoPaciente {
  id: number
  paciente: number
  arquivo_url: string | null
  nome_original: string
  tipo: TipoDocumento
  tipo_display: string
  descricao: string
  enviado_por: number | null
  enviado_por_nome: string | null
  criado_em: string
}

/** Item da listagem de pacientes (representação enxuta). */
export interface PacienteListItem {
  id: number
  nome_completo: string
  data_nascimento: string
  idade: number | null
  cpf: string | null
  telefone: string
  profissionais: ProfissionalResumo[]
  ativo: boolean
  atualizado_em: string
}

/** Cadastro completo do paciente (detalhe). */
export interface Paciente {
  id: number
  nome_completo: string
  data_nascimento: string
  idade: number | null
  cpf: string | null
  email: string
  telefone: string
  cep: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  estado: string
  escola: string
  serie_escolar: string
  escola_responsavel_nome: string
  escola_responsavel_telefone: string
  nome_mae: string
  nome_pai: string
  foto: string | null
  informacoes_complementares: string
  diagnostico: string
  cid: string
  alertas: string
  profissionais: number[]
  profissionais_detalhe: ProfissionalResumo[]
  responsaveis: Responsavel[]
  documentos: DocumentoPaciente[]
  ativo: boolean
  criado_por: number | null
  criado_em: string
  atualizado_em: string
}

/** Payload de criação/edição do paciente. */
export interface PacientePayload {
  nome_completo: string
  data_nascimento: string
  cpf?: string | null
  email?: string
  telefone?: string
  cep?: string
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  cidade?: string
  estado?: string
  escola?: string
  serie_escolar?: string
  escola_responsavel_nome?: string
  escola_responsavel_telefone?: string
  nome_mae?: string
  nome_pai?: string
  informacoes_complementares?: string
  diagnostico?: string
  cid?: string
  alertas?: string
  profissionais?: number[]
  responsaveis?: Responsavel[]
}
