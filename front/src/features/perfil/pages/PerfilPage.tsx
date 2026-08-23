/** Página "Meu Perfil": foto, dados básicos e troca de senha. */
import { useRef, useState } from "react"
import type { FormEvent } from "react"
import { CameraIcon, Loader2Icon, SaveIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Avatar } from "@/components/ui/avatar"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { mensagemDeErro } from "@/utils/apiError"
import { CONSELHO_LABELS, PAPEL_LABELS, TIPOS_CONSELHO } from "@/types/auth"
import { UFS } from "@/types/paciente"
import { atualizarPerfil, trocarSenha } from "@/services/auth"
import { useAuthStore } from "@/store/authStore"
import GoogleAgendaCard from "@/features/perfil/components/GoogleAgendaCard"

export default function PerfilPage() {
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const fileRef = useRef<HTMLInputElement>(null)

  const [nome, setNome] = useState(user?.nome ?? "")
  const [conselhoTipo, setConselhoTipo] = useState<string>(user?.conselho_tipo ?? "")
  const [conselhoUf, setConselhoUf] = useState(user?.conselho_uf ?? "")
  const [conselhoNumero, setConselhoNumero] = useState(user?.conselho_numero ?? "")
  const [salvandoPerfil, setSalvandoPerfil] = useState(false)
  const [enviandoFoto, setEnviandoFoto] = useState(false)
  const [msgPerfil, setMsgPerfil] = useState<string | null>(null)
  const [erroPerfil, setErroPerfil] = useState<string | null>(null)

  const [senhaAtual, setSenhaAtual] = useState("")
  const [novaSenha, setNovaSenha] = useState("")
  const [salvandoSenha, setSalvandoSenha] = useState(false)
  const [msgSenha, setMsgSenha] = useState<string | null>(null)
  const [erroSenha, setErroSenha] = useState<string | null>(null)

  async function handleFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const foto = e.target.files?.[0]
    if (!foto) return
    setEnviandoFoto(true)
    setErroPerfil(null)
    try {
      const atualizado = await atualizarPerfil({ foto })
      setUser(atualizado)
    } catch (err) {
      setErroPerfil(mensagemDeErro(err))
    } finally {
      setEnviandoFoto(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  async function salvarPerfil(e: FormEvent) {
    e.preventDefault()
    setMsgPerfil(null)
    setErroPerfil(null)
    setSalvandoPerfil(true)
    try {
      const atualizado = await atualizarPerfil({
        nome,
        conselho_tipo: conselhoTipo,
        conselho_uf: conselhoUf,
        conselho_numero: conselhoNumero,
      })
      setUser(atualizado)
      setMsgPerfil("Perfil atualizado.")
    } catch (err) {
      setErroPerfil(mensagemDeErro(err))
    } finally {
      setSalvandoPerfil(false)
    }
  }

  async function salvarSenha(e: FormEvent) {
    e.preventDefault()
    setMsgSenha(null)
    setErroSenha(null)
    setSalvandoSenha(true)
    try {
      await trocarSenha({ senha_atual: senhaAtual, nova_senha: novaSenha })
      setSenhaAtual("")
      setNovaSenha("")
      setMsgSenha("Senha alterada com sucesso.")
    } catch (err) {
      setErroSenha(mensagemDeErro(err))
    } finally {
      setSalvandoSenha(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Meu Perfil
        </h1>
        <p className="text-sm text-muted-foreground">
          Atualize sua foto, seus dados e sua senha.
        </p>
      </div>

      {/* Foto + dados */}
      <Card>
        <CardHeader>
          <CardTitle>Dados pessoais</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar
                nome={user?.nome}
                foto={user?.foto}
                className="size-20 text-lg"
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={enviandoFoto}
                className="absolute -bottom-1 -right-1 flex size-7 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm transition-colors hover:text-foreground"
                title="Trocar foto"
              >
                {enviandoFoto ? (
                  <Loader2Icon className="size-3.5 animate-spin" />
                ) : (
                  <CameraIcon className="size-3.5" />
                )}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleFoto}
                className="hidden"
              />
            </div>
            <div>
              <p className="font-medium text-foreground">{user?.nome}</p>
              <p className="text-sm text-muted-foreground">
                {user ? PAPEL_LABELS[user.role] : ""}
              </p>
              <p className="text-xs text-muted-foreground">
                JPG, PNG ou WEBP, até 5&nbsp;MB.
              </p>
            </div>
          </div>

          <form onSubmit={salvarPerfil} className="space-y-4">
            {erroPerfil && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {erroPerfil}
              </div>
            )}
            {msgPerfil && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {msgPerfil}
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Nome completo</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>E-mail</Label>
                <Input value={user?.email ?? ""} disabled />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Registro no conselho</Label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <Select
                    value={conselhoTipo}
                    onChange={(e) => setConselhoTipo(e.target.value)}
                  >
                    <option value="">Conselho</option>
                    {Object.values(TIPOS_CONSELHO).map((t) => (
                      <option key={t} value={t}>
                        {CONSELHO_LABELS[t]}
                      </option>
                    ))}
                  </Select>
                  <Select
                    value={conselhoUf}
                    onChange={(e) => setConselhoUf(e.target.value)}
                  >
                    <option value="">UF</option>
                    {UFS.map((uf) => (
                      <option key={uf} value={uf}>
                        {uf}
                      </option>
                    ))}
                  </Select>
                  <Input
                    value={conselhoNumero}
                    onChange={(e) => setConselhoNumero(e.target.value)}
                    placeholder="Número"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Aparece na assinatura dos seus registros no prontuário
                  {user?.conselho ? ` (ex.: ${user.conselho})` : ""}.
                </p>
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={salvandoPerfil}>
                {salvandoPerfil ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : (
                  <SaveIcon className="size-4" />
                )}
                Salvar dados
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Trocar senha */}
      <Card>
        <CardHeader>
          <CardTitle>Alterar senha</CardTitle>
          <CardDescription>
            Informe a senha atual e defina a nova senha.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={salvarSenha} className="space-y-4">
            {erroSenha && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {erroSenha}
              </div>
            )}
            {msgSenha && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {msgSenha}
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Senha atual</Label>
                <Input
                  type="password"
                  value={senhaAtual}
                  onChange={(e) => setSenhaAtual(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Nova senha</Label>
                <Input
                  type="password"
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={salvandoSenha || !senhaAtual || !novaSenha}
              >
                {salvandoSenha && <Loader2Icon className="size-4 animate-spin" />}
                Alterar senha
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Integração com Google Agenda */}
      <GoogleAgendaCard />
    </div>
  )
}
