/** Aba de textos padrão reutilizáveis, por profissional. */
import { useCallback, useEffect, useState } from "react"
import { Loader2Icon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { RichTextEditor } from "@/components/ui/rich-text-editor"
import { RichContent } from "@/components/ui/rich-content"
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
  atualizarTextoPadrao,
  criarTextoPadrao,
  listarTextosPadrao,
  removerTextoPadrao,
} from "@/services/prontuario"
import type { TextoPadrao } from "@/types/prontuario"

export function TextosPadraoTab({ profissionalId }: { profissionalId: number }) {
  const [textos, setTextos] = useState<TextoPadrao[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const [editando, setEditando] = useState<TextoPadrao | "novo" | null>(null)
  const [titulo, setTitulo] = useState("")
  const [conteudo, setConteudo] = useState("")
  const [editorKey, setEditorKey] = useState(0)
  const [compartilhado, setCompartilhado] = useState(false)
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(() => {
    setCarregando(true)
    listarTextosPadrao({ profissional: profissionalId })
      .then(setTextos)
      .catch((e) => setErro(mensagemDeErro(e)))
      .finally(() => setCarregando(false))
  }, [profissionalId])

  useEffect(() => {
    let ativo = true
    async function inicial() {
      setCarregando(true)
      try {
        const d = await listarTextosPadrao({ profissional: profissionalId })
        if (ativo) setTextos(d)
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
    setTitulo("")
    setConteudo("")
    setCompartilhado(false)
    setEditorKey((k) => k + 1)
  }

  function abrirEdicao(t: TextoPadrao) {
    setEditando(t)
    setTitulo(t.titulo)
    setConteudo(t.conteudo)
    setCompartilhado(t.compartilhado)
    setEditorKey((k) => k + 1)
  }

  async function salvar() {
    if (!titulo.trim() || htmlParaTexto(conteudo).trim() === "") {
      setErro("Informe título e conteúdo do texto.")
      return
    }
    setSalvando(true)
    setErro(null)
    try {
      const payload = { profissional: profissionalId, titulo, conteudo, compartilhado }
      if (editando && editando !== "novo") await atualizarTextoPadrao(editando.id, payload)
      else await criarTextoPadrao(payload)
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
      await removerTextoPadrao(id)
      carregar()
    } catch (e) {
      setErro(mensagemDeErro(e))
    }
  }

  if (editando) {
    return (
      <div className="space-y-4">
        <h3 className="font-medium">{editando === "novo" ? "Novo texto padrão" : "Editar texto padrão"}</h3>
        {erro && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {erro}
          </div>
        )}
        <div className="space-y-1.5">
          <Label>Título</Label>
          <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Conteúdo</Label>
          <RichTextEditor key={editorKey} value={conteudo} onChange={setConteudo} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={compartilhado}
            onChange={(e) => setCompartilhado(e.target.checked)}
            className="size-4 rounded border-input"
          />
          Compartilhar com toda a equipe
        </label>
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
        <p className="text-sm text-muted-foreground">Textos padrão para agilizar o preenchimento.</p>
        <Button size="sm" onClick={abrirNovo}>
          <PlusIcon className="size-4" /> Novo texto
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
      ) : textos.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-12 text-center">
          <p className="text-sm text-muted-foreground">Nenhum texto padrão cadastrado.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {textos.map((t) => (
            <div key={t.id} className="rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{t.titulo}</span>
                  {t.compartilhado && <Badge variant="outline">Compartilhado</Badge>}
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon-xs" onClick={() => abrirEdicao(t)}>
                    <PencilIcon className="size-3.5" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive">
                      <Trash2Icon className="size-3.5" />
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir texto padrão?</AlertDialogTitle>
                        <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => excluir(t.id)}
                          className="bg-destructive text-white hover:bg-destructive/90"
                        >
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
              <RichContent html={t.conteudo} className="mt-2 line-clamp-3 text-muted-foreground" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
