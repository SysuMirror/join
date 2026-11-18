/**
 * 极简 Markdown 渲染器（无第三方依赖）。
 *
 * 只用于渲染管理员维护的集市历史正文，支持：
 * 标题、段落、粗体/斜体、行内代码、链接、引用、有序/无序列表、
 * 表格、分隔线与围栏代码块。
 *
 * 所有原始 HTML 都会被转义，链接只放行 http(s) / mailto / 站内路径。
 */

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (ch) => ESCAPES[ch] || ch)
}

function safeUrl(raw: string): string {
  const url = raw.trim()
  if (/^(https?:\/\/|mailto:)/i.test(url)) return url
  if (url.startsWith('/')) return url
  return '#'
}

function inline(src: string): string {
  const codes: string[] = []
  let text = escapeHtml(src)

  // 行内代码先抽出，避免内部字符被后续规则误处理
  text = text.replace(/`([^`]+)`/g, (_m, code: string) => {
    codes.push(`<code>${code}</code>`)
    return `\u0000C${codes.length - 1}\u0000`
  })

  text = text.replace(
    /\[([^\]]+)\]\(([^)\s]+)\)/g,
    (_m, label: string, url: string) =>
      `<a href="${escapeHtml(safeUrl(url))}" target="_blank" rel="noopener noreferrer">${label}</a>`,
  )
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  text = text.replace(
    /(^|[\s（(【])\*([^*\n]+)\*(?=$|[\s）)】。，,.!?！？])/g,
    '$1<em>$2</em>',
  )

  text = text.replace(/\u0000C(\d+)\u0000/g, (_m, idx: string) => codes[Number(idx)] || '')
  return text
}

function isListLine(line: string): boolean {
  return /^\s*(?:[-*+]|\d+[.)])\s+/.test(line)
}

function isTableSeparator(line: string): boolean {
  return /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(line)
}

function isBlockStart(line: string, next?: string): boolean {
  return (
    /^\s*```/.test(line) ||
    /^\s*#{1,6}\s+/.test(line) ||
    /^\s*>\s?/.test(line) ||
    /^\s*([-*_])\1{2,}\s*$/.test(line) ||
    isListLine(line) ||
    (line.includes('|') && Boolean(next && isTableSeparator(next)))
  )
}

function splitTableRow(line: string): string[] {
  let row = line.trim()
  if (row.startsWith('|')) row = row.slice(1)
  if (row.endsWith('|')) row = row.slice(0, -1)
  return row.split('|').map((cell) => cell.trim())
}

function renderTable(lines: string[], start: number): { html: string; next: number } {
  const header = splitTableRow(lines[start])
  let i = start + 2
  const rows: string[][] = []
  while (i < lines.length && lines[i].trim() && lines[i].includes('|')) {
    rows.push(splitTableRow(lines[i]))
    i += 1
  }
  const head = header.map((cell) => `<th>${inline(cell)}</th>`).join('')
  const body = rows
    .map(
      (row) =>
        `<tr>${header
          .map((_h, idx) => `<td>${inline(row[idx] ?? '')}</td>`)
          .join('')}</tr>`,
    )
    .join('')
  return {
    html: `<div class="md-table"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`,
    next: i,
  }
}

function renderList(lines: string[], start: number): { html: string; next: number } {
  const ordered = /^\s*\d+[.)]\s+/.test(lines[start])
  const items: string[] = []
  let i = start
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) break
    const match = line.match(/^\s*(?:[-*+]|\d+[.)])\s+(.*)$/)
    if (match) {
      items.push(match[1])
      i += 1
      continue
    }
    // 缩进的续行并入上一项
    if (/^\s{2,}\S/.test(line) && items.length) {
      items[items.length - 1] += ` ${line.trim()}`
      i += 1
      continue
    }
    break
  }
  const tag = ordered ? 'ol' : 'ul'
  const html = `<${tag}>${items.map((item) => `<li>${inline(item)}</li>`).join('')}</${tag}>`
  return { html, next: i }
}

export function renderMarkdown(source: string): string {
  const lines = String(source || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
  const out: string[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) {
      i += 1
      continue
    }

    // 围栏代码块
    const fence = line.match(/^\s*```(\S*)\s*$/)
    if (fence) {
      const lang = fence[1] || ''
      const code: string[] = []
      i += 1
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) {
        code.push(lines[i])
        i += 1
      }
      i += 1 // 跳过结束围栏
      const cls = lang ? ` class="language-${escapeHtml(lang)}"` : ''
      out.push(`<pre><code${cls}>${escapeHtml(code.join('\n'))}</code></pre>`)
      continue
    }

    // 标题（正文从 h3 开始，避免和章节标题抢层级）
    const heading = line.match(/^\s*(#{1,6})\s+(.+)$/)
    if (heading) {
      const level = Math.min(6, heading[1].length + 2)
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`)
      i += 1
      continue
    }

    // 分隔线
    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      out.push('<hr />')
      i += 1
      continue
    }

    // 引用
    if (/^\s*>\s?/.test(line)) {
      const quote: string[] = []
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        quote.push(lines[i].replace(/^\s*>\s?/, ''))
        i += 1
      }
      out.push(`<blockquote><p>${quote.map(inline).join('<br />')}</p></blockquote>`)
      continue
    }

    // 表格
    if (line.includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const table = renderTable(lines, i)
      out.push(table.html)
      i = table.next
      continue
    }

    // 列表
    if (isListLine(line)) {
      const list = renderList(lines, i)
      out.push(list.html)
      i = list.next
      continue
    }

    // 段落：收集到空行或下一个块级元素
    const para: string[] = [line]
    i += 1
    while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i], lines[i + 1])) {
      para.push(lines[i])
      i += 1
    }
    out.push(`<p>${para.map(inline).join('<br />')}</p>`)
  }

  return out.join('\n')
}