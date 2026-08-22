/** Aba de grupos de exames pré-configurados, por profissional. */
import { useCallback, useEffect, useState } from "react"
import { Loader2Icon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  atualizarGrupoExames,
  criarGrupoExames,
  listarGruposExames,
  removerGrupoExames,
} from "@/services/prontuario"
import type { GrupoExames } from "@/types/prontuario"

export function GruposExamesTab({ profissionalId }: { profissionalId: number }) {
  const [grupos, setGrupos] = useState<GrupoExames[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const [editando, setEditando] = useState<GrupoExames | "novo" | null>(null)
  const [nome, setNome] = useState("")
  const [exames, setExames] = useState("")
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(() => {
    setCarregando(true)
    listarGruposExames(profissionalId)
      .then(setGrupos)
      .catch((e) => setErro(mensagemDeErro(e)))
      .finally(() => setCarregando(false))
  }, [profissionalId])

  useEffect(() => {
    let ativo = true
    async function inicial() {
      setCarregando(true)
      try {
        const d = await listarGruposExames(profissionalId)
        if (ativo) setGrupos(d)
      } catch (e) {
        if (ativo) setErro(mensagemDeErro(e))
      } finally {
        if (ativo) setCarregando(false)
      }
    }
    inicial()
    return () => {
      ativo = false
    }
  }, [profissionalId])

  function abrirNovo() {
    setEditando("novo")
    setNome("")
    setExames("")
  }

  function abrirEdicao(g: GrupoExames) {
    setEditando(g)
    setNome(g.nome)
    setExames(g.exames.map((e) => e.nome).join("\n"))
  }

  async function salvar() {
    if (!nome.trim()) {
      setErro("Informe o nome do grupo.")
      return
    }
    const listaExames = exames
      .split("\n")
      .map((n) => n.trim())
      .filter(Boolean)
      .map((n) => ({ nome: n }))
    setSalvando(true)
    setErro(null)
    try {
      const payload = { profissional: profissionalId, nome, exames: listaExames }
      if (editando && editando !== "novo") await atualizarGrupoExames(editando.id, payload)
      else await criarGrupoExames(payload)
      setEditando(null)
      carregar()
    } catch (e) {
      setErro(mensagemDeErro(e))
    } finally {
      setSalvando(false)
    }
  }

  async function excluir(id: number) {
    try {
      await removerGrupoExames(id)
      carregar()
    } catch (e) {
      setErro(mensagemDeErro(e))
    }
  }

  if (editando) {
    return (
      <div className="space-y-4">
        <h3 className="font-medium">{editando === "novo" ? "Novo grupo de exames" : "Editar grupo"}</h3>
        {erro && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {erro}
          </div>
        )}
        <div className="space-y-1.5">
          <Label>Nome do grupo</Label>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Exames de sangue" />
        </div>
        <div className="space-y-1.5">
          <Label>Exames (um por linha)</Label>
          <textarea
            value={exames}
            onChange={(e) => setExames(e.target.value)}
            rows={6}
            className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring"
            placeholder={"Hemograma completo\nGlicemia de jejum"}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setEditando(null)} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={salvando}>
            {salvando && <Loader2Icon className="size-4 animate-spin" />}
            Salvar
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Grupos de exames para solicitação rápida.</p>
        <Button size="sm" onClick={abrirNovo}>
          <PlusIcon className="size-4" /> Novo grupo
        </Button>
      </div>

      {erro && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {erro}
        </div>
      )}

      {carregando ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" /> Carregando…
        </div>
      ) : grupos.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-12 text-center">
          <p className="text-sm text-muted-foreground">Nenhum grupo de exames cadastrado.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {grupos.map((g) => (
            <div key={g.id} className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between">
                <span className="font-medium">{g.nome}</span>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon-xs" onClick={() => abrirEdicao(g)}>
                    <PencilIcon className="size-3.5" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive">
                      <Trash2Icon className="size-3.5" />
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir grupo?</AlertDialogTitle>
                        <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => excluir(g.id)}
                          className="bg-destructive text-white hover:bg-destructive/90"
                        >
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
              {g.exames.length > 0 && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {g.exames.map((e) => e.nome).join(" · ")}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
