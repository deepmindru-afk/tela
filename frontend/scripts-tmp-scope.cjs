const fs = require('fs')
const { execSync } = require('child_process')

const all = execSync('find src -type f \\( -name "*.tsx" -o -name "*.ts" \\) ! -name "*.stories.tsx"', {
  encoding: 'utf8',
})
  .trim()
  .split('\n')

const RU = /[Ѐ-ӿ]/
const todo = all.filter((f) => !RU.test(fs.readFileSync(f, 'utf8')))

const UI = [
  /aria-label\s*=/,
  /placeholder\s*=\s*["']/,
  /\btitle\s*=\s*["'][A-ZА-ЯЁ]/,
  />\s*[A-ZА-ЯЁ][a-zа-яё]+(\s+[a-zA-Zа-яёЁ]+){1,}/,
  /(?:label|description|caption|emptyText|emptyMessage|helperText|confirmLabel|message|toast)\s*:\s*['"][A-ZА-ЯЁ]/,
  /(?:label|description|caption|emptyText|emptyMessage|helperText|confirmLabel)\s*=\s*["'][A-ZА-ЯЁ]/,
  /(?:return|=>)\s*['"][A-Z][a-z]+[^'"]{3,}['"]/,
]

const withUi = []
const withoutUi = []
for (const f of todo) {
  const src = fs.readFileSync(f, 'utf8')
  ;(UI.some((re) => re.test(src)) ? withUi : withoutUi).push(f)
}

const milkdown = withUi.filter((f) => /milkdown|blocks-|staleness|sheet-|use-file/.test(f))
const rest = withUi.filter((f) => !/milkdown|blocks-|staleness|sheet-|use-file/.test(f))

console.log(`todo total: ${todo.length}`)
console.log(`  with UI strings: ${withUi.length}`)
console.log(`    core/app components: ${rest.length}`)
console.log(`    editor/markdown internals: ${milkdown.length}`)
console.log(`  no UI strings: ${withoutUi.length}`)
console.log('\n--- CORE (translate) ---')
console.log(rest.map((f) => f.replace('src/components/', '')).sort().join('\n'))
console.log('\n--- EDITOR INTERNALS ---')
console.log(milkdown.map((f) => f.replace('src/components/app/', '')).sort().join(' '))
