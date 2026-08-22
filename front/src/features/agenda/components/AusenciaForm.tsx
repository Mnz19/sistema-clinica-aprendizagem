/** Formulário de cadastro/edição de ausência pontual de profissional. */
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { Loader2Icon, SaveIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { mensagemDeErro } from "@/utils/apiError"
import { useClinicaStore } from "@/store/clinicaStore"
import type { Ausencia, AusenciaPayload } from "@/types/clinica"

interface Props {
  ausenciaInicial?: Ausencia
  onSalvo: (ausencia: Ausencia) => void
  onCancelar: () => void
}

type FormValues = {
  profissional_id: number
  data_inicio: string
  data_fim: string
  motivo: string
}

export function AusenciaForm({ ausenciaInicial, onSalvo, onCancelar }: Props) {
  const editando = Boolean(ausenciaInicial)
  const profissionais = useClinicaStore((s) => s.profissionais)
  const buscarProfissionais = useClinicaStore((s) => s.buscarProfissionais)
  const criarAusencia = useClinicaStore((s) => s.criarAusencia)
  const atualizarAusencia = useClinicaStore((s) => s.atualizarAusencia)

  useEffect(() => {
    if (profissionais.length === 0) {
      void buscarProfissionais()
    }
  }, [profissionais.length, buscarProfissionais])

  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      profissional_id: ausenciaInicial?.profissional_id ?? profissionais[0]?.id ?? 0,
      data_inicio: ausenciaInicial?.data_inicio ?? "",
      data_fim: ausenciaInicial?.data_fim ?? "",
      motivo: ausenciaInicial?.motivo ?? "",
    },
  })

  async function aoEnviar(valores: FormValues) {
    setErro(null)

    if (valores.data_inicio > valores.data_fim) {
      setErro("A data de início deve ser anterior ou igual à data de fim.")
      return
    }

    const payload: AusenciaPayload = {
      profissional_id: Number(valores.profissional_id),
      data_inicio: valores.data_inicio,
      data_fim: valores.data_fim,
      motivo: valores.motivo.trim(),
    }

    setSalvando(true)
    try {
      const salva = ausenciaInicial
        ? await atualizarAusencia(ausenciaInicial.id, payload)
        : await criarAusencia(payload)
      onSalvo(salva)
    } catch (err) {
      setErro(mensagemDeErro(err, "Não foi possível salvar a ausência. Tente novamente."))
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
          <CardTitle>Ausência do profissional</CardTitle>
          <CardDescription>Período em que o profissional não estará disponível.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Profissional *</Label>
            <Select
              disabled={profissionais.length === 0}
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
          </div>
          <div className="space-y-1.5">
            <Label>Data de início *</Label>
            <Input
              type="date"
              aria-invalid={Boolean(errors.data_inicio)}
              {...register("data_inicio", { required: "Informe a data de início." })}
            />
            {errors.data_inicio && (
              <p className="text-xs text-destructive">{errors.data_inicio.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Data de fim *</Label>
            <Input
              type="date"
              aria-invalid={Boolean(errors.data_fim)}
              {...register("data_fim", { required: "Informe a data de fim." })}
            />
            {errors.data_fim && <p className="text-xs text-destructive">{errors.data_fim.message}</p>}
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Motivo</Label>
            <Textarea
              placeholder="Ex.: Férias, licença médica, folga…"
              rows={3}
              {...register("motivo")}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancelar} disabled={salvando}>
          Cancelar
        </Button>
        <Button type="submit" disabled={salvando || profissionais.length === 0}>
          {salvando ? <Loader2Icon className="size-4 animate-spin" /> : <SaveIcon className="size-4" />}
          {editando ? "Salvar alterações" : "Cadastrar ausência"}
        </Button>
      </div>
    </form>
  )
}
