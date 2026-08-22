/**
 * Serviço de gestão de usuários (equipe da clínica).
 *
 * Endpoints (`/api/usuarios/`, restrito a DIREÇÃO e SUPERVISÃO):
 *   GET/POST/PATCH/DELETE. A remoção (DELETE) é lógica: desativa o usuário.
 */
import { api } from "@/services/api"
import type { Usuario } from "@/types/auth"
import type { UsuarioPayload } from "@/types/usuario"

interface ListarParams {
  search?: string
  role?: string
  is_active?: boolean
}

/** Lista os usuários da equipe. */
export async function listarUsuarios(
  params: ListarParams = {}
): Promise<Usuario[]> {
  const { data } = await api.get<Usuario[]>("/usuarios/", {
    params: {
      search: params.search || undefined,
      role: params.role || undefined,
      is_active: params.is_active,
    },
  })
  return data
}

/** Cria um novo usuário. */
export async function criarUsuario(payload: UsuarioPayload): Promise<Usuario> {
  const { data } = await api.post<Usuario>("/usuarios/", payload)
  return data
}

/** Atualiza (parcialmente) um usuário. */
export async function atualizarUsuario(
  id: number,
  payload: Partial<UsuarioPayload>
): Promise<Usuario> {
  const { data } = await api.patch<Usuario>(`/usuarios/${id}/`, payload)
  return data
}

/** Desativa (exclusão lógica) um usuário. */
export async function desativarUsuario(id: number): Promise<void> {
  await api.delete(`/usuarios/${id}/`)
}

/** Reativa um usuário previamente desativado. */
export async function reativarUsuario(id: number): Promise<Usuario> {
  return atualizarUsuario(id, { is_active: true })
}

/** (Re)envia o convite de acesso por e-mail para o usuário. */
export async function reenviarConvite(id: number): Promise<void> {
  await api.post(`/usuarios/${id}/enviar-convite/`)
}
