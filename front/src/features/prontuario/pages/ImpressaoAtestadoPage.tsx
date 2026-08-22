/** Versão para impressão / PDF de um atestado gerado (macros já resolvidas). */
import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { ArrowLeftIcon, Loader2Icon, PrinterIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { RichContent } from "@/components/ui/rich-content"
import { mensagemDeErro } from "@/utils/apiError"
import { formatarData } from "@/utils/format"
import { obterAtestado } from "@/services/prontuario"
import type { Atestado } from "@/types/prontuario"

export default function ImpressaoAtestadoPage() {
  const { id, atestadoId } = useParams()
  const pacienteId = Number(id)
  const navigate = useNavigate()

  const [atestado, setAtestado] = useState<Atestado | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    obterAtestado(Number(atestadoId))
      .then((a) => ativo && setAtestado(a))
      .catch((e) => ativo && setErro(mensagemDeErro(e)))
      .finally(() => ativo && setCarregando(false))
    return () => {
      ativo = false
    }
  }, [atestadoId])

  if (carregando) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2Icon className="size-4 animate-spin" /> Preparando atestado…
      </div>
    )
  }

  if (erro || !atestado) {
    return <div className="p-6 text-sm text-destructive">{erro || "Atestado não encontrado."}</div>
  }

  return (
    <div className="mx-auto max-w-3xl bg-white p-6 text-zinc-900">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/prontuarios/${pacienteId}`)}>
          <ArrowLeftIcon className="size-4" /> Voltar
        </Button>
        <Button size="sm" onClick={() => window.print()}>
          <PrinterIcon className="size-4" /> Imprimir / Salvar PDF
        </Button>
      </div>

      <header className="border-b border-zinc-300 pb-4 text-center">
        <h1 className="text-xl font-bold">Fontes Comportamentais</h1>
        {atestado.titulo && (
          <h2 className="mt-4 text-lg font-semibold uppercase tracking-wide">{atestado.titulo}</h2>
        )}
      </header>

      <main className="mt-8">
        <RichContent html={atestado.corpo_resolvido} className="text-base leading-relaxed text-zinc-800" />
      </main>

      <footer className="mt-16 text-center">
        <div className="mx-auto w-64 border-t border-zinc-400 pt-1 text-sm">
          {atestado.profissional_nome}
          {atestado.profissional_conselho && (
            <div className="text-zinc-500">{atestado.profissional_conselho}</div>
          )}
        </div>
        <p className="mt-4 text-xs text-zinc-400">Emitido em {formatarData(atestado.emitido_em)}</p>
      </footer>
    </div>
  )
}
