// Warm lazy route chunks while the browser is idle so view switches feel instant.
function schedule(load) {
  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(load, { timeout: 2000 })
  else window.setTimeout(load, 400)
}

export function preloadWorkspace() {
  schedule(() => {
    import('./Workspace.jsx')
    import('../pages/SubscriptionsPage.jsx')
  })
}

export function preloadEditor() {
  schedule(() => {
    import('../pages/SubscriptionPage.jsx')
  })
}
