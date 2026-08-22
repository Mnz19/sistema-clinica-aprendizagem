/** Sheet de criação/edição de uma entrada do prontuário (texto livre ou formulário). */
import { useEffect, useState } from "react"
import type { FormEvent } from "react"
import { FileStackIcon, Loader2Icon, SaveIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RichTextEditor } from "@/components/ui/rich-text-editor"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { mensagemDeErro } from "@/utils/apiError"
import { htmlParaTexto } from "@/utils/html"
import {
  atualizarEntrada,
  criarEntrada,
  listarTextosPadrao,
} from "@/services/prontuario"
import { FormRenderer } from "@/features/prontuario/components/FormRenderer"
import type {
  EntradaPayload,
  EntradaProntuario,
  ItemProntuario,
  TextoPadrao,
} from "@/types/prontuario"

interface Props {
  aberto: boolean
  pacienteId: number
  item: ItemProntuario
  entrada?: EntradaProntuario | null
  onFechar: () => void
  onSalvo: () => void
}

function paraInputLocal(iso?: string): string {
  const base = iso ? new Date(iso) : new Date()
  const off = base.getTimezoneOffset()
  return new Date(base.getTime() - off * 60000).toISOString().slice(0, 16)
}

export function EntradaFormSheet({
  aberto,
  pacienteId,
  item,
  entrada,
  onFechar,
  onSalvo,
}: Props) {
  const editando = Boolean(entrada)
  const ehFormulario = item.tipo_item === "FORMULARIO"
  // Formulários existentes usam o snapshot salvo; novos usam o schema atual do item.
  const schema = entrada?.schema_snapshot?.length ? entrada.schema_snapshot : item.formulario_schema

  const [titulo, setTitulo] = useState(entrada?.titulo ?? "")
  const [conteudo, setConteudo] = useState(entrada?.conteudo ?? "")
  const [editorKey, setEditorKey] = useState(0)
  const [respostas, setRespostas] = useState<Record<string, unknown>>(entrada?.respostas ?? {})
  const [dataEvento, setDataEvento] = useState(paraInputLocal(entrada?.data_evento))
  const [textos, setTextos] = useState<TextoPadrao[]>([])
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (ehFormulario) return
    listarTextosPadrao({ profissional: item.profissional })
      .then(setTextos)
      .catch(() => setTextos([]))
  }, [ehFormulario, item.profissional])

  function inserirTexto(id: string) {
    const texto = textos.find((t) => String(t.id) === id)
    if (!texto) return
    const vazio = htmlParaTexto(conteudo).trim() === ""
    setConteudo(vazio ? texto.conteudo : `${conteudo}<hr>${texto.conteudo}`)
    setEditorKey((k) => k + 1)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro(null)

    if (!ehFormulario && htmlParaTexto(conteudo).trim() === "") {
      setErro("O conteúdo é obrigatório.")
      return
    }

    const payload: EntradaPayload = {
      paciente: pacienteId,
      item: item.id,
      titulo,
      data_evento: new Date(dataEvento).toISOString(),
      ...(ehFormulario ? { respostas } : { conteudo }),
    }

    setSalvando(true)
    try {
      if (entrada) await atualizarEntrada(entrada.id, payload)
      else await criarEntrada(payload)
      onSalvo()
    } catch (err) {
      setErro(mensagemDeErro(err))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Sheet open={aberto} onOpenChange={(o) => !o && onFechar()}>
      <SheetContent
        side="right"
        className="p-0"
        style={{ width: "min(92vw, 1024px)", maxWidth: "none" }}
      >
        <form onSubmit={handleSubmit} className="flex h-full flex-col">
          <SheetHeader className="border-b border-border p-4">
            <SheetTitle>
              {editando ? "Editar" : "Novo"} — {item.nome}
            </SheetTitle>
            <SheetDescription>Registro da linha do tempo clínica do paciente.</SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-4 overflow-auto p-4">
            {erro && (
              <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {erro}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Título (opcional)</Label>
                <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Resumo curto" />
              </div>
              <div className="space-y-1.5">
                <Label>Data do evento</Label>
                <Input type="datetime-local" value={dataEvento} onChange={(e) => setDataEvento(e.target.value)} />
              </div>
            </div>

            {ehFormulario ? (
              <FormRenderer schema={schema} valores={respostas} onChange={setRespostas} />
            ) : (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>Conteúdo</Label>
                  {textos.length > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <FileStackIcon className="size-3.5" />
                      <select
                        value=""
                        onChange={(e) => {
                          inserirTexto(e.target.value)
                          e.target.value = ""
                        }}
                        className="rounded-md border border-input bg-transparent px-2 py-1 text-xs outline-none focus-visible:border-ring"
                      >
                        <option value="">Inserir texto padrão…</option>
                        {textos.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.titulo}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                <RichTextEditor key={editorKey} value={conteudo} onChange={setConteudo} />
              </div>
            )}
          </div>

          <SheetFooter className="flex-row justify-end gap-2 border-t border-border p-4">
            <Button type="button" variant="ghost" onClick={onFechar} disabled={salvando}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando}>
              {salvando ? <Loader2Icon className="size-4 animate-spin" /> : <SaveIcon className="size-4" />}
              {editando ? "Salvar" : "Adicionar"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
