import type { ReactNode } from "react"

interface AuthLayoutProps {
  children: ReactNode
}

/** Arcos dourados translúcidos que ecoam o "C" do monograma da logo. */
function ArcosDecorativos() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -top-40 -right-40 size-112 rounded-full border border-brand-gold/20" />
      <div className="absolute -top-24 -right-24 size-80 rounded-full border border-brand-gold/10" />
      <div className="absolute -bottom-48 -left-32 size-128 rounded-full border border-brand-gold/15" />
      <div className="absolute -bottom-20 left-1/3 size-72 rounded-full bg-brand-gold/5 blur-3xl" />
      <div className="absolute top-1/4 -left-16 size-64 rounded-full bg-brand-gold-light/5 blur-3xl" />
    </div>
  )
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="grid min-h-screen bg-canvas lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      {/* Painel da marca (somente telas largas) */}
      <aside className="relative hidden flex-col items-center justify-between overflow-hidden bg-brand-ink p-12 text-white lg:flex">
        <ArcosDecorativos />
        <div aria-hidden />
        <div className="relative flex flex-col items-center gap-10 text-center">
          <img
            src="/logo.webp"
            alt="Clínica da Aprendizagem — Christiane Menezes | Alexandra Negrão"
            className="h-auto w-full max-w-sm"
          />
          <div aria-hidden className="filete-dourado h-px w-48" />
          <p className="max-w-sm font-heading text-3xl leading-snug font-medium text-brand-gold-light">
            Cuidado, ciência e afeto
            <br />
            em cada etapa do aprender.
          </p>
        </div>
        <p className="relative text-xs tracking-[0.2em] text-white/40 uppercase">
          Sistema de gestão clínica
        </p>
      </aside>

      <main className="flex items-center justify-center p-4 sm:p-8">{children}</main>
    </div>
  )
}
