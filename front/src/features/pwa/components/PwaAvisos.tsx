import { RefreshCwIcon, WifiOffIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { usePwaStore } from "@/features/pwa/pwaStore"
import { useOnline } from "@/features/pwa/useOnline"

/**
 * Avisos flutuantes do app: versão nova disponível e falta de conexão.
 * Fica acima da barra de gestos do celular (safe-area).
 */
export default function PwaAvisos() {
  const isOnline = useOnline()
  const temAtualizacao = usePwaStore((s) => s.temAtualizacao)
  const avisoDispensado = usePwaStore((s) => s.avisoDispensado)
  const isRecarregando = usePwaStore((s) => s.isRecarregando)
  const dispensarAviso = usePwaStore((s) => s.dispensarAviso)
  const recarregar = usePwaStore((s) => s.recarregar)

  const mostrarAtualizacao = temAtualizacao && !avisoDispensado
  if (isOnline && !mostrarAtualizacao) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
      {!isOnline && (
        <div
          role="status"
          className="pointer-events-auto flex items-center gap-2 rounded-full bg-brand-ink px-4 py-2 text-sm text-white shadow-lg"
        >
          <WifiOffIcon className="size-4 shrink-0 text-brand-gold" />
          Sem conexão com a internet
        </div>
      )}

      {mostrarAtualizacao && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-xl border border-brand-gold/40 bg-brand-ink py-3 pr-3 pl-4 text-white shadow-xl"
        >
          <RefreshCwIcon className="size-5 shrink-0 text-brand-gold" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-tight">Nova versão disponível</p>
            <p className="text-xs leading-tight text-white/70">
              Salve o que estiver editando antes de atualizar.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={dispensarAviso}
            className="text-white/80 hover:bg-white/10 hover:text-white"
          >
            Depois
          </Button>
          <Button
            size="sm"
            onClick={() => void recarregar()}
            disabled={isRecarregando}
            className="bg-brand-gold text-brand-ink hover:bg-brand-gold-light"
          >
            Atualizar
          </Button>
        </div>
      )}
    </div>
  )
}
