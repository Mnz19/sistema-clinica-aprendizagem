/**
 * Trilha de auditoria (aba "Logs" — DIREÇÃO/superusuário).
 *
 * Linha do tempo das alterações do sistema (create/update/delete de qualquer
 * tabela), com busca por objeto/autor e filtros por usuário, tabela, ação e datas.
 * Consome `/api/logs/` (paginado). Ver `services/logs.ts` e `types/log.ts`.
 */
import { useCallback, useEffect, useState } from "react"
import {
  ScrollTextIcon,
  SearchIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  XIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { mensagemDeErro } from "@/utils/apiError"
import { formatarDataHora } from "@/utils/format"
import { listarLogs, listarModelosLog } from "@/services/logs"
import { listarUsuarios } from "@/services/usuarios"
import { ACAO_LABELS } from "@/types/log"
import type { LogEntry, LogModelo } from "@/types/log"
import type { Usuario } from "@/types/auth"

/** Variante do badge conforme a ação (0=criação, 1=edição, 2=exclusão, 3=acesso). */
function acaoVariant(acao: number): "default" | "secondary" | "success" | "destructive" {
  if (acao === 0) return "success"
  if (acao === 2) return "destructive"
  if (acao === 3) return "secondary"
  return "default"
}

/** Cor do marcador da timeline conforme a ação. */
function acaoDotClass(acao: number): string {
  if (acao === 0) return "bg-emerald-500"
  if (acao === 2) return "bg-destructive"
  if (acao === 3) return "bg-muted-foreground"
  return "bg-primary"
}

/** Valor legível de um lado do diff (auditlog grava "None" para vazio). */
function valorLegivel(v: unknown): string {
  if (v === null || v === undefined || v === "" || v === "None") return "—"
  if (typeof v === "object") return JSON.stringify(v)
  return String(v)
}

export default function LogsPage() {
  // Filtros
  const [busca, setBusca] = useState("")
  const [usuario, setUsuario] = useState("")
  const [tabela, setTabela] = useState("")
  const [acao, setAcao] = useState("")
  const [objetoId, setObjetoId] = useState("")
  const [dataInicio, setDataInicio] = useState("")
  const [dataFim, setDataFim] = useState("")
  const [page, setPage] = useState(1)

  // Dados
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [count, setCount] = useState(0)
  const [temProxima, setTemProxima] = useState(false)
  const [temAnterior, setTemAnterior] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  // Opções dos selects
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [modelos, setModelos] = useState<LogModelo[]>([])

  // Linhas expandidas (mostrando o diff)
  const [expandidos, setExpandidos] = useState<Set<number>>(new Set())

  // Carrega as opções de filtro uma vez. Falhas são silenciosas (ex.: superusuário
  // sem papel de gestão não lista usuários) — não bloqueiam a tela.
  useEffect(() => {
    listarUsuarios().then(setUsuarios).catch(() => setUsuarios([]))
    listarModelosLog().then(setModelos).catch(() => setModelos([]))
  }, [])

  const carregar = useCallback(() => {
    setCarregando(true)
    setErro(null)
    listarLogs({
      search: busca,
      usuario,
      tabela,
      acao,
      objeto_id: objetoId,
      data_inicio: dataInicio,
      data_fim: dataFim,
      page,
    })
      .then((res) => {
        setLogs(res.results)
        setCount(res.count)
        setTemProxima(!!res.next)
        setTemAnterior(!!res.previous)
      })
      .catch((e) => setErro(mensagemDeErro(e)))
      .finally(() => setCarregando(false))
  }, [busca, usuario, tabela, acao, objetoId, dataInicio, dataFim, page])

  useEffect(() => {
    const timer = setTimeout(carregar, 300)
    return () => clearTimeout(timer)
  }, [carregar])

  // Toda mudança de filtro volta para a 1ª página.
  function comReset<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v)
      setPage(1)
    }
  }

  function limparFiltros() {
    setBusca("")
    setUsuario("")
    setTabela("")
    setAcao("")
    setObjetoId("")
    setDataInicio("")
    setDataFim("")
    setPage(1)
  }

  function alternarExpandido(id: number) {
    setExpandidos((prev) => {
      const novo = new Set(prev)
      if (novo.has(id)) novo.delete(id)
      else novo.add(id)
      return novo
    })
  }

  const temFiltro =
    busca || usuario || tabela || acao || objetoId || dataInicio || dataFim

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-foreground">
          <ScrollTextIcon className="size-5" /> Logs de auditoria
        </h1>
        <p className="text-sm text-muted-foreground">
          Histórico de todas as alterações do sistema. Pesquise por objeto, autor,
          tabela ou período.
        </p>
      </div>

      {/* Filtros */}
      <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[16rem] flex-1">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => comReset(setBusca)(e.target.value)}
              placeholder="Buscar por objeto ou autor…"
              className="pl-8"
            />
          </div>
          <div className="w-48">
            <Select
              value={usuario}
              onChange={(e) => comReset(setUsuario)(e.target.value)}
            >
              <option value="">Todos os usuários</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-44">
            <Select
              value={tabela}
              onChange={(e) => comReset(setTabela)(e.target.value)}
            >
              <option value="">Todas as tabelas</option>
              {modelos.map((m) => (
                <option key={m.tabela} value={m.tabela}>
                  {m.tabela_label}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-40">
            <Select value={acao} onChange={(e) => comReset(setAcao)(e.target.value)}>
              <option value="">Todas as ações</option>
              {Object.entries(ACAO_LABELS).map(([valor, rotulo]) => (
                <option key={valor} value={valor}>
                  {rotulo}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="w-44">
            <Input
              value={objetoId}
              onChange={(e) => comReset(setObjetoId)(e.target.value)}
              placeholder="ID do objeto"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">De</label>
            <Input
              type="date"
              value={dataInicio}
              onChange={(e) => comReset(setDataInicio)(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">Até</label>
            <Input
              type="date"
              value={dataFim}
              onChange={(e) => comReset(setDataFim)(e.target.value)}
              className="w-40"
            />
          </div>
          {temFiltro && (
            <Button variant="ghost" size="sm" onClick={limparFiltros}>
              <XIcon className="size-4" /> Limpar
            </Button>
          )}
        </div>
      </div>

      {erro && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {erro}
        </div>
      )}

      {/* Linha do tempo */}
      {carregando ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-16 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhum registro de auditoria encontrado.
          </p>
        </div>
      ) : (
        <ol className="relative ml-2 space-y-4 border-l border-border pl-6">
          {logs.map((log) => {
            const aberto = expandidos.has(log.id)
            const campos = Object.entries(log.alteracoes ?? {})
            return (
              <li key={log.id} className="relative">
                {/* Centralizado na linha do tempo: -left-6 casa com o pl-6 do <ol>
                    e o -translate-x-1/2 alinha o centro do marcador sobre a borda. */}
                <span
                  className={`absolute -left-6 top-1.5 size-3 -translate-x-1/2 rounded-full ring-4 ring-background ${acaoDotClass(
                    log.acao
                  )}`}
                />
                <div className="rounded-lg border border-border bg-card p-3 shadow-xs">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={acaoVariant(log.acao)}>{log.acao_label}</Badge>
                        <span className="text-sm font-medium text-foreground">
                          {log.tabela_label || log.tabela}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          #{log.objeto_id}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-sm text-muted-foreground">
                        {log.objeto_repr || "—"}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatarDataHora(log.data_hora)}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span>
                      Autor:{" "}
                      <span className="text-foreground">
                        {log.usuario
                          ? `${log.usuario.nome} (${log.usuario.email})`
                          : "Sistema"}
                      </span>
                    </span>
                    {log.ip && (
                      <>
                        <span aria-hidden="true" className="text-border">
                          ·
                        </span>
                        <span>
                          IP: <span className="text-foreground">{log.ip}</span>
                        </span>
                      </>
                    )}
                  </div>

                  {campos.length > 0 && (
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={() => alternarExpandido(log.id)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                      >
                        {aberto ? (
                          <ChevronDownIcon className="size-3.5" />
                        ) : (
                          <ChevronRightIcon className="size-3.5" />
                        )}
                        {aberto ? "Ocultar alterações" : `Ver alterações (${campos.length})`}
                      </button>

                      {aberto && (
                        <div className="mt-2 overflow-hidden rounded-md border border-border">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-border bg-muted/40 text-left uppercase tracking-wide text-muted-foreground">
                                <th className="px-3 py-1.5 font-medium">Campo</th>
                                <th className="px-3 py-1.5 font-medium">De</th>
                                <th className="px-3 py-1.5 font-medium">Para</th>
                              </tr>
                            </thead>
                            <tbody>
                              {campos.map(([campo, valores]) => (
                                <tr
                                  key={campo}
                                  className="border-b border-border last:border-0"
                                >
                                  <td className="px-3 py-1.5 font-medium text-foreground">
                                    {campo}
                                  </td>
                                  <td className="px-3 py-1.5 text-muted-foreground">
                                    {valorLegivel(valores?.[0])}
                                  </td>
                                  <td className="px-3 py-1.5 text-foreground">
                                    {valorLegivel(valores?.[1])}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      )}

      {/* Paginação */}
      {!carregando && logs.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {count} registro{count === 1 ? "" : "s"} · página {page}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!temAnterior}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!temProxima}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
