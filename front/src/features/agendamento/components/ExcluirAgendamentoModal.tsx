/**
 * Modal de confirmação da exclusão definitiva de um agendamento.
 *
 * Ação irreversível e restrita ao super admin (`is_superuser`) — o backend
 * (`IsSuperAdmin`) é quem de fato garante a regra. O fluxo normal da clínica é
 * desmarcar a consulta, que preserva o histórico.
 */
import { Loader2Icon } from "lucide-react"

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
import { formatarData, formatarHorario } from "@/utils/format"
import type { Agendamento } from "@/types/agendamento"

interface Props {
  open: boolean
  agendamento: Agendamento | null
  excluindo?: boolean
  erro?: string | null
  onConfirmar: () => void
  onCancelar: () => void
}

export function ExcluirAgendamentoModal({
  open,
  agendamento,
  excluindo = false,
  erro = null,
  onConfirmar,
  onCancelar,
}: Props) {
  return (
    <AlertDialog open={open} onOpenChange={(aberto) => !aberto && !excluindo && onCancelar()}>
      <AlertDialogContent className="max-w-md data-[size=default]:max-w-md data-[size=default]:sm:max-w-md">
        <AlertDialogHeader className="text-left">
          <AlertDialogTitle>Excluir agendamento</AlertDialogTitle>
          <AlertDialogDescription>
            <div className="space-y-3 text-left">
              {agendamento && (
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{agendamento.paciente_nome}</span>
                  {" · "}
                  {agendamento.profissional_nome}
                  {" · "}
                  {formatarData(agendamento.data)} às{" "}
                  {formatarHorario(agendamento.horario_inicio)}
                </p>
              )}

              <p className="text-sm text-foreground">
                Esta ação é <strong>irreversível</strong> e apaga o agendamento do banco,
                junto com o seu histórico. Para encerrar a consulta preservando o registro,
                use <strong>Desmarcar</strong>.
              </p>

              {erro && (
                <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
                  {erro}
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={excluindo} onClick={onCancelar}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={excluindo}
            onClick={onConfirmar}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {excluindo ? <Loader2Icon className="size-4 animate-spin" /> : "Excluir"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
