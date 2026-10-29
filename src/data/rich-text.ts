/** Operating results are plain text until someone formats them. Formatted notes are a small HTML subset. */

const BLOCK = new Set(["p", "h1", "h2", "h3"])
const INLINE = new Set(["strong", "em", "u"])
const LIST = new Set(["ul", "ol"])
const DANGEROUS = new Set([
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "link",
  "meta",
  "svg",
  "math",
  "noscript",
  "template",
])

type El = { tag: string; children: Array<El | string> }

type Token =
  | { kind: "text"; value: string }
  | { kind: "open"; tag: string; selfClosing: boolean }
  | { kind: "close"; tag: string }
  | { kind: "br" }

export function looksLikeHtml(value: string): boolean {
  return /<[a-z!/]/i.test(value)
}

/** Turn stored plain text into paragraphs for the editor. Leave formatted notes to the sanitizer. */
export function editorHtml(value: string): string {
  if (!value.trim()) return ""
  if (looksLikeHtml(value)) return sanitizeRichText(value)
  return value
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => `<p>${escapeHtml(line) || "<br>"}</p>`)
    .join("")
}

/** Clean a formatted note. Blank notes come back as an empty string. */
export function commitHtml(html: string): string {
  const clean = sanitizeRichText(html)
  return isBlankRichText(clean) ? "" : clean
}

export function isBlankRichText(html: string): boolean {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .trim() === ""
}

export function sanitizeRichText(html: string): string {
  const root: El = { tag: "div", children: [] }
  const stack: El[] = [root]
  let skipping: string | null = null
  for (const token of tokenize(html)) {
    if (skipping) {
      if (token.kind === "close" && token.tag === skipping) skipping = null
      continue
    }
    if (token.kind === "open" && DANGEROUS.has(token.tag)) {
      if (!token.selfClosing) skipping = token.tag
      continue
    }
    if (token.kind === "text") {
      appendText(stack, token.value)
      continue
    }
    if (token.kind === "br") {
      appendInline(stack, { tag: "br", children: [] })
      continue
    }
    const tag = canonical(token.tag)
    if (token.kind === "close") {
      if (tag) closeTag(stack, tag)
      continue
    }
    if (!tag || token.selfClosing) continue
    openTag(stack, tag)
  }
  return serialize(root)
}

function canonical(tag: string): string | null {
  if (tag === "div") return "p"
  if (tag === "b") return "strong"
  if (tag === "i") return "em"
  if (BLOCK.has(tag) || INLINE.has(tag) || LIST.has(tag) || tag === "li") return tag
  return null
}

function openTag(stack: El[], tag: string) {
  if (INLINE.has(tag)) {
    ensureTextParent(stack)
    push(stack, tag)
    return
  }
  unwindInlines(stack)
  if (tag === "li") {
    while (stack.length > 1 && top(stack).tag !== "ul" && top(stack).tag !== "ol" && top(stack).tag !== "div") pop(stack)
    if (top(stack).tag !== "ul" && top(stack).tag !== "ol") push(stack, "ul")
    push(stack, "li")
    return
  }
  if (LIST.has(tag)) {
    while (stack.length > 1 && top(stack).tag !== "div" && top(stack).tag !== "li") pop(stack)
    push(stack, tag)
    return
  }
  if (top(stack).tag === "ul" || top(stack).tag === "ol") push(stack, "li")
  while (stack.length > 1 && top(stack).tag !== "div" && top(stack).tag !== "li") pop(stack)
  push(stack, tag)
}

function closeTag(stack: El[], tag: string) {
  for (let index = stack.length - 1; index >= 1; index -= 1) {
    if (stack[index]?.tag !== tag) continue
    while (stack.length > index) pop(stack)
    return
  }
}

function unwindInlines(stack: El[]) {
  while (INLINE.has(top(stack).tag)) pop(stack)
}

function ensureTextParent(stack: El[]) {
  const parent = top(stack)
  if (BLOCK.has(parent.tag) || parent.tag === "li" || INLINE.has(parent.tag)) return
  if (parent.tag === "ul" || parent.tag === "ol") {
    push(stack, "li")
    return
  }
  push(stack, "p")
}

function appendText(stack: El[], value: string) {
  if (!value) return
  const parent = top(stack)
  if ((parent.tag === "div" || parent.tag === "ul" || parent.tag === "ol") && !value.trim()) return
  ensureTextParent(stack)
  const host = top(stack)
  const last = host.children[host.children.length - 1]
  if (typeof last === "string") host.children[host.children.length - 1] = last + value
  else host.children.push(value)
}

function appendInline(stack: El[], el: El) {
  const parent = top(stack)
  if ((parent.tag === "div" || parent.tag === "ul" || parent.tag === "ol") && el.tag === "br") {
    ensureTextParent(stack)
  }
  ensureTextParent(stack)
  top(stack).children.push(el)
}

function push(stack: El[], tag: string) {
  const el: El = { tag, children: [] }
  top(stack).children.push(el)
  stack.push(el)
}

function pop(stack: El[]) {
  const closed = stack.pop()
  if (!closed || stack.length === 0) return
  if (closed.children.length === 0) {
    const parent = top(stack)
    if (parent.children[parent.children.length - 1] === closed) parent.children.pop()
  }
}

function top(stack: El[]): El {
  return stack[stack.length - 1] ?? { tag: "div", children: [] }
}

function serialize(el: El): string {
  if (el.tag === "br") return "<br>"
  const inner = el.children
    .map((child) => (typeof child === "string" ? escapeHtml(child) : serialize(child)))
    .join("")
  if (el.tag === "div") return inner
  if (!inner) return ""
  return `<${el.tag}>${inner}</${el.tag}>`
}

function tokenize(html: string): Token[] {
  const tokens: Token[] = []
  let index = 0
  while (index < html.length) {
    if (html.startsWith("<!--", index)) {
      const end = html.indexOf("-->", index + 4)
      index = end === -1 ? html.length : end + 3
      continue
    }
    if (html[index] !== "<") {
      const next = html.indexOf("<", index)
      const raw = html.slice(index, next === -1 ? html.length : next)
      index = next === -1 ? html.length : next
      const value = decode(raw)
      if (value) tokens.push({ kind: "text", value })
      continue
    }
    const end = tagEnd(html, index + 1)
    const raw = html.slice(index, end)
    index = end
    const token = readTag(raw)
    if (token) tokens.push(token)
  }
  return tokens
}

function tagEnd(html: string, index: number): number {
  let quote = ""
  for (let cursor = index; cursor < html.length; cursor += 1) {
    const ch = html[cursor]
    if (quote) {
      if (ch === quote) quote = ""
      continue
    }
    if (ch === "\"" || ch === "'") {
      quote = ch
      continue
    }
    if (ch === ">") return cursor + 1
  }
  return html.length
}

function readTag(raw: string): Token | null {
  const match = /^<\/?\s*([a-zA-Z][a-zA-Z0-9]*)/.exec(raw)
  if (!match?.[1]) return null
  const tag = match[1].toLowerCase()
  if (raw.startsWith("</")) return { kind: "close", tag }
  if (tag === "br") return { kind: "br" }
  return { kind: "open", tag, selfClosing: /\/\s*>$/.test(raw) }
}

function decode(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (entity) => {
    const body = entity.slice(1, -1).toLowerCase()
    if (body === "amp") return "&"
    if (body === "lt") return "<"
    if (body === "gt") return ">"
    if (body === "quot") return "\""
    if (body === "apos") return "'"
    if (body === "nbsp") return "\u00a0"
    if (body.startsWith("#x")) {
      const code = Number.parseInt(body.slice(2), 16)
      return fromCode(code)
    }
    if (body.startsWith("#")) {
      const code = Number.parseInt(body.slice(1), 10)
      return fromCode(code)
    }
    return entity
  })
}

function fromCode(code: number): string {
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return ""
  if (code < 32 && code !== 9 && code !== 10 && code !== 13) return ""
  return String.fromCodePoint(code)
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}
