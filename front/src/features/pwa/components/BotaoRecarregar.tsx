import { RefreshCwIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { usePwaStore } from "@/features/pwa/pwaStore"

/**
 * Botão "recarregar" do header. Instalado como app não há o F5 do navegador:
 * aplica a versão nova se houver (ponto dourado) ou só recarrega a página.
 */
export default function BotaoRecarregar() {
  const temAtualizacao = usePwaStore((s) => s.temAtualizacao)
  const isRecarregando = usePwaStore((s) => s.isRecarregando)
  const recarregar = usePwaStore((s) => s.recarregar)

  const rotulo = temAtualizacao ? "Nova versão disponível — atualizar" : "Recarregar sistema"

  return (
    <button
      type="button"
      onClick={() => void recarregar()}
      disabled={isRecarregando}
      title={rotulo}
      className="relative flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-60"
    >
      <RefreshCwIcon className={cn("size-4", isRecarregando && "animate-spin")} />
      {temAtualizacao && (
        <span
          aria-hidden
          className="absolute top-1.5 right-1.5 size-2 rounded-full bg-brand-gold ring-2 ring-background"
        />
      )}
      <span className="sr-only">{rotulo}</span>
    </button>
  )
}
