/**
 * Serviço das confirmações por WhatsApp (`apps.whatsapp`).
 *
 * Endpoints (`/api/whatsapp/`): `config/`, `enviar/<agendamento_id>/`.
 */
import { api } from "@/services/api"
import type {
  ConfiguracaoConfirmacao,
  ConfiguracaoPayload,
} from "@/types/whatsapp"

/** Busca a configuração de confirmações. */
export async function obterConfiguracao(): Promise<ConfiguracaoConfirmacao> {
  const { data } = await api.get<ConfiguracaoConfirmacao>("/whatsapp/config/")
  return data
}

/** Salva a configuração de confirmações. */
export async function salvarConfiguracao(
  payload: ConfiguracaoPayload
): Promise<ConfiguracaoConfirmacao> {
  const { data } = await api.put<ConfiguracaoConfirmacao>(
    "/whatsapp/config/",
    payload
  )
  return data
}

/** Envia (ou reenvia) manualmente a confirmação de um agendamento. */
export async function enviarConfirmacao(agendamentoId: number): Promise<void> {
  await api.post(`/whatsapp/enviar/${agendamentoId}/`)
}
