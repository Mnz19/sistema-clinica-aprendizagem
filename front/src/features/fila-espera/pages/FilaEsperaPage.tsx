/**
 * Fila de Espera (Gestão de Agenda › Fila de Espera).
 *
 * Lista pacientes aguardando horário (FIFO), com filtros por status/profissional/
 * especialidade. Permite adicionar/editar, recusar, excluir e — o atalho principal —
 * agendar direto a partir da fila reaproveitando o `AgendamentoForm`.
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  CalendarPlusIcon,
  ListChecksIcon,
  Loader2Icon,
  PencilIcon,
  PhoneIcon,
  PlusIcon,
  RotateCwIcon,
  Trash2Icon,
  XCircleIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Drawer } from "@/components/ui/Drawer"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { AgendamentoForm } from "@/features/agendamento/components/AgendamentoForm"
import { FilaEsperaFormModal } from "@/features/fila-espera/components/FilaEsperaFormModal"
import { tempoDeEspera } from "@/features/fila-espera/utils"
import { listarFila, recusarFila, removerFila } from "@/services/filaEspera"
import { listarPacientes } from "@/services/pacientes"
import { listarEspecialidades } from "@/services/especialidades"
import { useClinicaStore } from "@/store/clinicaStore"
import type { FilaEsperaItem, StatusFila } from "@/types/filaEspera"
import type { PacienteListItem } from "@/types/paciente"
import type { Especialidade } from "@/types/especialidade"

const STATUS_LABEL: Record<StatusFila, string> = {
  AGUARDANDO: "Aguardando",
  CONVERTIDO: "Agendado",
  RECUSADO: "Recusado",
}

const STATUS_VARIANT: Record<StatusFila, "default" | "success" | "destructive"> = {
  AGUARDANDO: "default",
  CONVERTIDO: "success",
  RECUSADO: "destructive",
}

function dataLocalISO(date = new Date()): string {
  const ano = date.getFullYear()
  const mes = String(date.getMonth() + 1).padStart(2, "0")
  const dia = String(date.getDate()).padStart(2, "0")
  return `${ano}-${mes}-${dia}`
}

export default function FilaEsperaPage() {
  const [fila, setFila] = useState<FilaEsperaItem[]>([])
  const [carregando, setCarregando] = useState(true)
  const [pacientes, setPacientes] = useState<PacienteListItem[]>([])
  const [especialidades, setEspecialidades] = useState<Especialidade[]>([])

  const profissionais = useClinicaStore((s) => s.profissionais)
  const buscarProfissionais = useClinicaStore((s) => s.buscarProfissionais)

  // Filtros
  const [filtroStatus, setFiltroStatus] = useState<StatusFila>("AGUARDANDO")
  const [filtroProfissional, setFiltroProfissional] = useState<number>(0)
  const [filtroEspecialidade, setFiltroEspecialidade] = useState<number>(0)

  // Modais / drawers
  const [formAberto, setFormAberto] = useState(false)
  const [entradaEmEdicao, setEntradaEmEdicao] = useState<FilaEsperaItem | undefined>()
  const [converterItem, setConverterItem] = useState<FilaEsperaItem | null>(null)
  const [acaoId, setAcaoId] = useState<number | null>(null)

  const carregarFila = useCallback(async () => {
    setCarregando(true)
    try {
      const data = await listarFila({
        status: filtroStatus,
        profissional: filtroProfissional || undefined,
        especialidade: filtroEspecialidade || undefined,
      })
      setFila(data)
    } finally {
      setCarregando(false)
    }
  }, [filtroStatus, filtroProfissional, filtroEspecialidade])

  useEffect(() => {
    void carregarFila()
  }, [carregarFila])

  useEffect(() => {
    void buscarProfissionais()
    void listarPacientes({ ativo: true }).then(setPacientes)
    void listarEspecialidades().then(setEspecialidades)
  }, [buscarProfissionais])

  const converterSlot = useMemo(() => {
    if (!converterItem) return undefined
    return {
      data: dataLocalISO(),
      profissional_id: converterItem.profissional ?? undefined,
      paciente_id: converterItem.paciente,
    }
  }, [converterItem])

  function abrirNovo() {
    setEntradaEmEdicao(undefined)
    setFormAberto(true)
  }

  function abrirEdicao(item: FilaEsperaItem) {
    setEntradaEmEdicao(item)
    setFormAberto(true)
  }

  async function aoRecusar(item: FilaEsperaItem) {
    if (!confirm(`Marcar ${item.paciente_nome} como recusado?`)) return
    setAcaoId(item.id)
    try {
      await recusarFila(item.id)
      await carregarFila()
    } finally {
      setAcaoId(null)
    }
  }

  async function aoExcluir(item: FilaEsperaItem) {
    if (!confirm(`Remover ${item.paciente_nome} da fila de espera?`)) return
    setAcaoId(item.id)
    try {
      await removerFila(item.id)
      await carregarFila()
    } finally {
      setAcaoId(null)
    }
  }

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <ListChecksIcon className="size-5 shrink-0 text-primary" />
          <h1 className="truncate text-lg font-semibold tracking-tight text-foreground">
            Fila de Espera
          </h1>
        </div>
        <Button size="sm" onClick={abrirNovo}>
          <PlusIcon className="size-4" /> Adicionar à fila
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card px-3 py-2">
        <div className="space-y-1">
          <Label htmlFor="f-status" className="text-xs">Status</Label>
          <Select
            id="f-status"
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value as StatusFila)}
            className="h-8 w-40"
          >
            <option value="AGUARDANDO">Aguardando</option>
            <option value="CONVERTIDO">Agendados</option>
            <option value="RECUSADO">Recusados</option>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="f-esp" className="text-xs">Especialidade</Label>
          <Select
            id="f-esp"
            value={filtroEspecialidade}
            onChange={(e) => setFiltroEspecialidade(Number(e.target.value))}
            className="h-8 w-52"
          >
            <option value={0}>Todas</option>
            {especialidades.map((e) => (
              <option key={e.id} value={e.id}>{e.nome}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="f-prof" className="text-xs">Profissional</Label>
          <Select
            id="f-prof"
            value={filtroProfissional}
            onChange={(e) => setFiltroProfissional(Number(e.target.value))}
            className="h-8 w-52"
          >
            <option value={0}>Todos</option>
            {profissionais.map((p) => (
              <option key={p.id} value={p.id}>{p.nome}</option>
            ))}
          </Select>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8"
          onClick={() => void carregarFila()}
          title="Atualizar"
        >
          <RotateCwIcon className="size-4" />
        </Button>
      </div>

      {carregando ? (
        <div className="flex justify-center py-10">
          <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : fila.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum paciente {STATUS_LABEL[filtroStatus].toLowerCase()} na fila.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">#</th>
                <th className="px-4 py-2 font-medium">Paciente</th>
                <th className="px-4 py-2 font-medium">Especialidade</th>
                <th className="px-4 py-2 font-medium">Profissional</th>
                <th className="px-4 py-2 font-medium">Observações</th>
                <th className="px-4 py-2 font-medium">Espera</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {fila.map((item, indice) => (
                <tr key={item.id} className="border-t border-border align-top">
                  <td className="px-4 py-3 text-muted-foreground">{indice + 1}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{item.paciente_nome}</div>
                    {item.paciente_telefone && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <PhoneIcon className="size-3" /> {item.paciente_telefone}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {item.especialidade_nome ?? <span className="italic">Qualquer</span>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {item.profissional_nome ?? <span className="italic">Qualquer</span>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {[item.preferencia_horario, item.observacoes].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td className="px-4 py-3">
                    {item.status === "AGUARDANDO" ? (
                      <span className="text-xs text-muted-foreground">
                        {tempoDeEspera(item.criado_em)}
                      </span>
                    ) : (
                      <Badge variant={STATUS_VARIANT[item.status]}>
                        {STATUS_LABEL[item.status]}
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {item.status === "AGUARDANDO" && (
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" onClick={() => setConverterItem(item)}>
                          <CalendarPlusIcon className="size-4" /> Agendar
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          title="Editar"
                          onClick={() => abrirEdicao(item)}
                        >
                          <PencilIcon className="size-4" />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          title="Recusar"
                          disabled={acaoId === item.id}
                          onClick={() => void aoRecusar(item)}
                        >
                          <XCircleIcon className="size-4" />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          title="Remover"
                          disabled={acaoId === item.id}
                          onClick={() => void aoExcluir(item)}
                        >
                          <Trash2Icon className="size-4 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <FilaEsperaFormModal
        open={formAberto}
        entrada={entradaEmEdicao}
        pacientes={pacientes}
        profissionais={profissionais}
        especialidades={especialidades}
        onPacienteCriado={(paciente) => setPacientes((prev) => [paciente, ...prev])}
        onSalvo={() => {
          setFormAberto(false)
          void carregarFila()
        }}
        onCancelar={() => setFormAberto(false)}
      />

      {/* Atalho: agendar a partir da fila (converte a entrada em agendamento) */}
      <Drawer
        open={converterItem != null}
        onClose={() => setConverterItem(null)}
        title="Agendar da fila de espera"
        description={converterItem ? `${converterItem.paciente_nome} — preencha o horário` : undefined}
      >
        {converterItem && (
          <AgendamentoForm
            key={`converter-${converterItem.id}`}
            modoDrawer
            converterFilaId={converterItem.id}
            slotInicial={converterSlot}
            onSalvo={() => {
              setConverterItem(null)
              void carregarFila()
            }}
            onCancelar={() => setConverterItem(null)}
          />
        )}
      </Drawer>
    </div>
  )
}
