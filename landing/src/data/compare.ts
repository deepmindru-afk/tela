// Data for the /compare/<slug> pages. One entry per competitor; the page
// template (src/pages/compare/[slug].astro) and the sitemap read from here.
//
// Voice: plain, capability-first, honest — matches Compare.astro. Each page
// concedes what the competitor still does better (the "when X is better" line).
// FACTS (verified mid-2026): tela is open-source (AGPL), self-hostable,
// markdown-native (canonical markdown, no block table), with a built-in MCP
// server (39 tools) and Atlas (a cited, coverage-checked wiki generated from
// git + Jira). The real differentiator is ATLAS + open-source/self-host/markdown
// ownership — NOT "they have no MCP": Notion, Confluence, GitBook, Docmost,
// Slite, Nuclino and Coda all ship MCP. Never claim a competitor lacks MCP.
// Keep compare pages price-agnostic on purpose (durability): say "self-host free
// · free cloud tier", not concrete numbers — so a pricing change never stales
// these. Canonical prices live in docs/editions-and-pricing.md + the landing.

export interface CompareRow {
  /** Comparison dimension. */
  feature: string;
  /** tela's value. */
  tela: string;
  /** the competitor's value. */
  them: string;
}

export interface Competitor {
  slug: string;
  /** Proper display name, e.g. "Notion". */
  name: string;
  seoTitle: string;
  metaDescription: string;
  /** The H1 / page heading. */
  heading: string;
  /** Lead paragraph (plain text). */
  lead: string;
  rows: CompareRow[];
  /** "Why teams switch" bullets. */
  whySwitch: string[];
  /** Honest "when <competitor> is the better choice". */
  whenBetter: string;
  /** Short source note (where the competitor facts came from). */
  source: string;
}

const TELA_LICENSE = 'Открытый исходный код (AGPL-3.0)';
const TELA_SELFHOST = 'Да — бесплатный self-host + бесплатный облачный тариф';
const TELA_STORAGE = 'Канонический markdown, который вам принадлежит';
const TELA_ASK = 'Встроено — семантический + полнотекстовый поиск, ответы с цитатами';
const TELA_MCP = 'Встроено — агенты читают и пишут (39 инструментов с ограниченным доступом)';
const TELA_ATLAS = 'Да — Atlas строит вики с цитированием и проверкой покрытия из git + Jira';

export const competitors: Competitor[] = [
  {
    slug: 'notion',
    name: 'Notion',
    seoTitle: 'Альтернатива Notion — открытый исходный код, self-host, агенты «из коробки» | tela',
    metaDescription:
      'Открытая альтернатива Notion с возможностью самостоятельного размещения. tela хранит канонический markdown, который вам принадлежит, отвечает на вопросы по вашим документам с цитатами и создаёт вики с цитированием из вашего кода с помощью Atlas.',
    heading: 'Открытая альтернатива Notion с собственным размещением',
    lead: 'Notion — это мощное универсальное рабочее пространство, но ваши страницы хранятся в проприетарной блочной базе данных, оно доступно только в облаке, и ничто в нём не пишет документацию из вашего кода. tela — это markdown-ориентированная, саморазмещаемая и агент-ориентированная платформа, а Atlas создаёт вики с цитированием прямо из ваших git-репозиториев и Jira.',
    rows: [
      { feature: 'Storage', tela: TELA_STORAGE, them: 'Проприетарная блочная база данных' },
      { feature: 'Self-hostable', tela: TELA_SELFHOST, them: 'Нет — только облако' },
      { feature: 'Ask your docs (AI)', tela: TELA_ASK, them: '"Ask Notion" — на тарифе Business' },
      { feature: 'Agents read & write (MCP)', tela: TELA_MCP, them: 'Официальный MCP-сервер (за платным AI)' },
      { feature: 'Generate docs from your code', tela: TELA_ATLAS, them: 'Нет' },
    ],
    whySwitch: [
      'Ваши документы пишутся сами — укажите Atlas на репозиторий или проект Jira, и он создаст вики с цитированием и проверкой покрытия.',
      'Владейте своим контентом в портативном markdown — экспорт не требует преобразований, в отличие от потери данных при выгрузке из блочного хранилища.',
      'Размещайте на собственной инфраструктуре или используйте бесплатный облачный тариф.',
    ],
    whenBetter:
      'Notion на годы впереди по базам данных, шаблонам и общей полировке. Если вам нужно реляционное рабочее пространство — трекеры, доски проектов, лёгкие приложения — а не вики, то Notion — лучший инструмент.',
    source: 'Цены Notion + MCP-сервер Notion (проверено в 2026).',
  },
  {
    slug: 'confluence',
    name: 'Confluence',
    seoTitle: 'Альтернатива Confluence — быстрая, self-hosted, с AI «из коробки» | tela',
    metaDescription:
      'Лёгкая альтернатива Confluence с самостоятельным размещением и встроенным AI. tela использует markdown как основной формат, создаёт вики с цитированием из вашего кода с помощью Atlas и не тарифицирует запросы к вашим документам.',
    heading: 'Альтернатива Confluence, которой ваши инженеры действительно будут доверять',
    lead: 'Confluence тяжёл, а его AI (Rovo) тарифицируется в кредитах, причём лучший AI доступен на более дорогих тарифах. И, как и другие устаревшие решения, он не умеет писать документацию из вашего исходного кода. tela — лёгкая, markdown-ориентированная, AI-нативная противоположность — а Atlas поддерживает вики в актуальном состоянии, генерируя её из ваших git-репозиториев и Jira.',
    rows: [
      { feature: 'Feel', tela: 'Быстрый, markdown-ориентированный, чистый редактор', them: 'Тяжёлый; проприетарный редактор' },
      { feature: 'Self-hostable', tela: TELA_SELFHOST, them: 'Data Center (enterprise) или облако' },
      { feature: 'Ask your docs (AI)', tela: TELA_ASK, them: 'Rovo — тарифицируется в кредитах' },
      { feature: 'Agents read & write (MCP)', tela: TELA_MCP, them: 'Rovo MCP (за платным тарифом)' },
      { feature: 'Generate docs from your code', tela: TELA_ATLAS, them: 'Нет' },
    ],
    whySwitch: [
      'Он обновляется сам — Atlas перегенерирует вики из кода и отслеживает расхождения; обычная причина, по которой пространства Confluence устаревают, в том, что их никто не обновляет.',
      'Никакого учёта кредитов только за то, чтобы задать вопрос своей же вики.',
      'Лёгкий и управляемый — вики, которую можно разместить самостоятельно, с портативным markdown, а не громоздкая корпоративная установка.',
    ],
    whenBetter:
      'Если ваша организация глубоко интегрирована в стек Atlassian — рабочие процессы Jira, корпоративный SSO и управление, масштаб на тысячи пользователей — глубина интеграции Confluence и существующие инвестиции — веские причины остаться. tela документирует из Jira; она не управляет Jira.',
    source: 'Цены Atlassian Rovo + Rovo MCP (проверено в 2026).',
  },
  {
    slug: 'outline',
    name: 'Outline',
    seoTitle: 'Альтернатива Outline — вики с открытым кодом (AGPL) и агентами «из коробки» | tela',
    metaDescription:
      'tela против Outline: обе вики на markdown с возможностью самостоятельного размещения. tela — AGPL (Outline — BSL-1.1, доступность исходного кода без OSI-сертификации), с бесплатным облачным тарифом, встроенным MCP-сервером и Atlas — вики с цитированием, создаваемой из вашего кода.',
    heading: 'tela против Outline — AI-нативный, полностью открытый вариант',
    lead: 'Outline — действительно хорошая и самая близкая по функциональности вики — полированная, с возможностью самостоятельного размещения на markdown. Различия три: лицензия, модель ценообразования и весь AI-слой. Outline использует BSL-1.1 (доступность исходного кода, но не OSI-открытый) без бесплатного облака и без первоклассного слоя агентов/автодокументации; tela — AGPL с бесплатным облачным тарифом, встроенным MCP-сервером и Atlas.',
    rows: [
      { feature: 'License', tela: TELA_LICENSE, them: 'BSL 1.1 — доступность исходного кода, не OSI-открытый' },
      { feature: 'Self-hostable', tela: TELA_SELFHOST, them: 'Да (без бесплатного облака)' },
      { feature: 'Ask your docs (AI)', tela: TELA_ASK, them: 'Self-host + свой ключ OpenAI' },
      { feature: 'Agents read & write (MCP)', tela: TELA_MCP, them: 'Нет официального сервера (только сторонние)' },
      { feature: 'Generate docs from your code', tela: TELA_ATLAS, them: 'Нет' },
    ],
    whySwitch: [
      'То, что Outline никогда не создавал — Atlas генерирует вики с цитированием из вашего кода, а встроенный MCP-сервер делает агентов полноправными авторами.',
      'Более чистая история с открытым исходным кодом — AGPL (настоящий OSI-открытый) против ограничений BSL.',
      'Бесплатный облачный тариф для оценки, плюс self-host когда захотите.',
    ],
    whenBetter:
      'Outline — это зрелая, красиво оформленная самостоятельно размещаемая вики с сильным сообществом. Если вам нужна отличная саморазмещаемая вики сегодня и вы не нуждаетесь в AI-генерации или агентах, Outline — отличный, стабильный выбор.',
    source: 'Цены Outline + лицензия BSL-1.1 репозитория (проверено в 2026).',
  },
  {
    slug: 'gitbook',
    name: 'GitBook',
    seoTitle: 'Альтернатива GitBook — self-hosted AI-вики, которая вам принадлежит | tela',
    metaDescription:
      'Открытая альтернатива GitBook для внутренних знаний команды с самостоятельным размещением. tela создаёт вики с цитированием из вашего репозитория с помощью Atlas, а агенты могут не только читать, но и писать в неё.',
    heading: 'Открытая альтернатива GitBook, которая документирует себя сама',
    lead: 'GitBook отлично подходит для публичной документации продуктов, но это проприетарное SaaS-решение, которое нельзя разместить самостоятельно, с ценой за опубликованный сайт, а его Git Sync только зеркалирует markdown, который вы уже написали. tela — это выбор для внутренних знаний команды, которые вам принадлежат — markdown-ориентированная, саморазмещаемая и генерируемая из вашего реального исходного кода.',
    rows: [
      { feature: 'License', tela: TELA_LICENSE, them: 'Проприетарное SaaS' },
      { feature: 'Self-hostable', tela: TELA_SELFHOST, them: 'Нет — только облако' },
      { feature: 'Ask your docs (AI)', tela: TELA_ASK, them: 'AI на высшем тарифе' },
      { feature: 'Agents read & write (MCP)', tela: TELA_MCP, them: 'MCP, но только для чтения (опубликованные документы)' },
      { feature: 'Generate docs from your code', tela: TELA_ATLAS, them: 'Нет — Git Sync зеркалирует существующий markdown' },
    ],
    whySwitch: [
      'Atlas пишет черновик из вашего кода; Git Sync в GitBook только зеркалирует markdown, написанный вручную.',
      'Агенты — полноправные участники: MCP GitBook доступен только для чтения и открывает только опубликованные документы; агенты tela ищут и пишут в вашу живую вики.',
      'Размещайте самостоятельно под AGPL и храните портативный markdown вместо аренды за каждый опубликованный сайт.',
    ],
    whenBetter:
      'Если ваша задача — красивая публичная документация для разработчиков — версионированные API-референсы, многоверсионная документация для библиотеки с открытым кодом, брендированный сайт документации — GitBook отличен и его трудно превзойти. tela — это командная вики, а не платформа для публикации документации.',
    source: 'Цены GitBook + MCP для опубликованных документов (проверено в 2026).',
  },
  {
    slug: 'bookstack',
    name: 'BookStack',
    seoTitle: 'Альтернатива BookStack — AI-нативная, готовая к агентам self-hosted вики | tela',
    metaDescription:
      'Саморазмещаемая альтернатива BookStack со встроенным AI и нативным MCP-сервером. tela хранит канонический markdown, отвечает на вопросы по вашим документам и создаёт вики из вашего репозитория с помощью Atlas.',
    heading: 'AI-нативная альтернатива BookStack с открытым исходным кодом',
    lead: 'BookStack — это надёжная, распространяемая по лицензии MIT саморазмещаемая вики — и если вам просто нужны полки, книги и страницы, это отличный бесплатный выбор. Но в нём нет встроенного AI, официального MCP-сервера, контент хранится в HTML, а не в markdown, и он не генерирует документацию из кода. tela добавляет все четыре функции.',
    rows: [
      { feature: 'License', tela: TELA_LICENSE, them: 'Открытый исходный код (MIT)' },
      { feature: 'Storage', tela: TELA_STORAGE, them: 'В основном HTML' },
      { feature: 'Ask your docs (AI)', tela: TELA_ASK, them: 'Нет встроенного' },
      { feature: 'Agents read & write (MCP)', tela: TELA_MCP, them: 'Нет официального сервера (только сообщество)' },
      { feature: 'Generate docs from your code', tela: TELA_ATLAS, them: 'Нет' },
      { feature: 'Live collaboration', tela: 'Да — многопользовательская работа в реальном времени', them: 'Нет совместного редактирования в реальном времени' },
    ],
    whySwitch: [
      'Задавайте вопросы своим документам, а не просто ищите по ключевым словам — семантические ответы с цитатами сразу из коробки.',
      'Агенты — полноправные участники через встроенный MCP-сервер; у BookStack только обёртки API сообщества.',
      'Atlas превращает репозиторий в вики с цитированием; контент BookStack полностью создаётся вручную.',
    ],
    whenBetter:
      'BookStack более зрелый, очень прост в запуске, действительно бесплатный и распространяется по лицензии MIT без копилефта. Если вам нужна простая, с разрешительной лицензией вики для документации без AI-амбиций, это фантастический, более лёгкий выбор.',
    source: 'Документация BookStack + модель хранения контента (проверено в 2026).',
  },
  {
    slug: 'docmost',
    name: 'Docmost',
    seoTitle: 'Альтернатива Docmost — markdown-ориентированная, AI и агенты без ограничений | tela',
    metaDescription:
      'Markdown-ориентированная альтернатива Docmost. tela хранит канонический markdown (не ProseMirror JSON), предоставляет AI и доступ агентам без Enterprise-лицензии и создаёт вики с цитированием из вашего кода с помощью Atlas.',
    heading: 'Markdown-ориентированная, саморазмещаемая альтернатива Docmost',
    lead: 'Docmost — самый близкий к tela инструмент: оба на AGPL, оба с self-host, оба с совместной работой в реальном времени, и оба с MCP-сервером. Реальные различия три: Docmost хранит данные в ProseMirror JSON, а не в markdown; его AI и MCP-сервер доступны только за платной Enterprise-лицензией; и у него нет возможности генерировать документацию из кода.',
    rows: [
      { feature: 'License', tela: TELA_LICENSE, them: 'Ядро AGPL + коммерческая Enterprise-лицензия' },
      { feature: 'Storage', tela: TELA_STORAGE, them: 'ProseMirror JSON (markdown только для импорта/экспорта)' },
      { feature: 'Ask your docs (AI)', tela: TELA_ASK, them: 'Встроено — только для Enterprise-лицензии' },
      { feature: 'Agents read & write (MCP)', tela: TELA_MCP, them: 'Собственный MCP — только для Enterprise-лицензии' },
      { feature: 'Generate docs from your code', tela: TELA_ATLAS, them: 'Нет' },
    ],
    whySwitch: [
      'Markdown — источник истины: grep, diff, владение навсегда; Docmost хранит ProseMirror JSON, а markdown — только для импорта/экспорта.',
      'AI и доступ агентов включены в коробку, а не за стеной Enterprise-лицензии.',
      'Atlas замыкает цикл, который Docmost не предоставляет — вики с цитированием из вашего репозитория и Jira.',
    ],
    whenBetter:
      'Docmost — зрелое и сбалансированное решение с понятным путём платной поддержки: полированный блочный редактор, импорт из Confluence, SSO/SCIM и аудит-логи. Если вам нужен блочный редактор в стиле Notion, готовая миграция с Confluence или поставщик с контрактом на поддержку, это сильный выбор.',
    source: 'Редакции Docmost, документация AI и MCP (проверено в 2026).',
  },
  {
    slug: 'slab',
    name: 'Slab',
    seoTitle: 'Альтернатива Slab — self-hosted, markdown-ориентированная, готовая к агентам | tela',
    metaDescription:
      'Открытая альтернатива Slab с самостоятельным размещением. tela хранит ваш контент в markdown, который вам принадлежит, поставляет MCP-сервер для чтения и записи и создаёт вики с цитированием из вашего репозитория с помощью Atlas.',
    heading: 'Саморазмещаемая альтернатива Slab с открытым исходным кодом',
    lead: 'Slab — это чистая, хорошо спроектированная командная база знаний — но она проприетарная, облачная SaaS без self-hosting, контент хранится в проприетарном rich-text формате, а её AI «Ask» доступен только на более дорогом тарифе. tela предоставляет ту же организованную командную вики — с возможностью самостоятельного размещения, markdown-ориентированную, со встроенными AI и агентами.',
    rows: [
      { feature: 'License', tela: TELA_LICENSE, them: 'Проприетарное SaaS' },
      { feature: 'Self-hostable', tela: TELA_SELFHOST, them: 'Нет — только облако' },
      { feature: 'Storage', tela: TELA_STORAGE, them: 'Проприетарные «Посты» в rich-text' },
      { feature: 'Ask your docs (AI)', tela: TELA_ASK, them: 'AI «Ask» — на более дорогом тарифе' },
      { feature: 'Agents read & write (MCP)', tela: TELA_MCP, them: 'Нет официального сервера (только сообщество)' },
      { feature: 'Generate docs from your code', tela: TELA_ATLAS, them: 'Нет' },
    ],
    whySwitch: [
      'Владейте своей базой знаний и своими данными — self-host под AGPL; Slab — только облако.',
      'Markdown, который можно экспортировать и версионировать, а не проприетарный формат постов.',
      'Atlas создаёт вики с цитированием из ваших источников; интеграция Slab с репозиториями только зеркалирует существующий markdown.',
    ],
    whenBetter:
      'Редакторский опыт и широта интеграций Slab сильны — изысканный UI для письма и универсальный поиск, объединяющий Slack, Drive, GitHub, Linear, Jira и другие сервисы. Если вам нужно полностью управляемое SaaS без хлопот с администрированием, которое связывает вместе стек существующих инструментов, Slab — полированный выбор.',
    source: 'Цены Slab + документация универсального поиска (проверено в 2026).',
  },
  {
    slug: 'wikijs',
    name: 'Wiki.js',
    seoTitle: 'Альтернатива Wiki.js — открытая AI-вики, которая документирует себя сама | tela',
    metaDescription:
      'Открытая альтернатива Wiki.js (AGPL, self-hosted). tela добавляет семантический поиск по документам, встроенный MCP-сервер и Atlas — который создаёт вики с цитированием из ваших репозиториев.',
    heading: 'Открытая альтернатива Wiki.js, которая пишет свою документацию сама',
    lead: 'Wiki.js — заслуженно популярная саморазмещаемая вики: AGPL, markdown-ориентированная, бесплатная в использовании. Но в ней нет встроенного AI, первоклассной интеграции агентов, а её Git-модуль только синхронизирует вашу вики с репозиторием; она никогда не создаёт документацию из вашего кода. tela сохраняет ту же модель владения и добавляет то, что Wiki.js оставляет на ваше усмотрение.',
    rows: [
      { feature: 'License', tela: TELA_LICENSE, them: 'Открытый исходный код (AGPL-3.0)' },
      { feature: 'Ask your docs (AI)', tela: TELA_ASK, them: 'Нет встроенного (только поиск по ключевым словам)' },
      { feature: 'Agents read & write (MCP)', tela: TELA_MCP, them: 'Нет официального сервера (мосты сообщества)' },
      { feature: 'Generate docs from your code', tela: TELA_ATLAS, them: 'Нет — Git-модуль синхронизирует контент' },
      { feature: 'Live collaboration', tela: 'Да — многопользовательская работа в реальном времени', them: 'Нет совместного редактирования в реальном времени' },
    ],
    whySwitch: [
      'Ваши документы пишутся сами — Atlas создаёт вики с цитированием из репозитория или проекта Jira и отмечает пробелы в покрытии.',
      'Агенты — полноправные участники через встроенный MCP-сервер, а не обёртки сообщества над API.',
      'Спрашивайте свои документы по смыслу, с цитатами — а не просто ищите по ключевым словам.',
    ],
    whenBetter:
      'Wiki.js v2 зрелая, имеет большую экосистему модулей и тем и широкую гибкость в выборе БД. Если вам нужна проверенная лёгкая вики и вы не нуждаетесь в AI, агентах или генерации документации из репозитория, это отличный бесплатный вариант. (Её v3 ещё в предрелизной стадии, так что стабильный выбор — v2.)',
    source: 'js.wiki — лицензия, Git-синхронизация, редакторы (проверено в 2026).',
  },
  {
    slug: 'slite',
    name: 'Slite',
    seoTitle: 'Альтернатива Slite — self-hosted, открытая AI-база знаний | tela',
    metaDescription:
      'Саморазмещаемая альтернатива Slite с открытым исходным кодом. tela — это AGPL markdown, который вам принадлежит — с поиском по документам, встроенным MCP-сервером и Atlas для создания вики с цитированием из вашего кода.',
    heading: 'Саморазмещаемая альтернатива Slite с открытым исходным кодом',
    lead: 'Slite — это полированная облачная база знаний с действительно хорошим AI-слоем и официальным MCP-сервером, так что честное различие не в том, что «у Slite нет AI» — это вопрос владения и привязки. Slite — проприетарный, только облачный, с оплатой за рабочее место, без постоянного бесплатного тарифа. tela соответствует его AI-нативному подходу, но с открытым кодом, self-host и хранением канонического markdown, который вам принадлежит — а Atlas создаёт документацию из вашего кода, чего Slite не делает.',
    rows: [
      { feature: 'License', tela: TELA_LICENSE, them: 'Проприетарное SaaS' },
      { feature: 'Self-hostable', tela: TELA_SELFHOST, them: 'Нет — только облако' },
      { feature: 'Storage', tela: TELA_STORAGE, them: 'Блочный редактор (markdown только для импорта/экспорта)' },
      { feature: 'Ask your docs (AI)', tela: TELA_ASK, them: 'AI «Ask» с цитатами (тарифицируется)' },
      { feature: 'Agents read & write (MCP)', tela: TELA_MCP, them: 'Да — официальный удалённый MCP-сервер' },
      { feature: 'Generate docs from your code', tela: TELA_ATLAS, them: 'Нет (AI отслеживает расхождения в SaaS-инструментах)' },
    ],
    whySwitch: [
      'Никаких счетов за рабочие места и никакой привязки — self-host под AGPL или бесплатный облачный тариф.',
      'Владейте markdown; контент Slite живёт в его проприетарном формате и облаке.',
      'Atlas превращает репозитории и Jira в вики с цитированием; Slite показывает расхождения, но не создаёт контент из вашего кода.',
    ],
    whenBetter:
      'Если вам нужно готовое, красиво оформленное хостинговое решение без администрирования, с глубокой интеграцией Slack, которая автоматически отвечает в каналах, и AI-агентом, отслеживающим десятки подключённых SaaS-инструментов на предмет расхождения документации, Slite отличен и быстрее внедряется.',
    source: 'slite.com/pricing + журнал изменений Slite, официальный MCP (проверено в 2026).',
  },
  {
    slug: 'nuclino',
    name: 'Nuclino',
    seoTitle: 'Альтернатива Nuclino — self-hosted, открытая командная вики | tela',
    metaDescription:
      'Саморазмещаемая альтернатива Nuclino с открытым исходным кодом (AGPL). tela предоставляет поиск по документам, встроенный MCP-сервер и Atlas — который создаёт вики с цитированием из ваших репозиториев.',
    heading: 'Саморазмещаемая альтернатива Nuclino с открытым исходным кодом',
    lead: 'Nuclino быстр и имеет способного AI-ассистента с цитатами и официальный MCP-сервер, так что различие с tela не в наличии AI — а в том, где живут ваши знания и как далеко заходит автоматизация. Nuclino проприетарный и только облачный, с полным ассистентом на высшем тарифе. tela — с открытым кодом, self-host, хранит markdown, который вам принадлежит, и Atlas создаёт документацию из вашего кода.',
    rows: [
      { feature: 'License', tela: TELA_LICENSE, them: 'Проприетарное SaaS' },
      { feature: 'Self-hostable', tela: TELA_SELFHOST, them: 'Нет — только облако' },
      { feature: 'Ask your docs (AI)', tela: TELA_ASK, them: '«Sidekick» — полная версия на высшем тарифе' },
      { feature: 'Agents read & write (MCP)', tela: TELA_MCP, them: 'Да — официальный MCP-сервер' },
      { feature: 'Generate docs from your code', tela: TELA_ATLAS, them: 'Нет' },
    ],
    whySwitch: [
      'Self-host и владение данными — Nuclino только облачный, без опции on-prem.',
      'AI не за пейволлом высшего тарифа — семантический поиск встроен.',
      'Atlas создаёт вики с цитированием из репозиториев и Jira; Nuclino — это ручная вики.',
    ],
    whenBetter:
      'Nuclino исключительно быстр и прост, с прекрасным лёгким UX, мгновенными представлениями графа/доски/канваса и нулевой настройкой. Для безболезненной хостинговой командной вики, где скорость и минимализм важнее self-hosting и генерации документации из репозитория, это восхитительный выбор.',
    source: 'nuclino.com/pricing + справочная документация, официальный MCP (проверено в 2026).',
  },
  {
    slug: 'coda',
    name: 'Coda',
    seoTitle: 'Альтернатива Coda — открытый код, self-host, markdown, который вам принадлежит | tela',
    metaDescription:
      'Открытая альтернатива Coda с самостоятельным размещением. tela — это AGPL канонический markdown, а не проприетарное полотно из блоков и формул — с поиском по документам, встроенным MCP-сервером и Atlas.',
    heading: 'Открытая альтернатива Coda с самостоятельным размещением для документации, которой вы владеете',
    lead: 'Coda — это мощное полотно «документ-как-приложение» — таблицы, формулы, Packs, официальный MCP-сервер, AI в документах. Но он также проприетарный, только облачный, с ценой за Doc Maker и хранением контента в собственном формате. tela — более лёгкое предложение: открытая, саморазмещаемая, markdown-ориентированная командная вики, где знания остаются в markdown, который вам принадлежит. Если вы обратились к Coda для документирования команды и вам не нужна его машинерия таблиц-и-баз-данных, tela — альтернатива, которая вам принадлежит.',
    rows: [
      { feature: 'License', tela: TELA_LICENSE, them: 'Проприетарное SaaS' },
      { feature: 'Self-hostable', tela: TELA_SELFHOST, them: 'Нет — только облако' },
      { feature: 'Storage', tela: TELA_STORAGE, them: 'Проприетарный формат блоков/холста' },
      { feature: 'Ask your docs (AI)', tela: TELA_ASK, them: 'Coda AI — тарифицируется в кредитах' },
      { feature: 'Agents read & write (MCP)', tela: TELA_MCP, them: 'Да — официальный MCP-сервер' },
      { feature: 'Generate docs from your code', tela: TELA_ATLAS, them: 'Нет' },
    ],
    whySwitch: [
      'Владейте своим контентом в markdown — Coda запирает документы в проприетарном формате и своём облаке.',
      'Открытый код и self-host под AGPL, без оплаты за Doc Maker.',
      'Atlas создаёт документацию из кода; у Coda нет приёма репозиториев.',
    ],
    whenBetter:
      'Суперсила Coda в том, что это одновременно документ и реляционное приложение — таблицы, формулы, кнопки и Packs, интегрирующие десятки сервисов. Если вы хотите создавать интерактивные рабочие процессы или лёгкие внутренние инструменты, а не писать и читать документацию, Coda в этом отношении находится в более способном классе.',
    source: 'coda.io/pricing + руководство по Coda MCP (проверено в 2026).',
  },
  {
    slug: 'mediawiki',
    name: 'MediaWiki',
    seoTitle: 'Альтернатива MediaWiki — современная, markdown-ориентированная, AI-командная вики | tela',
    metaDescription:
      'Современная альтернатива MediaWiki на markdown. tela — открытый код (AGPL), self-hosted — без викитекста, без тяжёлого администрирования — с поиском по документам, встроенным MCP-сервером и Atlas.',
    heading: 'Современная, markdown-ориентированная альтернатива MediaWiki',
    lead: 'MediaWiki — движок Википедии: GPL, бесконечно расширяемый, непревзойдённый для энциклопедических публичных вики масштаба Википедии. Для командной вики это тяжёлая ноша: используется викитекст вместо markdown, крутая кривая обучения, нет встроенного AI и нет MCP-сервера в ядре. tela сохраняет хорошее — открытый код, self-host, ваши данные на вашем сервере — и устраняет сложности.',
    rows: [
      { feature: 'License', tela: TELA_LICENSE, them: 'Открытый исходный код (GPL-2.0+)' },
      { feature: 'Markup', tela: 'Канонический markdown', them: 'Викитекст (не markdown)' },
      { feature: 'Ask your docs (AI)', tela: TELA_ASK, them: 'Нет в ядре (только расширения)' },
      { feature: 'Agents read & write (MCP)', tela: TELA_MCP, them: 'Нет сервера в ядре (обёртки сообщества)' },
      { feature: 'Generate docs from your code', tela: TELA_ATLAS, them: 'Нет' },
      { feature: 'Ops', tela: 'Лёгкий современный стек', them: 'Тяжёлый (масштаба Википедии)' },
    ],
    whySwitch: [
      'Markdown, а не викитекст — никакой кривой обучения шаблонам и функциям парсера.',
      'AI и агенты «из коробки»; MediaWiki требует дополнительных расширений и не имеет MCP в ядре.',
      'Atlas создаёт документацию из кода, а стек гораздо легче в эксплуатации.',
    ],
    whenBetter:
      'Для массивной, публичной, многоязычной энциклопедии — тысячи участников, глубокие системы шаблонов и трансклюзии, структурированные данные через Semantic MediaWiki и обширная экосистема расширений, отточенная за два десятилетия — MediaWiki — это проверенный, специализированный движок, и ничто другое не сравнится с ним в таком масштабе.',
    source: 'mediawiki.org — требования к установке + авторские права (проверено в 2026).',
  },
  {
    slug: 'obsidian',
    name: 'Obsidian',
    seoTitle: 'Альтернатива Obsidian для команд — открытый код, self-hosted, совместная работа в реальном времени | tela',
    metaDescription:
      'Готовая для команд, саморазмещаемая альтернатива Obsidian. tela сохраняет ваш markdown, но добавляет многопользовательскую работу в реальном времени, SSO, поиск по документам, встроенный MCP-сервер и Atlas — вики с цитированием, созданную из вашего кода.',
    heading: 'Открытая, саморазмещаемая альтернатива Obsidian, созданная для команд',
    lead: 'Obsidian — любимое локальное markdown-приложение: ваши заметки — это простые файлы, которые вам принадлежат, с непревзойдённой экосистемой плагинов и графовым представлением. Но оно создано для одного человека: закрытый код, нет многопользовательской работы в реальном времени, нет встроенного AI или MCP, а Obsidian Publish — это хостинговая услуга, которую нельзя разместить самостоятельно. tela сохраняет лучшую идею Obsidian — знания как портативный markdown, который вам принадлежит — и превращает их в настоящую командную платформу.',
    rows: [
      { feature: 'License', tela: TELA_LICENSE, them: 'Проприетарный / закрытый код' },
      { feature: 'Self-hostable', tela: TELA_SELFHOST, them: 'Локальное приложение; Publish — хостинг, не для self-host' },
      { feature: 'Real-time collaboration', tela: 'Да — многопользовательское редактирование', them: 'Нет — однопользовательский; асинхронная синхронизация хранилищ' },
      { feature: 'Team controls (SSO, roles)', tela: 'Да', them: 'Нет — однопользовательский продукт' },
      { feature: 'Ask your docs (AI) & MCP', tela: TELA_ASK, them: 'Нет официальных (только плагины сообщества)' },
      { feature: 'Generate docs from your code', tela: TELA_ATLAS, them: 'Нет' },
    ],
    whySwitch: [
      'Многопользовательская работа в реальном времени с SSO и ролями; Obsidian — однопользовательский с асинхронной синхронизацией.',
      'Открытый код и self-host — включая публикационную поверхность; Obsidian Publish — платный хостинг, который вы не можете запустить сами.',
      'AI и агенты встроены, а не собраны из плагинов сообщества с разными лицензиями и уровнем поддержки — и Atlas создаёт документацию из кода.',
    ],
    whenBetter:
      'Для личной базы знаний одного пользователя Obsidian трудно превзойти: локальный-first и офлайн по умолчанию, огромная библиотека плагинов, графовое представление и полный контроль над папкой файлов на вашем диске. Для личного PKM или цифрового сада оставайтесь с Obsidian.',
    source: 'obsidian.md — цены + лицензия (проверено в 2026).',
  },
];

export const competitorSlugs = competitors.map((c) => c.slug);
