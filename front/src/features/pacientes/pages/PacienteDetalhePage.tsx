/** Página de detalhe do paciente: cadastro, responsáveis e anexos. */
import { useCallback, useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  ArrowLeftIcon,
  FileTextIcon,
  Loader2Icon,
  PencilIcon,
  UserXIcon,
  UserCheckIcon,
} from "lucide-react"

import { Avatar } from "@/components/ui/avatar"
import { Button, buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
import { formatarCep, formatarCpf, formatarData, formatarTelefone } from "@/utils/format"
import { useAuthStore } from "@/store/authStore"
import { PAPEL_LABELS, temPapel } from "@/types/auth"
import { PAPEIS_PRONTUARIO } from "@/types/prontuario"
import { PARENTESCOS, SERIES_ESCOLARES } from "@/types/paciente"
import type { Paciente, SerieEscolar } from "@/types/paciente"
import {
  desativarPaciente,
  obterPaciente,
  reativarPaciente,
} from "@/services/pacientes"
import { DocumentosPanel } from "@/features/pacientes/components/DocumentosPanel"

function Info({ rotulo, valor }: { rotulo: string; valor?: string | null }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
        {rotulo}
      </dt>
      <dd className="text-sm text-foreground">{valor || "—"}</dd>
    </div>
  )
}

export default function PacienteDetalhePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const podeVerProntuario = temPapel(user, ...PAPEIS_PRONTUARIO)

  const [paciente, setPaciente] = useState<Paciente | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(() => {
    if (!id) return
    obterPaciente(Number(id))
      .then(setPaciente)
      .catch((e) => setErro(mensagemDeErro(e)))
      .finally(() => setCarregando(false))
  }, [id])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function alternarAtivo() {
    if (!paciente) return
    try {
      if (paciente.ativo) {
        await desativarPaciente(paciente.id)
      } else {
        await reativarPaciente(paciente.id)
      }
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

  if (erro || !paciente) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/pacientes")}>
          <ArrowLeftIcon className="size-4" /> Voltar
        </Button>
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {erro || "Paciente não encontrado."}
        </div>
      </div>
    )
  }

  const endereco = [
    paciente.logradouro,
    paciente.numero,
    paciente.complemento,
    paciente.bairro,
    paciente.cidade && `${paciente.cidade}${paciente.estado ? "/" + paciente.estado : ""}`,
    paciente.cep && formatarCep(paciente.cep),
  ]
    .filter(Boolean)
    .join(", ")

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon-sm" onClick={() => navigate("/pacientes")}>
            <ArrowLeftIcon className="size-4" />
          </Button>
          <Avatar
            nome={paciente.nome_completo}
            foto={paciente.foto}
            className="size-12 text-base"
          />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight text-foreground">
                {paciente.nome_completo}
              </h1>
              {paciente.ativo ? (
                <Badge variant="success">Ativo</Badge>
              ) : (
                <Badge variant="destructive">Inativo</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {formatarData(paciente.data_nascimento)}
              {paciente.idade != null && ` · ${paciente.idade} anos`}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {podeVerProntuario && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/prontuarios/${paciente.id}`)}
            >
              <FileTextIcon className="size-4" /> Prontuário
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/pacientes/${paciente.id}/editar`)}
          >
            <PencilIcon className="size-4" /> Editar
          </Button>
          <AlertDialog>
            <AlertDialogTrigger
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              {paciente.ativo ? (
                <>
                  <UserXIcon className="size-4" /> Desativar
                </>
              ) : (
                <>
                  <UserCheckIcon className="size-4" /> Reativar
                </>
              )}
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {paciente.ativo ? "Desativar paciente?" : "Reativar paciente?"}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {paciente.ativo
                    ? "O paciente deixará de aparecer nas listagens padrão, mas o histórico é preservado."
                    : "O paciente voltará a aparecer nas listagens."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={alternarAtivo}>
                  Confirmar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Dados cadastrais */}
      <Card>
        <CardHeader>
          <CardTitle>Dados cadastrais</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-3">
            <Info rotulo="CPF" valor={formatarCpf(paciente.cpf)} />
            <Info rotulo="Telefone" valor={formatarTelefone(paciente.telefone)} />
            <Info rotulo="E-mail" valor={paciente.email} />
            <div className="sm:col-span-3">
              <Info rotulo="Endereço" valor={endereco} />
            </div>
            {paciente.informacoes_complementares && (
              <div className="sm:col-span-3">
                <Info
                  rotulo="Informações complementares"
                  valor={paciente.informacoes_complementares}
                />
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      {/* Dados escolares */}
      <Card>
        <CardHeader>
          <CardTitle>Dados escolares</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-3">
            <Info rotulo="Escola" valor={paciente.escola} />
            <Info
              rotulo="Série escolar"
              valor={
                paciente.serie_escolar
                  ? SERIES_ESCOLARES[paciente.serie_escolar as SerieEscolar]
                  : ""
              }
            />
            <Info rotulo="Responsável na escola" valor={paciente.escola_responsavel_nome} />
            <Info
              rotulo="Telefone do responsável"
              valor={formatarTelefone(paciente.escola_responsavel_telefone)}
            />
          </dl>
        </CardContent>
      </Card>

      {/* Profissionais */}
      <Card>
        <CardHeader>
          <CardTitle>Profissionais responsáveis</CardTitle>
        </CardHeader>
        <CardContent>
          {paciente.profissionais_detalhe.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum vínculo.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {paciente.profissionais_detalhe.map((prof) => (
                <Badge key={prof.id} variant="secondary">
                  {prof.nome} · {PAPEL_LABELS[prof.role]}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Responsáveis */}
      <Card>
        <CardHeader>
          <CardTitle>Responsáveis</CardTitle>
        </CardHeader>
        <CardContent>
          {paciente.responsaveis.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum responsável cadastrado.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {paciente.responsaveis.map((resp, i) => (
                <li
                  key={resp.id ?? i}
                  className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {resp.nome}
                      {resp.principal && (
                        <Badge variant="default" className="ml-2">
                          Principal
                        </Badge>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {PARENTESCOS[resp.parentesco]}
                      {resp.telefone && ` · ${formatarTelefone(resp.telefone)}`}
                      {resp.email && ` · ${resp.email}`}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Anexos */}
      <Card>
        <CardHeader>
          <CardTitle>Documentos e anexos</CardTitle>
        </CardHeader>
        <CardContent>
          <DocumentosPanel
            pacienteId={paciente.id}
            documentos={paciente.documentos}
            onAlterado={carregar}
          />
        </CardContent>
      </Card>
    </div>
  )
}
