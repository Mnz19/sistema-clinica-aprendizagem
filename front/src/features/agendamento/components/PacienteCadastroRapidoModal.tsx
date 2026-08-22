/** Modal de cadastro rápido de paciente durante o agendamento. */
import { useState } from "react"
import { useForm } from "react-hook-form"
import { Loader2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog"
import { api } from "@/services/api"
import type { PacienteListItem } from "@/types/paciente"

interface Props {
  open: boolean
  onCriar: (paciente: PacienteListItem) => void
  onCancelar: () => void
}

type FormValues = {
  nome_completo: string
  data_nascimento: string
}

export function PacienteCadastroRapidoModal({ open, onCriar, onCancelar }: Props) {
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>()

  async function aoEnviar(valores: FormValues) {
    setErro(null)
    setSalvando(true)
    try {
      const { data } = await api.post("/pacientes/", {
        nome_completo: valores.nome_completo.trim(),
        data_nascimento: valores.data_nascimento,
        cadastro_incompleto: true,
        responsaveis: [],
      })
      reset()
      onCriar(data as PacienteListItem)
    } catch {
      setErro("Não foi possível cadastrar o paciente. Tente novamente.")
    } finally {
      setSalvando(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={(aberto: boolean) => !aberto && !salvando && onCancelar()}>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Cadastro rápido de paciente</AlertDialogTitle>
        </AlertDialogHeader>
        <form onSubmit={handleSubmit(aoEnviar)} className="space-y-4 py-2">
          {erro && <p className="text-sm text-destructive">{erro}</p>}
          <div className="space-y-1.5">
            <Label>Nome completo *</Label>
            <Input
              placeholder="Nome do paciente"
              aria-invalid={Boolean(errors.nome_completo)}
              {...register("nome_completo", { required: "Informe o nome completo." })}
            />
            {errors.nome_completo && (
              <p className="text-xs text-destructive">{errors.nome_completo.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Data de nascimento *</Label>
            <Input
              type="date"
              aria-invalid={Boolean(errors.data_nascimento)}
              {...register("data_nascimento", { required: "Informe a data de nascimento." })}
            />
            {errors.data_nascimento && (
              <p className="text-xs text-destructive">{errors.data_nascimento.message}</p>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={salvando} onClick={onCancelar}>
              Cancelar
            </AlertDialogCancel>
            <Button type="submit" disabled={salvando}>
              {salvando ? <Loader2Icon className="size-4 animate-spin" /> : "Cadastrar"}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  )
}
