/**
 * Anotações colaborativas de uma entrada da linha do tempo.
 *
 * Um único componente cobre os dois tipos: `OBSERVACAO` (exibida acima do
 * registro, com destaque) e `COMENTARIO` (thread no rodapé). Qualquer
 * profissional com acesso ao prontuário pode adicionar; editar/excluir é
 * restrito ao autor da anotação (`pode_editar`).
 */
import { useState } from "react"
import {
  CheckIcon,
  MessageSquareIcon,
  PencilIcon,
  PlusIcon,
  StickyNoteIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Avatar } from "@/components/ui/avatar"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { mensagemDeErro } from "@/utils/apiError"
import { formatarDataHora } from "@/utils/format"
import {
  atualizarComentario,
  criarComentario,
  removerComentario,
} from "@/services/prontuario"
import type { ComentarioEntrada, TipoComentario } from "@/types/prontuario"

interface Props {
  entradaId: number
  tipo: TipoComentario
  itens: ComentarioEntrada[]
  onAlterado: () => void
}

const CONFIG: Record<
  TipoComentario,
  { label: string; adicionar: string; placeholder: string; icon: typeof StickyNoteIcon }
> = {
  OBSERVACAO: {
    label: "Observações",
    adicionar: "Adicionar observação",
    placeholder: "Escreva uma observação sobre este registro…",
    icon: StickyNoteIcon,
  },
  COMENTARIO: {
    label: "Comentários",
    adicionar: "Comentar",
    placeholder: "Escreva um comentário…",
    icon: MessageSquareIcon,
  },
}

export function AnotacoesEntrada({ entradaId, tipo, itens, onAlterado }: Props) {
  const cfg = CONFIG[tipo]
  const ehObservacao = tipo === "OBSERVACAO"

  const [adicionando, setAdicionando] = useState(false)
  const [novoTexto, setNovoTexto] = useState("")
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [textoEdicao, setTextoEdicao] = useState("")
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function handleCriar() {
    if (!novoTexto.trim()) return
    setOcupado(true)
    setErro(null)
    try {
      await criarComentario({ entrada: entradaId, tipo, texto: novoTexto.trim() })
      setNovoTexto("")
      setAdicionando(false)
      onAlterado()
    } catch (e) {
      setErro(mensagemDeErro(e))
    } finally {
      setOcupado(false)
    }
  }

  async function handleSalvarEdicao(id: number) {
    if (!textoEdicao.trim()) return
    setOcupado(true)
    setErro(null)
    try {
      await atualizarComentario(id, { texto: textoEdicao.trim() })
      setEditandoId(null)
      onAlterado()
    } catch (e) {
      setErro(mensagemDeErro(e))
    } finally {
      setOcupado(false)
    }
  }

  async function handleExcluir(id: number) {
    setOcupado(true)
    setErro(null)
    try {
      await removerComentario(id)
      onAlterado()
    } catch (e) {
      setErro(mensagemDeErro(e))
    } finally {
      setOcupado(false)
    }
  }

  // Observação sem itens e sem estar adicionando: só o botão discreto.
  const vazio = itens.length === 0

  return (
    <div
      className={cn(
        ehObservacao
          ? "rounded-lg border border-amber-300/70 bg-amber-50/60 px-3 py-2 dark:border-amber-500/30 dark:bg-amber-500/5"
          : "space-y-2"
      )}
    >
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <cfg.icon className={cn("size-3.5", ehObservacao && "text-amber-600 dark:text-amber-400")} />
        <span className={cn(ehObservacao && "text-amber-700 dark:text-amber-300")}>{cfg.label}</span>
        {!vazio && <span className="text-muted-foreground/70">· {itens.length}</span>}
      </div>

      {!vazio && (
        <ul className={cn("space-y-2", ehObservacao ? "mt-1.5" : "")}>
          {itens.map((item) => (
            <li key={item.id} className="flex gap-2">
              <Avatar
                nome={item.autor_nome ?? undefined}
                foto={item.autor_foto}
                className="mt-0.5 size-6"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="text-xs font-medium text-foreground">
                    {item.autor_nome ?? "Autor removido"}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {formatarDataHora(item.criado_em)}
                    {item.atualizado_em !== item.criado_em && " · editado"}
                  </span>
                </div>

                {editandoId === item.id ? (
                  <div className="mt-1 space-y-1.5">
                    <Textarea
                      value={textoEdicao}
                      onChange={(e) => setTextoEdicao(e.target.value)}
                      className="min-h-16 text-sm"
                      autoFocus
                    />
                    <div className="flex items-center gap-1">
                      <Button
                        size="xs"
                        onClick={() => handleSalvarEdicao(item.id)}
                        disabled={ocupado || !textoEdicao.trim()}
                      >
                        <CheckIcon className="size-3.5" /> Salvar
                      </Button>
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => setEditandoId(null)}
                        disabled={ocupado}
                      >
                        <XIcon className="size-3.5" /> Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="group/anotacao flex items-start justify-between gap-2">
                    <p className="whitespace-pre-wrap text-sm text-foreground">{item.texto}</p>
                    {item.pode_editar && (
                      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/anotacao:opacity-100">
                        <button
                          type="button"
                          onClick={() => {
                            setEditandoId(item.id)
                            setTextoEdicao(item.texto)
                          }}
                          className="text-muted-foreground hover:text-foreground"
                          title="Editar"
                        >
                          <PencilIcon className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleExcluir(item.id)}
                          disabled={ocupado}
                          className="text-muted-foreground hover:text-destructive"
                          title="Excluir"
                        >
                          <Trash2Icon className="size-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {adicionando ? (
        <div className={cn("space-y-1.5", !vazio && "mt-2")}>
          <Textarea
            value={novoTexto}
            onChange={(e) => setNovoTexto(e.target.value)}
            placeholder={cfg.placeholder}
            className="min-h-16 text-sm"
            autoFocus
          />
          <div className="flex items-center gap-1">
            <Button size="xs" onClick={handleCriar} disabled={ocupado || !novoTexto.trim()}>
              <CheckIcon className="size-3.5" /> Salvar
            </Button>
            <Button
              size="xs"
              variant="ghost"
              onClick={() => {
                setAdicionando(false)
                setNovoTexto("")
                setErro(null)
              }}
              disabled={ocupado}
            >
              <XIcon className="size-3.5" /> Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <Button
          size="xs"
          variant="ghost"
          onClick={() => setAdicionando(true)}
          className={cn("text-muted-foreground", !vazio && "mt-1")}
        >
          <PlusIcon className="size-3.5" /> {cfg.adicionar}
        </Button>
      )}

      {erro && <p className="mt-1 text-xs text-destructive">{erro}</p>}
    </div>
  )
}
