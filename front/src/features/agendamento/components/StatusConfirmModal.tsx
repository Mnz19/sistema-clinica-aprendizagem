/** Modal de confirmação para alteração rápida de status do agendamento. */
import { useState } from "react"
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
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { STATUS_AGENDAMENTO, type Agendamento, type StatusAgendamento } from "@/types/agendamento"

interface Props {
  open: boolean
  agendamento: Agendamento | null
  novoStatus: StatusAgendamento | null
  salvando?: boolean
  erroParecer?: string | null
  onConfirmar: (parecer?: string) => void
  onCancelar: () => void
}

function statusExigeParecer(status: StatusAgendamento): boolean {
  return status === "FALTA" || status === "DESMARCADO"
}

export function StatusConfirmModal({
  open,
  agendamento,
  novoStatus,
  salvando = false,
  erroParecer = null,
  onConfirmar,
  onCancelar,
}: Props) {
  const [parecer, setParecer] = useState("")
  const [erroLocal, setErroLocal] = useState<string | null>(null)
  const [wasOpen, setWasOpen] = useState(open);

  const exigeParecer = novoStatus != null && statusExigeParecer(novoStatus)
  const rotuloStatus = novoStatus ? STATUS_AGENDAMENTO[novoStatus] : ""

  if (open !== wasOpen) {
    setWasOpen(open); // Atualiza o rastreador

    if (open) {
      // O modal acabou de abrir! Inicializa os campos perfeitamente.
      setParecer(agendamento?.parecer_status ?? "");
      setErroLocal(null);
    }
  }

  function aoConfirmar() {
    if (exigeParecer && !parecer.trim()) {
      setErroLocal("É necessário fornecer um parecer para este status.")
      return
    }
    setErroLocal(null)
    onConfirmar(exigeParecer ? parecer.trim() : undefined)
  }

  const mensagemErroParecer = erroParecer ?? erroLocal

  return (
    <AlertDialog open={open} onOpenChange={(aberto) => !aberto && !salvando && onCancelar()}>
      <AlertDialogContent className="max-w-md data-[size=default]:max-w-md data-[size=default]:sm:max-w-md">
        <AlertDialogHeader className="text-left">
          <AlertDialogTitle>Alterar status do agendamento</AlertDialogTitle>
          <AlertDialogDescription>
            <div className="space-y-3 text-left">
              {agendamento && (
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{agendamento.paciente_nome}</span>
                  {" · "}
                  {agendamento.profissional_nome}
                </p>
              )}

              {exigeParecer ? (
                <div className="space-y-2">
                  <p className="text-sm text-foreground">
                    Para alterar o status para <strong>{rotuloStatus}</strong>, informe a
                    justificativa abaixo.
                  </p>
                  <div className="space-y-1.5">
                    <Label htmlFor="parecer-status-modal" className="text-destructive">
                      Parecer / Justificativa *
                    </Label>
                    <Textarea
                      id="parecer-status-modal"
                      value={parecer}
                      onChange={(e) => {
                        setParecer(e.target.value)
                        if (erroLocal) setErroLocal(null)
                      }}
                      placeholder="Descreva o motivo da falta ou do cancelamento…"
                      rows={4}
                      aria-invalid={Boolean(mensagemErroParecer)}
                      className={cn(
                        mensagemErroParecer &&
                          "border-destructive ring-2 ring-destructive/20 focus-visible:border-destructive focus-visible:ring-destructive/30"
                      )}
                    />
                    {mensagemErroParecer && (
                      <p className="text-xs font-medium text-destructive">{mensagemErroParecer}</p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-foreground">
                  Tem certeza que deseja alterar o status para{" "}
                  <strong>{rotuloStatus}</strong>?
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={salvando} onClick={onCancelar}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction disabled={salvando} onClick={aoConfirmar}>
            {salvando ? <Loader2Icon className="size-4 animate-spin" /> : "Confirmar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
