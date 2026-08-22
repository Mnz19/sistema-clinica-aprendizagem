/** Aba de modelos de atestado, com editor de corpo + paleta de macros. */
import { useCallback, useEffect, useRef, useState } from "react"
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
import { htmlParaTexto } from "@/utils/html"
import {
  atualizarModeloAtestado,
  criarModeloAtestado,
  listarModelosAtestado,
  removerModeloAtestado,
} from "@/services/prontuario"
import { MACROS_ATESTADO } from "@/types/prontuario"
import type { ModeloAtestado } from "@/types/prontuario"

export function AtestadosTab({ profissionalId }: { profissionalId: number }) {
  const [modelos, setModelos] = useState<ModeloAtestado[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const [editando, setEditando] = useState<ModeloAtestado | "novo" | null>(null)
  const [nome, setNome] = useState("")
  const [titulo, setTitulo] = useState("")
  const [salvando, setSalvando] = useState(false)
  const corpoRef = useRef<HTMLDivElement>(null)

  const carregar = useCallback(() => {
    setCarregando(true)
    listarModelosAtestado(profissionalId)
      .then(setModelos)
      .catch((e) => setErro(mensagemDeErro(e)))
      .finally(() => setCarregando(false))
  }, [profissionalId])

  useEffect(() => {
    let ativo = true
    async function inicial() {
      setCarregando(true)
      try {
        const d = await listarModelosAtestado(profissionalId)
        if (ativo) setModelos(d)
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
    setTitulo("")
    if (corpoRef.current) corpoRef.current.innerHTML = ""
  }

  function abrirEdicao(m: ModeloAtestado) {
    setEditando(m)
    setNome(m.nome)
    setTitulo(m.titulo)
    // O editor é montado após esta atualização de estado; preenche via efeito abaixo.
    requestAnimationFrame(() => {
      if (corpoRef.current) corpoRef.current.innerHTML = m.corpo
    })
  }

  function inserirMacro(token: string) {
    const el = corpoRef.current
    if (!el) return
    el.focus()
    document.execCommand("insertText", false, token)
  }

  async function salvar() {
    const corpo = corpoRef.current?.innerHTML ?? ""
    if (!nome.trim() || htmlParaTexto(corpo).trim() === "") {
      setErro("Informe o nome e o corpo do atestado.")
      return
    }
    setSalvando(true)
    setErro(null)
    try {
      const payload = { profissional: profissionalId, nome, titulo, corpo }
      if (editando && editando !== "novo") await atualizarModeloAtestado(editando.id, payload)
      else await criarModeloAtestado(payload)
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
      await removerModeloAtestado(id)
      carregar()
    } catch (e) {
      setErro(mensagemDeErro(e))
    }
  }

  if (editando) {
    return (
      <div className="space-y-4">
        <h3 className="font-medium">{editando === "novo" ? "Novo atestado padrão" : "Editar atestado"}</h3>
        {erro && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {erro}
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Nome do modelo</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Atestado de comparecimento" />
          </div>
          <div className="space-y-1.5">
            <Label>Título impresso</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: ATESTADO" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Corpo do atestado</Label>
          <div
            ref={corpoRef}
            contentEditable
            suppressContentEditableWarning
            className="prose-registro min-h-56 max-h-[50vh] overflow-auto rounded-lg border border-input px-3 py-2 text-sm outline-none focus-visible:border-ring"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Inserir macro no cursor:</Label>
          <div className="flex flex-wrap gap-1.5">
            {MACROS_ATESTADO.map((m) => (
              <button
                key={m.token}
                type="button"
                title={m.rotulo}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => inserirMacro(m.token)}
                className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {m.token}
              </button>
            ))}
          </div>
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
        <p className="text-sm text-muted-foreground">Modelos de atestado com macros preenchidas na geração.</p>
        <Button size="sm" onClick={abrirNovo}>
          <PlusIcon className="size-4" /> Novo atestado
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
      ) : modelos.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-12 text-center">
          <p className="text-sm text-muted-foreground">Nenhum modelo de atestado cadastrado.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {modelos.map((m) => (
            <div key={m.id} className="flex items-center justify-between rounded-lg border border-border p-3">
              <span className="font-medium">{m.nome}</span>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon-xs" onClick={() => abrirEdicao(m)}>
                  <PencilIcon className="size-3.5" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive">
                    <Trash2Icon className="size-3.5" />
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir modelo de atestado?</AlertDialogTitle>
                      <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => excluir(m.id)}
                        className="bg-destructive text-white hover:bg-destructive/90"
                      >
                        Excluir
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
