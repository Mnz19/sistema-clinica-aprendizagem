/**
 * Consulta de endereço por CEP via ViaCEP (https://viacep.com.br).
 *
 * Serviço público e gratuito. Usa `fetch` nativo (não o cliente axios da API
 * interna), pois é um endpoint externo sem autenticação.
 */

export interface EnderecoViaCep {
  logradouro: string
  complemento: string
  bairro: string
  cidade: string
  estado: string
}

/**
 * Busca o endereço de um CEP (com ou sem máscara).
 *
 * @returns o endereço encontrado, ou `null` se o CEP não existir.
 * @throws  em caso de falha de rede/serviço.
 */
export async function buscarCep(cep: string): Promise<EnderecoViaCep | null> {
  const d = cep.replace(/\D/g, "")
  if (d.length !== 8) return null

  const resp = await fetch(`https://viacep.com.br/ws/${d}/json/`)
  if (!resp.ok) {
    throw new Error("Não foi possível consultar o CEP.")
  }

  const data = await resp.json()
  if (data.erro) return null

  return {
    logradouro: data.logradouro ?? "",
    complemento: data.complemento ?? "",
    bairro: data.bairro ?? "",
    cidade: data.localidade ?? "",
    estado: data.uf ?? "",
  }
}
