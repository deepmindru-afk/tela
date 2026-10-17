// Strong check: structural attribute VALUES must be byte-identical to HEAD.
// If a className / route / href / variant / id / key / data-* value changed,
// the translation broke something. Translated display text changing is fine.
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const root = path.resolve(__dirname, '..')

const ATTRS = [
  'className', 'class', 'to', 'href', 'variant', 'size', 'tone', 'type',
  'id', 'key', 'name', 'htmlFor', 'role', 'asChild', 'decorator',
]

function valuesFromSrc(src) {
  const out = []
  for (const a of ATTRS) {
    const re = new RegExp(`\\b${a}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'g')
    let m
    while ((m = re.exec(src)) !== null) out.push(`${a}=${m[2] ?? m[3]}`)
  }
  return out
}

function valuesForWorktree(rel) {
  return valuesFromSrc(fs.readFileSync(path.join(root, rel), 'utf8'))
}

function valuesFor(file, rev) {
  let src
  try {
    src = execSync(`git show ${rev}:${file}`, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 })
  } catch {
    return null // new file
  }
  return valuesFromSrc(src)
}

function index(list) {
  const map = new Map()
  for (const v of list) map.set(v, (map.get(v) ?? 0) + 1)
  return map
}

const changed = execSync('git diff --name-only -- frontend/src frontend/index.html', {
  cwd: root,
  encoding: 'utf8',
})
  .trim()
  .split('\n')
  .filter(Boolean)

let problems = 0
let files = 0

for (const rel of changed) {
  const head = valuesFor(rel, 'HEAD')
  if (!head) {
    console.log(`NEW FILE (no HEAD version): ${rel}`)
    continue
  }
  files++
  const worktreePath = path.join(root, rel)
  if (!fs.existsSync(worktreePath)) {
    console.log(`DELETED: ${rel}`)
    continue
  }
  const now = valuesForWorktree(rel)
  const a = index(head)
  const b = index(now)
  const lost = []
  for (const [val, count] of a) {
    const have = b.get(val) ?? 0
    if (have < count) lost.push({ val, count, have })
  }
  if (lost.length) {
    problems++
    console.log(`\n${rel} — ${lost.length} structural value(s) changed/removed:`)
    for (const l of lost.slice(0, 12)) {
      console.log(`  - ${l.count - l.have}x  ${l.val.slice(0, 120)}`)
    }
  }
}

console.log(`\nchecked ${files} changed files; files with structural changes: ${problems}`)
process.exit(0)
