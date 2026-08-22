/**
 * Metadados visuais do estado de confirmação por WhatsApp de um agendamento.
 * Usado na listagem (selo) e no calendário (cor do evento / legenda).
 */
import { CheckCircle2Icon, ClockIcon, XCircleIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import type { EstadoConfirmacao } from "@/types/agendamento"

interface InfoConfirmacao {
  label: string
  icon: typeof CheckCircle2Icon
  /** Classes do selo (badge). */
  badge: string
  /** Cor (hex) para o evento do calendário e a legenda. */
  cor: string
}

const CONFIRMACAO_INFO: Record<
  "CONFIRMADO" | "AGUARDANDO" | "DESMARCADO",
  InfoConfirmacao
> = {
  CONFIRMADO: {
    label: "Confirmado",
    icon: CheckCircle2Icon,
    badge: "border-emerald-200 bg-emerald-100 text-emerald-700",
    cor: "#22c55e",
  },
  AGUARDANDO: {
    label: "Aguardando confirmação",
    icon: ClockIcon,
    badge: "border-amber-200 bg-amber-100 text-amber-700",
    cor: "#f59e0b",
  },
  DESMARCADO: {
    label: "Desmarcado",
    icon: XCircleIcon,
    badge: "border-red-200 bg-red-100 text-red-700",
    cor: "#ef4444",
  },
}

/**
 * Selo visual do estado de confirmação. Quando ``estado`` é ``null`` (nenhum
 * dos casos), não renderiza nada — o agendamento fica "normal".
 */
export function ConfirmacaoBadge({
  estado,
  className,
  compacto = false,
}: {
  estado: EstadoConfirmacao
  className?: string
  compacto?: boolean
}) {
  if (!estado) return null
  const info = CONFIRMACAO_INFO[estado]
  const Icone = info.icon
  return (
    <span
      title={info.label}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium whitespace-nowrap",
        info.badge,
        className
      )}
    >
      <Icone className="size-3.5 shrink-0" />
      {!compacto && info.label}
    </span>
  )
}
