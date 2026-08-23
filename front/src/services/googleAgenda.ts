/** Integração com o Google Agenda: status, conectar (OAuth) e desconectar. */
import { api } from "@/services/api"

export interface StatusGoogleAgenda {
  /** A integração está configurada no servidor (client id/secret presentes). */
  configurado: boolean
  /** O usuário já conectou uma conta Google. */
  conectado: boolean
  /** A sincronização está ligada (pode ser pausada sem desconectar). */
  ativa: boolean
  /** E-mail da conta Google conectada (para exibição). */
  email_google: string
  /** Data/hora da conexão (ISO) ou null. */
  conectada_em: string | null
}

/** Estado atual da conexão do usuário logado com o Google Agenda. */
export async function obterStatusGoogle(): Promise<StatusGoogleAgenda> {
  const { data } = await api.get<StatusGoogleAgenda>("/google/status/")
  return data
}

/** URL de consentimento do Google para onde o usuário deve ser levado. */
export async function obterUrlAutorizacaoGoogle(): Promise<string> {
  const { data } = await api.get<{ authorization_url: string }>(
    "/google/authorize/",
  )
  return data.authorization_url
}

/** Liga/desliga a sincronização sem desconectar a conta. */
export async function alternarSincronizacaoGoogle(
  ativa: boolean,
): Promise<StatusGoogleAgenda> {
  const { data } = await api.patch<StatusGoogleAgenda>("/google/status/", {
    ativa,
  })
  return data
}

/** Desconecta a conta Google do usuário logado. */
export async function desconectarGoogle(): Promise<void> {
  await api.delete("/google/disconnect/")
}
