import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"

interface ErrorScreenProps {
  /** Código HTTP em destaque (ex.: "404", "500"). */
  code: string
  /** Ícone ilustrativo do erro. */
  icon: LucideIcon
  /** Título curto e humano. */
  title: string
  /** Explicação amigável do que aconteceu. */
  description: ReactNode
  /** Botões de ação (voltar, recarregar, etc.). */
  actions: ReactNode
}

/**
 * Casca visual compartilhada das páginas de erro (404, 500, ...).
 *
 * É autossuficiente: ocupa a tela inteira e não depende do layout autenticado,
 * pois um erro pode acontecer em qualquer rota (pública ou protegida).
 */
export default function ErrorScreen({
  code,
  icon: Icon,
  title,
  description,
  actions,
}: ErrorScreenProps) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-canvas px-6 py-16 text-center">
      {/* Brilho decorativo de fundo */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,var(--color-brand-cream)_0%,transparent_70%)]"
      />

      {/* Código gigante, fantasma, atrás do conteúdo */}
      <span
        aria-hidden
        className="pointer-events-none absolute select-none text-[13rem] font-black leading-none tracking-tighter text-brand-gold/10 sm:text-[18rem]"
      >
        {code}
      </span>

      <div className="relative z-10 flex w-full max-w-md flex-col items-center">
        {/* Marca */}
        <img
          src="/logo.webp"
          alt="Clínica da Aprendizagem"
          className="mb-10 h-auto w-48"
        />

        {/* Ícone do erro */}
        <div className="mb-6 flex size-16 items-center justify-center rounded-2xl border border-border bg-card text-primary shadow-sm">
          <Icon className="size-8" strokeWidth={1.75} />
        </div>

        <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Erro {code}
        </p>
        <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">
          {title}
        </h1>
        <p className="mt-3 text-balance text-muted-foreground">{description}</p>

        <div className="mt-8 flex w-full flex-col-reverse gap-3 sm:flex-row sm:justify-center">
          {actions}
        </div>
      </div>
    </div>
  )
}
