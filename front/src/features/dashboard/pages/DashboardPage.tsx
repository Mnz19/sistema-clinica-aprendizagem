/**
 * Painel inicial (Recepção).
 *
 * Reúne uma visão rápida da operação da clínica a partir dos dados já
 * disponíveis na API (cadastro de pacientes e equipe): indicadores-chave,
 * pacientes recém-atualizados (com atalho ao prontuário) e aniversariantes do
 * mês.
 */
import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import type { LucideIcon } from "lucide-react"
import {
  ArrowUpRightIcon,
  CakeIcon,
  FileTextIcon,
  PlusIcon,
  ShieldCheckIcon,
  UserRoundCheckIcon,
  UserRoundXIcon,
  UsersIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/hooks/useAuth"
import { listarPacientes } from "@/services/pacientes"
import { listarUsuarios } from "@/services/usuarios"
import { mensagemDeErro } from "@/utils/apiError"
import { PAPEL_LABELS, temPapel } from "@/types/auth"
import { PAPEIS_GESTORES } from "@/types/usuario"
import { PAPEIS_PRONTUARIO } from "@/types/prontuario"
import type { PacienteListItem } from "@/types/paciente"

/** Saudação conforme o horário do dia. */
function saudacao(hora: number): string {
  if (hora < 12) return "Bom dia"
  if (hora < 18) return "Boa tarde"
  return "Boa noite"
}

/** Primeiro nome, para um cumprimento mais pessoal. */
function primeiroNome(nome?: string): string {
  return nome?.trim().split(/\s+/)[0] ?? "por aqui"
}

/** Data por extenso em pt-BR (ex.: "segunda-feira, 13 de julho de 2026"). */
function dataPorExtenso(d: Date): string {
  const texto = d.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

/** Dia do mês (1–31) a partir de uma data ISO `YYYY-MM-DD`. */
function diaDoMes(iso: string): number {
  return Number(iso.slice(8, 10))
}

interface Stat {
  label: string
  valor: number | string
  hint: string
  icon: LucideIcon
  to?: string
  atencao?: boolean
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const ehGestor = temPapel(user, ...PAPEIS_GESTORES)
  const podeProntuario = temPapel(user, ...PAPEIS_PRONTUARIO)

  const [pacientes, setPacientes] = useState<PacienteListItem[]>([])
  const [equipeAtiva, setEquipeAtiva] = useState<number | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const agora = useMemo(() => new Date(), [])

  useEffect(() => {
    let ativo = true
    async function carregar() {
      setCarregando(true)
      setErro(null)
      // Equipe só é consultada por gestores (a rota /usuarios é restrita a eles).
      const equipe = ehGestor
        ? listarUsuarios({ is_active: true }).then((u) => u.length).catch(() => null)
        : Promise.resolve<number | null>(null)
      try {
        const [listaPacientes, totalEquipe] = await Promise.all([
          listarPacientes(),
          equipe,
        ])
        if (!ativo) return
        setPacientes(listaPacientes)
        setEquipeAtiva(totalEquipe)
      } catch (e) {
        if (ativo) setErro(mensagemDeErro(e))
      } finally {
        if (ativo) setCarregando(false)
      }
    }
    carregar()
    return () => {
      ativo = false
    }
  }, [ehGestor])

  // Indicadores derivados da lista de pacientes (uma única requisição).
  const { total, comVinculo, semVinculo, aniversariantes, recentes } = useMemo(() => {
    const total = pacientes.length
    const comVinculo = pacientes.filter((p) => p.profissionais.length > 0).length
    const mesAtual = agora.getMonth() + 1 // 1–12

    const aniversariantes = pacientes
      .filter((p) => Number(p.data_nascimento?.slice(5, 7)) === mesAtual)
      .sort((a, b) => diaDoMes(a.data_nascimento) - diaDoMes(b.data_nascimento))

    const recentes = [...pacientes]
      .sort((a, b) => b.atualizado_em.localeCompare(a.atualizado_em))
      .slice(0, 6)

    return {
      total,
      comVinculo,
      semVinculo: total - comVinculo,
      aniversariantes,
      recentes,
    }
  }, [pacientes, agora])

  const stats: Stat[] = [
    {
      label: "Pacientes ativos",
      valor: total,
      hint: "cadastro total",
      icon: UsersIcon,
      to: "/pacientes",
    },
    {
      label: "Sem profissional",
      valor: semVinculo,
      hint: semVinculo > 0 ? "aguardando vínculo" : "tudo vinculado",
      icon: UserRoundXIcon,
      to: "/pacientes",
      atencao: semVinculo > 0,
    },
    {
      label: "Aniversariantes",
      valor: aniversariantes.length,
      hint: "neste mês",
      icon: CakeIcon,
    },
    ehGestor
      ? {
          label: "Equipe ativa",
          valor: equipeAtiva ?? "—",
          hint: "profissionais e staff",
          icon: ShieldCheckIcon,
          to: "/usuarios",
        }
      : {
          label: "Em acompanhamento",
          valor: comVinculo,
          hint: "com profissional",
          icon: UserRoundCheckIcon,
          to: "/pacientes",
        },
  ]

  return (
    <div className="space-y-6">
      {/* Cabeçalho de boas-vindas */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {saudacao(agora.getHours())}, {primeiroNome(user?.nome)}.
          </h1>
          <p className="text-sm text-muted-foreground">
            {user && (
              <span className="font-medium text-foreground">
                {PAPEL_LABELS[user.role]}
              </span>
            )}
            {user && " · "}
            {dataPorExtenso(agora)}
          </p>
        </div>
        <Button onClick={() => navigate("/pacientes/novo")}>
          <PlusIcon className="size-4" /> Novo paciente
        </Button>
      </header>

      {erro && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {erro}
        </div>
      )}

      {/* Indicadores */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <StatCard key={s.label} stat={s} carregando={carregando} onNavegar={navigate} />
        ))}
      </div>

      {/* Recentes + aniversariantes */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Pacientes recentes */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <UsersIcon className="size-4 text-muted-foreground" />
              Atividade recente
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/pacientes")}
              className="text-muted-foreground"
            >
              Ver todos <ArrowUpRightIcon className="size-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="px-2">
            {carregando ? (
              <div className="space-y-1 px-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : recentes.length === 0 ? (
              <EmptyState
                icon={UsersIcon}
                titulo="Nenhum paciente ainda"
                descricao="Cadastre o primeiro paciente para começar."
              />
            ) : (
              <ul>
                {recentes.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-1 rounded-lg pr-2 transition-colors hover:bg-muted/60"
                  >
                    <button
                      type="button"
                      onClick={() => navigate(`/pacientes/${p.id}`)}
                      className="flex min-w-0 flex-1 items-center gap-3 px-2 py-2 text-left"
                    >
                      <Avatar nome={p.nome_completo} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {p.nome_completo}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {p.idade != null ? `${p.idade} anos` : "Idade —"}
                          {p.profissionais.length > 0 &&
                            ` · ${p.profissionais.map((prof) => prof.nome).join(", ")}`}
                        </p>
                      </div>
                      {p.profissionais.length === 0 && (
                        <Badge variant="destructive">Sem vínculo</Badge>
                      )}
                    </button>
                    {podeProntuario && (
                      <button
                        type="button"
                        onClick={() => navigate(`/prontuarios/${p.id}`)}
                        title="Abrir prontuário"
                        className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                      >
                        <FileTextIcon className="size-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Aniversariantes do mês */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CakeIcon className="size-4 text-muted-foreground" />
              Aniversariantes do mês
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2">
            {carregando ? (
              <div className="space-y-1 px-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : aniversariantes.length === 0 ? (
              <EmptyState
                icon={CakeIcon}
                titulo="Nenhum aniversário"
                descricao="Não há aniversariantes neste mês."
              />
            ) : (
              <ul>
                {aniversariantes.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => navigate(`/pacientes/${p.id}`)}
                      className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted/60"
                    >
                      <span className="flex size-9 shrink-0 flex-col items-center justify-center rounded-lg bg-muted text-foreground">
                        <span className="text-sm font-semibold leading-none">
                          {diaDoMes(p.data_nascimento)}
                        </span>
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {p.nome_completo}
                        </p>
                        {p.idade != null && (
                          <p className="text-xs text-muted-foreground">
                            faz {p.idade + 1} anos
                          </p>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

/** Cartão de indicador (KPI). Vira link quando `stat.to` está definido. */
function StatCard({
  stat,
  carregando,
  onNavegar,
}: {
  stat: Stat
  carregando: boolean
  onNavegar: (to: string) => void
}) {
  const { label, valor, hint, icon: Icon, to, atencao } = stat
  const clicavel = !!to

  return (
    <Card
      onClick={clicavel ? () => onNavegar(to!) : undefined}
      className={clicavel ? "cursor-pointer transition-shadow hover:ring-foreground/20" : ""}
    >
      <CardContent className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{label}</p>
          {carregando ? (
            <Skeleton className="h-8 w-12" />
          ) : (
            <p className="text-3xl font-semibold tracking-tight text-foreground">
              {valor}
            </p>
          )}
          <p className={atencao ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
            {hint}
          </p>
        </div>
        <span
          className={
            atencao
              ? "flex size-9 items-center justify-center rounded-lg bg-destructive/10 text-destructive"
              : "flex size-9 items-center justify-center rounded-lg bg-muted text-foreground"
          }
        >
          <Icon className="size-5" />
        </span>
      </CardContent>
    </Card>
  )
}

/** Estado vazio compacto para as listas do painel. */
function EmptyState({
  icon: Icon,
  titulo,
  descricao,
}: {
  icon: LucideIcon
  titulo: string
  descricao: string
}) {
  return (
    <div className="flex flex-col items-center gap-1 px-4 py-10 text-center">
      <Icon className="mb-1 size-8 text-muted-foreground/40" />
      <p className="text-sm font-medium text-foreground">{titulo}</p>
      <p className="text-xs text-muted-foreground">{descricao}</p>
    </div>
  )
}
