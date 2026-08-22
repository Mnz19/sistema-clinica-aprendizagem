import { cn } from "@/lib/utils"

/** Barra de abas simples (sem dependências), controlada pelo componente pai. */
export interface TabItem {
  id: string
  label: string
  icon?: React.ComponentType<{ className?: string }>
}

interface TabsProps {
  itens: TabItem[]
  ativo: string
  onChange: (id: string) => void
  className?: string
}

export function Tabs({ itens, ativo, onChange, className }: TabsProps) {
  return (
    <div
      className={cn(
        "flex gap-1 overflow-x-auto border-b border-border no-scrollbar",
        className
      )}
    >
      {itens.map((item) => {
        const selecionado = item.id === ativo
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={cn(
              "-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              selecionado
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {item.icon && <item.icon className="size-4" />}
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
