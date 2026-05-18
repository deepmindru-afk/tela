import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CommandPalette,
  prefixForMode,
  usePaletteShortcuts,
  type CommandItem,
  type CommandMode,
  type CommandSubPicker,
} from '../ui/command'
import { useSpaces } from '../../lib/queries/spaces'
import { router } from '../../routes/router'
import {
  getTheme,
  setTheme,
  subscribeToTheme,
  type ThemeName,
} from '../../lib/theme'
import {
  materializeCommands,
  type CommandContext,
  type SubPickerSpec,
} from '../../lib/commands'
// Side-effect: starter commands self-register on import. Keep this import in
// the app-level host so the registry is populated before the palette mounts.
import '../../lib/commands/starters'

// Reactive view of the active theme so commands that read currentTheme always
// see the freshest value. Subscribes to setTheme() broadcasts.
function useThemeName(): ThemeName {
  const [theme, setLocal] = useState<ThemeName>(() => getTheme())
  useEffect(() => subscribeToTheme(setLocal), [])
  return theme
}

// App-level palette mount. Owns:
//  - palette open / sub-picker / external-search-request state
//  - the global keyboard contract (Cmd-K, Cmd-Shift-P, Cmd-N)
//  - the CommandContext that registered commands run against
//
// Sits outside RouterProvider in App.tsx (sibling to it), so navigation goes
// through the imported `router` instance rather than useNavigate. Lives inside
// QueryClientProvider so useSpaces() resolves from the shared cache.
export function AppCommandHost({ onNewPage }: { onNewPage?: () => void }) {
  const [open, setOpen] = useState(false)
  const [initialMode, setInitialMode] = useState<CommandMode>('pages')
  const [subPicker, setSubPicker] = useState<CommandSubPicker | null>(null)
  const [searchRequest, setSearchRequest] =
    useState<{ value: string; nonce: number } | null>(null)

  const currentTheme = useThemeName()
  const spacesQuery = useSpaces()
  const spaces = spacesQuery.data ?? []

  // Clear transient state whenever the palette closes so the next open starts
  // fresh — no stale sub-picker, no leftover external search push.
  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next)
    if (!next) {
      setSubPicker(null)
      setSearchRequest(null)
    }
  }, [])

  const openWith = useCallback((mode: CommandMode) => {
    setSubPicker(null)
    setSearchRequest(null)
    setInitialMode(mode)
    setOpen(true)
  }, [])

  usePaletteShortcuts({
    onOpenPages: () => openWith('pages'),
    onOpenCommands: () => openWith('commands'),
    onNewPage,
  })

  const ctx = useMemo<CommandContext>(
    () => ({
      currentTheme,
      setTheme,
      spaces,
      navigateToSpace: (spaceId) => {
        void router.navigate({
          to: '/spaces/$spaceId',
          params: { spaceId },
        })
      },
      openHelpMode: () => {
        // Push the help prefix into the open palette via searchRequest. Nonce
        // forces the effect to fire even when the same value is sent twice.
        setSubPicker(null)
        setSearchRequest((prev) => ({
          value: prefixForMode('help'),
          nonce: (prev?.nonce ?? 0) + 1,
        }))
      },
      openSubPicker: (spec: SubPickerSpec) => {
        setSubPicker({
          label: spec.label,
          placeholder: spec.placeholder,
          emptyMessage: spec.emptyMessage,
          items: spec.items,
        })
      },
      closePalette: () => setOpen(false),
    }),
    [currentTheme, spaces],
  )

  // Recompute commandsItems whenever ctx changes so onSelect closures bind
  // the latest theme / spaces snapshot.
  const commandsItems = useMemo<CommandItem[]>(
    () => materializeCommands(ctx),
    [ctx],
  )

  return (
    <CommandPalette
      open={open}
      onOpenChange={handleOpenChange}
      initialMode={initialMode}
      commandsItems={commandsItems}
      subPicker={subPicker}
      searchRequest={searchRequest ?? undefined}
    />
  )
}
