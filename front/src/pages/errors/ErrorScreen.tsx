import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import { ActivityIcon } from "lucide-react"

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
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-zinc-50 px-6 py-16 text-center">
      {/* Brilho decorativo de fundo */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,var(--color-zinc-200)_0%,transparent_70%)]"
      />

      {/* Código gigante, fantasma, atrás do conteúdo */}
      <span
        aria-hidden
        className="pointer-events-none absolute select-none text-[13rem] font-black leading-none tracking-tighter text-zinc-900/4 sm:text-[18rem]"
      >
        {code}
      </span>

      <div className="relative z-10 flex w-full max-w-md flex-col items-center">
        {/* Marca */}
        <div className="mb-10 flex items-center gap-2 text-zinc-400">
          <div className="flex size-7 items-center justify-center rounded-lg bg-zinc-900 text-white">
            <ActivityIcon className="size-4" />
          </div>
          <span className="text-sm font-semibold tracking-tight text-zinc-500">
            Clínica da Aprendizagem
          </span>
        </div>

        {/* Ícone do erro */}
        <div className="mb-6 flex size-16 items-center justify-center rounded-2xl border border-zinc-200 bg-white text-zinc-700 shadow-sm">
          <Icon className="size-8" strokeWidth={1.75} />
        </div>

        <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-zinc-400">
          Erro {code}
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
          {title}
        </h1>
        <p className="mt-3 text-balance text-zinc-500">{description}</p>

        <div className="mt-8 flex w-full flex-col-reverse gap-3 sm:flex-row sm:justify-center">
          {actions}
        </div>
      </div>
    </div>
  )
}
