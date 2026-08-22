/**
 * Store de autenticação (Zustand + persist).
 *
 * É a fonte única da verdade da sessão: usuário logado e tokens JWT. Fica
 * persistida no localStorage para sobreviver a refresh de página. Como o estado
 * é acessível fora do React (`useAuthStore.getState()`), os interceptors do
 * axios leem e atualizam os tokens diretamente por aqui.
 */
import { create } from "zustand"
import { persist } from "zustand/middleware"

import type { Usuario } from "@/types/auth"

interface AuthState {
  user: Usuario | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean

  /** Registra uma sessão completa após o login. */
  setSession: (dados: {
    user: Usuario
    accessToken: string
    refreshToken: string
  }) => void
  /** Atualiza apenas os tokens (usado na renovação automática). */
  setTokens: (tokens: { accessToken: string; refreshToken: string }) => void
  /** Atualiza os dados do usuário (ex.: após `/auth/me/`). */
  setUser: (user: Usuario) => void
  /** Limpa a sessão (logout ou refresh expirado). */
  clear: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      setSession: ({ user, accessToken, refreshToken }) =>
        set({ user, accessToken, refreshToken, isAuthenticated: true }),

      setTokens: ({ accessToken, refreshToken }) =>
        set({ accessToken, refreshToken }),

      setUser: (user) => set({ user }),

      clear: () =>
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        }),
    }),
    {
      name: "fontes-auth",
    }
  )
)
