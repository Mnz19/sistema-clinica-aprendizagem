/** Sheet de criação/edição de um item de prontuário (texto livre ou formulário). */
import { useState } from "react"
import type { FormEvent } from "react"
import { FileTextIcon, Loader2Icon, SaveIcon, SquareCheckBigIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { mensagemDeErro } from "@/utils/apiError"
import { criarItem, atualizarItem } from "@/services/prontuario"
import { FormBuilder } from "@/features/prontuario/components/FormBuilder"
import type { CampoFormulario, ItemProntuario, TipoItem } from "@/types/prontuario"

interface Props {
  aberto: boolean
  profissionalId: number
  item?: ItemProntuario | null
  onFechar: () => void
  onSalvo: () => void
}

export function CriadorItemSheet({ aberto, profissionalId, item, onFechar, onSalvo }: Props) {
  const editando = Boolean(item)
  const [nome, setNome] = useState(item?.nome ?? "")
  const [tipo, setTipo] = useState<TipoItem>(
    item?.tipo_item === "FORMULARIO" ? "FORMULARIO" : "TEXTO_LIVRE"
  )
  const [campos, setCampos] = useState<CampoFormulario[]>(item?.formulario_schema ?? [])
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // Itens fixos: só editam nome (o tipo/estrutura não muda).
  const ehFixo = item?.tipo_item === "FIXO"

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    if (!nome.trim()) {
      setErro("Informe o nome do item.")
      return
    }
    if (!ehFixo && tipo === "FORMULARIO" && campos.length === 0) {
      setErro("Adicione ao menos um campo ao formulário.")
      return
    }
    setSalvando(true)
    try {
      if (item) {
        await atualizarItem(item.id, {
          nome,
          ...(ehFixo ? {} : { tipo_item: tipo, formulario_schema: tipo === "FORMULARIO" ? campos : [] }),
        })
      } else {
        await criarItem({
          profissional: profissionalId,
          nome,
          tipo_item: tipo,
          formulario_schema: tipo === "FORMULARIO" ? campos : [],
        })
      }
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
        style={{ width: "min(92vw, 900px)", maxWidth: "none" }}
      >
        <form onSubmit={handleSubmit} className="flex h-full flex-col">
          <SheetHeader className="border-b border-border p-4">
            <SheetTitle>{editando ? "Editar item" : "Novo item de prontuário"}</SheetTitle>
            <SheetDescription>
              Configure como este item será preenchido no prontuário do paciente.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-4 overflow-auto p-4">
            {erro && (
              <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {erro}
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Nome do item</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Evolução, Anamnese…" />
            </div>

            {!ehFixo && (
              <div className="space-y-2">
                <Label>Tipo de preenchimento</Label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setTipo("TEXTO_LIVRE")}
                    className={cn(
                      "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                      tipo === "TEXTO_LIVRE" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
                    )}
                  >
                    <FileTextIcon className="mt-0.5 size-5 text-primary" />
                    <span className="flex flex-col">
                      <span className="text-sm font-medium">Texto livre</span>
                      <span className="text-xs text-muted-foreground">Digite livremente as informações.</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTipo("FORMULARIO")}
                    className={cn(
                      "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                      tipo === "FORMULARIO" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
                    )}
                  >
                    <SquareCheckBigIcon className="mt-0.5 size-5 text-primary" />
                    <span className="flex flex-col">
                      <span className="text-sm font-medium">Formulário personalizado</span>
                      <span className="text-xs text-muted-foreground">Crie campos para serem preenchidos.</span>
                    </span>
                  </button>
                </div>
              </div>
            )}

            {!ehFixo && tipo === "FORMULARIO" && (
              <div className="space-y-2">
                <Label>Campos do formulário</Label>
                <FormBuilder campos={campos} onChange={setCampos} />
              </div>
            )}
          </div>

          <SheetFooter className="flex-row justify-end gap-2 border-t border-border p-4">
            <Button type="button" variant="ghost" onClick={onFechar} disabled={salvando}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando}>
              {salvando ? <Loader2Icon className="size-4 animate-spin" /> : <SaveIcon className="size-4" />}
              Salvar
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
