/** Página de listagem e busca de salas. */
import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { DoorOpenIcon, EyeIcon, PencilIcon, PlusIcon, RotateCcwIcon, SearchIcon, Trash2Icon } from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import type { Sala } from "@/types/clinica"

export default function SalasListPage() {
  const navigate = useNavigate()
  const salas = useClinicaStore((s) => s.salas)
  const erro = useClinicaStore((s) => s.erro)
  const buscarSalas = useClinicaStore((s) => s.buscarSalas)
  const removerSala = useClinicaStore((s) => s.removerSala)
  const reativarSala = useClinicaStore((s) => s.reativarSala)

  const [busca, setBusca] = useState("")
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setCarregando(true)
      void buscarSalas().finally(() => setCarregando(false))
    }, 300)
    return () => clearTimeout(timer)
  }, [buscarSalas])

  const salasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return salas
    return salas.filter(
      (s) => s.nome.toLowerCase().includes(termo) || s.descricao.toLowerCase().includes(termo)
    )
  }, [salas, busca])

  async function alternarAtiva(sala: Sala) {
    try {
      if (sala.ativa) await removerSala(sala.id)
      else await reativarSala(sala.id)
    } catch {
      // erro já tratado na store
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Salas</h1>
          <p className="text-sm text-muted-foreground">
            Espaços físicos de atendimento da clínica.
          </p>
        </div>
        <Button onClick={() => navigate("/salas/novo")}>
          <PlusIcon className="size-4" /> Nova sala
        </Button>
      </div>

      <div className="relative max-w-sm">
        <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome ou descrição…"
          className="pl-8"
        />
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
              <th className="px-4 py-2.5 font-medium">Nome</th>
              <th className="hidden px-4 py-2.5 font-medium md:table-cell">Descrição</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="hidden px-4 py-2.5 font-medium lg:table-cell">Atualizado</th>
              <th className="px-4 py-2.5 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {carregando ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="px-4 py-3" colSpan={5}>
                    <Skeleton className="h-5 w-full" />
                  </td>
                </tr>
              ))
            ) : salasFiltradas.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center">
                  <DoorOpenIcon className="mx-auto mb-2 size-8 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">
                    {busca ? "Nenhuma sala encontrada para a busca." : "Nenhuma sala cadastrada ainda."}
                  </p>
                </td>
              </tr>
            ) : (
              salasFiltradas.map((sala) => (
                <tr key={sala.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <span className="font-medium text-foreground">{sala.nome}</span>
                  </td>
                  <td className="hidden max-w-xs truncate px-4 py-3 text-muted-foreground md:table-cell">
                    {sala.descricao || "—"}
                  </td>
                  <td className="px-4 py-3">
                    {sala.ativa ? (
                      <Badge variant="success">Ativa</Badge>
                    ) : (
                      <Badge variant="destructive">Inativa</Badge>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
                    {formatarData(sala.atualizado_em)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => navigate(`/salas/${sala.id}`)}
                        title="Ver detalhes"
                      >
                        <EyeIcon className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => navigate(`/salas/${sala.id}/editar`)}
                        title="Editar"
                      >
                        <PencilIcon className="size-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger
                          className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
                          title={sala.ativa ? "Excluir" : "Reativar"}
                        >
                          {sala.ativa ? (
                            <Trash2Icon className="size-4" />
                          ) : (
                            <RotateCcwIcon className="size-4" />
                          )}
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              {sala.ativa ? "Excluir sala?" : "Reativar sala?"}
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              {sala.ativa
                                ? "A sala deixará de aparecer nas listagens padrão, mas o histórico é preservado."
                                : "A sala voltará a aparecer nas listagens."}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => alternarAtiva(sala)}>
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
