/** Campo de seleção múltipla (com chips) das especialidades de um prestador. */
import { useMemo } from "react"
import { Loader2Icon } from "lucide-react"

import { ComboboxMulti } from "@/components/ui/combobox"
import { useEspecialidades } from "@/features/especialidades/hooks/useEspecialidades"

interface Props {
  selecionados: number[]
  onChange: (ids: number[]) => void
}

export function EspecialidadesMultiSelect({ selecionados, onChange }: Props) {
  const { especialidades, carregando } = useEspecialidades()

  // Garante que especialidades já vinculadas mas eventualmente inativas ainda
  // apareçam como opção (para não sumirem os chips ao editar um cadastro antigo).
  const options = useMemo(
    () => especialidades.map((e) => ({ value: e.id, label: e.nome })),
    [especialidades]
  )

  if (carregando) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2Icon className="size-4 animate-spin" /> Carregando especialidades…
      </div>
    )
  }

  return (
    <ComboboxMulti
      options={options}
      value={selecionados}
      onChange={onChange}
      placeholder="Busque e selecione as especialidades…"
      emptyText={
        options.length === 0
          ? "Nenhuma especialidade cadastrada."
          : "Nenhuma especialidade encontrada."
      }
    />
  )
}
