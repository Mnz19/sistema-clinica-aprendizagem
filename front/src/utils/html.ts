/** Utilitários para conteúdo HTML dos registros do prontuário. */

/**
 * Sanitiza HTML de forma conservadora para exibição: remove scripts, estilos,
 * iframes e atributos de evento (`on*`) e `javascript:`. O conteúdo é produzido
 * internamente por profissionais, mas ainda assim higienizamos por segurança.
 */
export function sanitizarHtml(html: string): string {
  if (!html) return ""
  const doc = new DOMParser().parseFromString(html, "text/html")

  doc.querySelectorAll("script, style, iframe, object, embed, link").forEach((el) =>
    el.remove()
  )

  doc.querySelectorAll("*").forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      const nome = attr.name.toLowerCase()
      const valor = attr.value.toLowerCase()
      if (nome.startsWith("on") || valor.includes("javascript:")) {
        el.removeAttribute(attr.name)
      }
    }
  })

  return doc.body.innerHTML
}

/** Indica se um texto já contém marcação HTML. */
export function pareceHtml(texto: string): boolean {
  return /<[a-z][\s\S]*>/i.test(texto)
}

/**
 * Prepara conteúdo para exibição: se for texto puro (registros antigos),
 * converte quebras de linha em `<br>`; caso contrário, sanitiza o HTML.
 */
export function conteudoParaExibicao(conteudo?: string | null): string {
  if (!conteudo) return ""
  if (!pareceHtml(conteudo)) {
    const escapado = conteudo
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
    return escapado.replace(/\n/g, "<br>")
  }
  return sanitizarHtml(conteudo)
}

/** Extrai texto simples de um HTML (para prévias/resumos). */
export function htmlParaTexto(html?: string | null): string {
  if (!html) return ""
  const doc = new DOMParser().parseFromString(html, "text/html")
  return (doc.body.textContent ?? "").trim()
}
