/** Seletor (múltipla escolha) de profissionais vinculados ao paciente. */
import { CheckIcon, Loader2Icon } from "lucide-react"

import { PAPEL_LABELS } from "@/types/auth"
import { cn } from "@/lib/utils"
import { useProfissionais } from "@/features/pacientes/hooks/useProfissionais"

interface Props {
  selecionados: number[]
  onChange: (ids: number[]) => void
}

export function ProfissionaisSelector({ selecionados, onChange }: Props) {
  const { profissionais, carregando } = useProfissionais()

  function alternar(id: number) {
    if (selecionados.includes(id)) {
      onChange(selecionados.filter((x) => x !== id))
    } else {
      onChange([...selecionados, id])
    }
  }

  if (carregando) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2Icon className="size-4 animate-spin" /> Carregando profissionais…
      </div>
    )
  }

  if (profissionais.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhum profissional disponível para vínculo.
      </p>
    )
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {profissionais.map((prof) => {
        const ativo = selecionados.includes(prof.id)
        return (
          <button
            key={prof.id}
            type="button"
            onClick={() => alternar(prof.id)}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
              ativo
                ? "border-primary bg-primary/5 text-foreground"
                : "border-border hover:bg-muted"
            )}
          >
            <span
              className={cn(
                "flex size-4 shrink-0 items-center justify-center rounded border",
                ativo ? "border-primary bg-primary text-primary-foreground" : "border-input"
              )}
            >
              {ativo && <CheckIcon className="size-3" />}
            </span>
            <span className="flex flex-col overflow-hidden">
              <span className="truncate font-medium">{prof.nome}</span>
              <span className="truncate text-xs text-muted-foreground">
                {PAPEL_LABELS[prof.role]}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
