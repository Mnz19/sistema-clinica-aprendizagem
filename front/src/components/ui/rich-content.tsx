import { cn } from "@/lib/utils"
import { conteudoParaExibicao } from "@/utils/html"

/** Renderiza, com segurança, o conteúdo HTML de um registro do prontuário. */
export function RichContent({
  html,
  className,
}: {
  html?: string | null
  className?: string
}) {
  return (
    <div
      className={cn("prose-registro text-sm text-foreground/90", className)}
      dangerouslySetInnerHTML={{ __html: conteudoParaExibicao(html) }}
    />
  )
}
