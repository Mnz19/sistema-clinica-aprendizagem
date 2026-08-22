/** Formulário de cadastro/edição de sala. */
import { useState } from "react"
import { useForm } from "react-hook-form"
import { Loader2Icon, SaveIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { mensagemDeErro } from "@/utils/apiError"
import { useClinicaStore } from "@/store/clinicaStore"
import type { Sala, SalaPayload } from "@/types/clinica"

interface Props {
  salaInicial?: Sala
  onSalvo: (sala: Sala) => void
  onCancelar: () => void
}

type FormValues = {
  nome: string
  descricao: string
}

export function SalaForm({ salaInicial, onSalvo, onCancelar }: Props) {
  const editando = Boolean(salaInicial)
  const criarSala = useClinicaStore((s) => s.criarSala)
  const atualizarSala = useClinicaStore((s) => s.atualizarSala)

  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      nome: salaInicial?.nome ?? "",
      descricao: salaInicial?.descricao ?? "",
    },
  })

  async function aoEnviar(valores: FormValues) {
    setErro(null)
    const payload: SalaPayload = {
      nome: valores.nome.trim(),
      descricao: valores.descricao.trim(),
    }

    setSalvando(true)
    try {
      const salva = salaInicial
        ? await atualizarSala(salaInicial.id, payload)
        : await criarSala(payload)
      onSalvo(salva)
    } catch (err) {
      setErro(mensagemDeErro(err, "Não foi possível salvar a sala. Tente novamente."))
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
          <CardTitle>Dados da sala</CardTitle>
          <CardDescription>Identificação do espaço físico de atendimento.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="space-y-1.5">
            <Label>Nome *</Label>
            <Input
              aria-invalid={Boolean(errors.nome)}
              placeholder="Ex.: Sala 1 — Atendimento"
              {...register("nome", { required: "Informe o nome da sala." })}
            />
            {errors.nome && <p className="text-xs text-destructive">{errors.nome.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea
              placeholder="Observações sobre o espaço, capacidade, equipamentos…"
              rows={4}
              {...register("descricao")}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancelar} disabled={salvando}>
          Cancelar
        </Button>
        <Button type="submit" disabled={salvando}>
          {salvando ? <Loader2Icon className="size-4 animate-spin" /> : <SaveIcon className="size-4" />}
          {editando ? "Salvar alterações" : "Cadastrar sala"}
        </Button>
      </div>
    </form>
  )
}
