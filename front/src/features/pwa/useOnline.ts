import { useSyncExternalStore } from "react"

function assinar(aoMudar: () => void) {
  window.addEventListener("online", aoMudar)
  window.addEventListener("offline", aoMudar)
  return () => {
    window.removeEventListener("online", aoMudar)
    window.removeEventListener("offline", aoMudar)
  }
}

/** `true` enquanto o dispositivo tem conexão de rede. */
export function useOnline() {
  return useSyncExternalStore(assinar, () => navigator.onLine, () => true)
}
