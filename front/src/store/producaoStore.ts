/**
 * Store de produção (Zustand): consulta do ledger financeiro.
 */
import { create } from "zustand"

import { getProducoes } from "@/services/producao"
import { mensagemDeErro } from "@/utils/apiError"
import type { Producao, ProducaoFiltros } from "@/types/producao"

interface ProducaoState {
  producoes: Producao[]
  carregando: boolean
  erro: string | null
  buscarProducoes: (filtros?: ProducaoFiltros) => Promise<void>
}

export const useProducaoStore = create<ProducaoState>()((set) => ({
  producoes: [],
  carregando: false,
  erro: null,

  buscarProducoes: async (filtros = {}) => {
    set({ carregando: true, erro: null })
    try {
      const producoes = await getProducoes(filtros)
      set({ producoes })
    } catch (erro) {
      console.error("[producaoStore] buscarProducoes:", erro)
      set({ erro: mensagemDeErro(erro), producoes: [] })
    } finally {
      set({ carregando: false })
    }
  },
}))
