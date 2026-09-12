/**
 * Tabela de prévia de um relatório.
 *
 * As colunas vêm descritas pela API (`RespostaRelatorio.colunas`), então este
 * componente serve os quatro relatórios sem conhecer nenhum deles. A formatação
 * é inferida do `formato` que o backend declara para o Excel — é a mesma
 * informação, reaproveitada na tela.
 */
import { cn } from "@/lib/utils"
import {
  FORMATO_DATA,
  FORMATO_DATA_HORA,
  FORMATO_MOEDA,
} from "@/features/relatorios/formatos"
import type {
  ColunaRelatorio,
  LinhaRelatorio,
  RespostaRelatorio,
} from "@/types/relatorio"
import { formatarData, formatarDataHora, formatarMoeda } from "@/utils/format"

/** Colunas numéricas são alinhadas à direita, como em qualquer planilha. */
function ehNumerica(coluna: ColunaRelatorio): boolean {
  return coluna.formato === FORMATO_MOEDA || coluna.somar
}

/** Formata uma célula conforme o formato declarado pela coluna. */
function formatarCelula(
  valor: LinhaRelatorio[string],
  coluna: ColunaRelatorio,
): string {
  if (valor === null || valor === undefined || valor === "") return "—"

  if (coluna.formato === FORMATO_MOEDA) {
    return formatarMoeda(Number(valor))
  }
  if (coluna.formato === FORMATO_DATA) {
    return formatarData(String(valor))
  }
  if (coluna.formato === FORMATO_DATA_HORA) {
    return formatarDataHora(String(valor))
  }
  return String(valor)
}

interface RelatorioTabelaProps {
  relatorio: RespostaRelatorio
}

export default function RelatorioTabela({ relatorio }: RelatorioTabelaProps) {
  const { colunas, linhas, totais } = relatorio
  const temTotais = colunas.some((coluna) => coluna.somar)

  return (
    // A rolagem horizontal fica contida na tabela: relatórios largos (pacientes
    // tem 26 colunas) não devem empurrar o layout da página.
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 bg-muted/50">
          <tr>
            {colunas.map((coluna) => (
              <th
                key={coluna.chave}
                scope="col"
                className={cn(
                  "whitespace-nowrap border-b border-border px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground",
                  ehNumerica(coluna) ? "text-right" : "text-left",
                )}
              >
                {coluna.titulo}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {linhas.map((linha, indice) => (
            <tr
              // Os relatórios são somente leitura e não expõem o id do registro;
              // a posição na lista é uma chave estável para esta renderização.
              key={indice}
              className="border-b border-border/60 last:border-0 hover:bg-muted/30"
            >
              {colunas.map((coluna) => (
                <td
                  key={coluna.chave}
                  className={cn(
                    "px-3 py-2 align-top text-foreground",
                    ehNumerica(coluna)
                      ? "whitespace-nowrap text-right tabular-nums"
                      : "max-w-[22rem]",
                  )}
                >
                  {formatarCelula(linha[coluna.chave], coluna)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>

        {temTotais && linhas.length > 0 && (
          <tfoot className="bg-muted/40 font-medium">
            <tr>
              {colunas.map((coluna, indice) => (
                <td
                  key={coluna.chave}
                  className={cn(
                    "border-t border-border px-3 py-2.5 text-foreground",
                    ehNumerica(coluna)
                      ? "whitespace-nowrap text-right tabular-nums"
                      : "text-left",
                  )}
                >
                  {indice === 0
                    ? `${relatorio.total_registros} registro(s)`
                    : coluna.somar
                      ? formatarCelula(totais[coluna.chave] ?? 0, coluna)
                      : ""}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}
