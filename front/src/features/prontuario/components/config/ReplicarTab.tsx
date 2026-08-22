/** Aba de replicação de configuração de um profissional para outro. */
import { useState } from "react"
import { CopyIcon, Loader2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { mensagemDeErro } from "@/utils/apiError"
import { replicarConfig } from "@/services/prontuario"
import type { ProfissionalResumo } from "@/types/paciente"

const OPCOES = [
  { chave: "itens", rotulo: "Itens de prontuário" },
  { chave: "textos", rotulo: "Textos padrão" },
  { chave: "atestados", rotulo: "Atestados" },
  { chave: "grupos", rotulo: "Grupos de exames" },
]

interface Props {
  profissionais: ProfissionalResumo[]
  destinoId: number
}

export function ReplicarTab({ profissionais, destinoId }: Props) {
  const [origem, setOrigem] = useState<number | "">("")
  const [incluir, setIncluir] = useState<string[]>(["itens", "textos", "atestados", "grupos"])
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [resultado, setResultado] = useState<string | null>(null)

  function alternar(chave: string) {
    setIncluir((atual) =>
      atual.includes(chave) ? atual.filter((c) => c !== chave) : [...atual, chave]
    )
  }

  async function replicar() {
    setErro(null)
    setResultado(null)
    if (origem === "") {
      setErro("Selecione o profissional de origem.")
      return
    }
    if (origem === destinoId) {
      setErro("Origem e destino devem ser diferentes.")
      return
    }
    if (incluir.length === 0) {
      setErro("Selecione ao menos um tipo para replicar.")
      return
    }
    setSalvando(true)
    try {
      const resumo = await replicarConfig({ origem: Number(origem), destino: destinoId, incluir })
      const partes = Object.entries(resumo).map(([k, v]) => `${v} ${k}`)
      setResultado(`Replicado: ${partes.join(", ") || "nada"}.`)
    } catch (e) {
      setErro(mensagemDeErro(e))
    } finally {
      setSalvando(false)
    }
  }

  const destino = profissionais.find((p) => p.id === destinoId)
  const disponiveis = profissionais.filter((p) => p.id !== destinoId)

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Copia a configuração de um profissional de origem para{" "}
        <strong>{destino?.nome ?? "o profissional selecionado"}</strong> (destino).
      </p>

      {erro && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {erro}
        </div>
      )}
      {resultado && (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {resultado}
        </div>
      )}

      <div className="max-w-md space-y-1.5">
        <Label>Profissional de origem</Label>
        <Select value={origem} onChange={(e) => setOrigem(e.target.value ? Number(e.target.value) : "")}>
          <option value="">Selecione…</option>
          {disponiveis.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-2">
        <Label>O que replicar</Label>
        <div className="space-y-1">
          {OPCOES.map((o) => (
            <label key={o.chave} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={incluir.includes(o.chave)}
                onChange={() => alternar(o.chave)}
                className="size-4 rounded border-input"
              />
              {o.rotulo}
            </label>
          ))}
        </div>
      </div>

      <Button onClick={replicar} disabled={salvando}>
        {salvando ? <Loader2Icon className="size-4 animate-spin" /> : <CopyIcon className="size-4" />}
        Replicar configuração
      </Button>
      <p className="text-xs text-muted-foreground">
        Os itens selecionados serão adicionados ao destino; a configuração de origem não é alterada.
      </p>
    </div>
  )
}
