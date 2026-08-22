/**
 * Painel "Buscar na fila de espera": lista candidatos AGUARDANDO compatíveis com um
 * horário vago (FIFO) e permite agendar direto a partir da fila (fluxo P2-QUEUE-02).
 */
import { useEffect, useState } from "react"
import { CalendarPlusIcon, Loader2Icon, PhoneIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Drawer } from "@/components/ui/Drawer"
import { listarCandidatos } from "@/services/filaEspera"
import { tempoDeEspera } from "@/features/fila-espera/utils"
import type { FilaEsperaItem } from "@/types/filaEspera"

interface Props {
  open: boolean
  /** Filtra candidatos compatíveis com o profissional do horário vago. */
  profissionalId?: number
  especialidadeId?: number
  descricaoSlot?: string
  onSelecionar: (item: FilaEsperaItem) => void
  onClose: () => void
}

export function BuscarNaFilaModal({
  open,
  profissionalId,
  especialidadeId,
  descricaoSlot,
  onSelecionar,
  onClose,
}: Props) {
  const [candidatos, setCandidatos] = useState<FilaEsperaItem[]>([])
  const [carregando, setCarregando] = useState(false)

  useEffect(() => {
    if (!open) return
    setCarregando(true)
    listarCandidatos({ profissional: profissionalId, especialidade: especialidadeId })
      .then(setCandidatos)
      .finally(() => setCarregando(false))
  }, [open, profissionalId, especialidadeId])

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Buscar na fila de espera"
      description={descricaoSlot ?? "Pacientes aguardando, em ordem de chegada."}
    >
      {carregando ? (
        <div className="flex justify-center py-10">
          <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : candidatos.length === 0 ? (
        <p className="py-6 text-sm text-muted-foreground">
          Nenhum paciente compatível na fila de espera.
        </p>
      ) : (
        <ul className="space-y-2">
          {candidatos.map((item, indice) => (
            <li
              key={item.id}
              className="rounded-lg border border-border p-3 text-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{indice + 1}º</Badge>
                    <span className="font-medium text-foreground">{item.paciente_nome}</span>
                  </div>
                  {item.paciente_telefone && (
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <PhoneIcon className="size-3" /> {item.paciente_telefone}
                    </p>
                  )}
                  {(item.especialidade_nome || item.profissional_nome) && (
                    <p className="text-xs text-muted-foreground">
                      {[item.especialidade_nome, item.profissional_nome]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                  {item.observacoes && (
                    <p className="text-xs text-muted-foreground">{item.observacoes}</p>
                  )}
                  <p className="text-xs text-muted-foreground/80">
                    Aguardando há {tempoDeEspera(item.criado_em)}
                  </p>
                </div>
                <Button size="sm" onClick={() => onSelecionar(item)} className="shrink-0">
                  <CalendarPlusIcon className="size-4" /> Agendar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Drawer>
  )
}
