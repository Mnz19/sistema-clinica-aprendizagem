/** Formulário de cadastro/edição de serviço. */
import { useEffect, useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { Loader2Icon, SaveIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ComboboxMulti } from "@/components/ui/combobox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { mensagemDeErro } from "@/utils/apiError"
import { useClinicaStore } from "@/store/clinicaStore"
import type { Servico, ServicoPayload } from "@/types/clinica"

interface Props {
  servicoInicial?: Servico
  onSalvo: (servico: Servico) => void
  onCancelar: () => void
}

type FormValues = {
  nome: string
  descricao: string
  duracao_minutos: number
  valor_clinica: string
  valor_repasse: string
  profissionais: number[]
}

export function ServicoForm({ servicoInicial, onSalvo, onCancelar }: Props) {
  const editando = Boolean(servicoInicial)
  const profissionais = useClinicaStore((s) => s.profissionais)
  const buscarProfissionais = useClinicaStore((s) => s.buscarProfissionais)
  const criarServico = useClinicaStore((s) => s.criarServico)
  const atualizarServico = useClinicaStore((s) => s.atualizarServico)

  useEffect(() => {
    if (profissionais.length === 0) {
      void buscarProfissionais()
    }
  }, [profissionais.length, buscarProfissionais])

  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      nome: servicoInicial?.nome ?? "",
      descricao: servicoInicial?.descricao ?? "",
      duracao_minutos: servicoInicial?.duracao_minutos ?? 60,
      valor_clinica: servicoInicial?.valor_clinica ?? "0.00",
      valor_repasse: servicoInicial?.valor_repasse ?? "0.00",
      profissionais: servicoInicial?.profissionais ?? [],
    },
  })

  const valorClinica = parseFloat(watch("valor_clinica") || "0")
  const valorRepasse = parseFloat(watch("valor_repasse") || "0")
  const margem = isNaN(valorClinica - valorRepasse) ? 0 : valorClinica - valorRepasse

  async function aoEnviar(valores: FormValues) {
    setErro(null)
    const payload: ServicoPayload = {
      nome: valores.nome.trim(),
      descricao: valores.descricao.trim(),
      duracao_minutos: Number(valores.duracao_minutos),
      valor_clinica: valores.valor_clinica,
      valor_repasse: valores.valor_repasse,
      profissionais: valores.profissionais.map(Number),
    }

    setSalvando(true)
    try {
      const salvo = servicoInicial
        ? await atualizarServico(servicoInicial.id, payload)
        : await criarServico(payload)
      onSalvo(salvo)
    } catch (err) {
      setErro(mensagemDeErro(err, "Não foi possível salvar o serviço. Tente novamente."))
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
          <CardTitle>Dados do serviço</CardTitle>
          <CardDescription>Tipo de atendimento, duração e valores.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Nome *</Label>
            <Input
              aria-invalid={Boolean(errors.nome)}
              placeholder="Ex.: Sessão de Terapia ABA"
              {...register("nome", { required: "Informe o nome do serviço." })}
            />
            {errors.nome && <p className="text-xs text-destructive">{errors.nome.message}</p>}
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Profissionais *</Label>
            <p className="text-xs text-muted-foreground">
              Selecione um ou mais profissionais que oferecem este serviço.
            </p>
            <Controller
              control={control}
              name="profissionais"
              rules={{ validate: (v) => v.length > 0 || "Selecione ao menos um profissional." }}
              render={({ field }) => (
                <ComboboxMulti
                  options={profissionais.map((p) => ({ value: p.id, label: p.nome }))}
                  value={field.value}
                  onChange={field.onChange}
                  disabled={profissionais.length === 0}
                  placeholder={
                    profissionais.length === 0
                      ? "Carregando profissionais…"
                      : "Busque e selecione os profissionais…"
                  }
                  emptyText="Nenhum profissional encontrado."
                  aria-invalid={Boolean(errors.profissionais)}
                />
              )}
            />
            {errors.profissionais && (
              <p className="text-xs text-destructive">{errors.profissionais.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Duração (minutos) *</Label>
            <Input
              type="number"
              min={1}
              aria-invalid={Boolean(errors.duracao_minutos)}
              {...register("duracao_minutos", {
                required: "Informe a duração.",
                valueAsNumber: true,
                min: { value: 1, message: "A duração deve ser maior que zero." },
              })}
            />
            {errors.duracao_minutos && (
              <p className="text-xs text-destructive">{errors.duracao_minutos.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Valor clínica (R$) *</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              {...register("valor_clinica", { required: "Informe o valor da clínica." })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Repasse profissional (R$) *</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              {...register("valor_repasse", { required: "Informe o repasse." })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Margem (calculada)</Label>
            <Input
              type="number"
              value={margem.toFixed(2)}
              readOnly
              className="bg-muted text-muted-foreground"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Descrição</Label>
            <Textarea
              placeholder="Detalhes sobre o serviço prestado…"
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
        <Button type="submit" disabled={salvando || profissionais.length === 0}>
          {salvando ? <Loader2Icon className="size-4 animate-spin" /> : <SaveIcon className="size-4" />}
          {editando ? "Salvar alterações" : "Cadastrar serviço"}
        </Button>
      </div>
    </form>
  )
}
