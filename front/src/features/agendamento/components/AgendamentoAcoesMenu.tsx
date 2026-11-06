/** Menu de ações rápidas por linha na listagem de agendamentos. */
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import {
  ArrowRightLeftIcon,
  BanIcon,
  CheckCircleIcon,
  ClipboardCheckIcon,
  EyeIcon,
  MoreHorizontalIcon,
  PlayCircleIcon,
  Trash2Icon,
  UserXIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Agendamento, StatusAgendamento } from "@/types/agendamento"

interface Props {
  agendamento: Agendamento
  onVerEditar: (agendamento: Agendamento) => void
  onStatusRapido: (agendamento: Agendamento, status: StatusAgendamento) => void
  onTransferir?: (agendamento: Agendamento) => void
  /** Exclusão definitiva — só é passada para o super admin (`is_superuser`). */
  onExcluir?: (agendamento: Agendamento) => void
}

/** Só faz sentido transferir agendamentos em aberto (regra do backend). */
const STATUS_TRANSFERIVEIS: StatusAgendamento[] = ["AGENDADO", "PRE_CONFIRMADO", "CONFIRMADO"]

interface ItemMenu {
  rotulo: string
  icone: typeof EyeIcon
  status?: StatusAgendamento
  onClick?: () => void
  separadorAntes?: boolean
  destaque?: "destructive"
}

const LARGURA_MENU = 192 // w-48
const MARGEM_VIEWPORT = 8
const DISTANCIA_TRIGGER = 4

export function AgendamentoAcoesMenu({
  agendamento,
  onVerEditar,
  onStatusRapido,
  onTransferir,
  onExcluir,
}: Props) {
  const [aberto, setAberto] = useState(false)
  const [posicao, setPosicao] = useState({ top: 0, left: 0, maxHeight: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  function atualizarPosicao() {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return

    let left = rect.right - LARGURA_MENU
    left = Math.max(
      MARGEM_VIEWPORT,
      Math.min(left, window.innerWidth - LARGURA_MENU - MARGEM_VIEWPORT)
    )

    // Nas últimas linhas da lista o menu não cabe embaixo: abre para cima.
    // `scrollHeight` dá a altura do conteúdo mesmo com o `maxHeight` já aplicado.
    const alturaMenu = menuRef.current?.scrollHeight ?? 0
    const espacoAbaixo = window.innerHeight - rect.bottom - DISTANCIA_TRIGGER - MARGEM_VIEWPORT
    const espacoAcima = rect.top - DISTANCIA_TRIGGER - MARGEM_VIEWPORT
    const abreParaCima = alturaMenu > espacoAbaixo && espacoAcima > espacoAbaixo

    if (abreParaCima) {
      const maxHeight = espacoAcima
      setPosicao({
        top: rect.top - DISTANCIA_TRIGGER - Math.min(alturaMenu, maxHeight),
        left,
        maxHeight,
      })
      return
    }

    setPosicao({ top: rect.bottom + DISTANCIA_TRIGGER, left, maxHeight: espacoAbaixo })
  }

  useLayoutEffect(() => {
    if (!aberto) return
    atualizarPosicao()
  }, [aberto])

  useEffect(() => {
    if (!aberto) return

    function fecharAoClicarFora(evento: MouseEvent) {
      const alvo = evento.target as Node
      if (triggerRef.current?.contains(alvo) || menuRef.current?.contains(alvo)) return
      setAberto(false)
    }

    function fecharComEscape(evento: KeyboardEvent) {
      if (evento.key === "Escape") setAberto(false)
    }

    function reposicionar() {
      atualizarPosicao()
    }

    document.addEventListener("mousedown", fecharAoClicarFora)
    document.addEventListener("keydown", fecharComEscape)
    window.addEventListener("resize", reposicionar)
    window.addEventListener("scroll", reposicionar, true)

    return () => {
      document.removeEventListener("mousedown", fecharAoClicarFora)
      document.removeEventListener("keydown", fecharComEscape)
      window.removeEventListener("resize", reposicionar)
      window.removeEventListener("scroll", reposicionar, true)
    }
  }, [aberto])

  const itens: ItemMenu[] = [
    {
      rotulo: "Ver / Editar",
      icone: EyeIcon,
      onClick: () => {
        setAberto(false)
        onVerEditar(agendamento)
      },
    },
    ...(onTransferir && STATUS_TRANSFERIVEIS.includes(agendamento.status)
      ? [
          {
            rotulo: "Transferir",
            icone: ArrowRightLeftIcon,
            onClick: () => {
              setAberto(false)
              onTransferir(agendamento)
            },
          } as ItemMenu,
        ]
      : []),
    {
      rotulo: "Confirmar presença",
      icone: CheckCircleIcon,
      status: "CONFIRMADO",
      separadorAntes: true,
    },
    {
      rotulo: "Iniciar atendimento",
      icone: PlayCircleIcon,
      status: "EM_ATENDIMENTO",
    },
    {
      rotulo: "Marcar como atendido",
      icone: ClipboardCheckIcon,
      status: "ATENDIDO",
    },
    {
      rotulo: "Registrar falta",
      icone: UserXIcon,
      status: "FALTA",
      separadorAntes: true,
      destaque: "destructive",
    },
    {
      rotulo: "Desmarcar",
      icone: BanIcon,
      status: "DESMARCADO",
      destaque: "destructive",
    },
    ...(onExcluir
      ? [
          {
            rotulo: "Excluir agendamento",
            icone: Trash2Icon,
            separadorAntes: true,
            destaque: "destructive",
            onClick: () => {
              setAberto(false)
              onExcluir(agendamento)
            },
          } as ItemMenu,
        ]
      : []),
  ]

  function aoSelecionarItem(item: ItemMenu) {
    setAberto(false)
    if (item.onClick) {
      item.onClick()
      return
    }
    if (item.status) {
      onStatusRapido(agendamento, item.status)
    }
  }

  function alternarMenu(evento: React.MouseEvent) {
    evento.stopPropagation()
    setAberto((prev) => !prev)
  }

  const menuPortal =
    aberto &&
    createPortal(
      <div
        ref={menuRef}
        role="menu"
        style={{
          position: "fixed",
          top: posicao.top,
          left: posicao.left,
          maxHeight: posicao.maxHeight || undefined,
        }}
        className="z-50 w-48 overflow-y-auto rounded-md border border-border bg-popover py-1 shadow-lg"
      >
        {itens.map((item) => {
          const Icone = item.icone
          const desabilitado = item.status != null && agendamento.status === item.status

          return (
            <div key={item.rotulo}>
              {item.separadorAntes && <div className="my-1 border-t border-border" />}
              <button
                type="button"
                role="menuitem"
                disabled={desabilitado}
                onClick={(e) => {
                  e.stopPropagation()
                  aoSelecionarItem(item)
                }}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors",
                  "hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50",
                  item.destaque === "destructive"
                    ? "text-destructive hover:bg-destructive/10"
                    : "text-foreground"
                )}
              >
                <Icone className="size-4 shrink-0" />
                {item.rotulo}
              </button>
            </div>
          )
        })}
      </div>,
      document.body
    )

  return (
    <div className="relative inline-block text-left">
      <Button
        ref={triggerRef}
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-expanded={aberto}
        aria-haspopup="menu"
        title="Ações"
        onClick={alternarMenu}
      >
        <MoreHorizontalIcon className="size-4" />
      </Button>
      {menuPortal}
    </div>
  )
}
