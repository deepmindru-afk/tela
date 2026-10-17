// The tela keymap, as data. Imported once for its side effects (KeymapHost
// imports it) so the registry is populated before the engine mounts. Add a
// binding here and it works in the dispatcher AND shows up in the `?`
// cheatsheet automatically.
//
// Groups (and their first-seen order) drive the cheatsheet sections:
//   Go to · Actions · Move · Reading · General

import { registerKeys } from './keymap'

// --- Go to (jumps) — authed app only -----------------------------------
const GO = 'Перейти'

registerKeys({
  id: 'go.home',
  keys: 'g h',
  label: 'Главная',
  group: GO,
  when: 'app',
  run: (c) => c.navigate('/'),
})
registerKeys({
  id: 'go.ask',
  keys: 'g a',
  label: 'Спросить о документах',
  group: GO,
  when: 'app',
  run: (c) => c.navigate('/ask'),
})
registerKeys({
  id: 'go.graph',
  keys: 'g r',
  label: 'Граф',
  group: GO,
  when: 'app',
  run: (c) => c.navigate('/graph'),
})
registerKeys({
  id: 'go.shared',
  keys: 'g e',
  label: 'Доступно всем',
  group: GO,
  when: 'app',
  run: (c) => c.navigate('/shared'),
})
registerKeys({
  id: 'go.inbox',
  keys: 'g i',
  label: 'Быстрые заметки',
  group: GO,
  when: 'app',
  run: (c) => c.navigate('/n'),
})
registerKeys({
  id: 'go.search',
  keys: 'g s',
  label: 'Полный поиск',
  group: GO,
  when: 'app',
  run: (c) => c.navigate('/search'),
})

// --- Actions — authed app only -----------------------------------------
const ACT = 'Действия'

registerKeys({
  id: 'act.palette',
  keys: '/',
  label: 'Найти страницу',
  group: ACT,
  when: 'app',
  run: (c) => c.openPalette(),
})
registerKeys({
  id: 'act.new',
  keys: 'c',
  label: 'Создать страницу',
  group: ACT,
  when: 'app',
  run: (c) => c.openNewPage(),
})
registerKeys({
  id: 'act.theme',
  keys: 't',
  label: 'Переключить тему',
  group: ACT,
  when: 'app',
  run: (c) => c.toggleTheme(),
})
registerKeys({
  id: 'act.sidebar',
  keys: '\\',
  label: 'Переключить боковую панель',
  group: ACT,
  when: 'app',
  run: (c) => c.toggleSidebar(),
})

// --- Move (roving / scroll) — every surface ----------------------------
const MOVE = 'Перемещение'

registerKeys({
  id: 'move.down',
  keys: 'j',
  label: 'Вниз (следующий элемент / прокрутка)',
  group: MOVE,
  run: (c) => c.down(),
})
registerKeys({
  id: 'move.up',
  keys: 'k',
  label: 'Вверх (предыдущий элемент / прокрутка)',
  group: MOVE,
  run: (c) => c.up(),
})
registerKeys({
  id: 'move.top',
  keys: 'g g',
  label: 'Перейти в начало',
  group: MOVE,
  run: (c) => c.top(),
})
registerKeys({
  id: 'move.bottom',
  keys: 'G',
  label: 'Перейти в конец',
  group: MOVE,
  run: (c) => c.bottom(),
})
registerKeys({
  id: 'move.activate',
  keys: ['Enter', 'o'],
  label: 'Открыть выбранный элемент',
  group: MOVE,
  run: (c) => c.activate(),
})

// --- Reading — every surface (no-ops outside a reader) ------------------
const READ = 'Чтение'

registerKeys({
  id: 'read.prev-section',
  keys: '[',
  label: 'Предыдущий заголовок',
  group: READ,
  run: (c) => c.prevSection(),
})
registerKeys({
  id: 'read.next-section',
  keys: ']',
  label: 'Следующий заголовок',
  group: READ,
  run: (c) => c.nextSection(),
})

// --- General — every surface -------------------------------------------
registerKeys({
  id: 'gen.help',
  keys: '?',
  label: 'Сочетания клавиш',
  group: 'Общие',
  run: (c) => c.openCheatsheet(),
})
