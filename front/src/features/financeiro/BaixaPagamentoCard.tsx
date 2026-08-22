/**
 * Card de baixa de pagamento exibido na tela de detalhe do agendamento.
 * Visível apenas para FINANCEIRO e DIRECAO.
 */
import { useState } from "react"
import { useForm } from "react-hook-form"
import { Loader2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { api } from "@/services/api"
import { FORMA_PAGAMENTO_LABELS, type FormaPagamento, type PagamentoAgendamento } from "@/types/agendamento"

interface Props {
  agendamentoId: number
  pagamentoExistente?: PagamentoAgendamento | null
  onRegistrado?: (pagamento: PagamentoAgendamento) => void
}

type FormValues = {
  valor_pago: string
  forma_pagamento: FormaPagamento
}

export function BaixaPagamentoCard({ agendamentoId, pagamentoExistente, onRegistrado }: Props) {
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [pagamento, setPagamento] = useState<PagamentoAgendamento | null>(pagamentoExistente ?? null)

  const { register, handleSubmit } = useForm<FormValues>({
    defaultValues: { valor_pago: "", forma_pagamento: "PIX" },
  })

  async function aoEnviar(valores: FormValues) {
    setErro(null)
    setSalvando(true)
    try {
      const { data } = await api.post(`/agendamentos/${agendamentoId}/pagamento/`, valores)
      setPagamento(data)
      onRegistrado?.(data)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setErro(msg ?? "Não foi possível registrar o pagamento.")
    } finally {
      setSalvando(false)
    }
  }

  if (pagamento) {
    return (
      <div className="rounded-lg border border-border p-4 space-y-2 text-sm">
        <p className="font-medium">Pagamento registrado</p>
        <p>Valor: <strong>R$ {pagamento.valor_pago}</strong></p>
        <p>Forma: <strong>{FORMA_PAGAMENTO_LABELS[pagamento.forma_pagamento]}</strong></p>
        <p>Repasse: <strong>R$ {pagamento.valor_repasse_calculado}</strong></p>
        <p className="text-muted-foreground text-xs">Por {pagamento.registrado_por_nome}</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(aoEnviar)} className="rounded-lg border border-border p-4 space-y-3">
      <p className="font-medium text-sm">Registrar pagamento</p>
      {erro && <p className="text-xs text-destructive">{erro}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Valor pago (R$)</Label>
          <Input type="number" step="0.01" min="0" {...register("valor_pago", { required: true })} />
        </div>
        <div className="space-y-1.5">
          <Label>Forma de pagamento</Label>
          <Select {...register("forma_pagamento")}>
            {(Object.entries(FORMA_PAGAMENTO_LABELS) as [FormaPagamento, string][]).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </Select>
        </div>
      </div>
      <Button type="submit" size="sm" disabled={salvando}>
        {salvando ? <Loader2Icon className="size-4 animate-spin" /> : "Registrar baixa"}
      </Button>
    </form>
  )
}
