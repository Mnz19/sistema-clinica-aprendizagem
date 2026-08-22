/** Página de gestão das especialidades dos prestadores (Cadastros › Especialidades). */
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  GraduationCapIcon,
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
import { mensagemDeErro } from "@/utils/apiError"
import {
  desativarEspecialidade,
  listarEspecialidades,
  reativarEspecialidade,
} from "@/services/especialidades"
import type { Especialidade } from "@/types/especialidade"
import { EspecialidadeFormSheet } from "@/features/especialidades/components/EspecialidadeFormSheet"

export default function EspecialidadesListPage() {
  const [busca, setBusca] = useState("")
  const [especialidades, setEspecialidades] = useState<Especialidade[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const [sheetAberto, setSheetAberto] = useState(false)
  const [emEdicao, setEmEdicao] = useState<Especialidade | null>(null)

  const carregar = useCallback(() => {
    setCarregando(true)
    setErro(null)
    // ``todos`` para trazer também as inativas (a tela gerencia ambas).
    listarEspecialidades({ todos: true })
      .then(setEspecialidades)
      .catch((e) => setErro(mensagemDeErro(e)))
      .finally(() => setCarregando(false))
  }, [])

  useEffect(() => {
    // Difere o carregamento para fora do corpo do efeito (evita setState síncrono).
    const timer = setTimeout(carregar, 0)
    return () => clearTimeout(timer)
  }, [carregar])

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return especialidades
    return especialidades.filter((e) => e.nome.toLowerCase().includes(termo))
  }, [especialidades, busca])

  function abrirNovo() {
    setEmEdicao(null)
    setSheetAberto(true)
  }

  function abrirEdicao(e: Especialidade) {
    setEmEdicao(e)
    setSheetAberto(true)
  }

  async function alternarAtivo(e: Especialidade) {
    try {
      if (e.ativo) await desativarEspecialidade(e.id)
      else await reativarEspecialidade(e.id)
      carregar()
    } catch (err) {
      setErro(mensagemDeErro(err))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-foreground">
            <GraduationCapIcon className="size-5" /> Especialidades
          </h1>
          <p className="text-sm text-muted-foreground">
            Lista de especialidades que podem ser vinculadas aos prestadores.
          </p>
        </div>
        <Button onClick={abrirNovo}>
          <PlusIcon className="size-4" /> Nova especialidade
        </Button>
      </div>

      <div className="relative max-w-sm">
        <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar especialidade…"
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
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {carregando ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="px-4 py-3" colSpan={3}>
                    <Skeleton className="h-5 w-full" />
                  </td>
                </tr>
              ))
            ) : filtradas.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-12 text-center">
                  <GraduationCapIcon className="mx-auto mb-2 size-8 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">
                    {busca
                      ? "Nenhuma especialidade encontrada para a busca."
                      : "Nenhuma especialidade cadastrada ainda."}
                  </p>
                </td>
              </tr>
            ) : (
              filtradas.map((esp) => (
                <tr
                  key={esp.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30"
                >
                  <td className="px-4 py-3">
                    <span className="font-medium text-foreground">{esp.nome}</span>
                  </td>
                  <td className="px-4 py-3">
                    {esp.ativo ? (
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
                        onClick={() => abrirEdicao(esp)}
                        title="Editar"
                      >
                        <PencilIcon className="size-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger
                          className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
                          title={esp.ativo ? "Desativar" : "Reativar"}
                        >
                          {esp.ativo ? (
                            <Trash2Icon className="size-4" />
                          ) : (
                            <RotateCcwIcon className="size-4" />
                          )}
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              {esp.ativo
                                ? "Desativar especialidade?"
                                : "Reativar especialidade?"}
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              {esp.ativo
                                ? "Ela deixará de aparecer na seleção de novos prestadores, mas os vínculos existentes são preservados."
                                : "Ela voltará a aparecer na seleção de prestadores."}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => alternarAtivo(esp)}>
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

      <EspecialidadeFormSheet
        key={`${emEdicao?.id ?? "novo"}-${sheetAberto}`}
        aberto={sheetAberto}
        especialidade={emEdicao}
        onFechar={() => setSheetAberto(false)}
        onSalvo={() => {
          setSheetAberto(false)
          carregar()
        }}
      />
    </div>
  )
}
