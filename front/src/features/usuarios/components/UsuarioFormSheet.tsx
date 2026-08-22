/** Formulário lateral (Sheet) de cadastro completo de usuário/prestador. */
import { useState } from "react"
import type { FormEvent, ReactNode } from "react"
import {
  CheckCircle2Icon,
  Loader2Icon,
  MailIcon,
  MapPinIcon,
  SaveIcon,
  SendIcon,
  XCircleIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { mensagemDeErro } from "@/utils/apiError"
import { apenasDigitos } from "@/utils/format"
import { maskCEP, maskCPF, maskTelefone } from "@/utils/masks"
import { buscarCep } from "@/services/viacep"
import {
  criarUsuario,
  atualizarUsuario,
  reenviarConvite,
} from "@/services/usuarios"
import {
  CONSELHO_LABELS,
  PAPEIS,
  PAPEL_LABELS,
  SEXO_LABELS,
  TIPOS_CONSELHO,
} from "@/types/auth"
import type { Papel, Usuario } from "@/types/auth"
import type { UsuarioPayload } from "@/types/usuario"
import { UFS } from "@/types/paciente"
import { EspecialidadesMultiSelect } from "@/features/usuarios/components/EspecialidadesMultiSelect"

type MetodoAcesso = "senha" | "convite"
type StatusCep = "idle" | "buscando" | "ok" | "nao_encontrado" | "erro"

interface Props {
  aberto: boolean
  usuario?: Usuario | null
  onFechar: () => void
  onSalvo: () => void
}

interface EstadoForm {
  nome: string
  email: string
  cpf: string
  rg: string
  rg_orgao_emissor: string
  data_nascimento: string
  sexo: string
  telefone: string
  celular: string
  conselho_tipo: string
  conselho_uf: string
  conselho_numero: string
  cep: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  estado: string
}

function estadoInicial(u?: Usuario | null): EstadoForm {
  return {
    nome: u?.nome ?? "",
    email: u?.email ?? "",
    cpf: u?.cpf ? maskCPF(u.cpf) : "",
    rg: u?.rg ?? "",
    rg_orgao_emissor: u?.rg_orgao_emissor ?? "",
    data_nascimento: u?.data_nascimento ?? "",
    sexo: u?.sexo ?? "",
    telefone: u?.telefone ? maskTelefone(u.telefone) : "",
    celular: u?.celular ? maskTelefone(u.celular) : "",
    conselho_tipo: u?.conselho_tipo ?? "",
    conselho_uf: u?.conselho_uf ?? "",
    conselho_numero: u?.conselho_numero ?? "",
    cep: u?.cep ? maskCEP(u.cep) : "",
    logradouro: u?.logradouro ?? "",
    numero: u?.numero ?? "",
    complemento: u?.complemento ?? "",
    bairro: u?.bairro ?? "",
    cidade: u?.cidade ?? "",
    estado: u?.estado ?? "",
  }
}

/** Título de seção do formulário. */
function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {titulo}
      </h3>
      {children}
    </div>
  )
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

export function UsuarioFormSheet({ aberto, usuario, onFechar, onSalvo }: Props) {
  const editando = Boolean(usuario)

  // O componente é remontado (via `key`) a cada abertura — o estado inicial
  // deriva das props, sem efeito de sincronização.
  const [form, setForm] = useState<EstadoForm>(() => estadoInicial(usuario))
  const [role, setRole] = useState<Papel>(usuario?.role ?? "PROFISSIONAL")
  const [ativo, setAtivo] = useState(usuario?.is_active ?? true)
  const [especialidades, setEspecialidades] = useState<number[]>(
    usuario?.especialidades ?? []
  )
  const [senha, setSenha] = useState("")
  const [metodo, setMetodo] = useState<MetodoAcesso>("convite")
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [msgConvite, setMsgConvite] = useState<string | null>(null)
  const [reenviando, setReenviando] = useState(false)
  const [statusCep, setStatusCep] = useState<StatusCep>("idle")

  const ehProfissional = role === "PROFISSIONAL"

  function campo<K extends keyof EstadoForm>(chave: K) {
    return {
      value: form[chave],
      onChange: (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
      ) => setForm((f) => ({ ...f, [chave]: e.target.value })),
    }
  }

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

    if (!form.nome.trim() || !form.email.trim()) {
      setErro("Preencha nome e e-mail.")
      return
    }
    if (ehProfissional && especialidades.length === 0) {
      setErro("Selecione ao menos uma especialidade para o profissional.")
      return
    }

    const usarConvite = !editando && metodo === "convite"
    if (!editando && metodo === "senha" && !senha) {
      setErro("Defina uma senha inicial para o novo usuário.")
      return
    }

    const payload: UsuarioPayload = {
      nome: form.nome.trim(),
      email: form.email.trim(),
      role,
      is_active: ativo,
      cpf: form.cpf.trim() || null,
      rg: form.rg.trim(),
      rg_orgao_emissor: form.rg_orgao_emissor.trim(),
      data_nascimento: form.data_nascimento || null,
      sexo: form.sexo as UsuarioPayload["sexo"],
      telefone: form.telefone,
      celular: form.celular,
      conselho_tipo: form.conselho_tipo as UsuarioPayload["conselho_tipo"],
      conselho_uf: form.conselho_uf,
      conselho_numero: form.conselho_numero.trim(),
      cep: form.cep,
      logradouro: form.logradouro.trim(),
      numero: form.numero.trim(),
      complemento: form.complemento.trim(),
      bairro: form.bairro.trim(),
      cidade: form.cidade.trim(),
      estado: form.estado,
      especialidades,
    }
    if (usarConvite) payload.enviar_convite = true
    else if (senha) payload.password = senha

    setSalvando(true)
    try {
      if (usuario) {
        await atualizarUsuario(usuario.id, payload)
      } else {
        await criarUsuario(payload)
      }
      onSalvo()
    } catch (err) {
      setErro(mensagemDeErro(err))
    } finally {
      setSalvando(false)
    }
  }

  async function handleReenviarConvite() {
    if (!usuario) return
    setReenviando(true)
    setMsgConvite(null)
    setErro(null)
    try {
      await reenviarConvite(usuario.id)
      setMsgConvite(`Convite reenviado para ${usuario.email}.`)
    } catch (err) {
      setErro(mensagemDeErro(err))
    } finally {
      setReenviando(false)
    }
  }

  return (
    <Sheet open={aberto} onOpenChange={(o) => !o && onFechar()}>
      <SheetContent
        side="right"
        className="w-full p-0 data-[side=right]:sm:w-[70vw] data-[side=right]:sm:max-w-[70vw]"
      >
        <form onSubmit={handleSubmit} className="flex h-full flex-col">
          <SheetHeader className="border-b border-border p-4">
            <SheetTitle>{editando ? "Editar cadastro" : "Novo prestador / usuário"}</SheetTitle>
            <SheetDescription>
              {editando
                ? "Atualize os dados cadastrais, o papel ou o status."
                : "Cadastre um membro da equipe. Para profissionais, informe a especialidade."}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-6 overflow-auto p-4">
            {erro && (
              <div
                role="alert"
                className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              >
                {erro}
              </div>
            )}

            {/* Identificação e papel */}
            <Secao titulo="Identificação">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Nome completo *</Label>
                  <Input {...campo("nome")} placeholder="Nome do usuário" />
                </div>
                <div className="space-y-1.5">
                  <Label>E-mail *</Label>
                  <Input type="email" {...campo("email")} placeholder="email@clinica.com" />
                </div>
                <div className="space-y-1.5">
                  <Label>Papel</Label>
                  <Select value={role} onChange={(e) => setRole(e.target.value as Papel)}>
                    {Object.values(PAPEIS).map((p) => (
                      <option key={p} value={p}>
                        {PAPEL_LABELS[p]}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            </Secao>

            {/* Registro no conselho e especialidades — só para profissionais */}
            {ehProfissional && (
              <>
                <Secao titulo="Registro no conselho">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label>Conselho</Label>
                      <Select {...campo("conselho_tipo")}>
                        <option value="">—</option>
                        {Object.values(TIPOS_CONSELHO).map((t) => (
                          <option key={t} value={t}>
                            {CONSELHO_LABELS[t]}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>UF</Label>
                      <Select {...campo("conselho_uf")}>
                        <option value="">—</option>
                        {UFS.map((uf) => (
                          <option key={uf} value={uf}>
                            {uf}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Número</Label>
                      <Input {...campo("conselho_numero")} placeholder="Ex.: 1009775" />
                    </div>
                  </div>
                </Secao>

                <Secao titulo="Especialidades *">
                  <EspecialidadesMultiSelect
                    selecionados={especialidades}
                    onChange={setEspecialidades}
                  />
                </Secao>
              </>
            )}

            {/* Dados pessoais */}
            <Secao titulo="Dados pessoais">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>CPF</Label>
                  <Input
                    {...campoMascarado("cpf", maskCPF)}
                    inputMode="numeric"
                    placeholder="000.000.000-00"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2 space-y-1.5">
                    <Label>Identidade (RG)</Label>
                    <Input {...campo("rg")} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Emissor</Label>
                    <Input {...campo("rg_orgao_emissor")} placeholder="SSP" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Data de nascimento</Label>
                  <Input type="date" {...campo("data_nascimento")} />
                </div>
                <div className="space-y-1.5">
                  <Label>Sexo</Label>
                  <Select {...campo("sexo")}>
                    <option value="">—</option>
                    {Object.entries(SEXO_LABELS).map(([valor, label]) => (
                      <option key={valor} value={valor}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            </Secao>

            {/* Contato */}
            <Secao titulo="Contato">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Telefone</Label>
                  <Input
                    {...campoMascarado("telefone", maskTelefone)}
                    inputMode="numeric"
                    placeholder="(91) 3222-0000"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Celular</Label>
                  <Input
                    {...campoMascarado("celular", maskTelefone)}
                    inputMode="numeric"
                    placeholder="(91) 90000-0000"
                  />
                </div>
              </div>
            </Secao>

            {/* Endereço */}
            <Secao titulo="Endereço">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPinIcon className="size-3.5" />
                Digite o CEP para preencher o endereço automaticamente.
              </p>
              <div className="grid gap-4 sm:grid-cols-6">
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
              </div>
            </Secao>

            {/* Acesso: convite por e-mail ou senha inicial (apenas na criação) */}
            {!editando && (
              <Secao titulo="Forma de acesso">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setMetodo("convite")}
                    className={cn(
                      "flex-1 rounded-lg border px-3 py-2 text-sm transition-colors",
                      metodo === "convite"
                        ? "border-primary bg-primary/5 text-foreground"
                        : "border-border text-muted-foreground hover:bg-muted"
                    )}
                  >
                    Convite por e-mail
                  </button>
                  <button
                    type="button"
                    onClick={() => setMetodo("senha")}
                    className={cn(
                      "flex-1 rounded-lg border px-3 py-2 text-sm transition-colors",
                      metodo === "senha"
                        ? "border-primary bg-primary/5 text-foreground"
                        : "border-border text-muted-foreground hover:bg-muted"
                    )}
                  >
                    Senha inicial
                  </button>
                </div>
                {metodo === "convite" ? (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MailIcon className="size-3.5" />
                    O usuário receberá um e-mail para definir a própria senha.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    <Label>Senha inicial</Label>
                    <Input
                      type="password"
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      placeholder="Defina a senha"
                      autoComplete="new-password"
                    />
                    <p className="text-xs text-muted-foreground">
                      O usuário será obrigado a trocá-la no primeiro acesso.
                    </p>
                  </div>
                )}
              </Secao>
            )}

            {/* Reset de senha e reenvio de convite (apenas na edição) */}
            {editando && (
              <Secao titulo="Acesso">
                <div className="space-y-1.5">
                  <Label>Nova senha (opcional)</Label>
                  <Input
                    type="password"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder="Deixe em branco para manter"
                    autoComplete="new-password"
                  />
                  <p className="text-xs text-muted-foreground">
                    Ao definir uma nova senha, o usuário deverá trocá-la no próximo acesso.
                  </p>
                </div>
                {msgConvite && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                    {msgConvite}
                  </div>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleReenviarConvite}
                  disabled={reenviando}
                >
                  {reenviando ? (
                    <Loader2Icon className="size-4 animate-spin" />
                  ) : (
                    <SendIcon className="size-4" />
                  )}
                  Reenviar convite por e-mail
                </Button>
              </Secao>
            )}

            {/* Status */}
            <Secao titulo="Status">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAtivo(true)}
                  className={cn(
                    "flex-1 rounded-lg border px-3 py-2 text-sm transition-colors",
                    ativo
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                      : "border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  Ativo
                </button>
                <button
                  type="button"
                  onClick={() => setAtivo(false)}
                  className={cn(
                    "flex-1 rounded-lg border px-3 py-2 text-sm transition-colors",
                    !ativo
                      ? "border-destructive bg-destructive/5 text-destructive"
                      : "border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  Inativo
                </button>
              </div>
            </Secao>
          </div>

          <SheetFooter className="flex-row justify-end gap-2 border-t border-border p-4">
            <Button type="button" variant="ghost" onClick={onFechar} disabled={salvando}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando}>
              {salvando ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                <SaveIcon className="size-4" />
              )}
              {editando ? "Salvar" : "Cadastrar"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
