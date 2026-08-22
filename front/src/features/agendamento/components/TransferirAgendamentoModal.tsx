/**
 * Modal de transferência de um agendamento para outro profissional.
 *
 * Regra: estar fora da disponibilidade semanal do destino é apenas um AVISO.
 * A primeira tentativa (`confirmar=false`) pode voltar com `requer_confirmacao`;
 * nesse caso mostramos os avisos e o botão passa a "Confirmar assim mesmo"
 * (reenvia com `confirmar=true`). Ausência, serviço não oferecido e choque de
 * horário continuam bloqueando (erro vermelho).
 */
import { useEffect, useMemo, useState } from "react"
import { AlertTriangleIcon, ArrowRightLeftIcon, Loader2Icon } from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Combobox } from "@/components/ui/combobox"
import { Label } from "@/components/ui/label"
import { AgendamentoValidacaoError } from "@/services/agendamento"
import { useAgendamentoStore } from "@/store/agendamentoStore"
import { useClinicaStore } from "@/store/clinicaStore"
import { formatarData, formatarHorario } from "@/utils/format"
import type { Agendamento } from "@/types/agendamento"

interface Props {
  open: boolean
  agendamento: Agendamento | null
  onTransferido: (agendamento: Agendamento) => void
  onCancelar: () => void
}

export function TransferirAgendamentoModal({
  open,
  agendamento,
  onTransferido,
  onCancelar,
}: Props) {
  const transferirAgendamento = useAgendamentoStore((s) => s.transferirAgendamento)
  const profissionais = useClinicaStore((s) => s.profissionais)
  const buscarProfissionais = useClinicaStore((s) => s.buscarProfissionais)

  const [destino, setDestino] = useState<number | null>(null)
  const [avisos, setAvisos] = useState<string[]>([])
  const [erros, setErros] = useState<string[]>([])
  const [salvando, setSalvando] = useState(false)
  const [wasOpen, setWasOpen] = useState(open)

  useEffect(() => {
    if (open) void buscarProfissionais()
  }, [open, buscarProfissionais])

  // Reinicializa o estado a cada abertura (padrão usado no StatusConfirmModal).
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setDestino(null)
      setAvisos([])
      setErros([])
      setSalvando(false)
    }
  }

  // Não faz sentido transferir para o profissional atual.
  const opcoes = useMemo(
    () =>
      profissionais
        .filter((p) => p.id !== agendamento?.profissional)
        .map((p) => ({ value: p.id, label: p.nome })),
    [profissionais, agendamento?.profissional]
  )

  const precisaConfirmar = avisos.length > 0

  async function executarTransferencia(confirmar: boolean) {
    if (!agendamento || !destino) {
      setErros(["Selecione o profissional de destino."])
      return
    }

    setSalvando(true)
    setErros([])

    try {
      const resultado = await transferirAgendamento(agendamento.id, destino, confirmar)
      if (resultado.requer_confirmacao) {
        // Fora da disponibilidade: exibe os avisos e aguarda confirmação.
        setAvisos(resultado.avisos)
        return
      }
      onTransferido(resultado.agendamento)
    } catch (err) {
      setAvisos([])
      if (err instanceof AgendamentoValidacaoError) {
        setErros(err.validacao.mensagens.length > 0 ? err.validacao.mensagens : [err.validacao.mensagem])
      } else {
        setErros(["Não foi possível transferir o agendamento. Tente novamente."])
      }
    } finally {
      setSalvando(false)
    }
  }

  // Trocar o destino invalida os avisos/erros da tentativa anterior.
  function aoTrocarDestino(valor: number | null) {
    setDestino(valor)
    setAvisos([])
    setErros([])
  }

  return (
    <AlertDialog open={open} onOpenChange={(aberto) => !aberto && !salvando && onCancelar()}>
      <AlertDialogContent className="max-w-md data-[size=default]:max-w-md data-[size=default]:sm:max-w-md">
        <AlertDialogHeader className="text-left">
          <AlertDialogTitle className="flex items-center gap-2">
            <ArrowRightLeftIcon className="size-4 text-primary" />
            Transferir agendamento
          </AlertDialogTitle>
          <AlertDialogDescription>
            {agendamento
              ? `${agendamento.paciente_nome} · ${formatarData(agendamento.data)} às ${formatarHorario(agendamento.horario_inicio)}`
              : "Selecione o profissional de destino."}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3 text-left">
          {agendamento && (
            <p className="text-sm text-muted-foreground">
              Profissional atual:{" "}
              <span className="font-medium text-foreground">{agendamento.profissional_nome}</span>
            </p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="destino-transferencia">Transferir para *</Label>
            <Combobox
              id="destino-transferencia"
              options={opcoes}
              value={destino}
              onChange={aoTrocarDestino}
              disabled={salvando}
              placeholder="Buscar profissional…"
              emptyText="Nenhum profissional encontrado."
            />
          </div>

          {precisaConfirmar && (
            <div
              role="alert"
              className="flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-amber-700 dark:text-amber-400"
            >
              <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
              <div className="space-y-1 text-sm">
                <p className="font-medium">Atenção — transferência fora da disponibilidade</p>
                <ul className="list-inside list-disc">
                  {avisos.map((msg) => (
                    <li key={msg}>{msg}</li>
                  ))}
                </ul>
                <p className="text-xs">Você pode confirmar mesmo assim.</p>
              </div>
            </div>
          )}

          {erros.length > 0 && (
            <div
              role="alert"
              className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              <ul className="list-inside list-disc">
                {erros.map((msg) => (
                  <li key={msg}>{msg}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={salvando} onClick={onCancelar}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={salvando || !destino}
            variant={precisaConfirmar ? "destructive" : "default"}
            onClick={() => executarTransferencia(precisaConfirmar)}
          >
            {salvando ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : precisaConfirmar ? (
              "Confirmar assim mesmo"
            ) : (
              "Transferir"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
