/**
 * Tipos do domínio de gestão de usuários (equipe da clínica).
 *
 * Espelham o `UsuarioAdminSerializer` do backend (`apps.accounts`). O tipo base
 * `Usuario` (leitura) vive em `types/auth.ts`; aqui ficam os payloads de escrita.
 */
import type { Papel, Sexo, TipoConselho } from "@/types/auth"

/** Papéis que podem gerenciar a equipe (tela de Usuários). */
export const PAPEIS_GESTORES: Papel[] = ["DIRECAO", "SUPERVISAO"]

/** Payload de criação/edição de usuário/prestador. */
export interface UsuarioPayload {
  nome: string
  email: string
  /** Papel principal — opcional; o backend deriva de `papeis`. */
  role?: Papel
  /** Papéis do usuário (um ou mais). É o que a gestão envia agora. */
  papeis?: Papel[]
  is_active: boolean

  // Dados pessoais (opcionais). CPF com máscara é normalizado pelo backend.
  cpf?: string | null
  rg?: string
  rg_orgao_emissor?: string
  data_nascimento?: string | null
  sexo?: Sexo | ""

  // Contato
  telefone?: string
  celular?: string

  // Registro no conselho (relevante para o papel PROFISSIONAL)
  conselho_tipo?: TipoConselho | ""
  conselho_uf?: string
  conselho_numero?: string

  // Endereço
  cep?: string
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  cidade?: string
  estado?: string

  /** Ids das especialidades (obrigatório para o papel PROFISSIONAL). */
  especialidades?: number[]

  /** Senha inicial (obrigatória na criação por senha; em branco na edição mantém). */
  password?: string
  /** Se verdadeiro, cria sem senha e envia convite por e-mail. */
  enviar_convite?: boolean
}
