/**
 * Store do PWA (Zustand): registro do service worker e atualização do sistema.
 *
 * Fluxo: a versão nova é baixada em segundo plano e fica "em espera"; o app
 * avisa (`temAtualizacao`) e só troca de versão quando o usuário pede — nunca
 * recarrega sozinho no meio de um formulário. Instalado como app (standalone)
 * não existe o botão de recarregar do navegador, então `recarregar()` faz esse
 * papel: aplica a versão nova se houver, senão apenas recarrega a página.
 */
import { create } from "zustand"
import { registerSW } from "virtual:pwa-register"

/** De quanto em quanto tempo o app aberto procura uma versão nova. */
const INTERVALO_VERIFICACAO_MS = 15 * 60 * 1000
/** Tempo máximo esperando o download/instalação da versão nova. */
const TIMEOUT_INSTALACAO_MS = 15_000
/** Tempo máximo esperando a versão nova assumir a página antes de recarregar. */
const TIMEOUT_ATIVACAO_MS = 10_000

interface PwaState {
  temAtualizacao: boolean
  avisoDispensado: boolean
  isRecarregando: boolean

  dispensarAviso: () => void
  recarregar: () => Promise<void>
}

type AplicarAtualizacao = (reloadPage?: boolean) => Promise<void>

let aplicarAtualizacao: AplicarAtualizacao | null = null
let registro: ServiceWorkerRegistration | undefined

/** Resolve quando o worker sai da instalação (em espera, descartado ou timeout). */
function aguardarInstalacao(worker: ServiceWorker): Promise<void> {
  if (worker.state !== "installing") return Promise.resolve()
  return new Promise((resolve) => {
    const finalizar = () => {
      window.clearTimeout(timer)
      worker.removeEventListener("statechange", finalizar)
      resolve()
    }
    const timer = window.setTimeout(finalizar, TIMEOUT_INSTALACAO_MS)
    worker.addEventListener("statechange", finalizar)
  })
}

/** Pergunta ao servidor se há versão nova e espera ela terminar de baixar. */
async function verificarAtualizacao(): Promise<void> {
  if (!registro || !navigator.onLine) return
  try {
    await registro.update()
  } catch (erro) {
    console.warn("[PWA] Falha ao verificar atualização:", erro)
    return
  }
  if (registro.installing) await aguardarInstalacao(registro.installing)
}

/**
 * Ativa a versão em espera e resolve quando ela assumir esta página
 * (`controllerchange`) — recarregar antes disso traria a versão antiga.
 */
function ativarVersaoEmEspera(): Promise<void> {
  const aplicar = aplicarAtualizacao
  if (!registro?.waiting || !aplicar) return Promise.resolve()
  return new Promise((resolve) => {
    const timer = window.setTimeout(resolve, TIMEOUT_ATIVACAO_MS)
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      () => {
        window.clearTimeout(timer)
        resolve()
      },
      { once: true },
    )
    void aplicar(false)
  })
}

export const usePwaStore = create<PwaState>((set, get) => ({
  temAtualizacao: false,
  avisoDispensado: false,
  isRecarregando: false,

  dispensarAviso: () => set({ avisoDispensado: true }),

  recarregar: async () => {
    set({ isRecarregando: true })
    if (!get().temAtualizacao) await verificarAtualizacao()
    await ativarVersaoEmEspera()
    window.location.reload()
  },
}))

function agendarVerificacoes() {
  const verificar = () => void verificarAtualizacao()
  window.setInterval(verificar, INTERVALO_VERIFICACAO_MS)
  // No celular o app passa horas em segundo plano: confere ao voltar para ele
  // e reexibe o aviso que o usuário tenha dispensado com "Depois".
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return
    usePwaStore.setState({ avisoDispensado: false })
    verificar()
  })
}

/** Registra o service worker. Chamado uma vez em `main.tsx`. */
export function iniciarPwa() {
  if (!import.meta.env.PROD) return
  const avisarVersaoNova = () =>
    usePwaStore.setState({ temAtualizacao: true, avisoDispensado: false })
  aplicarAtualizacao = registerSW({
    immediate: true,
    onNeedRefresh: avisarVersaoNova,
    // Versão nova ativada por OUTRA aba/janela: só avisa. Sem isto o plugin
    // recarregaria esta aba sozinho e um prontuário aberto aqui se perderia.
    // A aba que pediu a atualização recarrega em `recarregar()`.
    onNeedReload: avisarVersaoNova,
    onRegisteredSW: (_swUrl, reg) => {
      registro = reg
      agendarVerificacoes()
    },
    onRegisterError: (erro) => console.error("[PWA] Falha ao registrar o service worker:", erro),
  })
}
