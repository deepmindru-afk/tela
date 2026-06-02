import { useParams } from '@tanstack/react-router'
import { PageReader } from '../components/app/PageReader'

// Reading mode (#3). Attached to `rootRoute` (NOT appLayoutRoute) so the reader
// renders full-bleed — no Sidebar / app header chrome. Authentication is gated
// in the router config's beforeLoad (mirrors the app layout's ensureMe gate).
// Lazy-loaded via lazyRouteComponent so the reader + its Milkdown chunk stay
// off the main entry chunk until someone opens a page for reading.
export function ReadRoute() {
  const { spaceId, pageId } = useParams({ from: '/read/$spaceId/$pageId' })
  return <PageReader spaceId={spaceId} pageId={pageId} />
}
