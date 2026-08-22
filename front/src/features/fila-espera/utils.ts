/** Utilitários da fila de espera. */

/** Tempo decorrido desde a entrada na fila, em linguagem natural (pt-BR). */
export function tempoDeEspera(criadoEm: string): string {
  const inicio = new Date(criadoEm).getTime()
  const dias = Math.floor((Date.now() - inicio) / 86_400_000)
  if (dias <= 0) return "hoje"
  if (dias === 1) return "1 dia"
  if (dias < 30) return `${dias} dias`
  const meses = Math.floor(dias / 30)
  return meses === 1 ? "1 mês" : `${meses} meses`
}
