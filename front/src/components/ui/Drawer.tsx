import { useEffect, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface DrawerProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  className?: string
}

/**
 * Painel lateral (slide-over) que entra pela direita.
 * Overlay escuro com blur; fecha com Escape, clique no fundo ou botão X.
 */
export function Drawer({
  open,
  onClose,
  title,
  description,
  children,
  className,
}: DrawerProps) {
  useEffect(() => {
    if (!open) return

    function aoPressionarEscape(evento: KeyboardEvent) {
      if (evento.key === "Escape") onClose()
    }

    document.addEventListener("keydown", aoPressionarEscape)
    document.body.style.overflow = "hidden"

    return () => {
      document.removeEventListener("keydown", aoPressionarEscape)
      document.body.style.overflow = ""
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <>
      <div
        role="presentation"
        aria-hidden
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-titulo"
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-popover shadow-xl",
          "translate-x-0 transition-transform duration-300 ease-out",
          className
        )}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h2 id="drawer-titulo" className="text-base font-semibold tracking-tight text-foreground">
              {title}
            </h2>
            {description && (
              <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Fechar"
            className="shrink-0"
          >
            <XIcon className="size-4" />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>
      </aside>
    </>,
    document.body
  )
}
