/** Versão para impressão / PDF do prontuário (cabeçalho + registros por item). */
import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { ArrowLeftIcon, Loader2Icon, PrinterIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RichContent } from "@/components/ui/rich-content"
import { mensagemDeErro } from "@/utils/apiError"
import { formatarCpf, formatarData, formatarDataHora } from "@/utils/format"
import { obterPaciente } from "@/services/pacientes"
import { listarEntradas } from "@/services/prontuario"
import { FormRenderer } from "@/features/prontuario/components/FormRenderer"
import type { Paciente } from "@/types/paciente"
import type { EntradaProntuario } from "@/types/prontuario"

export default function ImpressaoProntuarioPage() {
  const { id } = useParams()
  const pacienteId = Number(id)
  const navigate = useNavigate()

  const [paciente, setPaciente] = useState<Paciente | null>(null)
  const [entradas, setEntradas] = useState<EntradaProntuario[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    async function carregar() {
      try {
        const [p, regs] = await Promise.all([
          obterPaciente(pacienteId),
          listarEntradas({ paciente: pacienteId }),
        ])
        if (!ativo) return
        setPaciente(p)
        setEntradas(regs)
      } catch (e) {
        if (ativo) setErro(mensagemDeErro(e))
      } finally {
        if (ativo) setCarregando(false)
      }
    }
    carregar()
    return () => {
      ativo = false
    }
  }, [pacienteId])

  if (carregando) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2Icon className="size-4 animate-spin" /> Preparando prontuário…
      </div>
    )
  }

  if (erro || !paciente) {
    return <div className="p-6 text-sm text-destructive">{erro || "Paciente não encontrado."}</div>
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

      <header className="border-b border-zinc-300 pb-4">
        <h1 className="text-xl font-bold">Clínica da Aprendizagem</h1>
        <p className="text-sm text-zinc-500">Prontuário eletrônico</p>
        <div className="mt-3 grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
          <div><strong>Paciente:</strong> {paciente.nome_completo}</div>
          <div>
            <strong>Nascimento:</strong> {formatarData(paciente.data_nascimento)}
            {paciente.idade != null && ` (${paciente.idade} anos)`}
          </div>
          {paciente.cpf && <div><strong>CPF:</strong> {formatarCpf(paciente.cpf)}</div>}
          {paciente.cid && <div><strong>CID:</strong> {paciente.cid}</div>}
          {paciente.diagnostico && (
            <div className="col-span-2"><strong>Diagnóstico:</strong> {paciente.diagnostico}</div>
          )}
          {paciente.alertas && (
            <div className="col-span-2"><strong>Alertas:</strong> {paciente.alertas}</div>
          )}
        </div>
        <p className="mt-2 text-xs text-zinc-400">
          Emitido em {formatarDataHora(new Date().toISOString())}
        </p>
      </header>

      <main className="mt-4 space-y-5">
        {entradas.length === 0 ? (
          <p className="text-sm text-zinc-500">Nenhum registro no prontuário.</p>
        ) : (
          entradas.map((e) => (
            <article key={e.id} className="break-inside-avoid border-b border-zinc-200 pb-4">
              <div className="flex items-center justify-between">
                <Badge variant="secondary">{e.item_nome}</Badge>
                <span className="text-xs text-zinc-500">{formatarDataHora(e.data_evento)}</span>
              </div>
              {e.titulo && <h3 className="mt-1 font-semibold">{e.titulo}</h3>}
              {e.item_tipo === "FORMULARIO" ? (
                <div className="mt-1">
                  <FormRenderer schema={e.schema_snapshot} valores={e.respostas} readOnly />
                </div>
              ) : (
                <RichContent html={e.conteudo} className="mt-1 text-zinc-800" />
              )}
              <p className="mt-2 text-xs text-zinc-500">
                {e.autor_nome}
                {e.autor_conselho ? ` · ${e.autor_conselho}` : ""}
                {e.autor_papel ? ` · ${e.autor_papel}` : ""}
              </p>
            </article>
          ))
        )}
      </main>
    </div>
  )
}
