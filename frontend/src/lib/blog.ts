// Display helpers for the public blog surfaces (space front page, /u/{handle}).
// Deterministic, content-derived visuals so a space/author/post has a stable
// identity even with no uploaded avatar or cover image.

// Stable 0..359 hue from a string — same input always yields the same hue, so a
// space/author keeps its colour across renders. Small FNV-ish rolling hash.
export function hueFromString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h) % 360
}

// One/two-letter monogram for an avatar tile. Initials of the first two words,
// else the first two letters; uppercased.
export function monogram(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '·'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

// Tinted avatar surface + readable foreground, in OKLCH so it sits naturally
// over any theme. Mid lightness / modest chroma keeps it legible light or dark.
export function avatarStyle(seed: string): { background: string; color: string } {
  const hue = hueFromString(seed)
  return {
    background: `oklch(0.62 0.16 ${hue})`,
    color: `oklch(0.99 0.02 ${hue})`,
  }
}

// A soft cover background derived from the title — a low-chroma diagonal wash
// with two hue-shifted stops, used when a post has no `cover` image. Subtle on
// purpose: it reads as a tasteful placeholder, not a loud gradient.
export function coverGradient(seed: string): string {
  const hue = hueFromString(seed)
  const hue2 = (hue + 38) % 360
  return `linear-gradient(135deg, oklch(0.72 0.12 ${hue}) 0%, oklch(0.6 0.13 ${hue2}) 100%)`
}
