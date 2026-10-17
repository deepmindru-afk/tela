# tela — Russian UI glossary (canonical)

Authoritative terminology for the Russian translation of the tela frontend.
Use these exact forms. Do not invent alternatives.

## Brand & feature names (transliterated per user decision)

| English | Russian | Note |
|---|---|---|
| tela | **tela** | Brand stays Latin. Cyrillic "тела" is an ordinary Russian word ("bodies") and misrepresents the product. Never transliterate. |
| Atlas | **Атлас** | Transliterate |
| Graph | **Граф** | Transliterate |
| Space | **Пространство** | Transliterate; plural Пространства |
| Page | **Страница** | plural Страницы |
| Home | **Главная** | |
| Docs | **Документы** | |
| Ask | **Спросить** | imperative form; the Ask feature |
| Deck | **Колода** | |
| Comment | **Комментарий** | plural Комментарии |
| Team | **Команда** | |
| Organization | **Организация** | |

## Common verbs and UI nouns

| English | Russian |
|---|---|
| Save | Сохранить |
| Cancel | Отмена |
| Delete | Удалить |
| Remove | Удалить |
| Edit | Редактировать |
| Create | Создать |
| New | Новый / Создать (per context) |
| Close | Закрыть |
| Back | Назад |
| Next | Далее |
| Previous | Назад |
| Continue | Продолжить |
| Submit | Отправить |
| Send | Отправить |
| Search | Поиск |
| Share | Поделиться |
| Copy | Копировать |
| Copied | Скопировано |
| Download | Скачать |
| Upload | Загрузить |
| Import | Импорт |
| Export | Экспорт |
| Rename | Переименовать |
| Move | Переместить |
| Duplicate | Дублировать |
| Retry | Повторить |
| Refresh | Обновить |
| Manage | Управление |
| Settings | Настройки |
| Loading | Загрузка |
| Loading… | Загрузка… |
| Something went wrong | Что-то пошло не так |
| Error | Ошибка |
| Warning | Предупреждение |
| Success | Успешно |
| Optional | Необязательно |
| Required | Обязательно |
| Name | Название |
| Description | Описание |
| Title | Заголовок |
| Type | Тип |
| Status | Статус |
| Role | Роль |
| Member | Участник |
| Members | Участники |
| Permissions | Права доступа |
| Public | Публичный |
| Private | Приватный |
| Public on the web | Доступен в интернете |
| Members only | Только участники |
| Anyone with the link | Все, у кого есть ссылка |
| Password | Пароль |
| Link | Ссылка |
| Email | Электронная почта |
| Profile | Профиль |
| Usage | Использование |
| Insights | Аналитика |
| API key | API-ключ |
| API keys | API-ключи |
| License | Лицензия |
| Licenses | Лицензии |
| Billing | Оплата |
| Audit log | Журнал аудита |
| Notifications | Уведомления |
| Instance | Инстанс |
| Search index | Индекс поиска |
| Trial | Пробный период |
| Plan | Тариф |
| Favorites | Избранное |
| Recent changes | Недавние изменения |
| Recently visited | Недавно посещённые |
| Untitled space | Пространство без названия |
| Untitled page | Страница без названия |
| Quick note | Быстрая заметка |
| Take the tour | Пройти обзор |
| Couldn't load spaces. | Не удалось загрузить пространства. |

## Style rules

1. **Formal "вы"** addressing in any user-facing sentence. Imperatives stay imperative.
2. Keep the ellipsis character `…` where English used `…` (sidebar uses `Search…`, `New…`).
3. Keep trailing question marks, exclamation marks, and periods matching the English punctuation.
4. Sentence case in Russian: capitalize only the first word of a heading or sentence, unless it is a proper noun (Atlas, tela, API).
5. Keep units, numbers, dates, times, currency and percentages exactly as-is. Format them per locale conventions but never invent values.
6. Buttons in Russian are typically infinitive ("Сохранить", "Удалить") — not imperative ("Сохрани").
7. Do not translate technical protocol tokens: `GET`, `POST`, `PATCH`, `DELETE`, `PUT`, HTTP status text, MIME types, `application/json`, URLs, file extensions, env var names, API route paths, JSON keys.

## Hard safety rules — never modify these

Editing UI copy in a codebase with no i18n layer is a blunt instrument. These are **never** UI copy, even when they contain English words:

- `to="/ask"`, `to="/graph"`, `href`, route paths, URL fragments — **translate aria-label/title but NOT the route**
- `className`, `class`, any CSS class string; CSS custom property names like `--text-muted`; Tailwind utilities
- `import` / `export` statements and module paths; file names
- Identifiers: variables, functions, props, types, interfaces, class names, enum members
- `data-*` attributes, `id`, `key`, `name`, `htmlFor`/`for` values, `aria-labelledby`/`aria-describedby` IDs
- API request/response field names and values sent over the wire
- `variant="ghost"`, `size="sm"`, `color=`, `type="button"` and similar design-system prop values
- Test fixtures and expected values
- Brand string `tela`
- Anything inside markdown/HTML content strings that is user data rather than chrome

If a string is ambiguous between "chrome" and "identifier", **leave it in English**.