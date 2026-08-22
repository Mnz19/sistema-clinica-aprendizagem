/** Painel de anexos do paciente: upload, listagem e remoção. */
import { useRef, useState } from "react"
import {
  DownloadIcon,
  FileTextIcon,
  Loader2Icon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
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
import { formatarData } from "@/utils/format"
import { enviarDocumento, removerDocumento } from "@/services/pacientes"
import { TIPOS_DOCUMENTO } from "@/types/paciente"
import type { DocumentoPaciente, TipoDocumento } from "@/types/paciente"

interface Props {
  pacienteId: number
  documentos: DocumentoPaciente[]
  onAlterado: () => void
}

export function DocumentosPanel({ pacienteId, documentos, onAlterado }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [tipo, setTipo] = useState<TipoDocumento>("LAUDO")
  const [descricao, setDescricao] = useState("")
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function handleEnviar() {
    if (!arquivo) return
    setEnviando(true)
    setErro(null)
    try {
      await enviarDocumento({ paciente: pacienteId, arquivo, tipo, descricao })
      setArquivo(null)
      setDescricao("")
      if (inputRef.current) inputRef.current.value = ""
      onAlterado()
    } catch (err) {
      setErro(mensagemDeErro(err))
    } finally {
      setEnviando(false)
    }
  }

  async function handleRemover(id: number) {
    try {
      await removerDocumento(id)
      onAlterado()
    } catch (err) {
      setErro(mensagemDeErro(err))
    }
  }

  return (
    <div className="space-y-4">
      {/* Formulário de upload */}
      <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
        {erro && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {erro}
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5 sm:col-span-1">
            <Label>Tipo</Label>
            <Select value={tipo} onChange={(e) => setTipo(e.target.value as TipoDocumento)}>
              {Object.entries(TIPOS_DOCUMENTO).map(([valor, rotulo]) => (
                <option key={valor} value={valor}>
                  {rotulo}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Descrição (opcional)</Label>
            <Input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex.: Laudo neuropsicológico 2026"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            ref={inputRef}
            type="file"
            onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
            className="max-w-xs"
          />
          <Button
            type="button"
            size="sm"
            onClick={handleEnviar}
            disabled={!arquivo || enviando}
          >
            {enviando ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              <UploadIcon className="size-4" />
            )}
            Enviar anexo
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Formatos: PDF, Word, imagens, planilhas. Máximo de 25&nbsp;MB por arquivo.
        </p>
      </div>

      {/* Lista de anexos */}
      {documentos.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum anexo cadastrado.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {documentos.map((doc) => (
            <li key={doc.id} className="flex items-center gap-3 p-3">
              <FileTextIcon className="size-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {doc.descricao || doc.nome_original}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {doc.tipo_display} · {formatarData(doc.criado_em)}
                  {doc.enviado_por_nome ? ` · ${doc.enviado_por_nome}` : ""}
                </p>
              </div>
              {doc.arquivo_url && (
                <a
                  href={doc.arquivo_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  title="Baixar"
                >
                  <DownloadIcon className="size-4" />
                </a>
              )}
              <AlertDialog>
                <AlertDialogTrigger className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive">
                  <Trash2Icon className="size-4" />
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remover anexo?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => handleRemover(doc.id)}
                      className="bg-destructive text-white hover:bg-destructive/90"
                    >
                      Remover
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
