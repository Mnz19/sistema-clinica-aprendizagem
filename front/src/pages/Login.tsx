import { useState } from "react"
import type { FormEvent } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { Loader2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle
} from "@/components/ui/card"
import { useAuth } from "@/hooks/useAuth"

export default function Login() {
    const navigate = useNavigate()
    const location = useLocation()
    const { entrar, carregando, erro } = useAuth()

    const [email, setEmail] = useState("")
    const [senha, setSenha] = useState("")

    // Rota de origem (definida pelo ProtectedRoute) ou home por padrão.
    const origem =
        (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? "/"

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()
        const ok = await entrar({ email, password: senha })
        if (ok) {
            navigate(origem, { replace: true })
        }
    }

    return (
        <Card className="w-full max-w-md border-none shadow-xl shadow-brand-ink/5">
            <CardHeader className="items-center space-y-4 text-center">
                {/* No desktop a logo já aparece no painel da marca (AuthLayout). */}
                <img
                    src="/logo.webp"
                    alt="Clínica da Aprendizagem"
                    className="mx-auto h-auto w-56 lg:hidden"
                />
                <div className="space-y-1.5">
                    <CardTitle className="font-heading text-3xl font-semibold text-foreground">
                        Bem-vindo(a)
                    </CardTitle>
                    <CardDescription>
                        Entre com seu e-mail corporativo para acessar o sistema.
                    </CardDescription>
                </div>
                <div aria-hidden className="filete-dourado mx-auto h-px w-24" />
            </CardHeader>

            <CardContent>
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
                            placeholder="recepcao@clinicadaaprendizagem.com"
                            className="h-10"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={carregando}
                            autoComplete="email"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="password">Senha</Label>
                            <Link to="/esqueci-senha" className="text-sm font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-primary hover:underline">
                                Esqueceu a senha?
                            </Link>
                        </div>
                        <Input
                            id="password"
                            type="password"
                            placeholder="••••••••"
                            className="h-10"
                            value={senha}
                            onChange={(e) => setSenha(e.target.value)}
                            disabled={carregando}
                            autoComplete="current-password"
                            required
                        />
                    </div>

                    <Button
                        type="submit"
                        disabled={carregando}
                        className="h-10 w-full"
                    >
                        {carregando ? (
                            <>
                                <Loader2Icon className="size-4 animate-spin" />
                                Entrando...
                            </>
                        ) : (
                            "Entrar no sistema"
                        )}
                    </Button>
                </form>
            </CardContent>

            <CardFooter className="mt-2 flex justify-center border-t pt-4">
                <p className="text-center text-xs text-muted-foreground">
                    Ambiente seguro e monitorado.<br/>
                    Acesso exclusivo para colaboradores da clínica.
                </p>
            </CardFooter>
        </Card>
    )
}
