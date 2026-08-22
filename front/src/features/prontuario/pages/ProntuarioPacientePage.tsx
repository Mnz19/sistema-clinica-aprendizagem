/** Prontuário modular do paciente: navegação lateral (itens) + conteúdo (largura total). */
import { useCallback, useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  ArrowLeftIcon,
  FolderIcon,
  ListChecksIcon,
  Loader2Icon,
  PlusIcon,
  PrinterIcon,
  ScrollTextIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { mensagemDeErro } from "@/utils/apiError"
import { formatarData } from "@/utils/format"
import { obterPaciente } from "@/services/pacientes"
import {
  listarAtestados,
  listarComentarios,
  listarEntradas,
  listarItensDoPaciente,
} from "@/services/prontuario"
import type { Paciente } from "@/types/paciente"
import type {
  Atestado,
  ComentarioEntrada,
  EntradaProntuario,
  ItemProntuario,
} from "@/types/prontuario"
import { PacienteResumo } from "@/features/prontuario/components/PacienteResumo"
import { AtendimentoCard } from "@/features/prontuario/components/AtendimentoCard"
import { AnotacoesEntrada } from "@/features/prontuario/components/AnotacoesEntrada"
import { EntradaCard } from "@/features/prontuario/components/EntradaCard"
import { EntradaFormSheet } from "@/features/prontuario/components/EntradaFormSheet"
import { GerarAtestadoModal } from "@/features/prontuario/components/GerarAtestadoModal"
import { DocumentosPanel } from "@/features/pacientes/components/DocumentosPanel"

type Secao = "item" | "timeline" | "atestados" | "documentos"

const SECOES_GERAIS: { id: Secao; label: string; icon: typeof ListChecksIcon }[] = [
  { id: "timeline", label: "Linha do tempo", icon: ListChecksIcon },
  { id: "atestados", label: "Atestados", icon: ScrollTextIcon },
  { id: "documentos", label: "Documentos", icon: FolderIcon },
]

export default function ProntuarioPacientePage() {
  const { id } = useParams()
  const pacienteId = Number(id)
  const navigate = useNavigate()

  const [paciente, setPaciente] = useState<Paciente | null>(null)
  const [itens, setItens] = useState<ItemProntuario[]>([])
  const [secao, setSecao] = useState<Secao>("item")
  const [itemSelecionadoId, setItemSelecionadoId] = useState<number | null>(null)
  const [entradas, setEntradas] = useState<EntradaProntuario[]>([])
  const [timeline, setTimeline] = useState<EntradaProntuario[]>([])
  const [comentarios, setComentarios] = useState<ComentarioEntrada[]>([])
  const [atestados, setAtestados] = useState<Atestado[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const [sheetAberto, setSheetAberto] = useState(false)
  const [emEdicao, setEmEdicao] = useState<EntradaProntuario | null>(null)
  const [atestadoAberto, setAtestadoAberto] = useState(false)

  const itemSelecionado = itens.find((i) => i.id === itemSelecionadoId) ?? null

  const carregarEntradas = useCallback(
    (itemId: number) => {
      listarEntradas({ paciente: pacienteId, item: itemId })
        .then(setEntradas)
        .catch((e) => setErro(mensagemDeErro(e)))
    },
    [pacienteId]
  )

  const recarregarPaciente = useCallback(() => {
    return obterPaciente(pacienteId).then(setPaciente).catch(() => {})
  }, [pacienteId])

  // Carrega o paciente e os itens do PRÓPRIO usuário (meu prontuário).
  useEffect(() => {
    let ativo = true
    async function carregar() {
      setCarregando(true)
      try {
        const [p, lista] = await Promise.all([
          obterPaciente(pacienteId),
          listarItensDoPaciente(pacienteId),
        ])
        if (!ativo) return
        setPaciente(p)
        setItens(lista)
        setItemSelecionadoId(lista[0]?.id ?? null)
        setSecao(lista.length > 0 ? "item" : "timeline")
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

  useEffect(() => {
    if (secao === "item" && itemSelecionadoId != null) carregarEntradas(itemSelecionadoId)
  }, [secao, itemSelecionadoId, carregarEntradas])

  const carregarComentarios = useCallback(() => {
    listarComentarios({ paciente: pacienteId }).then(setComentarios).catch(() => {})
  }, [pacienteId])

  useEffect(() => {
    if (secao === "timeline") {
      listarEntradas({ paciente: pacienteId }).then(setTimeline).catch(() => {})
      carregarComentarios()
    }
    if (secao === "atestados") {
      listarAtestados(pacienteId).then(setAtestados).catch(() => {})
    }
  }, [secao, pacienteId, carregarComentarios])

  if (carregando) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2Icon className="size-4 animate-spin" /> Carregando prontuário…
      </div>
    )
  }

  if (!paciente) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/prontuarios")}>
          <ArrowLeftIcon className="size-4" /> Voltar
        </Button>
        <p className="text-sm text-destructive">{erro || "Paciente não encontrado."}</p>
      </div>
    )
  }

  const tituloSecao =
    secao === "item"
      ? itemSelecionado?.nome ?? "Meu prontuário"
      : SECOES_GERAIS.find((s) => s.id === secao)?.label ?? ""

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate("/prontuarios")}>
          <ArrowLeftIcon className="size-4" /> Prontuários
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(`/prontuarios/${pacienteId}/impressao`)}
        >
          <PrinterIcon className="size-4" /> Imprimir / PDF
        </Button>
      </div>

      <PacienteResumo paciente={paciente} onAtualizado={setPaciente} />

      <AtendimentoCard pacienteId={pacienteId} />

      {erro && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {erro}
        </div>
      )}

      {/* Layout de largura total: navegação lateral + conteúdo. */}
      <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
        {/* Navegação lateral (estilo Shosp) */}
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <div className="overflow-hidden rounded-lg border border-border">
            <p className="border-b border-border bg-muted/40 px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">
              Meu prontuário
            </p>
            <nav className="flex flex-col">
              {itens.length === 0 ? (
                <span className="px-3 py-3 text-xs text-muted-foreground">
                  Nenhum item configurado.
                </span>
              ) : (
                itens.map((item) => {
                  const ativo = secao === "item" && item.id === itemSelecionadoId
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setSecao("item")
                        setItemSelecionadoId(item.id)
                      }}
                      className={cn(
                        "border-l-2 px-3 py-2.5 text-left text-sm transition-colors",
                        ativo
                          ? "border-primary bg-primary/5 font-medium text-foreground"
                          : "border-transparent text-muted-foreground hover:bg-muted/40"
                      )}
                    >
                      {item.nome}
                    </button>
                  )
                })
              )}
            </nav>

            <p className="border-y border-border bg-muted/40 px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">
              Geral
            </p>
            <nav className="flex flex-col">
              {SECOES_GERAIS.map((s) => {
                const ativo = secao === s.id
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSecao(s.id)}
                    className={cn(
                      "flex items-center gap-2 border-l-2 px-3 py-2.5 text-left text-sm transition-colors",
                      ativo
                        ? "border-primary bg-primary/5 font-medium text-foreground"
                        : "border-transparent text-muted-foreground hover:bg-muted/40"
                    )}
                  >
                    <s.icon className="size-4" />
                    {s.label}
                  </button>
                )
              })}
            </nav>
          </div>
        </aside>

        {/* Conteúdo */}
        <section className="min-w-0 space-y-4">
          {/* Cabeçalho da seção */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">{tituloSecao}</h2>
            {secao === "item" && itemSelecionado && (
              <Button
                size="sm"
                onClick={() => {
                  setEmEdicao(null)
                  setSheetAberto(true)
                }}
              >
                <PlusIcon className="size-4" /> Novo registro
              </Button>
            )}
            {secao === "atestados" && (
              <Button size="sm" onClick={() => setAtestadoAberto(true)}>
                <ScrollTextIcon className="size-4" /> Gerar atestado
              </Button>
            )}
          </div>

          {/* Seção: item do próprio profissional */}
          {secao === "item" && (
            itens.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border py-12 text-center">
                <p className="text-sm text-muted-foreground">
                  Você ainda não tem itens de prontuário configurados. Fale com a Direção
                  (Configurações › Prontuário).
                </p>
              </div>
            ) : entradas.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border py-12 text-center">
                <p className="text-sm text-muted-foreground">Nenhum registro neste item ainda.</p>
              </div>
            ) : (
              <div className="relative space-y-4 before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-px before:bg-border">
                {entradas.map((entrada) => (
                  <div key={entrada.id} className="relative pl-6">
                    <span className="absolute left-0 top-4 size-3.5 rounded-full border-2 border-background bg-primary" />
                    <EntradaCard
                      entrada={entrada}
                      onEditar={(e) => {
                        setEmEdicao(e)
                        setSheetAberto(true)
                      }}
                      onAlterado={() => itemSelecionadoId != null && carregarEntradas(itemSelecionadoId)}
                    />
                  </div>
                ))}
              </div>
            )
          )}

          {/* Seção: linha do tempo (todos os profissionais) */}
          {secao === "timeline" && (
            <>
              <p className="text-sm text-muted-foreground">
                Todos os registros deste paciente, de todos os profissionais.
              </p>
              {timeline.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border py-12 text-center">
                  <p className="text-sm text-muted-foreground">Nenhum registro no prontuário ainda.</p>
                </div>
              ) : (
                <div className="relative space-y-4 before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-px before:bg-border">
                  {timeline.map((entrada) => {
                    const observacoes = comentarios.filter(
                      (c) => c.entrada === entrada.id && c.tipo === "OBSERVACAO"
                    )
                    return (
                      <div key={entrada.id} className="relative space-y-2 pl-6">
                        <span className="absolute left-0 top-4 size-3.5 rounded-full border-2 border-background bg-primary" />
                        <AnotacoesEntrada
                          entradaId={entrada.id}
                          tipo="OBSERVACAO"
                          itens={observacoes}
                          onAlterado={carregarComentarios}
                        />
                        <EntradaCard entrada={entrada} somenteLeitura mostrarItem />
                        {/* Comentários ocultos por ora (redundante com observações).
                            Backend/serviço/componente permanecem prontos; para
                            reativar, renderize <AnotacoesEntrada tipo="COMENTARIO">
                            filtrando `comentarios` por c.tipo === "COMENTARIO". */}
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}

          {/* Seção: atestados */}
          {secao === "atestados" && (
            atestados.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border py-12 text-center">
                <p className="text-sm text-muted-foreground">Nenhum atestado emitido.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {atestados.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => navigate(`/prontuarios/${pacienteId}/atestado/${a.id}/impressao`)}
                    className="flex w-full items-center justify-between rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted/40"
                  >
                    <div>
                      <span className="font-medium">{a.titulo || "Atestado"}</span>
                      <p className="text-xs text-muted-foreground">
                        {a.profissional_nome}
                        {a.profissional_conselho ? ` · ${a.profissional_conselho}` : ""} ·{" "}
                        {formatarData(a.emitido_em)}
                      </p>
                    </div>
                    <PrinterIcon className="size-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )
          )}

          {/* Seção: documentos */}
          {secao === "documentos" && (
            <DocumentosPanel
              pacienteId={pacienteId}
              documentos={paciente.documentos}
              onAlterado={recarregarPaciente}
            />
          )}
        </section>
      </div>

      {sheetAberto && itemSelecionado && (
        <EntradaFormSheet
          key={`${emEdicao?.id ?? "novo"}`}
          aberto={sheetAberto}
          pacienteId={pacienteId}
          item={itemSelecionado}
          entrada={emEdicao}
          onFechar={() => setSheetAberto(false)}
          onSalvo={() => {
            setSheetAberto(false)
            if (itemSelecionadoId != null) carregarEntradas(itemSelecionadoId)
          }}
        />
      )}

      {atestadoAberto && (
        <GerarAtestadoModal
          aberto={atestadoAberto}
          pacienteId={pacienteId}
          profissionais={paciente.profissionais_detalhe ?? []}
          onFechar={() => setAtestadoAberto(false)}
          onGerado={(atestadoId) => {
            setAtestadoAberto(false)
            navigate(`/prontuarios/${pacienteId}/atestado/${atestadoId}/impressao`)
          }}
        />
      )}
    </div>
  )
}
