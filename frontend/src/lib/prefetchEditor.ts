// Warm the heavy Milkdown editor chunk (~1 MB raw / ~300 KB gz, plus its parse
// cost) ahead of time, so opening a page paints from a cached+compiled module
// instead of waiting on a cold download+compile on the click. Called from the
// page/reader route loaders, which `defaultPreload: 'intent'` fires on hover —
// turning the first "cold" page open of a session into a warm one.
//
// The module loader dedupes: the first call fetches+compiles the chunk, every
// later call resolves the cached module instantly. Errors are swallowed — this
// is a best-effort warmup; the real lazy import in the component still runs and
// surfaces any genuine load failure (and its vite:preloadError reload guard).
let started: Promise<unknown> | null = null

export function prefetchMilkdownEditor(): void {
  if (started) return
  started = import('../components/app/milkdown-editor').catch(() => {
    started = null // let a later attempt retry after a transient failure
  })
}
