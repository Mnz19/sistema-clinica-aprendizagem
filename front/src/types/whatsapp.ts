/**
 * Tipos das confirmações de consulta por WhatsApp (`apps.whatsapp`).
 */
import type { Papel } from "@/types/auth"

/** Papéis que podem configurar as confirmações. */
export const PAPEIS_CONFIG_WHATSAPP: Papel[] = ["DIRECAO", "SUPERVISAO"]

/** Configuração única do envio de confirmações. */
export interface ConfiguracaoConfirmacao {
  ativo: boolean
  antecedencia_dias: number
  /** Horário do disparo no formato `HH:MM` ou `HH:MM:SS`. */
  horario_disparo: string
  mensagem: string
  template_meta_nome: string
  template_meta_idioma: string
  /** Verdadeiro quando não há credenciais da Meta (envio simulado). */
  simulado: boolean
  atualizado_em: string
}

/** Payload de atualização da configuração. */
export interface ConfiguracaoPayload {
  ativo: boolean
  antecedencia_dias: number
  horario_disparo: string
  mensagem: string
  template_meta_nome: string
  template_meta_idioma: string
}
