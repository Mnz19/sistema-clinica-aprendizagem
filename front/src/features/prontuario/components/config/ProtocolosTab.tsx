/** Aba de protocolos prontos: biblioteca filtrável + importar para o profissional. */
import { useEffect, useState } from "react"
import { DownloadIcon, Loader2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { mensagemDeErro } from "@/utils/apiError"
import { importarProtocolo, listarProtocolos } from "@/services/prontuario"
import { listarEspecialidades } from "@/services/especialidades"
import type { Especialidade } from "@/types/especialidade"
import type { Protocolo } from "@/types/prontuario"

interface Props {
  profissionalId: number
  onImportado: () => void
}

export function ProtocolosTab({ profissionalId, onImportado }: Props) {
  const [protocolos, setProtocolos] = useState<Protocolo[]>([])
  const [especialidades, setEspecialidades] = useState<Especialidade[]>([])
  const [filtro, setFiltro] = useState<number | "">("")
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [importandoId, setImportandoId] = useState<number | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    listarEspecialidades()
      .then((d) => ativo && setEspecialidades(d))
      .catch(() => {})
    return () => {
      ativo = false
    }
  }, [])

  useEffect(() => {
    let ativo = true
    async function carregar() {
      setCarregando(true)
      try {
        const d = await listarProtocolos({ especialidade: filtro || undefined })
        if (ativo) setProtocolos(d)
      } catch (e) {
        if (ativo) setErro(mensagemDeErro(e))
      } finally {
        if (ativo) setCarregando(false)
      }
    }
    carregar()
    return () => {
      ativo = false
    }
  }, [filtro])

  async function importar(p: Protocolo) {
    setImportandoId(p.id)
    setFeedback(null)
    setErro(null)
    try {
      await importarProtocolo(p.id, { profissional: profissionalId })
      setFeedback(`"${p.nome}" importado para este profissional.`)
      onImportado()
    } catch (e) {
      setErro(mensagemDeErro(e))
    } finally {
      setImportandoId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Formulários pré-definidos prontos para importar.
        </p>
        <div className="w-64 space-y-1.5">
          <Label>Filtrar por especialidade</Label>
          <Select value={filtro} onChange={(e) => setFiltro(e.target.value ? Number(e.target.value) : "")}>
            <option value="">Todas as especialidades</option>
            {especialidades.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {erro && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {erro}
        </div>
      )}
      {feedback && (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {feedback}
        </div>
      )}

      {carregando ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" /> Carregando…
        </div>
      ) : protocolos.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-12 text-center">
          <p className="text-sm text-muted-foreground">Nenhum protocolo disponível.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {protocolos.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-lg border border-border p-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{p.nome}</span>
                  <Badge variant="secondary">{p.tipo_item_display}</Badge>
                  {p.especialidade_nome && <Badge variant="outline">{p.especialidade_nome}</Badge>}
                </div>
                {p.descricao && <p className="mt-0.5 text-sm text-muted-foreground">{p.descricao}</p>}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => importar(p)}
                disabled={importandoId === p.id}
              >
                {importandoId === p.id ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : (
                  <DownloadIcon className="size-4" />
                )}
                Importar
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
