export function formatZAR(value: number, opts: { decimals?: boolean } = {}): string {
  if (!isFinite(value)) return 'R0'
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: opts.decimals ? 2 : 0,
    maximumFractionDigits: opts.decimals ? 2 : 0,
  }).format(value)
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-ZA').format(value)
}

export function formatDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d)
}

export function formatRelative(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso).getTime()
  const now = Date.now()
  const diff = Math.round((d - now) / 1000)
  const abs = Math.abs(diff)
  const rtf = new Intl.RelativeTimeFormat('en-ZA', { numeric: 'auto' })
  if (abs < 60) return rtf.format(Math.round(diff), 'second')
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour')
  return rtf.format(Math.round(diff / 86400), 'day')
}

export function yearsBetween(iso: string, to = new Date()): number {
  if (!iso) return 0
  const d = new Date(iso)
  if (isNaN(d.getTime())) return 0
  let years = to.getFullYear() - d.getFullYear()
  const m = to.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && to.getDate() < d.getDate())) years--
  return Math.max(0, years)
}
