/** Aba de itens de prontuário: itens fixos (toggle) + personalizados (CRUD). */
import { useCallback, useEffect, useState } from "react"
import {
  ChevronDownIcon,
  ChevronUpIcon,
  Loader2Icon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { mensagemDeErro } from "@/utils/apiError"
import {
  atualizarItem,
  listarItens,
  provisionarFixos,
  removerItem,
  reordenarItens,
} from "@/services/prontuario"
import { CriadorItemSheet } from "@/features/prontuario/components/config/CriadorItemSheet"
import type { ItemProntuario } from "@/types/prontuario"

export function ItensTab({ profissionalId }: { profissionalId: number }) {
  const [itens, setItens] = useState<ItemProntuario[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [sheetAberto, setSheetAberto] = useState(false)
  const [emEdicao, setEmEdicao] = useState<ItemProntuario | null>(null)

  const carregar = useCallback(() => {
    setCarregando(true)
    listarItens(profissionalId)
      .then(setItens)
      .catch((e) => setErro(mensagemDeErro(e)))
      .finally(() => setCarregando(false))
  }, [profissionalId])

  useEffect(() => {
    let ativo = true
    async function inicial() {
      setCarregando(true)
      try {
        // Garante que os itens fixos do sistema existam para este profissional.
        await provisionarFixos(profissionalId)
        const d = await listarItens(profissionalId)
        if (ativo) setItens(d)
      } catch (e) {
        if (ativo) setErro(mensagemDeErro(e))
      } finally {
        if (ativo) setCarregando(false)
      }
    }
    inicial()
    return () => {
      ativo = false
    }
  }, [profissionalId])

  const fixos = itens.filter((i) => i.tipo_item === "FIXO")
  const personalizados = itens.filter((i) => i.tipo_item !== "FIXO")

  async function alternarVisivel(item: ItemProntuario) {
    // Atualização otimista.
    setItens((lista) =>
      lista.map((i) => (i.id === item.id ? { ...i, visivel: !i.visivel } : i))
    )
    try {
      await atualizarItem(item.id, { visivel: !item.visivel })
    } catch (e) {
      setErro(mensagemDeErro(e))
      carregar()
    }
  }

  async function mover(index: number, delta: number) {
    const alvo = index + delta
    if (alvo < 0 || alvo >= personalizados.length) return
    const copia = [...personalizados]
    ;[copia[index], copia[alvo]] = [copia[alvo], copia[index]]
    // Recombina mantendo os fixos no início.
    setItens([...fixos, ...copia])
    try {
      await reordenarItens(
        copia.map((i, ordem) => ({ id: i.id, ordem: fixos.length + ordem }))
      )
    } catch (e) {
      setErro(mensagemDeErro(e))
      carregar()
    }
  }

  async function excluir(id: number) {
    try {
      await removerItem(id)
      carregar()
    } catch (e) {
      setErro(mensagemDeErro(e))
    }
  }

  if (carregando) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2Icon className="size-4 animate-spin" /> Carregando…
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {erro && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {erro}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Itens fixos */}
        <div>
          <h3 className="mb-3 text-lg font-medium">Itens fixos</h3>
          <div className="overflow-hidden rounded-lg border border-border">
            <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3 py-2 text-xs font-medium uppercase text-muted-foreground">
              <span>Descrição</span>
              <span>Exibir</span>
            </div>
            {fixos.map((item) => (
              <label
                key={item.id}
                className="flex cursor-pointer items-center justify-between border-b border-border px-3 py-2.5 last:border-0 hover:bg-muted/30"
              >
                <span className="text-sm">{item.nome}</span>
                <input
                  type="checkbox"
                  checked={item.visivel}
                  onChange={() => alternarVisivel(item)}
                  className="size-4 rounded border-input"
                />
              </label>
            ))}
          </div>
        </div>

        {/* Itens personalizados */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-medium">Itens personalizados</h3>
            <Button
              size="sm"
              onClick={() => {
                setEmEdicao(null)
                setSheetAberto(true)
              }}
            >
              <PlusIcon className="size-4" /> Novo
            </Button>
          </div>

          {personalizados.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border py-12 text-center">
              <p className="text-sm text-muted-foreground">
                Nenhum item personalizado. Crie um novo ou importe um protocolo pronto.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {personalizados.map((item, index) => (
                <div
                  key={item.id}
                  className="flex items-center gap-2 rounded-lg border border-border p-3"
                >
                  <div className="flex flex-col gap-0.5">
                    <button
                      type="button"
                      onClick={() => mover(index, -1)}
                      disabled={index === 0}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                    >
                      <ChevronUpIcon className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => mover(index, 1)}
                      disabled={index === personalizados.length - 1}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                    >
                      <ChevronDownIcon className="size-4" />
                    </button>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={item.visivel ? "font-medium" : "font-medium text-muted-foreground line-through"}>
                        {item.nome}
                      </span>
                      <Badge variant="secondary">{item.tipo_item_display}</Badge>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => {
                        setEmEdicao(item)
                        setSheetAberto(true)
                      }}
                      title="Editar"
                    >
                      <PencilIcon className="size-3.5" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger
                        className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        title="Excluir"
                      >
                        <Trash2Icon className="size-3.5" />
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir item?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Itens com registros preenchidos não podem ser excluídos. Esta ação
                            não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => excluir(item.id)}
                            className="bg-destructive text-white hover:bg-destructive/90"
                          >
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {sheetAberto && (
        <CriadorItemSheet
          key={emEdicao?.id ?? "novo"}
          aberto={sheetAberto}
          profissionalId={profissionalId}
          item={emEdicao}
          onFechar={() => setSheetAberto(false)}
          onSalvo={() => {
            setSheetAberto(false)
            carregar()
          }}
        />
      )}
    </div>
  )
}
