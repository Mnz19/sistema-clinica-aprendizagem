/** Página de conferência financeira de produção (somente leitura). */
import { useEffect, useMemo, useState } from "react"
import { BanknoteIcon, CalendarRangeIcon, ClipboardListIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useClinicaStore } from "@/store/clinicaStore"
import { useProducaoStore } from "@/store/producaoStore"
import { MOTIVOS_PRODUCAO } from "@/types/producao"
import { formatarData, formatarMoeda } from "@/utils/format"

function primeiroDiaMes(ref = new Date()): string {
  const ano = ref.getFullYear()
  const mes = String(ref.getMonth() + 1).padStart(2, "0")
  return `${ano}-${mes}-01`
}

function ultimoDiaMes(ref = new Date()): string {
  const d = new Date(ref.getFullYear(), ref.getMonth() + 1, 0)
  const ano = d.getFullYear()
  const mes = String(d.getMonth() + 1).padStart(2, "0")
  const dia = String(d.getDate()).padStart(2, "0")
  return `${ano}-${mes}-${dia}`
}

function motivoVariant(motivo: string): "success" | "destructive" | "secondary" | "default" {
  if (motivo === MOTIVOS_PRODUCAO.REALIZADO) return "success"
  if (motivo === MOTIVOS_PRODUCAO.FALTA || motivo.includes("Cancelamento")) {
    return "destructive"
  }
  return "secondary"
}

export default function ProducaoListPage() {
  const producoes = useProducaoStore((s) => s.producoes)
  const carregando = useProducaoStore((s) => s.carregando)
  const erro = useProducaoStore((s) => s.erro)
  const buscarProducoes = useProducaoStore((s) => s.buscarProducoes)

  const profissionais = useClinicaStore((s) => s.profissionais)
  const buscarProfissionais = useClinicaStore((s) => s.buscarProfissionais)

  const [dataInicio, setDataInicio] = useState(primeiroDiaMes)
  const [dataFim, setDataFim] = useState(ultimoDiaMes)
  const [profissionalId, setProfissionalId] = useState("")

  useEffect(() => {
    void buscarProfissionais()
  }, [buscarProfissionais])

  useEffect(() => {
    const timer = setTimeout(() => {
      void buscarProducoes({
        data__gte: dataInicio || undefined,
        data__lte: dataFim || undefined,
        profissional: profissionalId ? Number(profissionalId) : undefined,
      })
    }, 300)
    return () => clearTimeout(timer)
  }, [buscarProducoes, dataInicio, dataFim, profissionalId])

  const totalSessoes = producoes.length
  const valorTotal = useMemo(
    () => producoes.reduce((acc, item) => acc + (Number.isFinite(item.valor) ? item.valor : 0), 0),
    [producoes]
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Produção e Faturamento
        </h1>
        <p className="text-sm text-muted-foreground">
          Conferência mensal de atendimentos para conciliação com o Nibo.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4">
        <div className="space-y-1.5">
          <Label htmlFor="producao-data-inicio">Data inicial</Label>
          <Input
            id="producao-data-inicio"
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            className="w-40"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="producao-data-fim">Data final</Label>
          <Input
            id="producao-data-fim"
            type="date"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
            className="w-40"
          />
        </div>
        <div className="min-w-[14rem] flex-1 space-y-1.5 sm:max-w-xs">
          <Label htmlFor="producao-profissional">Profissional</Label>
          <Select
            id="producao-profissional"
            value={profissionalId}
            onChange={(e) => setProfissionalId(e.target.value)}
          >
            <option value="">Todos os profissionais</option>
            {profissionais.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total de Sessões
            </CardTitle>
            <ClipboardListIcon className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {carregando ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="text-2xl font-semibold tracking-tight text-foreground">{totalSessoes}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Valor Total Produzido
            </CardTitle>
            <BanknoteIcon className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {carregando ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <p className="text-2xl font-semibold tracking-tight text-foreground">
                {formatarMoeda(valorTotal)}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {erro && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {erro}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">Data</th>
              <th className="px-4 py-2.5 font-medium">Paciente</th>
              <th className="hidden px-4 py-2.5 font-medium md:table-cell">Profissional</th>
              <th className="hidden px-4 py-2.5 font-medium lg:table-cell">Serviço</th>
              <th className="px-4 py-2.5 font-medium">Motivo</th>
              <th className="px-4 py-2.5 font-medium text-right">Valor</th>
            </tr>
          </thead>
          <tbody>
            {carregando ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="px-4 py-3" colSpan={6}>
                    <Skeleton className="h-5 w-full" />
                  </td>
                </tr>
              ))
            ) : producoes.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center">
                  <CalendarRangeIcon className="mx-auto mb-2 size-8 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">
                    Nenhuma produção encontrada para o período selecionado.
                  </p>
                </td>
              </tr>
            ) : (
              producoes.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30"
                >
                  <td className="px-4 py-3 text-muted-foreground">{formatarData(item.data)}</td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-foreground">{item.paciente_nome}</span>
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                    {item.profissional_nome}
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
                    {item.servico_nome}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={motivoVariant(item.motivo)}>{item.motivo}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-foreground">
                    {formatarMoeda(item.valor)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
