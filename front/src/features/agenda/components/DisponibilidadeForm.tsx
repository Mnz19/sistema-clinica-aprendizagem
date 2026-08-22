/** Construtor de grade semanal de disponibilidades por profissional. */
import { useEffect, useMemo, useState } from "react"
import { useFieldArray, useForm } from "react-hook-form"
import { CalendarDaysIcon, Loader2Icon, PlusIcon, SaveIcon, Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { useClinicaStore } from "@/store/clinicaStore"
import {
  DIAS_SEMANA,
  DIA_SEMANA_LABELS,
  type Disponibilidade,
  type GradeSemanalSlot,
} from "@/types/clinica"

interface Props {
  profissionalId?: number
  onSalvo: (profissionalId: number) => void
  onCancelar: () => void
}

type TurnoForm = {
  horario_inicio: string
  horario_fim: string
}

type DiaGradeForm = {
  habilitado: boolean
  turnos: TurnoForm[]
}

type FormValues = {
  profissional_id: number
  dias: DiaGradeForm[]
}

const TURNO_PADRAO: TurnoForm = { horario_inicio: "08:00", horario_fim: "12:00" }

function diaVazio(): DiaGradeForm {
  return { habilitado: false, turnos: [{ ...TURNO_PADRAO }] }
}

function montarValoresIniciais(
  profissionalId: number | undefined,
  profissionais: { id: number }[],
  disponibilidades?: Disponibilidade[]
): FormValues {
  const dias: DiaGradeForm[] = Array.from({ length: 7 }, () => diaVazio())

  if (profissionalId && disponibilidades) {
    const ativas = disponibilidades.filter((d) => d.profissional_id === profissionalId && d.ativo)

    for (const disp of ativas) {
      const dia = dias[disp.dia_semana]
      if (!dia) continue

      const turno: TurnoForm = {
        horario_inicio: disp.horario_inicio.slice(0, 5),
        horario_fim: disp.horario_fim.slice(0, 5),
      }

      if (!dia.habilitado) {
        dia.habilitado = true
        dia.turnos = [turno]
      } else {
        dia.turnos.push(turno)
      }
    }
  }

  return {
    profissional_id: profissionalId ?? profissionais[0]?.id ?? 0,
    dias,
  }
}

function validarTurnos(dias: DiaGradeForm[]): string | null {
  for (let i = 0; i < dias.length; i++) {
    const dia = dias[i]
    if (!dia?.habilitado) continue

    if (dia.turnos.length === 0) {
      return `Adicione ao menos um turno em ${DIA_SEMANA_LABELS[i]}.`
    }

    for (const turno of dia.turnos) {
      if (!turno.horario_inicio || !turno.horario_fim) {
        return `Preencha início e fim em ${DIA_SEMANA_LABELS[i]}.`
      }
      if (turno.horario_inicio >= turno.horario_fim) {
        return `Em ${DIA_SEMANA_LABELS[i]}, o horário de início deve ser anterior ao de fim.`
      }
    }
  }

  const temDiaAtivo = dias.some((d) => d.habilitado && d.turnos.length > 0)
  if (!temDiaAtivo) {
    return "Habilite ao menos um dia da semana com horários de atendimento."
  }

  return null
}

function DiaSwitch({
  habilitado,
  onChange,
  label,
}: {
  habilitado: boolean
  onChange: (valor: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={habilitado}
      aria-label={`Atendimento em ${label}`}
      onClick={() => onChange(!habilitado)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        habilitado ? "bg-primary" : "bg-muted"
      )}
    >
      <span
        className={cn(
          "pointer-events-none block size-4 rounded-full bg-white shadow-sm transition-transform",
          habilitado ? "translate-x-4" : "translate-x-0.5"
        )}
      />
    </button>
  )
}

function DiaGradeRow({
  diaIndex,
  control,
  register,
  watch,
  setValue,
}: {
  diaIndex: number
  control: ReturnType<typeof useForm<FormValues>>["control"]
  register: ReturnType<typeof useForm<FormValues>>["register"]
  watch: ReturnType<typeof useForm<FormValues>>["watch"]
  setValue: ReturnType<typeof useForm<FormValues>>["setValue"]
}) {
  const dia = DIAS_SEMANA[diaIndex]
  const habilitado = watch(`dias.${diaIndex}.habilitado`)

  const { fields, append, remove } = useFieldArray({
    control,
    name: `dias.${diaIndex}.turnos`,
  })

  function alternarDia(valor: boolean) {
    setValue(`dias.${diaIndex}.habilitado`, valor, { shouldDirty: true })
    if (valor && fields.length === 0) {
      append({ ...TURNO_PADRAO })
    }
  }

  return (
    <div
      className={cn(
        "rounded-xl border transition-colors",
        habilitado ? "border-border bg-card" : "border-transparent bg-muted/30"
      )}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <DiaSwitch
            habilitado={habilitado}
            onChange={alternarDia}
            label={dia?.label ?? ""}
          />
          <div>
            <p className="text-sm font-medium text-foreground">{dia?.label}</p>
            <p className="text-xs text-muted-foreground">
              {habilitado ? "Dia com atendimento" : "Sem atendimento neste dia"}
            </p>
          </div>
        </div>
        {habilitado && (
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={() => append({ horario_inicio: "14:00", horario_fim: "18:00" })}
          >
            <PlusIcon className="size-3.5" /> Turno
          </Button>
        )}
      </div>

      {habilitado && (
        <>
          <Separator />
          <div className="space-y-3 px-4 py-3">
            {fields.map((field, turnoIndex) => (
              <div key={field.id} className="flex flex-wrap items-end gap-3">
                <div className="min-w-[7rem] flex-1 space-y-1">
                  <Label className="text-xs text-muted-foreground">Início</Label>
                  <Input
                    type="time"
                    {...register(`dias.${diaIndex}.turnos.${turnoIndex}.horario_inicio`)}
                  />
                </div>
                <div className="min-w-[7rem] flex-1 space-y-1">
                  <Label className="text-xs text-muted-foreground">Fim</Label>
                  <Input
                    type="time"
                    {...register(`dias.${diaIndex}.turnos.${turnoIndex}.horario_fim`)}
                  />
                </div>
                {fields.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="mb-0.5 text-muted-foreground hover:text-destructive"
                    onClick={() => remove(turnoIndex)}
                    title="Remover turno"
                  >
                    <Trash2Icon className="size-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export function DisponibilidadeForm({ profissionalId, onSalvo, onCancelar }: Props) {
  const editando = Boolean(profissionalId)
  const disponibilidades = useClinicaStore((s) => s.disponibilidades)
  const profissionais = useClinicaStore((s) => s.profissionais)
  const buscarProfissionais = useClinicaStore((s) => s.buscarProfissionais)
  const salvarGradeSemanal = useClinicaStore((s) => s.salvarGradeSemanal)

  useEffect(() => {
    if (profissionais.length === 0) {
      void buscarProfissionais()
    }
  }, [profissionais.length, buscarProfissionais])

  const valoresIniciais = useMemo(
    () => montarValoresIniciais(profissionalId, profissionais, disponibilidades),
    [profissionalId, profissionais, disponibilidades]
  )

  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const { control, register, handleSubmit, watch, setValue } = useForm<FormValues>({
    defaultValues: valoresIniciais,
  })

  async function aoEnviar(valores: FormValues) {
    setErro(null)

    const erroValidacao = validarTurnos(valores.dias)
    if (erroValidacao) {
      setErro(erroValidacao)
      return
    }

    const slots: GradeSemanalSlot[] = []
    valores.dias.forEach((dia, diaIndex) => {
      if (!dia.habilitado) return
      for (const turno of dia.turnos) {
        slots.push({
          dia_semana: diaIndex,
          horario_inicio: turno.horario_inicio,
          horario_fim: turno.horario_fim,
        })
      }
    })

    setSalvando(true)
    try {
      await salvarGradeSemanal(Number(valores.profissional_id), slots)
      onSalvo(Number(valores.profissional_id))
    } catch {
      setErro("Não foi possível salvar a grade semanal. Tente novamente.")
    } finally {
      setSalvando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(aoEnviar)} className="space-y-6">
      {erro && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          {erro}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Profissional</CardTitle>
          <CardDescription>
            A grade semanal será vinculada a este profissional.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            <Label>Profissional *</Label>
            <Select
              disabled={editando || profissionais.length === 0}
              {...register("profissional_id", { valueAsNumber: true })}
            >
              {profissionais.length === 0 ? (
                <option value={0}>Carregando profissionais…</option>
              ) : (
                profissionais.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))
              )}
            </Select>
            {editando && (
              <p className="text-xs text-muted-foreground">
                O profissional não pode ser alterado ao editar uma grade existente.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CalendarDaysIcon className="size-4 text-muted-foreground" />
            <div>
              <CardTitle>Grade semanal</CardTitle>
              <CardDescription>
                Habilite os dias de atendimento e configure um ou mais turnos por dia.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {DIAS_SEMANA.map((_, diaIndex) => (
            <DiaGradeRow
              key={diaIndex}
              diaIndex={diaIndex}
              control={control}
              register={register}
              watch={watch}
              setValue={setValue}
            />
          ))}
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancelar} disabled={salvando}>
          Cancelar
        </Button>
        <Button type="submit" disabled={salvando}>
          {salvando ? <Loader2Icon className="size-4 animate-spin" /> : <SaveIcon className="size-4" />}
          {editando ? "Salvar grade" : "Cadastrar grade"}
        </Button>
      </div>
    </form>
  )
}
