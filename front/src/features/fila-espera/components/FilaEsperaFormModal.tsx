/** Formulário (drawer) para adicionar/editar uma entrada na fila de espera. */
import { useEffect, useMemo, useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { Loader2Icon, PhoneIcon, PlusIcon, SaveIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Combobox } from "@/components/ui/combobox"
import { Drawer } from "@/components/ui/Drawer"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { PacienteCadastroRapidoModal } from "@/features/agendamento/components/PacienteCadastroRapidoModal"
import { criarFila, atualizarFila } from "@/services/filaEspera"
import type { FilaEsperaItem } from "@/types/filaEspera"
import type { PacienteListItem } from "@/types/paciente"
import type { Especialidade } from "@/types/especialidade"
import type { Usuario } from "@/types/auth"

interface Props {
  open: boolean
  entrada?: FilaEsperaItem
  pacientes: PacienteListItem[]
  profissionais: Usuario[]
  especialidades: Especialidade[]
  onSalvo: () => void
  onCancelar: () => void
  /** Notifica o pai quando um paciente é cadastrado pelo atalho, para atualizar a lista. */
  onPacienteCriado?: (paciente: PacienteListItem) => void
}

type FormValues = {
  paciente_id: number
  profissional_id: number
  especialidade_id: number
  preferencia_horario: string
  observacoes: string
}

function valoresPadrao(entrada?: FilaEsperaItem): FormValues {
  return {
    paciente_id: entrada?.paciente ?? 0,
    profissional_id: entrada?.profissional ?? 0,
    especialidade_id: entrada?.especialidade ?? 0,
    preferencia_horario: entrada?.preferencia_horario ?? "",
    observacoes: entrada?.observacoes ?? "",
  }
}

export function FilaEsperaFormModal({
  open,
  entrada,
  pacientes,
  profissionais,
  especialidades,
  onSalvo,
  onCancelar,
  onPacienteCriado,
}: Props) {
  const editando = Boolean(entrada)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [modalPacienteAberto, setModalPacienteAberto] = useState(false)

  const {
    control,
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: valoresPadrao(entrada) })

  useEffect(() => {
    reset(valoresPadrao(entrada))
    setErro(null)
  }, [entrada, open, reset])

  const pacienteId = watch("paciente_id")
  const pacienteSelecionado = useMemo(
    () => pacientes.find((p) => p.id === Number(pacienteId)),
    [pacientes, pacienteId]
  )

  const pacienteOptions = useMemo(
    () => pacientes.map((p) => ({ value: p.id, label: p.nome_completo })),
    [pacientes]
  )

  async function aoEnviar(valores: FormValues) {
    setSalvando(true)
    setErro(null)
    try {
      const payload = {
        paciente: Number(valores.paciente_id),
        profissional: valores.profissional_id ? Number(valores.profissional_id) : null,
        especialidade: valores.especialidade_id ? Number(valores.especialidade_id) : null,
        preferencia_horario: valores.preferencia_horario.trim(),
        observacoes: valores.observacoes.trim(),
      }
      if (editando && entrada) {
        await atualizarFila(entrada.id, payload)
      } else {
        await criarFila(payload)
      }
      onSalvo()
    } catch {
      setErro("Não foi possível salvar a entrada. Tente novamente.")
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onCancelar}
      title={editando ? "Editar entrada da fila" : "Adicionar à fila de espera"}
      description="O paciente entra ao fim da fila (ordem de chegada) e pode ser agendado quando surgir um horário."
    >
      <form onSubmit={handleSubmit(aoEnviar)} className="grid gap-3">
        <div className="space-y-1.5">
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
            rules={{ required: true, min: { value: 1, message: "Selecione o paciente." } }}
            render={({ field }) => (
              <Combobox
                id="fila-paciente"
                options={pacienteOptions}
                value={field.value || null}
                onChange={(v) => field.onChange(v ?? 0)}
                placeholder="Buscar paciente…"
                emptyText="Nenhum paciente encontrado."
                disabled={editando}
                aria-invalid={Boolean(errors.paciente_id)}
              />
            )}
          />
          {errors.paciente_id && (
            <p className="text-xs text-destructive">{errors.paciente_id.message}</p>
          )}
          {pacienteSelecionado?.telefone && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <PhoneIcon className="size-3" /> {pacienteSelecionado.telefone}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>Especialidade preferida</Label>
          <Select {...register("especialidade_id", { valueAsNumber: true })}>
            <option value={0}>Qualquer especialidade</option>
            {especialidades.map((e) => (
              <option key={e.id} value={e.id}>{e.nome}</option>
            ))}
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Profissional preferido</Label>
          <Select {...register("profissional_id", { valueAsNumber: true })}>
            <option value={0}>Qualquer profissional</option>
            {profissionais.map((p) => (
              <option key={p.id} value={p.id}>{p.nome}</option>
            ))}
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Preferência de horário</Label>
          <Input
            {...register("preferencia_horario")}
            placeholder="Ex.: manhãs, terças à tarde…"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Observações</Label>
          <Textarea
            {...register("observacoes")}
            rows={3}
            placeholder="Ex.: grupo de habilidades sociais (12 anos)"
          />
        </div>

        {erro && <p className="text-sm text-destructive">{erro}</p>}

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onCancelar} disabled={salvando}>
            Cancelar
          </Button>
          <Button type="submit" disabled={salvando}>
            {salvando ? <Loader2Icon className="size-4 animate-spin" /> : <SaveIcon className="size-4" />}
            {editando ? "Salvar" : "Adicionar"}
          </Button>
        </div>
      </form>

      <PacienteCadastroRapidoModal
        open={modalPacienteAberto}
        onCriar={(novoPaciente) => {
          onPacienteCriado?.(novoPaciente)
          setValue("paciente_id", novoPaciente.id)
          setModalPacienteAberto(false)
        }}
        onCancelar={() => setModalPacienteAberto(false)}
      />
    </Drawer>
  )
}
