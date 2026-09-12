/**
 * Serviço da aba de Relatórios (`/api/relatorios/<id>/`).
 *
 * Cada relatório tem uma rota só, que atende os dois formatos:
 * - sem `formato` → JSON (prévia na tela)
 * - `?formato=xlsx` → arquivo `.xlsx` (download)
 *
 * Como a filtragem e a permissão ficam no backend, a planilha baixada é sempre
 * exatamente o que a prévia mostrou.
 */
import { AxiosError } from "axios"

import { api } from "@/services/api"
import type {
  FiltrosRelatorio,
  RelatorioId,
  RespostaRelatorio,
} from "@/types/relatorio"

/**
 * Converte os filtros da tela em query params do axios.
 *
 * Descarta vazios (para não enviar `?cidade=` e receber um 400 inútil) e
 * serializa os multi-valor como lista, que o backend lê com `getlist`.
 */
function montarParams(filtros: FiltrosRelatorio): Record<string, unknown> {
  const params: Record<string, unknown> = {}

  for (const [chave, valor] of Object.entries(filtros)) {
    if (valor === undefined || valor === null || valor === "") continue
    if (Array.isArray(valor)) {
      if (valor.length > 0) params[chave] = valor
      continue
    }
    params[chave] = valor
  }

  return params
}

/** Busca a prévia do relatório (JSON). */
export async function buscarRelatorio(
  id: RelatorioId,
  filtros: FiltrosRelatorio = {},
): Promise<RespostaRelatorio> {
  const { data } = await api.get<RespostaRelatorio>(`/relatorios/${id}/`, {
    params: montarParams(filtros),
    // `repeat` gera ?status=A&status=B, que é o formato que o backend espera.
    paramsSerializer: { indexes: null },
  })
  return data
}

/** Lê o nome do arquivo sugerido pelo backend no header `Content-Disposition`. */
function nomeDoArquivo(cabecalho: string | undefined, padrao: string): string {
  const encontrado = cabecalho?.match(/filename="?([^"]+)"?/)
  return encontrado?.[1] ?? padrao
}

/**
 * Extrai a mensagem de erro de uma resposta que veio como `blob`.
 *
 * Com `responseType: "blob"` o axios entrega até o corpo de erro como Blob, então
 * um 400 de filtro inválido chegaria como `[object Blob]` na interface. Aqui o
 * blob é lido como texto e o JSON do DRF é traduzido em mensagem legível.
 */
async function mensagemDeErroBlob(erro: unknown): Promise<string> {
  const resposta = (erro as AxiosError)?.response
  const corpo = resposta?.data

  if (corpo instanceof Blob) {
    try {
      const json = JSON.parse(await corpo.text())
      // DRF devolve {campo: ["mensagem"]} ou {detail: "mensagem"}.
      if (typeof json?.detail === "string") return json.detail
      const primeiro = Object.values(json)[0]
      if (Array.isArray(primeiro) && typeof primeiro[0] === "string") {
        return primeiro[0]
      }
      if (typeof primeiro === "string") return primeiro
    } catch {
      // Corpo não era JSON — cai no genérico abaixo.
    }
  }

  if (resposta?.status === 403) {
    return "Você não tem permissão para exportar este relatório."
  }
  return "Não foi possível gerar a planilha. Tente novamente."
}

/**
 * Baixa o relatório em Excel e dispara o download no navegador.
 *
 * O arquivo vem como `blob` porque a requisição precisa do header de
 * autenticação — um `<a href>` direto não carrega o JWT. Por isso criamos uma
 * URL temporária de objeto e a revogamos em seguida, para não vazar memória.
 */
export async function baixarRelatorioXlsx(
  id: RelatorioId,
  filtros: FiltrosRelatorio = {},
): Promise<void> {
  let resposta
  try {
    resposta = await api.get<Blob>(`/relatorios/${id}/`, {
      params: { ...montarParams(filtros), formato: "xlsx" },
      paramsSerializer: { indexes: null },
      responseType: "blob",
    })
  } catch (erro) {
    throw new Error(await mensagemDeErroBlob(erro), { cause: erro })
  }

  const url = URL.createObjectURL(resposta.data)
  const link = document.createElement("a")
  link.href = url
  link.download = nomeDoArquivo(
    resposta.headers["content-disposition"] as string | undefined,
    `relatorio_${id}.xlsx`,
  )
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
