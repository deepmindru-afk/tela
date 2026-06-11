// Fire-and-forget page-view beacon. Posted when a page is actually displayed
// (PageView mount/navigation), NOT on hover-prefetch — so the unified events
// feed records genuine "who-read-what", not warm-cache noise. Errors are
// swallowed: a view log must never affect the reading experience.
export function recordPageView(pageId: number): void {
  void fetch(`/api/pages/${pageId}/view`, {
    method: 'POST',
    credentials: 'include',
    keepalive: true,
  }).catch(() => {})
}
