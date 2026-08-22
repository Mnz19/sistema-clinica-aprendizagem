/**
 * Hook de autenticação para os componentes.
 *
 * Orquestra o serviço de auth (chamadas à API) com a store de sessão (Zustand),
 * expondo o usuário atual, o estado de carregamento/erro e as ações de
 * entrar/sair. Os componentes não falam diretamente com o serviço nem com a
 * store — usam este hook.
 */
import { useState } from "react"
import { AxiosError } from "axios"

import { login as loginRequest, logout as logoutRequest } from "@/services/auth"
import { useAuthStore } from "@/store/authStore"
import { mensagemDeErro } from "@/utils/apiError"
import type { LoginCredentials } from "@/types/auth"

export function useAuth() {
  const user = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const setSession = useAuthStore((s) => s.setSession)
  const clear = useAuthStore((s) => s.clear)

  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  /** Faz login e registra a sessão. Retorna `true` em caso de sucesso. */
  async function entrar(credenciais: LoginCredentials): Promise<boolean> {
    setCarregando(true)
    setErro(null)
    try {
      const { user, access, refresh } = await loginRequest(credenciais)
      setSession({ user, accessToken: access, refreshToken: refresh })
      return true
    } catch (e) {
      if (e instanceof AxiosError && e.response?.status === 401) {
        setErro("E-mail ou senha inválidos.")
      } else {
        setErro(mensagemDeErro(e))
      }
      return false
    } finally {
      setCarregando(false)
    }
  }

  /** Encerra a sessão: invalida o refresh no servidor e limpa o estado local. */
  async function sair(): Promise<void> {
    const refreshToken = useAuthStore.getState().refreshToken
    try {
      if (refreshToken) {
        await logoutRequest(refreshToken)
      }
    } catch {
      // Mesmo se o servidor falhar, limpamos a sessão local de qualquer forma.
    } finally {
      clear()
    }
  }

  return { user, isAuthenticated, carregando, erro, entrar, sair }
}
