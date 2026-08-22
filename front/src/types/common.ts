/** Tipos utilitários compartilhados entre domínios. */

/**
 * Resposta paginada padrão do DRF (`PageNumberPagination`).
 *
 * Hoje só a trilha de auditoria (`/api/logs/`) é paginada — as demais listagens
 * devolvem array puro. Ao paginar outros endpoints, reutilize este tipo.
 */
export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}
