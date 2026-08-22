/** Carrega, uma vez, a lista de profissionais disponíveis para vínculo. */
import { useEffect, useState } from "react"

import { listarProfissionais } from "@/services/pacientes"
import type { ProfissionalResumo } from "@/types/paciente"

export function useProfissionais() {
  const [profissionais, setProfissionais] = useState<ProfissionalResumo[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    let ativo = true
    listarProfissionais()
      .then((lista) => ativo && setProfissionais(lista))
      .catch(() => ativo && setProfissionais([]))
      .finally(() => ativo && setCarregando(false))
    return () => {
      ativo = false
    }
  }, [])

  return { profissionais, carregando }
}
