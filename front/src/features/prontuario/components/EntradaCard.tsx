/** Card de uma entrada preenchida na linha do tempo do prontuário. */
import { useRef, useState } from "react"
import { DownloadIcon, PaperclipIcon, PencilIcon, Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Avatar } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
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
import { formatarDataHora } from "@/utils/format"
import { enviarAnexo, removerAnexo, removerEntrada } from "@/services/prontuario"
import { FormRenderer } from "@/features/prontuario/components/FormRenderer"
import type { EntradaProntuario } from "@/types/prontuario"

interface Props {
  entrada: EntradaProntuario
  onEditar?: (entrada: EntradaProntuario) => void
  onAlterado?: () => void
  /** Timeline agregada: exibe o nome do item e esconde as ações de edição. */
  somenteLeitura?: boolean
  mostrarItem?: boolean
}

export function EntradaCard({
  entrada,
  onEditar,
  onAlterado,
  somenteLeitura,
  mostrarItem,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const ehFormulario = entrada.item_tipo === "FORMULARIO"
  const podeAgir = !somenteLeitura && entrada.pode_editar

  async function handleExcluir() {
    setOcupado(true)
    try {
      await removerEntrada(entrada.id)
      onAlterado?.()
    } catch (e) {
      setErro(mensagemDeErro(e))
      setOcupado(false)
    }
  }

  async function handleAnexar(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0]
    if (!arquivo) return
    setOcupado(true)
    setErro(null)
    try {
      await enviarAnexo({ entrada: entrada.id, arquivo })
      onAlterado?.()
    } catch (err) {
      setErro(mensagemDeErro(err))
    } finally {
      setOcupado(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  async function handleRemoverAnexo(id: number) {
    setOcupado(true)
    try {
      await removerAnexo(id)
      onAlterado?.()
    } catch (e) {
      setErro(mensagemDeErro(e))
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="relative rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {mostrarItem && <Badge variant="secondary">{entrada.item_nome}</Badge>}
          <span className="text-xs text-muted-foreground">
            {formatarDataHora(entrada.data_evento)}
          </span>
        </div>
        {podeAgir && (
          <div className="flex items-center gap-1">
            <input ref={inputRef} type="file" onChange={handleAnexar} className="hidden" />
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => inputRef.current?.click()}
              disabled={ocupado}
              title="Anexar arquivo"
            >
              <PaperclipIcon className="size-3.5" />
            </Button>
            <Button variant="ghost" size="icon-xs" onClick={() => onEditar?.(entrada)} title="Editar">
              <PencilIcon className="size-3.5" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger
                className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                title="Excluir"
              >
                <Trash2Icon className="size-3.5" />
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir registro?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação não pode ser desfeita. A remoção fica registrada na trilha de auditoria.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleExcluir}
                    className="bg-destructive text-white hover:bg-destructive/90"
                  >
                    Excluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>

      {entrada.titulo && <h3 className="mt-2 font-medium text-foreground">{entrada.titulo}</h3>}

      {ehFormulario ? (
        <div className="mt-2">
          <FormRenderer schema={entrada.schema_snapshot} valores={entrada.respostas} readOnly />
        </div>
      ) : (
        <RichContent html={entrada.conteudo} className="mt-1" />
      )}

      {erro && <p className="mt-2 text-xs text-destructive">{erro}</p>}

      {entrada.anexos.length > 0 && (
        <ul className="mt-3 space-y-1">
          {entrada.anexos.map((anexo) => (
            <li
              key={anexo.id}
              className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5 text-xs"
            >
              <PaperclipIcon className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{anexo.descricao || anexo.nome_original}</span>
              {anexo.arquivo_url && (
                <a
                  href={anexo.arquivo_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted-foreground hover:text-foreground"
                  title="Baixar"
                >
                  <DownloadIcon className="size-3.5" />
                </a>
              )}
              {podeAgir && (
                <button
                  type="button"
                  onClick={() => handleRemoverAnexo(anexo.id)}
                  className="text-muted-foreground hover:text-destructive"
                  title="Remover anexo"
                >
                  <Trash2Icon className="size-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex items-center gap-2 border-t border-border/60 pt-2">
        <Avatar nome={entrada.autor_nome ?? undefined} foto={entrada.autor_foto} className="size-6" />
        <div className="flex flex-col leading-tight">
          <span className="text-xs font-medium text-foreground">
            {entrada.autor_nome ?? "Autor removido"}
            {entrada.autor_conselho && (
              <span className="ml-1 font-normal text-muted-foreground">· {entrada.autor_conselho}</span>
            )}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {entrada.autor_papel ? `${entrada.autor_papel} · ` : ""}
            registrado em {formatarDataHora(entrada.criado_em)}
          </span>
        </div>
      </div>
    </div>
  )
}
