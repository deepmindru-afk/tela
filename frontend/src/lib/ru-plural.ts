// Russian counted-noun plurals.
//
// Russian has three grammatical forms for a counted noun, and choosing the
// right one needs the number AND the trailing digits:
//
//   1 страница, 2 страницы, 5 страниц, 21 страница, 11 страниц, 102 страницы
//
// The English source expressed this as a two-form `n === 1 ? x : x + 's'`,
// which Russian cannot express, so call sites go through here instead. Take the
// singular, the "few" form and the many form from the nominative case, e.g.
//
//   ruPlural(n, 'страница', 'страницы', 'страниц')
//
// Used only for display copy; never feed the result back into an API value.
export function ruPlural(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n)
  const mod10 = abs % 10
  const mod100 = abs % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}

// Shorthand for the very common "N <noun> ago" pattern, where the singular
// form is the accusative ("минуту назад", not "минута назад").
export function ruPluralAgo(n: number, one: string, few: string, many: string): string {
  return `${n} ${ruPlural(n, one, few, many)} назад`
}
