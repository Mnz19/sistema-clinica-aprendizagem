/** Página de detalhe (somente leitura) da ausência de profissional. */
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
import { nomeProfissional } from "@/types/clinica"
import type { Ausencia } from "@/types/clinica"

function Info({ rotulo, valor }: { rotulo: string; valor?: string | null }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{rotulo}</dt>
      <dd className="text-sm text-foreground">{valor || "—"}</dd>
    </div>
  )
}

export default function AusenciaDetalhePage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const ausencias = useClinicaStore((s) => s.ausencias)
  const profissionais = useClinicaStore((s) => s.profissionais)
  const isLoading = useClinicaStore((s) => s.isLoading)
  const buscarAusencias = useClinicaStore((s) => s.buscarAusencias)
  const buscarProfissionais = useClinicaStore((s) => s.buscarProfissionais)
  const removerAusencia = useClinicaStore((s) => s.removerAusencia)
  const reativarAusencia = useClinicaStore((s) => s.reativarAusencia)

  useEffect(() => {
    void buscarAusencias()
    void buscarProfissionais()
  }, [buscarAusencias, buscarProfissionais])

  const ausencia = useMemo<Ausencia | undefined>(
    () => (id ? ausencias.find((a) => a.id === Number(id)) : undefined),
    [ausencias, id]
  )

  async function alternarAtiva() {
    if (!ausencia) return
    try {
      if (ausencia.ativo) await removerAusencia(ausencia.id)
      else await reativarAusencia(ausencia.id)
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

  if (!ausencia) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/agenda/ausencias")}>
          <ArrowLeftIcon className="size-4" /> Voltar
        </Button>
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          Ausência não encontrada.
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon-sm" onClick={() => navigate("/agenda/ausencias")}>
            <ArrowLeftIcon className="size-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight text-foreground">
                {nomeProfissional(ausencia.profissional_id, profissionais)}
              </h1>
              {ausencia.ativo ? (
                <Badge variant="success">Ativa</Badge>
              ) : (
                <Badge variant="destructive">Inativa</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {formatarData(ausencia.data_inicio)} – {formatarData(ausencia.data_fim)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/agenda/ausencias/${ausencia.id}/editar`)}
          >
            <PencilIcon className="size-4" /> Editar
          </Button>
          <AlertDialog>
            <AlertDialogTrigger className={buttonVariants({ variant: "ghost", size: "sm" })}>
              {ausencia.ativo ? (
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
                  {ausencia.ativo ? "Excluir ausência?" : "Reativar ausência?"}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {ausencia.ativo
                    ? "A ausência deixará de aparecer nas listagens padrão, mas o histórico é preservado."
                    : "A ausência voltará a aparecer nas listagens."}
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
          <CardTitle>Dados da ausência</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Info rotulo="Profissional" valor={nomeProfissional(ausencia.profissional_id, profissionais)} />
            <Info rotulo="Status" valor={ausencia.ativo ? "Ativa" : "Inativa"} />
            <Info rotulo="Data de início" valor={formatarData(ausencia.data_inicio)} />
            <Info rotulo="Data de fim" valor={formatarData(ausencia.data_fim)} />
            <div className="sm:col-span-2">
              <Info rotulo="Motivo" valor={ausencia.motivo} />
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  )
}
