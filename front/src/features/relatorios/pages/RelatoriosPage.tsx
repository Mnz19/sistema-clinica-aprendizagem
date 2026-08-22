/** Placeholder do módulo de Relatórios (em desenvolvimento). */
import { ChartColumnIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"

export default function RelatoriosPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Relatórios</h1>
        <p className="text-sm text-muted-foreground">
          Análises gerenciais e fechamento contábil.
        </p>
      </div>

      <div className="flex min-h-[55vh] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-6 py-16 text-center">
        <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-muted">
          <ChartColumnIcon className="size-8 text-muted-foreground" strokeWidth={1.5} />
        </div>

        <Badge variant="secondary" className="mb-3">
          Em breve
        </Badge>

        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          Módulo em desenvolvimento
        </h2>

        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          Em breve você poderá exportar planilhas (Excel/CSV) de produção por profissional,
          consolidados mensais e dados prontos para integração com o Nibo.
        </p>
      </div>
    </div>
  )
}
