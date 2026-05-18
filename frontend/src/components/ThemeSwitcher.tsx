import { useState } from 'react'
import { ToggleGroup, ToggleGroupItem } from './ui/toggle'
import { getTheme, setTheme, THEMES, type ThemeName } from '../lib/theme'

export function ThemeSwitcher() {
  const [active, setActive] = useState<ThemeName>(() => getTheme())

  return (
    <ToggleGroup
      type="single"
      value={active}
      onValueChange={(value) => {
        if (!value) return
        const next = value as ThemeName
        setTheme(next)
        setActive(next)
      }}
      aria-label="Theme"
    >
      {THEMES.map((name) => (
        <ToggleGroupItem key={name} value={name} className="capitalize">
          {name}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
