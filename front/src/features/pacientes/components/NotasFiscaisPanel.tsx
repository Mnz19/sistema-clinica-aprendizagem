/** Painel de notas fiscais do paciente: upload, listagem e remoção. */
import { useRef, useState } from "react"
import {
  DownloadIcon,
  Loader2Icon,
  ReceiptTextIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react"

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
import { formatarData } from "@/utils/format"
import { enviarNotaFiscal, removerNotaFiscal } from "@/services/pacientes"
import type { NotaFiscalPaciente } from "@/types/paciente"

interface Props {
  pacienteId: number
  notasFiscais: NotaFiscalPaciente[]
  onAlterado: () => void
}

export function NotasFiscaisPanel({ pacienteId, notasFiscais, onAlterado }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [dataEmissao, setDataEmissao] = useState("")
  const [descricao, setDescricao] = useState("")
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const podeEnviar = Boolean(arquivo && dataEmissao) && !enviando

  async function handleEnviar() {
    if (!arquivo || !dataEmissao) return
    setEnviando(true)
    setErro(null)
    try {
      await enviarNotaFiscal({
        paciente: pacienteId,
        arquivo,
        data_emissao: dataEmissao,
        descricao,
      })
      setArquivo(null)
      setDataEmissao("")
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
      await removerNotaFiscal(id)
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
            <Label>Data de emissão</Label>
            <Input
              type="date"
              value={dataEmissao}
              onChange={(e) => setDataEmissao(e.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Descrição (opcional)</Label>
            <Input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex.: NF 1234 — sessões de março"
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
          <Button type="button" size="sm" onClick={handleEnviar} disabled={!podeEnviar}>
            {enviando ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              <UploadIcon className="size-4" />
            )}
            Enviar nota fiscal
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Formatos: PDF, XML da NF-e ou imagem. Máximo de 25&nbsp;MB por arquivo.
        </p>
      </div>

      {/* Lista de notas fiscais */}
      {notasFiscais.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma nota fiscal cadastrada.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {notasFiscais.map((nota) => (
            <li key={nota.id} className="flex items-center gap-3 p-3">
              <ReceiptTextIcon className="size-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {nota.descricao || nota.nome_original}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  Emissão: {formatarData(nota.data_emissao)}
                  {nota.enviado_por_nome ? ` · ${nota.enviado_por_nome}` : ""}
                </p>
              </div>
              {nota.arquivo_url && (
                <a
                  href={nota.arquivo_url}
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
                    <AlertDialogTitle>Remover nota fiscal?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => handleRemover(nota.id)}
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
