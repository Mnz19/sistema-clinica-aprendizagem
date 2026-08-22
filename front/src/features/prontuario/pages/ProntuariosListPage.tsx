/** Lista de prontuários: agenda de hoje (meus pacientes) + todos os pacientes. */
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { CalendarDaysIcon, FileTextIcon, SearchIcon } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs } from "@/components/ui/tabs"
import type { TabItem } from "@/components/ui/tabs"
import { mensagemDeErro } from "@/utils/apiError"
import { formatarData } from "@/utils/format"
import { useAuthStore } from "@/store/authStore"
import { listarPacientes } from "@/services/pacientes"
import { listarAgendamentos } from "@/services/agendamento"
import type { PacienteListItem } from "@/types/paciente"
import type { Agendamento } from "@/types/agendamento"

const ABAS: TabItem[] = [
  { id: "hoje", label: "Hoje", icon: CalendarDaysIcon },
  { id: "todos", label: "Todos", icon: FileTextIcon },
]

/** Data local de hoje no formato YYYY-MM-DD (respeita o fuso do navegador). */
function hojeLocal(): string {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

function corStatus(status: string): "secondary" | "outline" | "destructive" {
  if (status === "ATENDIDO") return "secondary"
  if (status === "FALTA" || status === "DESMARCADO") return "destructive"
  return "outline"
}

export default function ProntuariosListPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [aba, setAba] = useState("hoje")

  // Aba "Hoje"
  const [agenda, setAgenda] = useState<Agendamento[]>([])
  const [carregandoAgenda, setCarregandoAgenda] = useState(true)

  // Aba "Todos"
  const [busca, setBusca] = useState("")
  const [pacientes, setPacientes] = useState<PacienteListItem[]>([])
  const [carregandoPacientes, setCarregandoPacientes] = useState(true)

  const [erro, setErro] = useState<string | null>(null)

  // Agenda de hoje (meus pacientes), ordenada por horário.
  useEffect(() => {
    let ativo = true
    async function carregar() {
      setCarregandoAgenda(true)
      setErro(null)
      try {
        // Busca a agenda de hoje e filtra pelos MEUS atendimentos no cliente.
        // (O filtro ``profissional=`` do backend só aceita papel PROFISSIONAL;
        // filtrando aqui, funciona para qualquer papel — inclusive DIREÇÃO que
        // também atende.) O PROFISSIONAL já vem isolado na própria agenda.
        const lista = await listarAgendamentos({
          data: hojeLocal(),
          ordering: "horario_inicio",
        })
        if (ativo) {
          setAgenda(
            lista.filter(
              (a) =>
                a.status !== "DESMARCADO" &&
                (user?.id == null || a.profissional === user.id)
            )
          )
        }
      } catch (e) {
        if (ativo) setErro(mensagemDeErro(e))
      } finally {
        if (ativo) setCarregandoAgenda(false)
      }
    }
    carregar()
    return () => {
      ativo = false
    }
  }, [user?.id])

  // Todos os pacientes (com busca), carregado ao entrar na aba.
  useEffect(() => {
    if (aba !== "todos") return
    const timer = setTimeout(() => {
      setCarregandoPacientes(true)
      setErro(null)
      listarPacientes({ search: busca })
        .then(setPacientes)
        .catch((e) => setErro(mensagemDeErro(e)))
        .finally(() => setCarregandoPacientes(false))
    }, 300)
    return () => clearTimeout(timer)
  }, [aba, busca])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-foreground">
          <FileTextIcon className="size-5" /> Prontuários
        </h1>
        <p className="text-sm text-muted-foreground">
          Seus pacientes de hoje em ordem de horário — ou busque em todos os prontuários.
        </p>
      </div>

      <Tabs itens={ABAS} ativo={aba} onChange={setAba} />

      {erro && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {erro}
        </div>
      )}

      {/* ABA HOJE */}
      {aba === "hoje" && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Horário</th>
                <th className="px-4 py-2.5 font-medium">Paciente</th>
                <th className="hidden px-4 py-2.5 font-medium md:table-cell">Serviço</th>
                <th className="px-4 py-2.5 font-medium">Situação</th>
              </tr>
            </thead>
            <tbody>
              {carregandoAgenda ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="px-4 py-3" colSpan={4}>
                      <Skeleton className="h-5 w-full" />
                    </td>
                  </tr>
                ))
              ) : agenda.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center">
                    <p className="text-sm text-muted-foreground">
                      Nenhum paciente agendado para hoje.
                    </p>
                  </td>
                </tr>
              ) : (
                agenda.map((a) => (
                  <tr
                    key={a.id}
                    onClick={() => navigate(`/prontuarios/${a.paciente}`)}
                    className="cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-muted/40"
                  >
                    <td className="px-4 py-3 font-medium tabular-nums text-foreground">
                      {a.horario_inicio.slice(0, 5)}
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">{a.paciente_nome}</td>
                    <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                      {a.servico_nome}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={corStatus(a.status)}>{a.status_display}</Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ABA TODOS */}
      {aba === "todos" && (
        <div className="space-y-4">
          <div className="relative max-w-sm">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar paciente por nome ou CPF…"
              className="pl-8"
            />
          </div>

          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Paciente</th>
                  <th className="px-4 py-2.5 font-medium">Nascimento</th>
                  <th className="hidden px-4 py-2.5 font-medium md:table-cell">Profissionais</th>
                </tr>
              </thead>
              <tbody>
                {carregandoPacientes ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="px-4 py-3" colSpan={3}>
                        <Skeleton className="h-5 w-full" />
                      </td>
                    </tr>
                  ))
                ) : pacientes.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-12 text-center">
                      <p className="text-sm text-muted-foreground">Nenhum paciente encontrado.</p>
                    </td>
                  </tr>
                ) : (
                  pacientes.map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => navigate(`/prontuarios/${p.id}`)}
                      className="cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-muted/40"
                    >
                      <td className="px-4 py-3 font-medium text-foreground">{p.nome_completo}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatarData(p.data_nascimento)}
                      </td>
                      <td className="hidden px-4 py-3 md:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {p.profissionais.length === 0 ? (
                            <span className="text-xs text-muted-foreground">Sem vínculo</span>
                          ) : (
                            p.profissionais.map((prof) => (
                              <Badge key={prof.id} variant="secondary">
                                {prof.nome}
                              </Badge>
                            ))
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
