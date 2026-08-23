/**
 * Tipos do domínio de autenticação.
 *
 * Espelham o contrato da API do backend (`apps.accounts`): usuário com login por
 * e-mail, papel (`role`) e tokens JWT (access + refresh).
 */
import type { Especialidade } from "@/types/especialidade"

/** Papéis possíveis do usuário (enum `Papel` do backend). */
export const PAPEIS = {
  DIRECAO: "DIRECAO",
  SUPERVISAO: "SUPERVISAO",
  PROFISSIONAL: "PROFISSIONAL",
  RECEPCAO: "RECEPCAO",
  FINANCEIRO: "FINANCEIRO",
} as const

export type Papel = (typeof PAPEIS)[keyof typeof PAPEIS]

/** Rótulos legíveis de cada papel, para exibição na interface. */
export const PAPEL_LABELS: Record<Papel, string> = {
  DIRECAO: "Direção",
  SUPERVISAO: "Supervisão",
  PROFISSIONAL: "Profissional",
  RECEPCAO: "Recepção",
  FINANCEIRO: "Financeiro",
}

/** Sexo/gênero (enum `Sexo` do backend). */
export const SEXOS = {
  MASCULINO: "MASCULINO",
  FEMININO: "FEMININO",
  OUTRO: "OUTRO",
} as const

export type Sexo = (typeof SEXOS)[keyof typeof SEXOS]

export const SEXO_LABELS: Record<Sexo, string> = {
  MASCULINO: "Masculino",
  FEMININO: "Feminino",
  OUTRO: "Outro",
}

/** Conselho profissional de classe (enum `TipoConselho` do backend). */
export const TIPOS_CONSELHO = {
  CRP: "CRP",
  CRM: "CRM",
  CREFONO: "CREFONO",
  CREFITO: "CREFITO",
  CRESS: "CRESS",
  CRN: "CRN",
  CREF: "CREF",
  OUTRO: "OUTRO",
} as const

export type TipoConselho = (typeof TIPOS_CONSELHO)[keyof typeof TIPOS_CONSELHO]

export const CONSELHO_LABELS: Record<TipoConselho, string> = {
  CRP: "CRP — Psicologia",
  CRM: "CRM — Medicina",
  CREFONO: "CREFONO — Fonoaudiologia",
  CREFITO: "CREFITO — Fisioterapia/T.O.",
  CRESS: "CRESS — Serviço Social",
  CRN: "CRN — Nutrição",
  CREF: "CREF — Educação Física",
  OUTRO: "Outro",
}

/** Dados do usuário retornados pela API (`/auth/me/`, login e `/usuarios/`). */
export interface Usuario {
  id: number
  nome: string
  email: string
  /** Papel principal (derivado do conjunto `papeis`). Usado em exibição. */
  role: Papel
  /** Todos os papéis do usuário (um usuário pode acumular papéis). */
  papeis: Papel[]
  foto: string | null

  // Dados pessoais
  cpf: string | null
  rg: string
  rg_orgao_emissor: string
  data_nascimento: string | null
  sexo: Sexo | ""

  // Contato
  telefone: string
  celular: string

  // Registro no conselho (assinatura do prontuário)
  conselho_tipo: TipoConselho | ""
  conselho_uf: string
  conselho_numero: string
  /** Registro montado a partir dos campos acima (ex.: "CRP PA/1009775"). Somente leitura. */
  conselho: string

  // Endereço
  cep: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  estado: string

  // Qualificação profissional
  especialidades: number[]
  especialidades_detalhe: Especialidade[]

  is_active: boolean
  is_staff: boolean
  is_superuser: boolean
  precisa_trocar_senha: boolean
  last_login: string | null
  criado_em: string
  atualizado_em: string
}

/**
 * Conjunto de papéis do usuário (fallback para `[role]` em tokens/caches antigos
 * que ainda não trazem `papeis`).
 */
export function papeisDoUsuario(
  user: Pick<Usuario, "papeis" | "role"> | null | undefined,
): Papel[] {
  if (!user) return []
  return user.papeis?.length ? user.papeis : user.role ? [user.role] : []
}

/** Verdadeiro se o usuário tem **algum** dos papéis informados (multi-papel). */
export function temPapel(
  user: Pick<Usuario, "papeis" | "role"> | null | undefined,
  ...papeis: Papel[]
): boolean {
  const conjunto = papeisDoUsuario(user)
  return papeis.some((p) => conjunto.includes(p))
}

/**
 * Regra de acesso à trilha de auditoria (aba "Logs").
 *
 * Só a DIREÇÃO da clínica ou o superusuário técnico podem ver os logs — espelha
 * a permissão `IsDirecaoOuSuperuser` do backend. Centralizado aqui para o guard de
 * rota e o menu lateral usarem a mesma regra.
 */
export function podeVerLogs(user: Usuario | null | undefined): boolean {
  return !!user && (temPapel(user, "DIRECAO") || user.is_superuser)
}

/** Credenciais enviadas para `POST /auth/login/`. */
export interface LoginCredentials {
  email: string
  password: string
}

/** Resposta de `POST /auth/login/`. */
export interface LoginResponse {
  access: string
  refresh: string
  user: Usuario
}

/**
 * Resposta de `POST /auth/refresh/`.
 *
 * O backend usa rotação (`ROTATE_REFRESH_TOKENS`), então devolve também um novo
 * refresh — o antigo é invalidado (blacklist).
 */
export interface RefreshResponse {
  access: string
  refresh: string
}
