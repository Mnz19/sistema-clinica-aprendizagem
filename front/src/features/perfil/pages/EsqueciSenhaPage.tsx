/** Página pública "Esqueci minha senha": envia o link de redefinição por e-mail. */
import { useState } from "react"
import type { FormEvent } from "react"
import { Link } from "react-router-dom"
import { ArrowLeftIcon, KeyRoundIcon, Loader2Icon, MailCheckIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { mensagemDeErro } from "@/utils/apiError"
import { solicitarRedefinicaoSenha } from "@/services/auth"

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState("")
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [enviado, setEnviado] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    setEnviando(true)
    try {
      await solicitarRedefinicaoSenha(email.trim())
      setEnviado(true)
    } catch (err) {
      setErro(mensagemDeErro(err))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Card className="w-full max-w-md border-none shadow-xl shadow-brand-ink/5">
      <CardHeader className="items-center space-y-3 text-center">
        <div className="flex size-12 items-center justify-center rounded-xl bg-brand-ink text-brand-gold-light ring-1 ring-brand-gold/30">
          {enviado ? <MailCheckIcon className="size-6" /> : <KeyRoundIcon className="size-6" />}
        </div>
        <div className="space-y-1">
          <CardTitle className="font-heading text-3xl font-semibold text-foreground">
            {enviado ? "Confira seu e-mail" : "Esqueceu a senha?"}
          </CardTitle>
          <CardDescription>
            {enviado
              ? "Se o e-mail estiver cadastrado, você vai receber um link para criar uma nova senha."
              : "Informe seu e-mail e enviaremos um link para você criar uma nova senha."}
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent>
        {enviado ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
              Enviamos para <strong className="text-foreground">{email.trim()}</strong>. O link
              vale por tempo limitado e pode ser usado uma única vez. Não chegou? Verifique a
              caixa de spam.
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setEnviado(false)}
            >
              Usar outro e-mail
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {erro && (
              <div
                role="alert"
                className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              >
                {erro}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">E-mail corporativo</Label>
              <Input
                id="email"
                type="email"
                placeholder="voce@clinicadaaprendizagem.com.br"
                className="h-10"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={enviando}
                autoComplete="email"
                autoFocus
                required
              />
            </div>
            <Button
              type="submit"
              disabled={enviando}
              className="h-10 w-full"
            >
              {enviando && <Loader2Icon className="size-4 animate-spin" />}
              Enviar link de redefinição
            </Button>
          </form>
        )}
      </CardContent>

      <CardFooter className="mt-2 flex justify-center border-t pt-4">
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowLeftIcon className="size-4" />
          Voltar para o login
        </Link>
      </CardFooter>
    </Card>
  )
}
