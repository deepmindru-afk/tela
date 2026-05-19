// M12.1 — curated Prism grammars for Milkdown code-fence syntax highlighting.
// Replaces refractor's default `common.js` (~36 grammars, sideEffects) with
// `refractor/core` (empty singleton) + this curated list of 24 — the set we
// expect to see in Tela wiki content. Wired into @milkdown/plugin-prism via
// its `prismConfig` ctx slice in milkdown-editor.tsx; vite.config.ts aliases
// the bare `refractor` specifier to `refractor/core` so the plugin's own
// internal import resolves to the same empty singleton (otherwise common.js
// would still ship via the plugin's static import).
//
// Refractor's package.json `exports` field maps `./*` → `./lang/*.js`, so
// per-grammar imports are `refractor/<name>` (NOT `refractor/lang/<name>`).

import type { Refractor } from 'refractor/core'

import jsLang from 'refractor/javascript'
import tsLang from 'refractor/typescript'
import jsxLang from 'refractor/jsx'
import tsxLang from 'refractor/tsx'
import jsonLang from 'refractor/json'
import cssLang from 'refractor/css'
import scssLang from 'refractor/scss'
import markupLang from 'refractor/markup'
import markdownLang from 'refractor/markdown'
import bashLang from 'refractor/bash'
import shellSessionLang from 'refractor/shell-session'
import pythonLang from 'refractor/python'
import goLang from 'refractor/go'
import sqlLang from 'refractor/sql'
import yamlLang from 'refractor/yaml'
import tomlLang from 'refractor/toml'
import rustLang from 'refractor/rust'
import javaLang from 'refractor/java'
import cLang from 'refractor/c'
import cppLang from 'refractor/cpp'
import csharpLang from 'refractor/csharp'
import rubyLang from 'refractor/ruby'
import phpLang from 'refractor/php'
import diffLang from 'refractor/diff'

const GRAMMARS = [
  jsLang,
  tsLang,
  jsxLang,
  tsxLang,
  jsonLang,
  cssLang,
  scssLang,
  markupLang,
  markdownLang,
  bashLang,
  shellSessionLang,
  pythonLang,
  goLang,
  sqlLang,
  yamlLang,
  tomlLang,
  rustLang,
  javaLang,
  cLang,
  cppLang,
  csharpLang,
  rubyLang,
  phpLang,
  diffLang,
]

export function configureRefractor(refractor: Refractor): Refractor {
  for (const grammar of GRAMMARS) {
    refractor.register(grammar)
  }
  return refractor
}
