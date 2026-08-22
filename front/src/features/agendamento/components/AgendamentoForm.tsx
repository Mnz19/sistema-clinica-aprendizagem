/** Formulário de cadastro/edição de agendamento. */
import { useEffect, useMemo, useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { AlertTriangleIcon, ArrowRightLeftIcon, Loader2Icon, PlusIcon, SaveIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Combobox } from "@/components/ui/combobox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { listarPacientes } from "@/services/pacientes"
import { AgendamentoValidacaoError } from "@/services/agendamento"
import { converterFila } from "@/services/filaEspera"
import { api } from "@/services/api"
import { cn } from "@/lib/utils"
import { useAgendamentoStore } from "@/store/agendamentoStore"
import { useClinicaStore } from "@/store/clinicaStore"
import {
  FREQUENCIA_LABELS,
  STATUS_AGENDAMENTO,
  type Agendamento,
  type AgendamentoPayload,
  type Frequencia,
  type StatusAgendamento,
} from "@/types/agendamento"
import type { PacienteListItem } from "@/types/paciente"
import { PacienteCadastroRapidoModal } from "./PacienteCadastroRapidoModal"

interface SlotInicial {
  data: string
  horario?: string
  profissional_id?: number
  /** Pré-seleciona o paciente (usado ao converter uma entrada da fila de espera). */
  paciente_id?: number
}

interface Props {
  agendamentoInicial?: Agendamento
  slotInicial?: SlotInicial
  modoDrawer?: boolean
  onSalvo: (agendamento: Agendamento) => void
  onCancelar: () => void
  /** Quando fornecido (e em edição), exibe a ação "Transferir profissional". */
  onTransferir?: (agendamento: Agendamento) => void
  /**
   * Quando fornecido, o formulário está em modo "converter fila": ao salvar,
   * cria o agendamento pela action `converter/` (atômica) e marca a entrada como
   * CONVERTIDO. Sem recorrência neste modo.
   */
  converterFilaId?: number
}

/** Só faz sentido transferir agendamentos em aberto (regra do backend). */
const STATUS_TRANSFERIVEIS: StatusAgendamento[] = ["AGENDADO", "PRE_CONFIRMADO", "CONFIRMADO"]

type FormValues = {
  paciente_id: number
  profissional_id: number
  servico_id: number
  sala_id: number
  data: string
  horario_inicio: string
  observacoes: string
  status: StatusAgendamento
  parecer_status: string
}

function statusExigeParecer(status: StatusAgendamento): boolean {
  return status === "FALTA" || status === "DESMARCADO"
}

function valoresPadraoFormulario(
  agendamentoInicial?: Agendamento,
  slotInicial?: SlotInicial
): FormValues {
  return {
    paciente_id: agendamentoInicial?.paciente ?? slotInicial?.paciente_id ?? 0,
    profissional_id:
      agendamentoInicial?.profissional ?? slotInicial?.profissional_id ?? 0,
    servico_id: agendamentoInicial?.servico ?? 0,
    sala_id: agendamentoInicial?.sala ?? 0,
    data: agendamentoInicial?.data ?? slotInicial?.data ?? dataLocalISO(),
    horario_inicio:
      agendamentoInicial?.horario_inicio.slice(0, 5) ?? slotInicial?.horario ?? "08:00",
    observacoes: agendamentoInicial?.observacoes ?? "",
    status: agendamentoInicial?.status ?? "AGENDADO",
    parecer_status: agendamentoInicial?.parecer_status ?? "",
  }
}

function dataLocalISO(date = new Date()): string {
  const ano = date.getFullYear()
  const mes = String(date.getMonth() + 1).padStart(2, "0")
  const dia = String(date.getDate()).padStart(2, "0")
  return `${ano}-${mes}-${dia}`
}

export function AgendamentoForm({
  agendamentoInicial,
  slotInicial,
  modoDrawer = false,
  onSalvo,
  onCancelar,
  onTransferir,
  converterFilaId,
}: Props) {
  const editando = Boolean(agendamentoInicial)
  const convertendo = converterFilaId != null && !editando
  const podeTransferir =
    editando &&
    Boolean(onTransferir) &&
    agendamentoInicial != null &&
    STATUS_TRANSFERIVEIS.includes(agendamentoInicial.status)

  const salvarAgendamento = useAgendamentoStore((s) => s.salvarAgendamento)
  const limparErroValidacao = useAgendamentoStore((s) => s.limparErroValidacao)

  const profissionais = useClinicaStore((s) => s.profissionais)
  const salas = useClinicaStore((s) => s.salas)
  const servicos = useClinicaStore((s) => s.servicos)
  const buscarProfissionais = useClinicaStore((s) => s.buscarProfissionais)
  const buscarSalas = useClinicaStore((s) => s.buscarSalas)
  const buscarServicos = useClinicaStore((s) => s.buscarServicos)

  const [pacientes, setPacientes] = useState<PacienteListItem[]>([])
  const [carregandoDados, setCarregandoDados] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [erroConflito, setErroConflito] = useState<string[]>([])
  const [modalPacienteAberto, setModalPacienteAberto] = useState(false)
  // Recorrência
  const [recorrente, setRecorrente] = useState(false)
  const [frequencia, setFrequencia] = useState<Frequencia>("SEMANAL")
  const [dataFimRecorrencia, setDataFimRecorrencia] = useState("")
  const [resultadoRecorrencia, setResultadoRecorrencia] = useState<{total: number; nao_criados: Array<{data: string; motivo: string}>} | null>(null)

  useEffect(() => {
    limparErroValidacao()
    const timer = setTimeout(() => {
      setCarregandoDados(true)
      Promise.all([
        listarPacientes({ ativo: true }),
        buscarProfissionais(),
        buscarSalas(),
        buscarServicos(),
      ])
        .then(([listaPacientes]) => setPacientes(listaPacientes))
        .catch(() => setErro("Não foi possível carregar os dados do formulário."))
        .finally(() => setCarregandoDados(false))
    }, 300)
    return () => clearTimeout(timer)
  }, [buscarProfissionais, buscarSalas, buscarServicos, limparErroValidacao])

  const salasAtivas = useMemo(() => salas.filter((s) => s.ativa), [salas])
  const servicosAtivos = useMemo(() => servicos.filter((s) => s.ativo), [servicos])

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    setError,
    clearErrors,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: valoresPadraoFormulario(agendamentoInicial, slotInicial),
  })

  useEffect(() => {
    reset(valoresPadraoFormulario(agendamentoInicial, slotInicial))
    setErro(null)
    setErroConflito([])
  }, [agendamentoInicial, slotInicial, reset])

  const profissionalId = watch("profissional_id")
  const servicoId = watch("servico_id")
  const salaId = watch("sala_id")
  const pacienteId = watch("paciente_id")
  const statusSelecionado = watch("status")
  const exigeParecer = editando && statusExigeParecer(statusSelecionado)

  const servicosDoProfissional = useMemo(
    () => servicosAtivos.filter((s) => s.profissionais.includes(Number(profissionalId))),
    [servicosAtivos, profissionalId]
  )

  const pacienteOptions = useMemo(
    () => pacientes.map((p) => ({ value: p.id, label: p.nome_completo })),
    [pacientes]
  )
  const profissionalOptions = useMemo(
    () => profissionais.map((p) => ({ value: p.id, label: p.nome })),
    [profissionais]
  )

  useEffect(() => {
    if (profissionais.length > 0 && !profissionalId) {
      setValue("profissional_id", profissionais[0].id)
    }
  }, [profissionais, profissionalId, setValue])

  useEffect(() => {
    if (servicosDoProfissional.length === 0) {
      setValue("servico_id", 0)
      return
    }
    const servicoValido = servicosDoProfissional.some((s) => s.id === Number(servicoId))
    if (!servicoValido) {
      setValue("servico_id", servicosDoProfissional[0].id)
    }
  }, [servicosDoProfissional, servicoId, setValue])

  useEffect(() => {
    if (salasAtivas.length > 0 && !salaId) {
      setValue("sala_id", salasAtivas[0].id)
    }
  }, [salasAtivas, salaId, setValue])

  useEffect(() => {
    if (pacientes.length > 0 && !pacienteId) {
      setValue("paciente_id", pacientes[0].id)
    }
  }, [pacientes, pacienteId, setValue])

  useEffect(() => {
    if (!exigeParecer) {
      clearErrors("parecer_status")
    }
  }, [exigeParecer, clearErrors])

  async function aoEnviar(valores: FormValues) {
    setErro(null)
    setErroConflito([])
    limparErroValidacao()
    clearErrors("parecer_status")

    if (editando && statusExigeParecer(valores.status) && !valores.parecer_status.trim()) {
      setError("parecer_status", {
        message: "É necessário fornecer um parecer para este status.",
      })
      return
    }

    const payload: AgendamentoPayload = {
      paciente: Number(valores.paciente_id),
      profissional: Number(valores.profissional_id),
      servico: Number(valores.servico_id),
      sala: Number(valores.sala_id),
      data: valores.data,
      horario_inicio: valores.horario_inicio,
      observacoes: valores.observacoes.trim() || undefined,
    }

    if (editando) {
      payload.status = valores.status
      if (statusExigeParecer(valores.status)) {
        payload.parecer_status = valores.parecer_status.trim()
      }
    }

    setSalvando(true)
    try {
      // Modo "converter fila": cria o agendamento e marca a entrada como CONVERTIDO
      // numa única chamada atômica. Não há série recorrente aqui.
      if (convertendo) {
        const convertido = await converterFila(converterFilaId!, payload)
        onSalvo(convertido)
        return
      }

      const salvo = await salvarAgendamento(payload, agendamentoInicial?.id)
      // Série recorrente: criar ocorrências futuras após salvar o agendamento base
      if (!editando && recorrente && dataFimRecorrencia) {
        try {
          const { data: serieData } = await api.post(
            `/agendamentos/${salvo.id}/recorrente/`,
            { frequencia, data_fim_recorrencia: dataFimRecorrencia }
          )
          setResultadoRecorrencia({
            total: serieData.total_criados,
            nao_criados: serieData.nao_criados,
          })
        } catch {
          // Falha na série não impede retornar o agendamento base
        }
      }
      onSalvo(salvo)
    } catch (err) {
      if (err instanceof AgendamentoValidacaoError) {
        const { validacao } = err
        const erroParecer = validacao.campos.parecer_status?.[0]

        if (erroParecer) {
          setError("parecer_status", { message: erroParecer })
        }

        if (validacao.isConflitoHorario) {
          setErroConflito(validacao.mensagens)
        } else if (!erroParecer) {
          setErro(validacao.mensagem)
        }
      } else {
        setErro("Não foi possível salvar o agendamento. Tente novamente.")
      }
    } finally {
      setSalvando(false)
    }
  }

  const selectsProntos =
    !carregandoDados &&
    pacientes.length > 0 &&
    profissionais.length > 0 &&
    salasAtivas.length > 0 &&
    servicosDoProfissional.length > 0

  const camposFormulario = (
    <div className={modoDrawer ? "grid gap-3" : "grid gap-4 sm:grid-cols-2"}>
      <div className={`space-y-1.5 ${modoDrawer ? "" : "sm:col-span-2"}`}>
        <div className="flex items-center justify-between">
          <Label>Paciente *</Label>
          {!editando && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 gap-1 text-xs"
              onClick={() => setModalPacienteAberto(true)}
            >
              <PlusIcon className="size-3" /> Cadastrar Paciente
            </Button>
          )}
        </div>
        <Controller
          control={control}
          name="paciente_id"
          rules={{
            required: "Selecione o paciente.",
            min: { value: 1, message: "Selecione o paciente." },
          }}
          render={({ field }) => (
            <Combobox
              id="paciente"
              options={pacienteOptions}
              value={field.value || null}
              onChange={(v) => field.onChange(v ?? 0)}
              disabled={carregandoDados || pacientes.length === 0}
              placeholder={
                pacientes.length === 0 ? "Carregando pacientes…" : "Buscar paciente…"
              }
              emptyText="Nenhum paciente encontrado."
              aria-invalid={Boolean(errors.paciente_id)}
            />
          )}
        />
        {errors.paciente_id && (
          <p className="text-xs text-destructive">{errors.paciente_id.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label>Profissional *</Label>
        {editando ? (
          // Na edição o profissional é fixo: a troca é feita pela ação "Transferir".
          <>
            <Input value={agendamentoInicial?.profissional_nome ?? ""} disabled readOnly />
            <input type="hidden" {...register("profissional_id", { valueAsNumber: true })} />
            <p className="text-xs text-muted-foreground">
              Para trocar o profissional, use a ação{" "}
              <span className="font-medium text-foreground">Transferir</span>.
            </p>
          </>
        ) : (
          <Controller
            control={control}
            name="profissional_id"
            rules={{
              required: "Selecione o profissional.",
              min: { value: 1, message: "Selecione o profissional." },
            }}
            render={({ field }) => (
              <Combobox
                id="profissional"
                options={profissionalOptions}
                value={field.value || null}
                onChange={(v) => field.onChange(v ?? 0)}
                disabled={carregandoDados || profissionais.length === 0}
                placeholder={
                  profissionais.length === 0
                    ? "Carregando profissionais…"
                    : "Buscar profissional…"
                }
                emptyText="Nenhum profissional encontrado."
              />
            )}
          />
        )}
      </div>

      <div className="space-y-1.5">
        <Label>Serviço *</Label>
        <Select
          disabled={carregandoDados || servicosDoProfissional.length === 0}
          {...register("servico_id", {
            valueAsNumber: true,
            required: "Selecione o serviço.",
            min: { value: 1, message: "Selecione o serviço." },
          })}
        >
          {servicosDoProfissional.length === 0 ? (
            <option value={0}>
              {profissionalId
                ? "Nenhum serviço para este profissional"
                : "Selecione um profissional"}
            </option>
          ) : (
            servicosDoProfissional.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome} ({s.duracao_minutos} min)
              </option>
            ))
          )}
        </Select>
        {errors.servico_id && (
          <p className="text-xs text-destructive">{errors.servico_id.message}</p>
        )}
      </div>

      <div className={`space-y-1.5 ${modoDrawer ? "" : "sm:col-span-2"}`}>
        <Label>Sala *</Label>
        <Select
          disabled={carregandoDados || salasAtivas.length === 0}
          {...register("sala_id", {
            valueAsNumber: true,
            required: "Selecione a sala.",
            min: { value: 1, message: "Selecione a sala." },
          })}
        >
          {salasAtivas.length === 0 ? (
            <option value={0}>Carregando salas…</option>
          ) : (
            salasAtivas.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome}
              </option>
            ))
          )}
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>Data *</Label>
        <Input
          type="date"
          aria-invalid={Boolean(errors.data)}
          {...register("data", { required: "Informe a data." })}
        />
        {errors.data && <p className="text-xs text-destructive">{errors.data.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label>Horário de início *</Label>
        <Input
          type="time"
          aria-invalid={Boolean(errors.horario_inicio)}
          {...register("horario_inicio", { required: "Informe o horário de início." })}
        />
        {errors.horario_inicio && (
          <p className="text-xs text-destructive">{errors.horario_inicio.message}</p>
        )}
      </div>

      <div className={`space-y-1.5 ${modoDrawer ? "" : "sm:col-span-2"}`}>
        <Label>Observações</Label>
        <Textarea
          placeholder="Informações adicionais sobre o atendimento…"
          rows={modoDrawer ? 2 : 3}
          {...register("observacoes")}
        />
      </div>

      {editando && (
        <>
          <div
            className={`space-y-1.5 border-t border-border pt-3 ${modoDrawer ? "col-span-1" : "sm:col-span-2"}`}
          >
            <Label>Status do atendimento *</Label>
            <Select
              {...register("status")}
              aria-invalid={Boolean(errors.status)}
            >
              {(Object.entries(STATUS_AGENDAMENTO) as [StatusAgendamento, string][]).map(
                ([valor, rotulo]) => (
                  <option key={valor} value={valor}>
                    {rotulo}
                  </option>
                )
              )}
            </Select>
          </div>

          {exigeParecer && (
            <div className={`space-y-1.5 ${modoDrawer ? "" : "sm:col-span-2"}`}>
              <Label htmlFor="parecer_status" className="text-destructive">
                Parecer / Justificativa *
              </Label>
              <Textarea
                id="parecer_status"
                placeholder="Descreva o motivo da falta ou do cancelamento…"
                rows={modoDrawer ? 3 : 4}
                aria-invalid={Boolean(errors.parecer_status)}
                className={cn(
                  "transition-colors",
                  errors.parecer_status &&
                    "border-destructive ring-2 ring-destructive/20 focus-visible:border-destructive focus-visible:ring-destructive/30"
                )}
                {...register("parecer_status", {
                  validate: (valor) => {
                    if (!statusExigeParecer(statusSelecionado)) return true
                    return valor.trim().length > 0 || "É necessário fornecer um parecer para este status."
                  },
                })}
              />
              {errors.parecer_status && (
                <p className="text-xs font-medium text-destructive">
                  {errors.parecer_status.message}
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )

  return (
    <form onSubmit={handleSubmit(aoEnviar)} className={modoDrawer ? "space-y-4" : "space-y-6"}>
      {erroConflito.length > 0 && (
        <div
          role="alert"
          className="flex gap-3 rounded-lg border-2 border-destructive bg-destructive/15 px-4 py-4 text-destructive shadow-sm"
        >
          <AlertTriangleIcon className="mt-0.5 size-5 shrink-0" />
          <div className="space-y-1">
            <p className="font-semibold">Conflito de horário detectado</p>
            <p className="text-sm text-destructive/90">
              O horário escolhido colide com outro agendamento. Ajuste a data, o horário, a sala ou
              o profissional.
            </p>
            <ul className="mt-2 list-inside list-disc text-sm font-medium">
              {erroConflito.map((msg) => (
                <li key={msg}>{msg}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {erro && erroConflito.length === 0 && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          {erro}
        </div>
      )}

      {modoDrawer ? (
        camposFormulario
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Dados do agendamento</CardTitle>
            <CardDescription>
              Selecione paciente, profissional, serviço e sala. O horário de término é calculado
              automaticamente pela duração do serviço.
            </CardDescription>
          </CardHeader>
          <CardContent>{camposFormulario}</CardContent>
        </Card>
      )}

      {!editando && !convertendo && (
        <div className="rounded-lg border border-border p-3 space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="recorrente-toggle"
              checked={recorrente}
              onChange={(e) => setRecorrente(e.target.checked)}
              className="size-4"
            />
            <Label htmlFor="recorrente-toggle" className="cursor-pointer">
              Agendamento recorrente
            </Label>
          </div>
          {recorrente && (
            <div className="grid gap-3 sm:grid-cols-2 pt-1">
              <div className="space-y-1.5">
                <Label>Frequência</Label>
                <Select value={frequencia} onChange={(e) => setFrequencia(e.target.value as Frequencia)}>
                  {(Object.entries(FREQUENCIA_LABELS) as [Frequencia, string][]).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Repetir até</Label>
                <Input
                  type="date"
                  value={dataFimRecorrencia}
                  onChange={(e) => setDataFimRecorrencia(e.target.value)}
                />
              </div>
            </div>
          )}
          {resultadoRecorrencia && (
            <p className="text-sm text-muted-foreground">
              {resultadoRecorrencia.total} sessão(ões) criada(s).
              {resultadoRecorrencia.nao_criados.length > 0 && (
                <> {resultadoRecorrencia.nao_criados.length} não criada(s) por conflito.</>
              )}
            </p>
          )}
        </div>
      )}

      <div className={`flex items-center justify-end gap-2 ${modoDrawer ? "pt-2" : ""}`}>
        {podeTransferir && (
          <Button
            type="button"
            variant="outline"
            className="mr-auto"
            onClick={() => onTransferir?.(agendamentoInicial!)}
            disabled={salvando}
          >
            <ArrowRightLeftIcon className="size-4" /> Transferir
          </Button>
        )}
        <Button type="button" variant="ghost" onClick={onCancelar} disabled={salvando}>
          Cancelar
        </Button>
        <Button type="submit" disabled={salvando || !selectsProntos}>
          {salvando ? <Loader2Icon className="size-4 animate-spin" /> : <SaveIcon className="size-4" />}
          {editando ? "Salvar alterações" : convertendo ? "Agendar da fila" : "Agendar"}
        </Button>
      </div>

      <PacienteCadastroRapidoModal
        open={modalPacienteAberto}
        onCriar={(novoPaciente) => {
          setPacientes((prev) => [novoPaciente, ...prev])
          setValue("paciente_id", novoPaciente.id)
          setModalPacienteAberto(false)
        }}
        onCancelar={() => setModalPacienteAberto(false)}
      />
    </form>
  )
}
