/** Página de detalhe (somente leitura) do serviço. */
import { useEffect, useMemo } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { ArrowLeftIcon, PencilIcon, RotateCcwIcon, Trash2Icon } from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { formatarData, formatarDuracao, formatarMoeda } from "@/utils/format"
import { useClinicaStore } from "@/store/clinicaStore"
import { nomesProfissionais } from "@/types/clinica"
import type { Servico } from "@/types/clinica"

function Info({ rotulo, valor }: { rotulo: string; valor?: string | null }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{rotulo}</dt>
      <dd className="text-sm text-foreground">{valor || "—"}</dd>
    </div>
  )
}

export default function ServicoDetalhePage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const servicos = useClinicaStore((s) => s.servicos)
  const profissionais = useClinicaStore((s) => s.profissionais)
  const isLoading = useClinicaStore((s) => s.isLoading)
  const buscarServicos = useClinicaStore((s) => s.buscarServicos)
  const buscarProfissionais = useClinicaStore((s) => s.buscarProfissionais)
  const removerServico = useClinicaStore((s) => s.removerServico)
  const reativarServico = useClinicaStore((s) => s.reativarServico)

  useEffect(() => {
    void buscarServicos()
    void buscarProfissionais()
  }, [buscarServicos, buscarProfissionais])

  const servico = useMemo<Servico | undefined>(
    () => (id ? servicos.find((s) => s.id === Number(id)) : undefined),
    [servicos, id]
  )

  async function alternarAtivo() {
    if (!servico) return
    try {
      if (servico.ativo) await removerServico(servico.id)
      else await reativarServico(servico.id)
    } catch {
      // erro já tratado na store
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        Carregando…
      </div>
    )
  }

  if (!servico) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/servicos")}>
          <ArrowLeftIcon className="size-4" /> Voltar
        </Button>
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          Serviço não encontrado.
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon-sm" onClick={() => navigate("/servicos")}>
            <ArrowLeftIcon className="size-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight text-foreground">{servico.nome}</h1>
              {servico.ativo ? (
                <Badge variant="success">Ativo</Badge>
              ) : (
                <Badge variant="destructive">Inativo</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {nomesProfissionais(servico.profissionais, profissionais)} · {formatarDuracao(servico.duracao_minutos)} ·{" "}
              {formatarMoeda(parseFloat(servico.valor_clinica))}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(`/servicos/${servico.id}/editar`)}>
            <PencilIcon className="size-4" /> Editar
          </Button>
          <AlertDialog>
            <AlertDialogTrigger className={buttonVariants({ variant: "ghost", size: "sm" })}>
              {servico.ativo ? (
                <>
                  <Trash2Icon className="size-4" /> Excluir
                </>
              ) : (
                <>
                  <RotateCcwIcon className="size-4" /> Reativar
                </>
              )}
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {servico.ativo ? "Excluir serviço?" : "Reativar serviço?"}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {servico.ativo
                    ? "O serviço deixará de aparecer nas listagens padrão, mas o histórico é preservado."
                    : "O serviço voltará a aparecer nas listagens."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={alternarAtivo}>Confirmar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados do serviço</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-3">
            <Info rotulo="Profissionais" valor={nomesProfissionais(servico.profissionais, profissionais)} />
            <Info rotulo="Duração" valor={formatarDuracao(servico.duracao_minutos)} />
            <Info rotulo="Valor" valor={formatarMoeda(parseFloat(servico.valor_clinica))} />
            <Info rotulo="Status" valor={servico.ativo ? "Ativo" : "Inativo"} />
            <div className="sm:col-span-3">
              <Info rotulo="Descrição" valor={servico.descricao} />
            </div>
            <Info rotulo="Criado em" valor={formatarData(servico.criado_em)} />
            <Info rotulo="Atualizado em" valor={formatarData(servico.atualizado_em)} />
          </dl>
        </CardContent>
      </Card>
    </div>
  )
}
