import { parseSqliteTs } from './types'
import { ruPlural, ruPluralAgo } from './ru-plural'

const MINUTE = 60
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const WEEK = 7 * DAY
const MONTH = 30 * DAY
const YEAR = 365 * DAY

// Render a SQLite-native UTC timestamp (`YYYY-MM-DD HH:MM:SS`) as a short
// relative string. Always treats the wire value as UTC — see memory.md
// "Datetime on wire" pitfall — so a request that landed 'just now' doesn't
// drift by the viewer's timezone offset.
//
// Past tense only: the backend timestamps we feed in are last_seen_at /
// created_at, neither of which is in the future. If the diff comes out
// negative (clock skew), we surface 'just now' rather than '… from now'.
export function relativeTimeFromSqlite(s: string, now: Date = new Date()): string {
  const past = parseSqliteTs(s)
  const diffMs = now.getTime() - past.getTime()
  const seconds = Math.max(0, Math.floor(diffMs / 1000))

  if (seconds < 45) return 'только что'
  if (seconds < MINUTE * 2) return 'минуту назад'
  if (seconds < HOUR) return ruPluralAgo(Math.floor(seconds / MINUTE), 'минуту', 'минуты', 'минут')
  if (seconds < HOUR * 2) return 'час назад'
  if (seconds < DAY) return ruPluralAgo(Math.floor(seconds / HOUR), 'час', 'часа', 'часов')
  if (seconds < DAY * 2) return 'вчера'
  if (seconds < WEEK) return ruPluralAgo(Math.floor(seconds / DAY), 'день', 'дня', 'дней')
  if (seconds < WEEK * 2) return 'неделю назад'
  if (seconds < MONTH) return ruPluralAgo(Math.floor(seconds / WEEK), 'неделю', 'недели', 'недель')
  if (seconds < MONTH * 2) return 'месяц назад'
  if (seconds < YEAR) return ruPluralAgo(Math.floor(seconds / MONTH), 'месяц', 'месяца', 'месяцев')
  if (seconds < YEAR * 2) return 'год назад'
  return ruPluralAgo(Math.floor(seconds / YEAR), 'год', 'года', 'лет')
}

// The same thing in as few characters as possible — "6h", "3d", "2mo" — for a
// dense table where "6 hours ago" costs a column's worth of width. Pair it with
// the full form in a tooltip; on its own it's terse, not cryptic.
export function shortRelativeFromSqlite(s: string, now: Date = new Date()): string {
  const seconds = Math.max(0, Math.floor((now.getTime() - parseSqliteTs(s).getTime()) / 1000))
  if (seconds < 45) return 'сейчас'
  if (seconds < HOUR) return `${Math.max(1, Math.floor(seconds / MINUTE))} мин`
  if (seconds < DAY) return `${Math.floor(seconds / HOUR)} ч`
  if (seconds < WEEK) return `${Math.floor(seconds / DAY)} д`
  if (seconds < MONTH) return `${Math.floor(seconds / WEEK)} нед`
  if (seconds < YEAR) return `${Math.floor(seconds / MONTH)} мес`
  return `${Math.floor(seconds / YEAR)} г`
}

// Whole-and-fractional days since a SQLite-native UTC timestamp. Lives here (not
// in a component) so the unavoidable `new Date()` clock read stays out of render
// — React's purity lint forbids calling impure functions during a render pass.
export function daysSinceSqlite(s: string, now: Date = new Date()): number {
  const t = parseSqliteTs(s).getTime()
  if (Number.isNaN(t)) return 0
  return Math.max(0, (now.getTime() - t) / (DAY * 1000))
}

// Render a SQLite-native UTC timestamp as a compact local date (YYYY-MM-DD)
// for the 'Created' column. Uses `toLocaleDateString('en-CA')` to get a
// stable ISO-shape regardless of viewer locale (en-CA renders as
// `YYYY-MM-DD`, which we want here for terseness).
export function localDateFromSqlite(s: string): string {
  const d = parseSqliteTs(s)
  return d.toLocaleDateString('en-CA')
}

// Render a SQLite-native UTC timestamp as an editorial date — "7 июн. 2026" —
// for blog post bylines/cards. Drops the year when it's the current one for a
// lighter line ("7 июн."). Locale-aware month name; stable shape.
export function postDateFromSqlite(s: string, now: Date = new Date()): string {
  const d = parseSqliteTs(s)
  const sameYear = d.getFullYear() === now.getFullYear()
  return d.toLocaleDateString('ru-RU', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
}
