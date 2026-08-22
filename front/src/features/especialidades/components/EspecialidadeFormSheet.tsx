/** Formulário lateral (Sheet) de criação e edição de especialidade. */
import { useState } from "react"
import type { FormEvent } from "react"
import { Loader2Icon, SaveIcon } from "lucide-react"

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
import {
  atualizarEspecialidade,
  criarEspecialidade,
} from "@/services/especialidades"
import type { Especialidade } from "@/types/especialidade"

interface Props {
  aberto: boolean
  especialidade?: Especialidade | null
  onFechar: () => void
  onSalvo: () => void
}

export function EspecialidadeFormSheet({
  aberto,
  especialidade,
  onFechar,
  onSalvo,
}: Props) {
  const editando = Boolean(especialidade)

  const [nome, setNome] = useState(especialidade?.nome ?? "")
  const [ativo, setAtivo] = useState(especialidade?.ativo ?? true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro(null)

    if (!nome.trim()) {
      setErro("Informe o nome da especialidade.")
      return
    }

    setSalvando(true)
    try {
      if (especialidade) {
        await atualizarEspecialidade(especialidade.id, { nome: nome.trim(), ativo })
      } else {
        await criarEspecialidade({ nome: nome.trim() })
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
      <SheetContent side="right" className="w-full max-w-md p-0">
        <form onSubmit={handleSubmit} className="flex h-full flex-col">
          <SheetHeader className="border-b border-border p-4">
            <SheetTitle>
              {editando ? "Editar especialidade" : "Nova especialidade"}
            </SheetTitle>
            <SheetDescription>
              As especialidades ficam disponíveis para vincular aos prestadores.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-4 overflow-auto p-4">
            {erro && (
              <div
                role="alert"
                className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              >
                {erro}
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex.: Neuropsicólogo"
                autoFocus
              />
            </div>

            {editando && (
              <div className="space-y-1.5">
                <Label>Status</Label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAtivo(true)}
                    className={cn(
                      "flex-1 rounded-lg border px-3 py-2 text-sm transition-colors",
                      ativo
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                        : "border-border text-muted-foreground hover:bg-muted"
                    )}
                  >
                    Ativa
                  </button>
                  <button
                    type="button"
                    onClick={() => setAtivo(false)}
                    className={cn(
                      "flex-1 rounded-lg border px-3 py-2 text-sm transition-colors",
                      !ativo
                        ? "border-destructive bg-destructive/5 text-destructive"
                        : "border-border text-muted-foreground hover:bg-muted"
                    )}
                  >
                    Inativa
                  </button>
                </div>
              </div>
            )}
          </div>

          <SheetFooter className="flex-row justify-end gap-2 border-t border-border p-4">
            <Button type="button" variant="ghost" onClick={onFechar} disabled={salvando}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando}>
              {salvando ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                <SaveIcon className="size-4" />
              )}
              {editando ? "Salvar" : "Cadastrar"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
