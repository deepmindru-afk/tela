// Starter set of application commands. Imported once for its side effects;
// future tasks add commands by registering them in their own module and
// importing that module at app boot.

import {
  Folder,
  FolderPlus,
  HelpCircle,
  MessageSquarePlus,
  MonitorCog,
  Palette,
} from 'lucide-react'
import { registerCommand } from '../commands'
import { emitOpenNewSpace } from '../newSpaceEvent'
import { emitOpenFeedback } from '../feedbackEvent'
import { cycleTheme, followSystem } from '../theme'

registerCommand({
  id: 'tela.toggle-theme',
  title: 'Переключить тему',
  subtitle: 'Перебирает светлую → тёмную → тёплую → системную',
  icon: <Palette width={14} height={14} />,
  keywords: ['theme', 'appearance', 'dark', 'light', 'warm'],
  run: () => cycleTheme(),
})

registerCommand({
  id: 'tela.follow-system-theme',
  title: 'Следовать теме системы',
  subtitle: 'Учитывает настройку светлой/тёмной темы в ОС',
  icon: <MonitorCog width={14} height={14} />,
  keywords: ['theme', 'system', 'auto', 'appearance', 'os', 'dark', 'light'],
  run: () => followSystem(),
})

registerCommand({
  id: 'tela.new-space',
  title: 'Новое пространство',
  subtitle: 'Создать пространство',
  icon: <FolderPlus width={14} height={14} />,
  keywords: ['space', 'new', 'create', 'add'],
  run: () => emitOpenNewSpace(),
})

registerCommand({
  id: 'tela.go-to-space',
  title: 'Перейти к пространству…',
  subtitle: 'Перейти в другое пространство',
  icon: <Folder width={14} height={14} />,
  keywords: ['space', 'navigate', 'jump', 'switch'],
  keepPaletteOpen: true,
  run: (ctx) => {
    ctx.openSubPicker({
      label: 'Перейти к пространству',
      placeholder: 'Поиск пространств…',
      emptyMessage:
        ctx.spaces.length === 0 ? 'Пространств пока нет.' : 'Ничего не найдено.',
      items: ctx.spaces.map((space) => ({
        id: `space:${space.id}`,
        title: space.name || 'Пространство без названия',
        subtitle: space.slug || undefined,
        icon: <Folder width={14} height={14} />,
        keywords: [space.name, space.slug].filter(Boolean) as string[],
        onSelect: () => ctx.navigateToSpace(space.id),
      })),
    })
  },
})

registerCommand({
  id: 'tela.send-feedback',
  title: 'Отправить отзыв',
  subtitle: 'Сообщить команде tela',
  icon: <MessageSquarePlus width={14} height={14} />,
  keywords: ['feedback', 'bug', 'idea', 'suggestion', 'report', 'contact'],
  run: () => emitOpenFeedback(),
})

registerCommand({
  id: 'tela.show-shortcuts',
  title: 'Показать сочетания клавиш',
  subtitle: 'Показать все сочетания клавиш',
  icon: <HelpCircle width={14} height={14} />,
  keywords: ['help', 'shortcuts', 'keys', 'keyboard'],
  keepPaletteOpen: true,
  run: (ctx) => {
    ctx.openHelpMode()
  },
})
