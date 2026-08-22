/**
 * Visão de ocupação por sala: mostra, em tempo (quase) real, quais salas estão
 * em uso e o cronômetro do atendimento em andamento em cada uma.
 *
 * Os dados vêm de `GET /api/salas/ocupacao/`; a lista é recarregada
 * periodicamente e o cronômetro de cada sala corre localmente a partir do
 * `atendimento_iniciado_em` retornado pelo backend.
 */
import { useEffect, useState } from "react"
import { DoorClosedIcon, DoorOpenIcon, Loader2Icon, RefreshCwIcon, TimerIcon, UserIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { listarOcupacaoSalas } from "@/services/clinica"
import type { SalaOcupacao } from "@/types/clinica"
import { mensagemDeErro } from "@/utils/apiError"
import { formatarCronometro } from "@/utils/format"

const INTERVALO_ATUALIZACAO_MS = 15_000

/** Segundos decorridos desde o início do atendimento (ISO), a partir de `agora`. */
function segundosDecorridos(iniciadoEm: string, agora: number): number {
  const inicio = Date.parse(iniciadoEm)
  if (Number.isNaN(inicio)) return 0
  return Math.max(0, Math.floor((agora - inicio) / 1000))
}

export default function OcupacaoSalasPage() {
  const [ocupacoes, setOcupacoes] = useState<SalaOcupacao[]>([])
  const [carregando, setCarregando] = useState(true)
  const [atualizando, setAtualizando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [agora, setAgora] = useState(() => Date.now())
  const [refreshNonce, setRefreshNonce] = useState(0)

  // Carga inicial + recarga periódica; o botão "Atualizar" incrementa o nonce,
  // reexecutando o effect (e resetando o intervalo).
  useEffect(() => {
    let ativo = true
    async function carregar(silencioso: boolean) {
      if (silencioso) setAtualizando(true)
      try {
        const dados = await listarOcupacaoSalas()
        if (!ativo) return
        setOcupacoes(dados)
        setErro(null)
      } catch (e) {
        if (ativo) setErro(mensagemDeErro(e))
      } finally {
        if (ativo) {
          setCarregando(false)
          setAtualizando(false)
        }
      }
    }
    void carregar(refreshNonce > 0)
    const id = setInterval(() => void carregar(true), INTERVALO_ATUALIZACAO_MS)
    return () => {
      ativo = false
      clearInterval(id)
    }
  }, [refreshNonce])

  // Tique de 1s para os cronômetros correrem sem recarregar a API.
  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const emUso = ocupacoes.filter((o) => o.em_uso).length

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Ocupação por sala</h1>
          <p className="text-sm text-muted-foreground">
            {carregando
              ? "Carregando ocupação das salas…"
              : `${emUso} de ${ocupacoes.length} sala(s) em uso agora.`}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setRefreshNonce((n) => n + 1)}
          disabled={atualizando}
        >
          {atualizando ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            <RefreshCwIcon className="size-4" />
          )}
          Atualizar
        </Button>
      </div>

      {erro && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {erro}
        </div>
      )}

      {carregando ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-lg" />
          ))}
        </div>
      ) : ocupacoes.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-12 text-center">
          <DoorOpenIcon className="mx-auto mb-2 size-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Nenhuma sala ativa cadastrada.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ocupacoes.map((o) => {
            const at = o.atendimento
            return (
              <div
                key={o.sala_id}
                className={
                  "rounded-lg border p-4 transition-colors " +
                  (o.em_uso ? "border-sky-300 bg-sky-50" : "border-border bg-card")
                }
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 font-medium text-foreground">
                    {o.em_uso ? (
                      <DoorClosedIcon className="size-4 text-sky-600" />
                    ) : (
                      <DoorOpenIcon className="size-4 text-muted-foreground" />
                    )}
                    {o.sala_nome}
                  </span>
                  {o.em_uso ? (
                    <Badge variant="secondary">Em uso</Badge>
                  ) : (
                    <Badge variant="success">Livre</Badge>
                  )}
                </div>

                {o.em_uso && at ? (
                  <div className="mt-3 space-y-1.5">
                    <div className="flex items-center gap-1.5 font-mono text-2xl font-semibold tabular-nums text-sky-700">
                      <TimerIcon className="size-5 animate-pulse" />
                      {formatarCronometro(segundosDecorridos(at.atendimento_iniciado_em, agora))}
                    </div>
                    <p className="truncate text-sm text-foreground">{at.paciente_nome}</p>
                    <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                      <UserIcon className="size-3" /> {at.profissional_nome}
                      {" · "}
                      {at.servico_nome}
                    </p>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">Disponível.</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
