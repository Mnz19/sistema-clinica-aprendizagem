/**
 * Aba de Relatórios — prévia na tela + exportação em Excel.
 *
 * As abas visíveis dependem do papel: a recepção (e a supervisão) veem
 * Pacientes e Agendamentos; a direção e o financeiro veem também Produção e
 * Repasse. A regra vive em `DEFINICOES_RELATORIO`, espelhando
 * `apps/relatorios/permissions.py` — aqui ela só decide o que aparece, o
 * backend é quem barra o acesso de fato.
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertCircleIcon,
  ChartColumnIcon,
  DownloadIcon,
  FileSpreadsheetIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs } from "@/components/ui/tabs"
import RelatorioFiltros from "@/features/relatorios/components/RelatorioFiltros"
import RelatorioTabela from "@/features/relatorios/components/RelatorioTabela"
import { useAuth } from "@/hooks/useAuth"
import {
  baixarRelatorioXlsx,
  buscarRelatorio,
} from "@/services/relatorios"
import { temPapel } from "@/types/auth"
import {
  DEFINICOES_RELATORIO,
  type FiltrosRelatorio,
  type RelatorioId,
  type RespostaRelatorio,
} from "@/types/relatorio"
import { listarPacientes } from "@/services/pacientes"
import { useClinicaStore } from "@/store/clinicaStore"
import type { PacienteListItem } from "@/types/paciente"

/** Atraso do debounce da busca, para não disparar uma request por tecla. */
const DEBOUNCE_MS = 400

function primeiroDiaMes(ref = new Date()): string {
  const mes = String(ref.getMonth() + 1).padStart(2, "0")
  return `${ref.getFullYear()}-${mes}-01`
}

function ultimoDiaMes(ref = new Date()): string {
  const d = new Date(ref.getFullYear(), ref.getMonth() + 1, 0)
  const mes = String(d.getMonth() + 1).padStart(2, "0")
  return `${d.getFullYear()}-${mes}-${String(d.getDate()).padStart(2, "0")}`
}

/** Filtros iniciais: o mês corrente, que é o recorte mais usado. */
function filtrosIniciais(): FiltrosRelatorio {
  return { data_inicio: primeiroDiaMes(), data_fim: ultimoDiaMes() }
}

export default function RelatoriosPage() {
  const { user } = useAuth()

  // Só os relatórios que o papel do usuário alcança.
  const disponiveis = useMemo(
    () =>
      DEFINICOES_RELATORIO.filter((definicao) =>
        temPapel(user, ...definicao.papeis),
      ),
    [user],
  )

  // Aba escolhida pelo usuário; antes da primeira escolha cai na primeira
  // acessível. Derivar (em vez de sincronizar num efeito) evita um render extra
  // e o piscar da tela vazia no primeiro acesso.
  const [selecionada, setSelecionada] = useState<RelatorioId | null>(null)
  const ativo: RelatorioId | null = selecionada ?? disponiveis[0]?.id ?? null

  const [filtros, setFiltros] = useState<FiltrosRelatorio>(filtrosIniciais)
  const [relatorio, setRelatorio] = useState<RespostaRelatorio | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [baixando, setBaixando] = useState(false)

  const profissionais = useClinicaStore((s) => s.profissionais)
  const salas = useClinicaStore((s) => s.salas)
  const servicos = useClinicaStore((s) => s.servicos)
  const buscarProfissionais = useClinicaStore((s) => s.buscarProfissionais)
  const buscarSalas = useClinicaStore((s) => s.buscarSalas)
  const buscarServicos = useClinicaStore((s) => s.buscarServicos)
  // Não há store de pacientes: a lista enxuta alimenta só o seletor de filtro.
  const [pacientes, setPacientes] = useState<PacienteListItem[]>([])

  const definicaoAtiva = useMemo(
    () => disponiveis.find((definicao) => definicao.id === ativo) ?? null,
    [disponiveis, ativo],
  )

  // Dados dos seletores de filtro — carregados uma vez (os stores fazem cache).
  useEffect(() => {
    void buscarProfissionais()
    void buscarSalas()
    void buscarServicos()
    listarPacientes()
      .then(setPacientes)
      // O seletor de paciente é um filtro opcional: se falhar, o relatório
      // continua utilizável sem ele.
      .catch((falha) =>
        console.error("[RelatoriosPage] listarPacientes:", falha),
      )
  }, [buscarProfissionais, buscarSalas, buscarServicos])

  // Busca a prévia com debounce, reagindo a troca de aba e de filtros.
  useEffect(() => {
    if (!ativo) return

    let cancelado = false
    const temporizador = setTimeout(async () => {
      setCarregando(true)
      setErro(null)
      try {
        const dados = await buscarRelatorio(ativo, filtros)
        if (!cancelado) setRelatorio(dados)
      } catch (falha) {
        if (cancelado) return
        console.error("[RelatoriosPage] buscarRelatorio:", falha)
        setRelatorio(null)
        setErro(
          "Não foi possível carregar o relatório. Confira os filtros e tente novamente.",
        )
      } finally {
        if (!cancelado) setCarregando(false)
      }
    }, DEBOUNCE_MS)

    // Cancela a resposta em voo ao trocar de aba/filtro, evitando que um
    // resultado antigo sobrescreva o atual.
    return () => {
      cancelado = true
      clearTimeout(temporizador)
    }
  }, [ativo, filtros])

  const trocarAba = useCallback((id: string) => {
    setSelecionada(id as RelatorioId)
    setRelatorio(null)
    // Cada relatório tem filtros próprios; manter os do anterior enviaria
    // parâmetros que o novo não entende.
    setFiltros(filtrosIniciais())
  }, [])

  const exportar = useCallback(async () => {
    if (!ativo) return
    setBaixando(true)
    setErro(null)
    try {
      await baixarRelatorioXlsx(ativo, filtros)
    } catch (falha) {
      console.error("[RelatoriosPage] baixarRelatorioXlsx:", falha)
      setErro(
        falha instanceof Error
          ? falha.message
          : "Não foi possível gerar a planilha.",
      )
    } finally {
      setBaixando(false)
    }
  }, [ativo, filtros])

  if (disponiveis.length === 0) {
    return (
      <div className="flex min-h-[55vh] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-6 py-16 text-center">
        <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-muted">
          <ChartColumnIcon className="size-8 text-muted-foreground" strokeWidth={1.5} />
        </div>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          Nenhum relatório disponível
        </h2>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          Seu perfil de acesso não inclui relatórios. Fale com a direção se
          precisar de acesso.
        </p>
      </div>
    )
  }

  const semResultados = !carregando && relatorio?.total_registros === 0

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Relatórios
          </h1>
          <p className="text-sm text-muted-foreground">
            {definicaoAtiva?.descricao ??
              "Análises gerenciais e exportação de planilhas."}
          </p>
        </div>

        <Button
          type="button"
          onClick={exportar}
          disabled={baixando || carregando || !relatorio?.total_registros}
        >
          {baixando ? (
            <FileSpreadsheetIcon className="size-4 animate-pulse" />
          ) : (
            <DownloadIcon className="size-4" />
          )}
          {baixando ? "Gerando planilha…" : "Exportar Excel"}
        </Button>
      </div>

      <Tabs
        itens={disponiveis.map((definicao) => ({
          id: definicao.id,
          label: definicao.titulo,
        }))}
        ativo={ativo ?? ""}
        onChange={trocarAba}
      />

      {definicaoAtiva && (
        <RelatorioFiltros
          campos={definicaoAtiva.filtros}
          filtros={filtros}
          onChange={setFiltros}
          onLimpar={() => setFiltros(filtrosIniciais())}
          profissionais={profissionais}
          pacientes={pacientes}
          salas={salas}
          servicos={servicos}
        />
      )}

      {erro && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          <AlertCircleIcon className="mt-0.5 size-4 shrink-0" />
          {erro}
        </div>
      )}

      {carregando && (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-5/6" />
        </div>
      )}

      {semResultados && (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 px-6 py-12 text-center">
          <p className="text-sm font-medium text-foreground">
            Nenhum registro no período
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Ajuste os filtros para ampliar o resultado.
          </p>
        </div>
      )}

      {!carregando && relatorio && relatorio.total_registros > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {relatorio.total_registros} registro(s)
            {relatorio.filtros_descricao && ` · ${relatorio.filtros_descricao}`}
          </p>
          <RelatorioTabela relatorio={relatorio} />
        </div>
      )}
    </div>
  )
}
