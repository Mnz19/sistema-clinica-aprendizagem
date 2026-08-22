/** Carrega a lista de especialidades ativas (para seleção no cadastro do prestador). */
import { useEffect, useState } from "react"

import { listarEspecialidades } from "@/services/especialidades"
import type { Especialidade } from "@/types/especialidade"

export function useEspecialidades() {
  const [especialidades, setEspecialidades] = useState<Especialidade[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    let ativo = true
    listarEspecialidades()
      .then((lista) => ativo && setEspecialidades(lista))
      .catch(() => ativo && setEspecialidades([]))
      .finally(() => ativo && setCarregando(false))
    return () => {
      ativo = false
    }
  }, [])

  return { especialidades, carregando }
}
