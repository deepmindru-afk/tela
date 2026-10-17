import { editorViewCtx, parserCtx } from '@milkdown/kit/core'
import { Slice } from '@milkdown/kit/prose/model'
import type { Ctx } from '@milkdown/ctx'

// Built-in templates inserted from the slash menu — the markdown-safe stand-in
// for Notion "buttons". Each template is just a markdown snippet; inserting it
// parses the markdown to PM nodes and drops them at the cursor, so there's
// nothing proprietary and the result is ordinary editable content.
// User-defined templates are deferred (would need storage).

export interface TemplateDef {
  id: string
  label: string
  keywords: string[]
  markdown: string
}

export const TEMPLATES: TemplateDef[] = [
  {
    id: 'tpl-meeting',
    label: 'Заметки о встрече',
    keywords: ['template', 'meeting', 'notes', 'agenda'],
    markdown: `## Заметки о встрече

**Дата:**
**Участники:**

### Повестка
-

### Заметки
-

### Пункты к действию
- [ ]
`,
  },
  {
    id: 'tpl-decision',
    label: 'Запись о решении',
    keywords: ['template', 'decision', 'adr', 'record'],
    markdown: `## Решение

**Статус:** Предложено
**Дата:**

### Контекст

### Решение

### Последствия
`,
  },
  {
    id: 'tpl-weekly',
    label: 'Итоги недели',
    keywords: ['template', 'weekly', 'review', 'retro'],
    markdown: `## Итоги недели

### Готово на этой неделе
- [ ]

### Следующая неделя
- [ ]

### Блокеры
-
`,
  },
]

// Parse a markdown snippet and replace the current selection with its blocks.
export function insertTemplate(ctx: Ctx, markdown: string) {
  const view = ctx.get(editorViewCtx)
  const parser = ctx.get(parserCtx)
  const doc = parser(markdown)
  if (!doc) return
  const slice = new Slice(doc.content, 0, 0)
  view.dispatch(view.state.tr.replaceSelection(slice).scrollIntoView())
  view.focus()
}
