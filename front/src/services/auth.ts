/**
 * Serviço de autenticação: chamadas à API de contas do backend.
 *
 * Endpoints: `POST /auth/login/`, `POST /auth/logout/`, `GET /auth/me/`.
 */
import { api } from "@/services/api"
import type { LoginCredentials, LoginResponse, Usuario } from "@/types/auth"

/** Autentica por e-mail e senha; retorna tokens e dados do usuário. */
export async function login(
  credenciais: LoginCredentials
): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>("/auth/login/", credenciais)
  return data
}

/** Invalida o refresh token no servidor (blacklist). */
export async function logout(refreshToken: string): Promise<void> {
  await api.post("/auth/logout/", { refresh: refreshToken })
}

/** Retorna os dados do usuário autenticado. */
export async function buscarUsuarioAtual(): Promise<Usuario> {
  const { data } = await api.get<Usuario>("/auth/me/")
  return data
}

/** Troca a senha do próprio usuário (exige a senha atual). */
export async function trocarSenha(input: {
  senha_atual: string
  nova_senha: string
}): Promise<void> {
  await api.post("/auth/change-password/", input)
}

/** Atualiza o próprio perfil (nome, registro no conselho e/ou foto). Retorna os dados atualizados. */
export async function atualizarPerfil(input: {
  nome?: string
  conselho_tipo?: string
  conselho_uf?: string
  conselho_numero?: string
  foto?: File
}): Promise<Usuario> {
  const form = new FormData()
  if (input.nome !== undefined) form.append("nome", input.nome)
  if (input.conselho_tipo !== undefined) form.append("conselho_tipo", input.conselho_tipo)
  if (input.conselho_uf !== undefined) form.append("conselho_uf", input.conselho_uf)
  if (input.conselho_numero !== undefined) form.append("conselho_numero", input.conselho_numero)
  if (input.foto) form.append("foto", input.foto)
  const { data } = await api.patch<Usuario>("/auth/me/", form, {
    headers: { "Content-Type": "multipart/form-data" },
  })
  return data
}

/** Confirma um convite: define a senha e ativa a conta (endpoint público). */
export async function confirmarConvite(input: {
  uid: string
  token: string
  nova_senha: string
}): Promise<void> {
  await api.post("/auth/convite/confirmar/", input)
}
