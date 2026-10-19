// Allocate large configuration blobs only when the user actually downloads.
export function downloadText(content, filename, type) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  try {
    link.click()
  } finally {
    link.remove()
    // Give the browser time to start consuming the object URL.
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}
