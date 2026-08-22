/**
 * Cartão de atendimento no prontuário: "Iniciar atendimento" → cronômetro em
 * andamento → "Finalizar".
 *
 * Localiza o agendamento do paciente para hoje e permite ao profissional
 * iniciar/finalizar o atendimento. Ao iniciar, a sala passa a constar "em uso"
 * na visão de ocupação por sala.
 */
import { useEffect, useState } from "react"
import { CheckCircle2Icon, DoorClosedIcon, Loader2Icon, PlayIcon, SquareIcon, TimerIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  finalizarAtendimento,
  iniciarAtendimento,
  listarAgendamentos,
} from "@/services/agendamento"
import { atendimentoEmAndamento, type Agendamento } from "@/types/agendamento"
import { useAuthStore } from "@/store/authStore"
import { mensagemDeErro } from "@/utils/apiError"
import { formatarCronometro, formatarDataHora, formatarHorario } from "@/utils/format"

interface Props {
  pacienteId: number
}

/** Data de hoje em `YYYY-MM-DD` no fuso local. */
function dataHojeISO(): string {
  const d = new Date()
  const ano = d.getFullYear()
  const mes = String(d.getMonth() + 1).padStart(2, "0")
  const dia = String(d.getDate()).padStart(2, "0")
  return `${ano}-${mes}-${dia}`
}

const STATUS_INICIAVEL: Agendamento["status"][] = ["AGENDADO", "PRE_CONFIRMADO", "CONFIRMADO"]

/**
 * Escolhe o agendamento relevante do dia: um em andamento tem prioridade; senão
 * o próximo iniciável (mais cedo); senão um já atendido hoje (estado concluído).
 */
function selecionarAtendimento(ags: Agendamento[]): Agendamento | null {
  const emAndamento = ags.find((a) => a.status === "EM_ATENDIMENTO")
  if (emAndamento) return emAndamento

  const iniciaveis = ags
    .filter((a) => STATUS_INICIAVEL.includes(a.status))
    .sort((a, b) => a.horario_inicio.localeCompare(b.horario_inicio))
  if (iniciaveis.length > 0) return iniciaveis[0]

  const atendido = ags.find((a) => a.status === "ATENDIDO" && a.atendimento_iniciado_em)
  return atendido ?? null
}

/** Segundos decorridos desde o início (fonte de verdade: o timestamp do backend). */
function segundosDecorridos(agendamento: Agendamento, agora: number): number {
  if (!agendamento.atendimento_iniciado_em) return 0
  const inicio = Date.parse(agendamento.atendimento_iniciado_em)
  if (Number.isNaN(inicio)) return agendamento.duracao_atendimento_segundos ?? 0
  return Math.max(0, Math.floor((agora - inicio) / 1000))
}

export function AtendimentoCard({ pacienteId }: Props) {
  // Só PROFISSIONAL e DIRECAO podem iniciar/finalizar (espelha o backend);
  // SUPERVISAO vê o estado/cronômetro em modo leitura.
  const role = useAuthStore((s) => s.user?.role)
  const podeAgir = role === "PROFISSIONAL" || role === "DIRECAO"

  const [agendamento, setAgendamento] = useState<Agendamento | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [acaoEmCurso, setAcaoEmCurso] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [agora, setAgora] = useState(() => Date.now())

  useEffect(() => {
    let ativo = true
    async function carregar() {
      setCarregando(true)
      setErro(null)
      try {
        const ags = await listarAgendamentos({ paciente: pacienteId, data: dataHojeISO() })
        if (ativo) setAgendamento(selecionarAtendimento(ags))
      } catch (e) {
        if (ativo) setErro(mensagemDeErro(e))
      } finally {
        if (ativo) setCarregando(false)
      }
    }
    void carregar()
    return () => {
      ativo = false
    }
  }, [pacienteId])

  // Cronômetro: enquanto em andamento, um tique de 1s atualiza `agora`; o tempo
  // decorrido é derivado do timestamp do backend (sem drift, sem setState no
  // corpo do effect).
  const emAndamento = agendamento != null && atendimentoEmAndamento(agendamento)
  useEffect(() => {
    if (!emAndamento) return
    const id = setInterval(() => setAgora(Date.now()), 1000)
    return () => clearInterval(id)
  }, [emAndamento])

  async function aoIniciar() {
    if (!agendamento) return
    setAcaoEmCurso(true)
    setErro(null)
    try {
      const atualizado = await iniciarAtendimento(agendamento.id)
      setAgendamento(atualizado)
    } catch (e) {
      setErro(mensagemDeErro(e))
    } finally {
      setAcaoEmCurso(false)
    }
  }

  async function aoFinalizar() {
    if (!agendamento) return
    setAcaoEmCurso(true)
    setErro(null)
    try {
      const atualizado = await finalizarAtendimento(agendamento.id)
      setAgendamento(atualizado)
    } catch (e) {
      setErro(mensagemDeErro(e))
    } finally {
      setAcaoEmCurso(false)
    }
  }

  if (carregando) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
        <Loader2Icon className="size-4 animate-spin" /> Verificando atendimento de hoje…
      </div>
    )
  }

  if (!agendamento) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-card px-4 py-3 text-sm text-muted-foreground">
        <DoorClosedIcon className="size-4" />
        Sem agendamento para hoje — nada a iniciar.
        {erro && <span className="text-destructive">· {erro}</span>}
      </div>
    )
  }

  const finalizado = agendamento.status === "ATENDIDO" && !!agendamento.atendimento_iniciado_em
  const decorrido = emAndamento ? segundosDecorridos(agendamento, agora) : 0

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">Atendimento de hoje</span>
            <Badge variant={emAndamento ? "secondary" : finalizado ? "success" : "outline"}>
              {agendamento.status_display}
            </Badge>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {formatarHorario(agendamento.horario_inicio)}–{formatarHorario(agendamento.horario_fim)}
            {" · "}
            {agendamento.servico_nome}
            {" · "}
            <span className="inline-flex items-center gap-1">
              <DoorClosedIcon className="size-3" /> {agendamento.sala_nome}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          {emAndamento && (
            <span className="inline-flex items-center gap-1.5 font-mono text-lg font-semibold tabular-nums text-sky-600">
              <TimerIcon className="size-4 animate-pulse" />
              {formatarCronometro(decorrido)}
            </span>
          )}

          {podeAgir && !emAndamento && !finalizado && (
            <Button onClick={aoIniciar} disabled={acaoEmCurso}>
              {acaoEmCurso ? <Loader2Icon className="size-4 animate-spin" /> : <PlayIcon className="size-4" />}
              Iniciar atendimento
            </Button>
          )}

          {podeAgir && emAndamento && (
            <Button variant="destructive" onClick={aoFinalizar} disabled={acaoEmCurso}>
              {acaoEmCurso ? <Loader2Icon className="size-4 animate-spin" /> : <SquareIcon className="size-4" />}
              Finalizar
            </Button>
          )}

          {finalizado && (
            <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600">
              <CheckCircle2Icon className="size-4" />
              Finalizado
              {agendamento.duracao_atendimento_segundos != null && (
                <span className="font-mono tabular-nums text-muted-foreground">
                  ({formatarCronometro(agendamento.duracao_atendimento_segundos)})
                </span>
              )}
            </span>
          )}
        </div>
      </div>

      {emAndamento && agendamento.atendimento_iniciado_em && (
        <p className="mt-2 text-xs text-muted-foreground">
          Iniciado às {formatarDataHora(agendamento.atendimento_iniciado_em)}.
        </p>
      )}

      {erro && (
        <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {erro}
        </div>
      )}
    </div>
  )
}
