/** Construtor de formulários personalizados (campos essenciais, ordenável). */
import { ChevronDownIcon, ChevronUpIcon, PlusIcon, Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { TIPOS_CAMPO, TIPOS_CAMPO_COM_OPCOES } from "@/types/prontuario"
import type { CampoFormulario, TipoCampo } from "@/types/prontuario"

interface Props {
  campos: CampoFormulario[]
  onChange: (campos: CampoFormulario[]) => void
}

/** Gera um id estável para o campo (sobrevive a reorder/rename). */
function novoId(): string {
  return "f_" + Math.random().toString(36).slice(2, 9)
}

export function FormBuilder({ campos, onChange }: Props) {
  function adicionar() {
    onChange([
      ...campos,
      { id: novoId(), tipo: "TEXTO_CURTO", rotulo: "", ordem: campos.length, obrigatorio: false, opcoes: [] },
    ])
  }

  function atualizar(id: string, patch: Partial<CampoFormulario>) {
    onChange(campos.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  }

  function remover(id: string) {
    onChange(campos.filter((c) => c.id !== id).map((c, i) => ({ ...c, ordem: i })))
  }

  function mover(index: number, delta: number) {
    const alvo = index + delta
    if (alvo < 0 || alvo >= campos.length) return
    const copia = [...campos]
    ;[copia[index], copia[alvo]] = [copia[alvo], copia[index]]
    onChange(copia.map((c, i) => ({ ...c, ordem: i })))
  }

  return (
    <div className="space-y-3">
      {campos.length === 0 && (
        <p className="rounded-lg border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
          Nenhum campo ainda. Adicione o primeiro campo do formulário.
        </p>
      )}

      {campos.map((campo, index) => {
        const temOpcoes = TIPOS_CAMPO_COM_OPCOES.includes(campo.tipo)
        return (
          <div key={campo.id} className="rounded-lg border border-border p-3">
            <div className="flex items-start gap-2">
              <div className="flex flex-col gap-0.5 pt-5">
                <button
                  type="button"
                  onClick={() => mover(index, -1)}
                  disabled={index === 0}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                  title="Subir"
                >
                  <ChevronUpIcon className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => mover(index, 1)}
                  disabled={index === campos.length - 1}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                  title="Descer"
                >
                  <ChevronDownIcon className="size-4" />
                </button>
              </div>

              <div className="grid flex-1 gap-3 sm:grid-cols-[1fr_180px]">
                <div className="space-y-1.5">
                  <Label>Rótulo</Label>
                  <Input
                    value={campo.rotulo}
                    onChange={(e) => atualizar(campo.id, { rotulo: e.target.value })}
                    placeholder="Ex.: Queixa principal"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Tipo</Label>
                  <Select
                    value={campo.tipo}
                    onChange={(e) => atualizar(campo.id, { tipo: e.target.value as TipoCampo })}
                  >
                    {(Object.keys(TIPOS_CAMPO) as TipoCampo[]).map((t) => (
                      <option key={t} value={t}>
                        {TIPOS_CAMPO[t]}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <button
                type="button"
                onClick={() => remover(campo.id)}
                className="pt-6 text-muted-foreground hover:text-destructive"
                title="Remover campo"
              >
                <Trash2Icon className="size-4" />
              </button>
            </div>

            {temOpcoes && (
              <div className="mt-3 space-y-1.5">
                <Label>Opções (uma por linha)</Label>
                <textarea
                  value={(campo.opcoes ?? []).join("\n")}
                  onChange={(e) =>
                    atualizar(campo.id, {
                      opcoes: e.target.value.split("\n").map((o) => o.trim()).filter(Boolean),
                    })
                  }
                  rows={3}
                  className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring"
                  placeholder={"Opção 1\nOpção 2"}
                />
              </div>
            )}

            {campo.tipo !== "SECAO" && (
              <label className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={!!campo.obrigatorio}
                  onChange={(e) => atualizar(campo.id, { obrigatorio: e.target.checked })}
                  className="size-4 rounded border-input"
                />
                Campo obrigatório
              </label>
            )}
          </div>
        )
      })}

      <Button type="button" variant="outline" size="sm" onClick={adicionar}>
        <PlusIcon className="size-4" /> Adicionar campo
      </Button>
    </div>
  )
}
