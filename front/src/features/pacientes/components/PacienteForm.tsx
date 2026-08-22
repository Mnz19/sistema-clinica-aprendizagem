/** Formulário de cadastro/edição de paciente. */
import { useRef, useState } from "react"
import type { FormEvent } from "react"
import {
  CheckCircle2Icon,
  GraduationCapIcon,
  Loader2Icon,
  MapPinIcon,
  SaveIcon,
  Trash2Icon,
  UploadIcon,
  UserIcon,
  XCircleIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { mensagemDeErro } from "@/utils/apiError"
import { apenasDigitos } from "@/utils/format"
import { maskCEP, maskCPF, maskTelefone } from "@/utils/masks"
import {
  atualizarFotoPaciente,
  atualizarPaciente,
  criarPaciente,
  removerFotoPaciente,
} from "@/services/pacientes"
import { buscarCep } from "@/services/viacep"
import { SERIES_ESCOLARES, UFS } from "@/types/paciente"
import type { Paciente, PacientePayload, Responsavel } from "@/types/paciente"
import { ProfissionaisSelector } from "@/features/pacientes/components/ProfissionaisSelector"
import { ResponsaveisEditor } from "@/features/pacientes/components/ResponsaveisEditor"

/** Estado da busca de endereço por CEP (ViaCEP). */
type StatusCep = "idle" | "buscando" | "ok" | "nao_encontrado" | "erro"

interface Props {
  pacienteInicial?: Paciente
  onSalvo: (paciente: Paciente) => void
  onCancelar: () => void
}

interface EstadoForm {
  nome_completo: string
  data_nascimento: string
  cpf: string
  email: string
  telefone: string
  cep: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  estado: string
  escola: string
  serie_escolar: string
  escola_responsavel_nome: string
  escola_responsavel_telefone: string
  informacoes_complementares: string
  nome_mae: string
  nome_pai: string
}

function estadoInicial(p?: Paciente): EstadoForm {
  return {
    nome_completo: p?.nome_completo ?? "",
    data_nascimento: p?.data_nascimento ?? "",
    cpf: p?.cpf ? maskCPF(p.cpf) : "",
    email: p?.email ?? "",
    telefone: p?.telefone ? maskTelefone(p.telefone) : "",
    cep: p?.cep ? maskCEP(p.cep) : "",
    logradouro: p?.logradouro ?? "",
    numero: p?.numero ?? "",
    complemento: p?.complemento ?? "",
    bairro: p?.bairro ?? "",
    cidade: p?.cidade ?? "",
    estado: p?.estado ?? "",
    escola: p?.escola ?? "",
    serie_escolar: p?.serie_escolar ?? "",
    escola_responsavel_nome: p?.escola_responsavel_nome ?? "",
    escola_responsavel_telefone: p?.escola_responsavel_telefone
      ? maskTelefone(p.escola_responsavel_telefone)
      : "",
    informacoes_complementares: p?.informacoes_complementares ?? "",
    nome_mae: p?.nome_mae ?? "",
    nome_pai: p?.nome_pai ?? "",
  }
}

/** Mensagem de feedback da busca de CEP (ViaCEP). */
function StatusCepIndicador({ status }: { status: StatusCep }) {
  if (status === "idle") return null

  const mapa = {
    buscando: {
      icon: <Loader2Icon className="size-3.5 animate-spin" />,
      texto: "Buscando endereço…",
      cor: "text-muted-foreground",
    },
    ok: {
      icon: <CheckCircle2Icon className="size-3.5" />,
      texto: "Endereço preenchido automaticamente.",
      cor: "text-emerald-600",
    },
    nao_encontrado: {
      icon: <XCircleIcon className="size-3.5" />,
      texto: "CEP não encontrado. Preencha manualmente.",
      cor: "text-amber-600",
    },
    erro: {
      icon: <XCircleIcon className="size-3.5" />,
      texto: "Falha ao consultar o CEP. Preencha manualmente.",
      cor: "text-destructive",
    },
  } as const

  const item = mapa[status]
  return (
    <p className={`flex items-center gap-1.5 text-xs ${item.cor}`}>
      {item.icon} {item.texto}
    </p>
  )
}

export function PacienteForm({ pacienteInicial, onSalvo, onCancelar }: Props) {
  const editando = Boolean(pacienteInicial)
  const [form, setForm] = useState<EstadoForm>(() => estadoInicial(pacienteInicial))
  const [profissionais, setProfissionais] = useState<number[]>(
    pacienteInicial?.profissionais ?? []
  )
  const [responsaveis, setResponsaveis] = useState<Responsavel[]>(
    (pacienteInicial?.responsaveis ?? []).map((r) => ({
      ...r,
      cpf: r.cpf ? maskCPF(r.cpf) : "",
      telefone: r.telefone ? maskTelefone(r.telefone) : "",
    }))
  )
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [statusCep, setStatusCep] = useState<StatusCep>("idle")

  // Foto: arquivo novo a enviar, prévia exibida e flag de remoção.
  const fotoInputRef = useRef<HTMLInputElement>(null)
  const [fotoArquivo, setFotoArquivo] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(pacienteInicial?.foto ?? null)
  const [removerFoto, setRemoverFoto] = useState(false)

  function handleFotoSelecionada(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0]
    if (!arquivo) return
    setFotoArquivo(arquivo)
    setRemoverFoto(false)
    setFotoPreview(URL.createObjectURL(arquivo))
  }

  function handleRemoverFoto() {
    setFotoArquivo(null)
    setFotoPreview(null)
    setRemoverFoto(Boolean(pacienteInicial?.foto))
    if (fotoInputRef.current) fotoInputRef.current.value = ""
  }

  function campo<K extends keyof EstadoForm>(chave: K) {
    return {
      value: form[chave],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
        setForm((f) => ({ ...f, [chave]: e.target.value })),
    }
  }

  /** Atualiza um campo aplicando uma máscara ao valor digitado. */
  function campoMascarado<K extends keyof EstadoForm>(
    chave: K,
    mascara: (v: string) => string
  ) {
    return {
      value: form[chave],
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm((f) => ({ ...f, [chave]: mascara(e.target.value) })),
    }
  }

  /** CEP: aplica máscara e, ao completar 8 dígitos, busca o endereço no ViaCEP. */
  async function handleCepChange(e: React.ChangeEvent<HTMLInputElement>) {
    const cep = maskCEP(e.target.value)
    setForm((f) => ({ ...f, cep }))

    if (apenasDigitos(cep).length !== 8) {
      setStatusCep("idle")
      return
    }

    setStatusCep("buscando")
    try {
      const endereco = await buscarCep(cep)
      if (!endereco) {
        setStatusCep("nao_encontrado")
        return
      }
      // Preenche o que veio do ViaCEP, mantendo o que o usuário já digitou.
      setForm((f) => ({
        ...f,
        logradouro: endereco.logradouro || f.logradouro,
        bairro: endereco.bairro || f.bairro,
        cidade: endereco.cidade || f.cidade,
        estado: endereco.estado || f.estado,
        complemento: endereco.complemento || f.complemento,
      }))
      setStatusCep("ok")
    } catch {
      setStatusCep("erro")
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro(null)

    if (!form.nome_completo.trim() || !form.data_nascimento) {
      setErro("Preencha o nome completo e a data de nascimento.")
      return
    }

    const payload: PacientePayload = {
      ...form,
      cpf: form.cpf.trim() || null,
      profissionais,
      responsaveis,
    }

    setSalvando(true)
    try {
      let salvo = pacienteInicial
        ? await atualizarPaciente(pacienteInicial.id, payload)
        : await criarPaciente(payload)
      // A foto vai numa chamada multipart separada (o cadastro em si é JSON com
      // responsáveis aninhados). Aqui já temos o id do paciente salvo.
      if (fotoArquivo) {
        salvo = await atualizarFotoPaciente(salvo.id, fotoArquivo)
      } else if (removerFoto) {
        salvo = await removerFotoPaciente(salvo.id)
      }
      onSalvo(salvo)
    } catch (err) {
      setErro(mensagemDeErro(err))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {erro && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          {erro}
        </div>
      )}

      {/* Dados cadastrais */}
      <Card>
        <CardHeader>
          <CardTitle>Dados cadastrais</CardTitle>
          <CardDescription>Identificação e contato do paciente.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {/* Foto do paciente */}
          <div className="flex items-center gap-4 sm:col-span-2">
            <span className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-muted-foreground">
              {fotoPreview ? (
                <img src={fotoPreview} alt="Foto do paciente" className="size-full object-cover" />
              ) : (
                <UserIcon className="size-8" />
              )}
            </span>
            <div className="space-y-1.5">
              <Label>Foto do paciente</Label>
              <input
                ref={fotoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFotoSelecionada}
                className="hidden"
              />
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fotoInputRef.current?.click()}
                >
                  <UploadIcon className="size-4" /> {fotoPreview ? "Trocar foto" : "Enviar foto"}
                </Button>
                {fotoPreview && (
                  <Button type="button" variant="ghost" size="sm" onClick={handleRemoverFoto}>
                    <Trash2Icon className="size-4" /> Remover
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">JPG, PNG ou WEBP, até 5 MB.</p>
            </div>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label>Nome completo *</Label>
            <Input {...campo("nome_completo")} placeholder="Nome do paciente" />
          </div>
          <div className="space-y-1.5">
            <Label>Data de nascimento *</Label>
            <Input type="date" {...campo("data_nascimento")} />
          </div>
          <div className="space-y-1.5">
            <Label>Nome da mãe</Label>
            <Input {...campo("nome_mae")} placeholder="Opcional" />
          </div>
          <div className="space-y-1.5">
            <Label>Nome do pai</Label>
            <Input {...campo("nome_pai")} placeholder="Opcional" />
          </div>
          <div className="space-y-1.5">
            <Label>CPF</Label>
            <Input
              {...campoMascarado("cpf", maskCPF)}
              inputMode="numeric"
              placeholder="000.000.000-00 (opcional)"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Telefone</Label>
            <Input
              {...campoMascarado("telefone", maskTelefone)}
              inputMode="numeric"
              placeholder="(91) 90000-0000"
            />
          </div>
          <div className="space-y-1.5">
            <Label>E-mail</Label>
            <Input type="email" {...campo("email")} placeholder="email@exemplo.com" />
          </div>
        </CardContent>
      </Card>

      {/* Endereço */}
      <Card>
        <CardHeader>
          <CardTitle>Endereço</CardTitle>
          <CardDescription className="flex items-center gap-1.5">
            <MapPinIcon className="size-3.5" />
            Digite o CEP para preencher o endereço automaticamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-6">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>CEP</Label>
            <Input
              value={form.cep}
              onChange={handleCepChange}
              inputMode="numeric"
              placeholder="00000-000"
            />
            <StatusCepIndicador status={statusCep} />
          </div>
          <div className="space-y-1.5 sm:col-span-3">
            <Label>Logradouro</Label>
            <Input {...campo("logradouro")} placeholder="Rua / Avenida" />
          </div>
          <div className="space-y-1.5">
            <Label>Número</Label>
            <Input {...campo("numero")} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Complemento</Label>
            <Input {...campo("complemento")} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Bairro</Label>
            <Input {...campo("bairro")} />
          </div>
          <div className="space-y-1.5">
            <Label>Cidade</Label>
            <Input {...campo("cidade")} />
          </div>
          <div className="space-y-1.5">
            <Label>UF</Label>
            <Select {...campo("estado")}>
              <option value="">—</option>
              {UFS.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Dados escolares */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            <GraduationCapIcon className="size-4" /> Dados escolares
          </CardTitle>
          <CardDescription>
            Escola, série e a pessoa de contato na instituição.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Escola</Label>
            <Input {...campo("escola")} placeholder="Nome da escola" />
          </div>
          <div className="space-y-1.5">
            <Label>Série escolar</Label>
            <Select {...campo("serie_escolar")}>
              <option value="">—</option>
              {Object.entries(SERIES_ESCOLARES).map(([valor, rotulo]) => (
                <option key={valor} value={valor}>
                  {rotulo}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Responsável na escola</Label>
            <Input
              {...campo("escola_responsavel_nome")}
              placeholder="Coordenação, professor(a)…"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Telefone do responsável</Label>
            <Input
              {...campoMascarado("escola_responsavel_telefone", maskTelefone)}
              inputMode="numeric"
              placeholder="(91) 90000-0000"
            />
          </div>
        </CardContent>
      </Card>

      {/* Profissionais */}
      <Card>
        <CardHeader>
          <CardTitle>Profissionais responsáveis</CardTitle>
          <CardDescription>
            Selecione os profissionais que atendem este paciente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfissionaisSelector
            selecionados={profissionais}
            onChange={setProfissionais}
          />
        </CardContent>
      </Card>

      {/* Responsáveis */}
      <Card>
        <CardHeader>
          <CardTitle>Responsáveis</CardTitle>
          <CardDescription>Pais, tutores ou responsáveis legais.</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsaveisEditor
            responsaveis={responsaveis}
            onChange={setResponsaveis}
          />
        </CardContent>
      </Card>

      {/* Informações complementares */}
      <Card>
        <CardHeader>
          <CardTitle>Informações complementares</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            {...campo("informacoes_complementares")}
            placeholder="Observações relevantes, histórico, particularidades…"
            rows={4}
          />
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancelar} disabled={salvando}>
          Cancelar
        </Button>
        <Button type="submit" disabled={salvando}>
          {salvando ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            <SaveIcon className="size-4" />
          )}
          {editando ? "Salvar alterações" : "Cadastrar paciente"}
        </Button>
      </div>
    </form>
  )
}
