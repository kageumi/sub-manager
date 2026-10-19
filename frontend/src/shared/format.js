export function formatBytes(value) {
  const bytes = Number(value) || 0
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(2)} MB`
}

export function formatDate(value) {
  if (!value) return '暂无记录'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '暂无记录'

  const options = { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }
  if (date.getFullYear() !== new Date().getFullYear()) options.year = 'numeric'
  return new Intl.DateTimeFormat('zh-CN', options).format(date)
}
