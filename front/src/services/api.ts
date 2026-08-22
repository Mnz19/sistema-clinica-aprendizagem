/**
 * Cliente HTTP central (axios).
 *
 * - Request: injeta o access token (`Authorization: Bearer <token>`).
 * - Response: em caso de 401, tenta renovar o access token via `/auth/refresh/`
 *   uma única vez e refaz a requisição original. Requisições concorrentes que
 *   receberem 401 durante a renovação aguardam numa fila e são refeitas juntas.
 *
 * A renovação usa uma instância "crua" do axios para não disparar os próprios
 * interceptors (evita recursão).
 */
import axios, { AxiosError } from "axios"
import type { InternalAxiosRequestConfig } from "axios"

import { useAuthStore } from "@/store/authStore"
import type { RefreshResponse } from "@/types/auth"

const baseURL = import.meta.env.VITE_API_BASE_URL

export const api = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
})

/** Requisição com marca `_retry` para não renovar o token mais de uma vez. */
type RequisicaoComRetry = InternalAxiosRequestConfig & { _retry?: boolean }

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// --- Renovação de token com fila para requisições concorrentes ---------------
let renovando = false
let fila: Array<(token: string | null) => void> = []

function resolverFila(token: string | null) {
  fila.forEach((callback) => callback(token))
  fila = []
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RequisicaoComRetry | undefined
    const status = error.response?.status

    // Sem config, não é 401 ou já tentamos renovar → propaga o erro.
    if (!original || status !== 401 || original._retry) {
      return Promise.reject(error)
    }

    // Não faz sentido renovar a partir do próprio login/refresh.
    const url = original.url ?? ""
    if (url.includes("/auth/login") || url.includes("/auth/refresh")) {
      return Promise.reject(error)
    }

    const refreshToken = useAuthStore.getState().refreshToken
    if (!refreshToken) {
      useAuthStore.getState().clear()
      return Promise.reject(error)
    }

    original._retry = true

    // Já há uma renovação em andamento: entra na fila e aguarda o novo token.
    if (renovando) {
      return new Promise((resolve, reject) => {
        fila.push((token) => {
          if (!token) {
            reject(error)
            return
          }
          original.headers.Authorization = `Bearer ${token}`
          resolve(api(original))
        })
      })
    }

    renovando = true
    try {
      const { data } = await axios.post<RefreshResponse>(
        `${baseURL}/auth/refresh/`,
        { refresh: refreshToken }
      )
      useAuthStore.getState().setTokens({
        accessToken: data.access,
        refreshToken: data.refresh,
      })
      resolverFila(data.access)
      original.headers.Authorization = `Bearer ${data.access}`
      return api(original)
    } catch (erroRenovacao) {
      // Refresh inválido/expirado: encerra a sessão.
      resolverFila(null)
      useAuthStore.getState().clear()
      return Promise.reject(erroRenovacao)
    } finally {
      renovando = false
    }
  }
)
