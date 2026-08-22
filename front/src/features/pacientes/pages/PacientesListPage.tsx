/** Página de listagem e busca de pacientes. */
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { PlusIcon, SearchIcon, UsersIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { mensagemDeErro } from "@/utils/apiError"
import { formatarData } from "@/utils/format"
import { listarPacientes } from "@/services/pacientes"
import type { PacienteListItem } from "@/types/paciente"

export default function PacientesListPage() {
  const navigate = useNavigate()
  const [busca, setBusca] = useState("")
  const [pacientes, setPacientes] = useState<PacienteListItem[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      setCarregando(true)
      setErro(null)
      listarPacientes({ search: busca })
        .then(setPacientes)
        .catch((e) => setErro(mensagemDeErro(e)))
        .finally(() => setCarregando(false))
    }, 300)
    return () => clearTimeout(timer)
  }, [busca])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Pacientes
          </h1>
          <p className="text-sm text-muted-foreground">
            Cadastro de pacientes da clínica.
          </p>
        </div>
        <Button onClick={() => navigate("/pacientes/novo")}>
          <PlusIcon className="size-4" /> Novo paciente
        </Button>
      </div>

      <div className="relative max-w-sm">
        <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome, CPF ou e-mail…"
          className="pl-8"
        />
      </div>

      {erro && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {erro}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">Nome</th>
              <th className="px-4 py-2.5 font-medium">Nascimento</th>
              <th className="px-4 py-2.5 font-medium">Profissionais</th>
              <th className="hidden px-4 py-2.5 font-medium md:table-cell">
                Atualizado
              </th>
            </tr>
          </thead>
          <tbody>
            {carregando ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="px-4 py-3" colSpan={4}>
                    <Skeleton className="h-5 w-full" />
                  </td>
                </tr>
              ))
            ) : pacientes.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center">
                  <UsersIcon className="mx-auto mb-2 size-8 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">
                    {busca
                      ? "Nenhum paciente encontrado para a busca."
                      : "Nenhum paciente cadastrado ainda."}
                  </p>
                </td>
              </tr>
            ) : (
              pacientes.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => navigate(`/pacientes/${p.id}`)}
                  className="cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-muted/40"
                >
                  <td className="px-4 py-3">
                    <span className="font-medium text-foreground">
                      {p.nome_completo}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatarData(p.data_nascimento)}
                    {p.idade != null && (
                      <span className="ml-1 text-xs">({p.idade} anos)</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {p.profissionais.length === 0 ? (
                        <span className="text-xs text-muted-foreground">
                          Sem vínculo
                        </span>
                      ) : (
                        p.profissionais.map((prof) => (
                          <Badge key={prof.id} variant="secondary">
                            {prof.nome}
                          </Badge>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                    {formatarData(p.atualizado_em)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
