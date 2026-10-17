// Validation: (1) every changed/added file still parses, (2) no Cyrillic has
// leaked into className / imports / routes / identifiers. Run from frontend/.
const fs = require('fs')
const path = require('path')
const esbuild = require('esbuild')
const { execSync } = require('child_process')

const root = path.resolve(__dirname, '..')

function changedFiles() {
  const out = execSync('git diff --name-only -- frontend/src frontend/index.html', {
    cwd: root,
    encoding: 'utf8',
  })
    .trim()
    .split('\n')
    .filter(Boolean)
  return out.map((f) => path.join(root, f))
}

const CYR = /[Ѐ-ӿ]/

// Lines where Cyrillic is legitimate
const ALLOWED_ATTR = /(aria-label|title|placeholder|alt|label|description|caption|empty|emptyText|emptyMessage|helperText|confirmLabel|cancelLabel|sub|tooltip|summary|header|group|badge|statusLabel|message|children)\s*=/
const JSX_TEXT = /^\s*[А-ЯЁA-Z«"][^<>]*<>?\s*$/u

// Lines where Cyrillic is NOT legitimate
const FORBIDDEN = [
  [/className\s*=/, 'className'],
  [/^\s*import\s/, 'import statement'],
  [/^\s*export\s+/, 'export statement'],
  [/\bhref\s*=/, 'href'],
  [/\bto\s*=\s*["'{]/, 'route to='],
  [/from\s+["']/, 'module path'],
  [/\bvariant\s*=/, 'variant prop'],
  [/^\s*(key|id|name|htmlFor|data-[\w-]+)\s*=/, 'structural attr'],
  [/\btype\s*=\s*["']/, 'type attr'],
  [/^\s*(function|type|interface|enum)\s/, 'declaration'],
]

let parseFails = 0
let suspicious = 0
let files = 0
let cyrLines = 0

for (const f of changedFiles()) {
  if (!fs.existsSync(f)) continue
  const src = fs.readFileSync(f, 'utf8')
  files++
  const loader = f.endsWith('.tsx') ? 'tsx' : f.endsWith('.ts') ? 'ts' : f.endsWith('.css') ? 'css' : null
  if (loader) {
    try {
      esbuild.transformSync(src, { loader })
    } catch (e) {
      parseFails++
      console.log(`PARSE FAIL ${path.relative(root, f)}: ${e.message.split('\n')[0]}`)
    }
  }
  src.split('\n').forEach((line, i) => {
    if (!CYR.test(line)) return
    cyrLines++
    for (const [re, why] of FORBIDDEN) {
      if (re.test(line)) {
        suspicious++
        console.log(`SUSPECT ${path.relative(root, f)}:${i + 1} [${why}]\n  ${line.trim().slice(0, 140)}`)
        return
      }
    }
  })
}

console.log(`\nfiles: ${files}, cyrillic lines: ${cyrLines}, parse failures: ${parseFails}, suspicious: ${suspicious}`)
process.exit(parseFails > 0 ? 1 : 0)
