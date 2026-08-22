/** Cabeçalho/resumo do paciente exibido no topo do prontuário (estilo Shosp). */
import { useState } from "react"
import {
  AlertTriangleIcon,
  CakeIcon,
  Loader2Icon,
  PencilIcon,
  PhoneIcon,
  StethoscopeIcon,
  UsersIcon,
} from "lucide-react"

import { Avatar } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { mensagemDeErro } from "@/utils/apiError"
import { formatarData, formatarTelefone } from "@/utils/format"
import { PARENTESCOS } from "@/types/paciente"
import type { Paciente } from "@/types/paciente"
import { atualizarPaciente } from "@/services/pacientes"

interface Props {
  paciente: Paciente
  onAtualizado: (p: Paciente) => void
}

export function PacienteResumo({ paciente, onAtualizado }: Props) {
  const [editando, setEditando] = useState(false)
  const [diagnostico, setDiagnostico] = useState(paciente.diagnostico)
  const [cid, setCid] = useState(paciente.cid)
  const [alertas, setAlertas] = useState(paciente.alertas)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const principal = paciente.responsaveis.find((r) => r.principal) ?? paciente.responsaveis[0]

  async function salvar() {
    setSalvando(true)
    setErro(null)
    try {
      const atualizado = await atualizarPaciente(paciente.id, {
        diagnostico,
        cid,
        alertas,
      })
      onAtualizado(atualizado)
      setEditando(false)
    } catch (e) {
      setErro(mensagemDeErro(e))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start gap-4">
        <Avatar nome={paciente.nome_completo} foto={paciente.foto} className="size-14 text-lg" />

        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            {paciente.nome_completo}
          </h1>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <CakeIcon className="size-3.5" />
              {formatarData(paciente.data_nascimento)}
              {paciente.idade != null && ` · ${paciente.idade} anos`}
            </span>
            {principal && (
              <span className="flex items-center gap-1">
                <UsersIcon className="size-3.5" />
                {principal.nome}
                {` (${PARENTESCOS[principal.parentesco]})`}
              </span>
            )}
            {paciente.telefone && (
              <span className="flex items-center gap-1">
                <PhoneIcon className="size-3.5" />
                {formatarTelefone(paciente.telefone)}
              </span>
            )}
          </div>

          {paciente.profissionais_detalhe.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {paciente.profissionais_detalhe.map((prof) => (
                <Badge key={prof.id} variant="secondary">
                  {prof.nome}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {!editando && (
          <Button variant="ghost" size="sm" onClick={() => setEditando(true)}>
            <PencilIcon className="size-4" /> Editar dados clínicos
          </Button>
        )}
      </div>

      {/* Alerta destacado */}
      {!editando && paciente.alertas && (
        <div className="mt-3 flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <AlertTriangleIcon className="size-4 shrink-0" />
          {paciente.alertas}
        </div>
      )}

      {/* Diagnóstico / CID */}
      {!editando ? (
        (paciente.diagnostico || paciente.cid) && (
          <div className="mt-3 flex flex-wrap items-start gap-2 text-sm">
            <StethoscopeIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div>
              <span className="text-foreground">
                {paciente.diagnostico || "—"}
              </span>
              {paciente.cid && (
                <Badge variant="outline" className="ml-2">
                  CID {paciente.cid}
                </Badge>
              )}
            </div>
          </div>
        )
      ) : (
        <div className="mt-3 space-y-3 rounded-md border border-border bg-muted/30 p-3">
          {erro && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {erro}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Diagnóstico / hipótese</Label>
              <Textarea
                value={diagnostico}
                onChange={(e) => setDiagnostico(e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-1.5">
              <Label>CID</Label>
              <Input value={cid} onChange={(e) => setCid(e.target.value)} placeholder="F90.0" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Alertas</Label>
            <Input
              value={alertas}
              onChange={(e) => setAlertas(e.target.value)}
              placeholder="Ex.: alergias, cuidados especiais"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditando(false)
                setDiagnostico(paciente.diagnostico)
                setCid(paciente.cid)
                setAlertas(paciente.alertas)
              }}
              disabled={salvando}
            >
              Cancelar
            </Button>
            <Button size="sm" onClick={salvar} disabled={salvando}>
              {salvando && <Loader2Icon className="size-4 animate-spin" />}
              Salvar
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
