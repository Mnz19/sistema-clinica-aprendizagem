/** Página de listagem e busca de serviços. */
import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  ClipboardListIcon,
  EyeIcon,
  PencilIcon,
  PlusIcon,
  RotateCcwIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react"

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
import { formatarDuracao, formatarMoeda } from "@/utils/format"
import { useClinicaStore } from "@/store/clinicaStore"
import { nomesProfissionais } from "@/types/clinica"
import type { Servico } from "@/types/clinica"

export default function ServicosListPage() {
  const navigate = useNavigate()
  const servicos = useClinicaStore((s) => s.servicos)
  const profissionais = useClinicaStore((s) => s.profissionais)
  const erro = useClinicaStore((s) => s.erro)
  const buscarServicos = useClinicaStore((s) => s.buscarServicos)
  const buscarProfissionais = useClinicaStore((s) => s.buscarProfissionais)
  const removerServico = useClinicaStore((s) => s.removerServico)
  const reativarServico = useClinicaStore((s) => s.reativarServico)

  const [busca, setBusca] = useState("")
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setCarregando(true)
      Promise.all([buscarServicos(), buscarProfissionais()]).finally(() =>
        setCarregando(false)
      )
    }, 300)
    return () => clearTimeout(timer)
  }, [buscarServicos, buscarProfissionais])

  const servicosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return servicos
    return servicos.filter(
      (s) => s.nome.toLowerCase().includes(termo) || s.descricao.toLowerCase().includes(termo)
    )
  }, [servicos, busca])

  async function alternarAtivo(servico: Servico) {
    try {
      if (servico.ativo) await removerServico(servico.id)
      else await reativarServico(servico.id)
    } catch {
      // erro já tratado na store
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Serviços</h1>
          <p className="text-sm text-muted-foreground">
            Tipos de atendimento prestados pela clínica.
          </p>
        </div>
        <Button onClick={() => navigate("/servicos/novo")}>
          <PlusIcon className="size-4" /> Novo serviço
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
              <th className="hidden px-4 py-2.5 font-medium md:table-cell">Profissional</th>
              <th className="hidden px-4 py-2.5 font-medium sm:table-cell">Duração</th>
              <th className="px-4 py-2.5 font-medium">Valor</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium text-right">Ações</th>
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
            ) : servicosFiltrados.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center">
                  <ClipboardListIcon className="mx-auto mb-2 size-8 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">
                    {busca
                      ? "Nenhum serviço encontrado para a busca."
                      : "Nenhum serviço cadastrado ainda."}
                  </p>
                </td>
              </tr>
            ) : (
              servicosFiltrados.map((servico) => (
                <tr key={servico.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <span className="font-medium text-foreground">{servico.nome}</span>
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                    {nomesProfissionais(servico.profissionais, profissionais)}
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                    {formatarDuracao(servico.duracao_minutos)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatarMoeda(parseFloat(servico.valor_clinica))}</td>
                  <td className="px-4 py-3">
                    {servico.ativo ? (
                      <Badge variant="success">Ativo</Badge>
                    ) : (
                      <Badge variant="destructive">Inativo</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => navigate(`/servicos/${servico.id}`)}
                        title="Ver detalhes"
                      >
                        <EyeIcon className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => navigate(`/servicos/${servico.id}/editar`)}
                        title="Editar"
                      >
                        <PencilIcon className="size-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger
                          className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
                          title={servico.ativo ? "Excluir" : "Reativar"}
                        >
                          {servico.ativo ? (
                            <Trash2Icon className="size-4" />
                          ) : (
                            <RotateCcwIcon className="size-4" />
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
                            <AlertDialogAction onClick={() => alternarAtivo(servico)}>
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
