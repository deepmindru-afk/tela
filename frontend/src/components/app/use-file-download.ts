import { useCallback, useState } from 'react'
import { getTheme } from '../../lib/theme'

// useFileDownload encapsulates the fetch→Blob→download flow (with the live-theme
// query param) so both the standalone DownloadPdfButton and the "•••" menu's
// Export-PDF item can trigger it. Lives in its own module so the component file
// stays a pure component export (react-refresh).
export function useFileDownload(
  url: string,
  opts?: { themed?: boolean; fallbackName?: string },
) {
  const { themed = false, fallbackName = 'page.pdf' } = opts ?? {}
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  // Resolves true on a completed download, false on failure — so callers without
  // a persistent affordance (e.g. a dropdown item that closes on click) can drive
  // a toast off the result instead of polling `busy`/`failed`.
  const download = useCallback(async (): Promise<boolean> => {
    if (busy) return false
    setBusy(true)
    setFailed(false)
    try {
      const target = themed
        ? url + (url.includes('?') ? '&' : '?') + 'theme=' + getTheme()
        : url
      const res = await fetch(target, { credentials: 'include' })
      if (!res.ok) throw new Error(`pdf ${res.status}`)
      const blob = await res.blob()
      const cd = res.headers.get('Content-Disposition') ?? ''
      const match = /filename="?([^"]+)"?/.exec(cd)
      const name = match?.[1] ?? fallbackName
      const objUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objUrl
      a.download = name
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(objUrl)
      return true
    } catch {
      setFailed(true)
      return false
    } finally {
      setBusy(false)
    }
  }, [url, busy, themed, fallbackName])

  return { download, busy, failed }
}
