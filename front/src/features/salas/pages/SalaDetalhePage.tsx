/** Página de detalhe (somente leitura) da sala. */
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
import { formatarData } from "@/utils/format"
import { useClinicaStore } from "@/store/clinicaStore"
import type { Sala } from "@/types/clinica"

function Info({ rotulo, valor }: { rotulo: string; valor?: string | null }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{rotulo}</dt>
      <dd className="text-sm text-foreground">{valor || "—"}</dd>
    </div>
  )
}

export default function SalaDetalhePage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const salas = useClinicaStore((s) => s.salas)
  const isLoading = useClinicaStore((s) => s.isLoading)
  const buscarSalas = useClinicaStore((s) => s.buscarSalas)
  const removerSala = useClinicaStore((s) => s.removerSala)
  const reativarSala = useClinicaStore((s) => s.reativarSala)

  useEffect(() => {
    void buscarSalas()
  }, [buscarSalas])

  const sala = useMemo<Sala | undefined>(
    () => (id ? salas.find((s) => s.id === Number(id)) : undefined),
    [salas, id]
  )

  async function alternarAtiva() {
    if (!sala) return
    try {
      if (sala.ativa) await removerSala(sala.id)
      else await reativarSala(sala.id)
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

  if (!sala) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/salas")}>
          <ArrowLeftIcon className="size-4" /> Voltar
        </Button>
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          Sala não encontrada.
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon-sm" onClick={() => navigate("/salas")}>
            <ArrowLeftIcon className="size-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight text-foreground">{sala.nome}</h1>
              {sala.ativa ? (
                <Badge variant="success">Ativa</Badge>
              ) : (
                <Badge variant="destructive">Inativa</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Atualizada em {formatarData(sala.atualizado_em)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(`/salas/${sala.id}/editar`)}>
            <PencilIcon className="size-4" /> Editar
          </Button>
          <AlertDialog>
            <AlertDialogTrigger className={buttonVariants({ variant: "ghost", size: "sm" })}>
              {sala.ativa ? (
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
                <AlertDialogTitle>{sala.ativa ? "Excluir sala?" : "Reativar sala?"}</AlertDialogTitle>
                <AlertDialogDescription>
                  {sala.ativa
                    ? "A sala deixará de aparecer nas listagens padrão, mas o histórico é preservado."
                    : "A sala voltará a aparecer nas listagens."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={alternarAtiva}>Confirmar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados da sala</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Info rotulo="Nome" valor={sala.nome} />
            <Info rotulo="Status" valor={sala.ativa ? "Ativa" : "Inativa"} />
            <div className="sm:col-span-2">
              <Info rotulo="Descrição" valor={sala.descricao} />
            </div>
            <Info rotulo="Criada em" valor={formatarData(sala.criado_em)} />
            <Info rotulo="Atualizada em" valor={formatarData(sala.atualizado_em)} />
          </dl>
        </CardContent>
      </Card>
    </div>
  )
}
