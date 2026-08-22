/** Modal de geração de atestado a partir de um modelo (macros resolvidas). */
import { useEffect, useState } from "react"
import type { FormEvent } from "react"
import { Loader2Icon, PlusIcon, ScrollTextIcon, Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { mensagemDeErro } from "@/utils/apiError"
import { gerarAtestado, listarModelosAtestado } from "@/services/prontuario"
import type { CID, ModeloAtestado } from "@/types/prontuario"
import type { ProfissionalResumo } from "@/types/paciente"

interface Props {
  aberto: boolean
  pacienteId: number
  profissionais: ProfissionalResumo[]
  onFechar: () => void
  onGerado: (atestadoId: number) => void
}

export function GerarAtestadoModal({
  aberto,
  pacienteId,
  profissionais,
  onFechar,
  onGerado,
}: Props) {
  const [profissionalId, setProfissionalId] = useState<number | "">(
    profissionais[0]?.id ?? ""
  )
  const [modelos, setModelos] = useState<ModeloAtestado[]>([])
  const [modeloId, setModeloId] = useState<number | "">("")
  const [cids, setCids] = useState<CID[]>([])
  const [gerando, setGerando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    async function carregar() {
      if (profissionalId === "") {
        if (ativo) setModelos([])
        return
      }
      try {
        const d = await listarModelosAtestado(Number(profissionalId))
        if (!ativo) return
        setModelos(d)
        setModeloId(d[0]?.id ?? "")
      } catch {
        if (ativo) setModelos([])
      }
    }
    carregar()
    return () => {
      ativo = false
    }
  }, [profissionalId])

  function addCid() {
    setCids((c) => [...c, { codigo: "", descricao: "" }])
  }

  function setCid(i: number, patch: Partial<CID>) {
    setCids((c) => c.map((x, idx) => (idx === i ? { ...x, ...patch } : x)))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    if (modeloId === "") {
      setErro("Selecione um modelo de atestado.")
      return
    }
    setGerando(true)
    try {
      const atestado = await gerarAtestado({
        paciente: pacienteId,
        modelo: Number(modeloId),
        cids: cids.filter((c) => c.codigo || c.descricao),
      })
      onGerado(atestado.id)
    } catch (err) {
      setErro(mensagemDeErro(err))
    } finally {
      setGerando(false)
    }
  }

  return (
    <Sheet open={aberto} onOpenChange={(o) => !o && onFechar()}>
      <SheetContent side="right" className="p-0" style={{ width: "min(92vw, 640px)", maxWidth: "none" }}>
        <form onSubmit={handleSubmit} className="flex h-full flex-col">
          <SheetHeader className="border-b border-border p-4">
            <SheetTitle>Gerar atestado</SheetTitle>
            <SheetDescription>As macros serão preenchidas com os dados do paciente.</SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-4 overflow-auto p-4">
            {erro && (
              <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {erro}
              </div>
            )}

            {profissionais.length > 1 && (
              <div className="space-y-1.5">
                <Label>Profissional</Label>
                <Select
                  value={profissionalId}
                  onChange={(e) => setProfissionalId(e.target.value ? Number(e.target.value) : "")}
                >
                  {profissionais.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Modelo de atestado</Label>
              {modelos.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum modelo de atestado configurado para este profissional.
                </p>
              ) : (
                <Select value={modeloId} onChange={(e) => setModeloId(e.target.value ? Number(e.target.value) : "")}>
                  {modelos.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nome}
                    </option>
                  ))}
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>CIDs (opcional)</Label>
                <Button type="button" variant="outline" size="sm" onClick={addCid}>
                  <PlusIcon className="size-4" /> Adicionar CID
                </Button>
              </div>
              {cids.map((cid, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={cid.codigo ?? ""}
                    onChange={(e) => setCid(i, { codigo: e.target.value })}
                    placeholder="Código (ex.: F90.0)"
                    className="w-40"
                  />
                  <Input
                    value={cid.descricao ?? ""}
                    onChange={(e) => setCid(i, { descricao: e.target.value })}
                    placeholder="Descrição"
                  />
                  <button
                    type="button"
                    onClick={() => setCids((c) => c.filter((_, idx) => idx !== i))}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2Icon className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <SheetFooter className="flex-row justify-end gap-2 border-t border-border p-4">
            <Button type="button" variant="ghost" onClick={onFechar} disabled={gerando}>
              Cancelar
            </Button>
            <Button type="submit" disabled={gerando || modelos.length === 0}>
              {gerando ? <Loader2Icon className="size-4 animate-spin" /> : <ScrollTextIcon className="size-4" />}
              Gerar e imprimir
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
