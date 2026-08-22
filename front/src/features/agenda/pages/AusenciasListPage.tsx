/** Página de listagem das ausências pontuais dos profissionais. */
import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { CalendarOffIcon, EyeIcon, PencilIcon, PlusIcon, RotateCcwIcon, Trash2Icon } from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
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

export default function AusenciasListPage() {
  const navigate = useNavigate()
  const ausencias = useClinicaStore((s) => s.ausencias)
  const profissionais = useClinicaStore((s) => s.profissionais)
  const erro = useClinicaStore((s) => s.erro)
  const buscarAusencias = useClinicaStore((s) => s.buscarAusencias)
  const buscarProfissionais = useClinicaStore((s) => s.buscarProfissionais)
  const removerAusencia = useClinicaStore((s) => s.removerAusencia)
  const reativarAusencia = useClinicaStore((s) => s.reativarAusencia)

  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setCarregando(true)
      Promise.all([buscarAusencias(), buscarProfissionais()]).finally(() =>
        setCarregando(false)
      )
    }, 300)
    return () => clearTimeout(timer)
  }, [buscarAusencias, buscarProfissionais])

  const ausenciasOrdenadas = useMemo(
    () => [...ausencias].sort((a, b) => b.data_inicio.localeCompare(a.data_inicio)),
    [ausencias]
  )

  async function alternarAtiva(ausencia: Ausencia) {
    try {
      if (ausencia.ativo) await removerAusencia(ausencia.id)
      else await reativarAusencia(ausencia.id)
    } catch {
      // erro já tratado na store
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Ausências</h1>
          <p className="text-sm text-muted-foreground">
            Férias, licenças e folgas pontuais dos profissionais.
          </p>
        </div>
        <Button onClick={() => navigate("/agenda/ausencias/novo")}>
          <PlusIcon className="size-4" /> Nova ausência
        </Button>
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
              <th className="px-4 py-2.5 font-medium">Profissional</th>
              <th className="px-4 py-2.5 font-medium">Período</th>
              <th className="hidden px-4 py-2.5 font-medium md:table-cell">Motivo</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {carregando ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="px-4 py-3" colSpan={5}>
                    <Skeleton className="h-5 w-full" />
                  </td>
                </tr>
              ))
            ) : ausenciasOrdenadas.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center">
                  <CalendarOffIcon className="mx-auto mb-2 size-8 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">Nenhuma ausência cadastrada ainda.</p>
                </td>
              </tr>
            ) : (
              ausenciasOrdenadas.map((ausencia) => (
                <tr key={ausencia.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <span className="font-medium text-foreground">
                      {nomeProfissional(ausencia.profissional_id, profissionais)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatarData(ausencia.data_inicio)} – {formatarData(ausencia.data_fim)}
                  </td>
                  <td className="hidden max-w-xs truncate px-4 py-3 text-muted-foreground md:table-cell">
                    {ausencia.motivo || "—"}
                  </td>
                  <td className="px-4 py-3">
                    {ausencia.ativo ? (
                      <Badge variant="success">Ativa</Badge>
                    ) : (
                      <Badge variant="destructive">Inativa</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => navigate(`/agenda/ausencias/${ausencia.id}`)}
                        title="Ver detalhes"
                      >
                        <EyeIcon className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => navigate(`/agenda/ausencias/${ausencia.id}/editar`)}
                        title="Editar"
                      >
                        <PencilIcon className="size-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger
                          className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
                          title={ausencia.ativo ? "Excluir" : "Reativar"}
                        >
                          {ausencia.ativo ? (
                            <Trash2Icon className="size-4" />
                          ) : (
                            <RotateCcwIcon className="size-4" />
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
                            <AlertDialogAction onClick={() => alternarAtiva(ausencia)}>
                              Confirmar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
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
