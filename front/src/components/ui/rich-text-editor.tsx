import { useEffect, useRef } from "react"
import {
  BoldIcon,
  ItalicIcon,
  ListIcon,
  ListOrderedIcon,
  UnderlineIcon,
  Heading3Icon,
} from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Editor de texto rico leve (sem dependências), baseado em `contenteditable`.
 *
 * É não-controlado: define o conteúdo inicial no mount a partir de `value` e
 * emite `onChange(html)` a cada edição. Para carregar um novo conteúdo (editar
 * outro registro ou inserir um modelo), troque a prop `key` no componente pai
 * para forçar a remontagem.
 */
interface Props {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  className?: string
}

interface Ferramenta {
  icon: typeof BoldIcon
  titulo: string
  comando: string
  valor?: string
}

const FERRAMENTAS: Ferramenta[] = [
  { icon: BoldIcon, titulo: "Negrito", comando: "bold" },
  { icon: ItalicIcon, titulo: "Itálico", comando: "italic" },
  { icon: UnderlineIcon, titulo: "Sublinhado", comando: "underline" },
  { icon: Heading3Icon, titulo: "Título", comando: "formatBlock", valor: "H3" },
  { icon: ListIcon, titulo: "Lista", comando: "insertUnorderedList" },
  { icon: ListOrderedIcon, titulo: "Lista numerada", comando: "insertOrderedList" },
]

export function RichTextEditor({ value, onChange, placeholder, className }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  // Define o conteúdo apenas na montagem (editor NÃO-controlado). Assim, ao
  // digitar, o React não reescreve o HTML — o que causava o cursor "pular".
  // Para carregar outro conteúdo (editar/inserir modelo), o pai troca a `key`.
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function aplicar(cmd: string, valor?: string) {
    ref.current?.focus()
    // execCommand é obsoleto, mas continua funcionando em todos os navegadores
    // atuais e evita adicionar uma dependência pesada de editor.
    document.execCommand(cmd, false, valor)
    if (ref.current) onChange(ref.current.innerHTML)
  }

  return (
    <div className={cn("rounded-lg border border-input", className)}>
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border p-1">
        {FERRAMENTAS.map((f) => (
          <button
            key={f.titulo}
            type="button"
            title={f.titulo}
            // onMouseDown + preventDefault mantém a seleção/foco no editor.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => aplicar(f.comando, f.valor)}
            className="inline-flex size-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <f.icon className="size-4" />
          </button>
        ))}
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={(e) => onChange((e.target as HTMLDivElement).innerHTML)}
        className={cn(
          "prose-registro min-h-72 max-h-[60vh] overflow-auto px-3 py-2 text-sm outline-none",
          "empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]"
        )}
      />
    </div>
  )
}
