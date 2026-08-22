/** Tela de troca de senha obrigatória no primeiro acesso. */
import { useState } from "react"
import type { FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import { KeyRoundIcon, Loader2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { mensagemDeErro } from "@/utils/apiError"
import { trocarSenha } from "@/services/auth"
import { useAuthStore } from "@/store/authStore"

export default function TrocarSenhaObrigatoriaPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)

  const [senhaAtual, setSenhaAtual] = useState("")
  const [novaSenha, setNovaSenha] = useState("")
  const [confirmacao, setConfirmacao] = useState("")
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro(null)

    if (novaSenha !== confirmacao) {
      setErro("A confirmação não confere com a nova senha.")
      return
    }

    setSalvando(true)
    try {
      await trocarSenha({ senha_atual: senhaAtual, nova_senha: novaSenha })
      if (user) setUser({ ...user, precisa_trocar_senha: false })
      navigate("/", { replace: true })
    } catch (err) {
      setErro(mensagemDeErro(err))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="items-center space-y-3 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-zinc-900 text-white">
            <KeyRoundIcon className="size-6" />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-xl">Defina uma nova senha</CardTitle>
            <CardDescription>
              Por segurança, você precisa trocar a senha inicial antes de continuar.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {erro && (
              <div
                role="alert"
                className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              >
                {erro}
              </div>
            )}
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
            <div className="space-y-1.5">
              <Label>Confirmar nova senha</Label>
              <Input
                type="password"
                value={confirmacao}
                onChange={(e) => setConfirmacao(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={salvando}>
              {salvando && <Loader2Icon className="size-4 animate-spin" />}
              Salvar e continuar
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
