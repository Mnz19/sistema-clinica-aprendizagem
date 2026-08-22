/**
 * Tipos do domínio de especialidades dos prestadores.
 *
 * Espelham o ``EspecialidadeSerializer`` do backend (`apps.accounts`). A lista é
 * gerenciável pela clínica (DIREÇÃO/SUPERVISÃO) e vinculada aos profissionais.
 */

export interface Especialidade {
  id: number
  nome: string
  ativo: boolean
  criado_em: string
  atualizado_em: string
}

/** Payload de criação/edição de especialidade. */
export interface EspecialidadePayload {
  nome: string
  ativo?: boolean
}
