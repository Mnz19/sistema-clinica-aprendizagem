/**
 * Serviço de gestão de especialidades (Cadastros › Especialidades).
 *
 * Endpoints (`/api/especialidades/`, restrito a DIREÇÃO e SUPERVISÃO):
 *   GET/POST/PATCH/DELETE. A remoção (DELETE) é lógica: desativa a especialidade.
 */
import { api } from "@/services/api"
import type { Especialidade, EspecialidadePayload } from "@/types/especialidade"

interface ListarParams {
  /** Quando ``true`` (padrão do backend), lista só as ativas. Use ``todos`` para ver todas. */
  todos?: boolean
  search?: string
}

/** Lista as especialidades. Por padrão, apenas as ativas. */
export async function listarEspecialidades(
  params: ListarParams = {}
): Promise<Especialidade[]> {
  const { data } = await api.get<Especialidade[]>("/especialidades/", {
    params: {
      todos: params.todos ? 1 : undefined,
      search: params.search || undefined,
    },
  })
  return data
}

/** Cria uma nova especialidade. */
export async function criarEspecialidade(
  payload: EspecialidadePayload
): Promise<Especialidade> {
  const { data } = await api.post<Especialidade>("/especialidades/", payload)
  return data
}

/** Atualiza (parcialmente) uma especialidade. */
export async function atualizarEspecialidade(
  id: number,
  payload: Partial<EspecialidadePayload>
): Promise<Especialidade> {
  const { data } = await api.patch<Especialidade>(`/especialidades/${id}/`, payload)
  return data
}

/** Desativa (exclusão lógica) uma especialidade. */
export async function desativarEspecialidade(id: number): Promise<void> {
  await api.delete(`/especialidades/${id}/`)
}

/** Reativa uma especialidade previamente desativada. */
export async function reativarEspecialidade(id: number): Promise<Especialidade> {
  return atualizarEspecialidade(id, { ativo: true })
}
