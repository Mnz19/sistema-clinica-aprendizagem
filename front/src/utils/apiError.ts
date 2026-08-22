/**
 * Extrai uma mensagem de erro legível a partir de uma falha do axios.
 *
 * O DRF costuma responder com `{ "detail": "..." }` ou com um mapa de campos
 * `{ campo: ["mensagem"] }` (incluindo `non_field_errors`). Também trata erro de
 * rede (servidor fora do ar / sem conexão).
 */
import { AxiosError } from "axios"

export function mensagemDeErro(
  erro: unknown,
  padrao = "Ocorreu um erro. Tente novamente."
): string {
  if (erro instanceof AxiosError) {
    if (erro.code === "ERR_NETWORK") {
      return "Não foi possível conectar ao servidor."
    }

    const data = erro.response?.data as Record<string, unknown> | undefined
    if (data) {
      if (typeof data.detail === "string") {
        return data.detail
      }
      // Primeiro erro de campo (ex.: { email: ["Este campo é obrigatório."] }).
      const primeiro = Object.values(data)[0]
      if (Array.isArray(primeiro) && typeof primeiro[0] === "string") {
        return primeiro[0]
      }
      if (typeof primeiro === "string") {
        return primeiro
      }
    }
  }

  return padrao
}
