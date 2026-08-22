/** Editor dinâmico de responsáveis legais do paciente. */
import { PlusIcon, StarIcon, Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { maskCPF, maskTelefone } from "@/utils/masks"
import { PARENTESCOS } from "@/types/paciente"
import type { Parentesco, Responsavel } from "@/types/paciente"

interface Props {
  responsaveis: Responsavel[]
  onChange: (responsaveis: Responsavel[]) => void
}

function responsavelVazio(): Responsavel {
  return {
    nome: "",
    parentesco: "MAE",
    cpf: "",
    telefone: "",
    email: "",
    principal: false,
  }
}

export function ResponsaveisEditor({ responsaveis, onChange }: Props) {
  function atualizar(index: number, patch: Partial<Responsavel>) {
    onChange(responsaveis.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  function definirPrincipal(index: number) {
    onChange(responsaveis.map((r, i) => ({ ...r, principal: i === index })))
  }

  function adicionar() {
    onChange([...responsaveis, responsavelVazio()])
  }

  function remover(index: number) {
    onChange(responsaveis.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-3">
      {responsaveis.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nenhum responsável adicionado.
        </p>
      )}

      {responsaveis.map((resp, i) => (
        <div
          key={i}
          className="rounded-lg border border-border bg-muted/30 p-3 space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Responsável {i + 1}
            </span>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => definirPrincipal(i)}
                className={cn(resp.principal && "text-amber-600")}
              >
                <StarIcon
                  className={cn("size-3.5", resp.principal && "fill-amber-500")}
                />
                {resp.principal ? "Principal" : "Tornar principal"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => remover(i)}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2Icon className="size-3.5" />
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Nome completo</Label>
              <Input
                value={resp.nome}
                onChange={(e) => atualizar(i, { nome: e.target.value })}
                placeholder="Nome do responsável"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Parentesco</Label>
              <Select
                value={resp.parentesco}
                onChange={(e) =>
                  atualizar(i, { parentesco: e.target.value as Parentesco })
                }
              >
                {Object.entries(PARENTESCOS).map(([valor, rotulo]) => (
                  <option key={valor} value={valor}>
                    {rotulo}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>CPF</Label>
              <Input
                value={resp.cpf}
                onChange={(e) => atualizar(i, { cpf: maskCPF(e.target.value) })}
                inputMode="numeric"
                placeholder="000.000.000-00"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Telefone</Label>
              <Input
                value={resp.telefone}
                onChange={(e) => atualizar(i, { telefone: maskTelefone(e.target.value) })}
                inputMode="numeric"
                placeholder="(91) 90000-0000"
              />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input
                type="email"
                value={resp.email}
                onChange={(e) => atualizar(i, { email: e.target.value })}
                placeholder="email@exemplo.com"
              />
            </div>
          </div>
        </div>
      ))}

      <Button type="button" variant="outline" size="sm" onClick={adicionar}>
        <PlusIcon className="size-4" /> Adicionar responsável
      </Button>
    </div>
  )
}
