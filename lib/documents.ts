/**
 * The finance pack lives here rather than in the store, because it is data and
 * rules, not state: the demo seeds, the currency checks and the screen all need
 * it, and only the screen needs React. lib/store.tsx re-exports both symbols so
 * existing imports keep working.
 */
export type DocItem = {
  id: string
  category: string
  fileName: string
  status: 'missing' | 'added'
  addedAt?: string
  /** Date printed on the document itself, where currency matters. */
  docDate?: string
  /** How old the document may be before a lender rejects it. */
  maxAgeMonths?: number
  hint: string
}

export const DEFAULT_DOCS: DocItem[] = [
  {
    id: 'id',
    category: 'South African ID / Passport',
    fileName: '',
    status: 'missing',
    hint: 'Bar-coded ID book, smart ID card, or a passport with a valid visa.',
  },
  {
    id: 'licence',
    category: "Driver's Licence",
    fileName: '',
    status: 'missing',
    hint: 'Must be valid on the day you sign. Renew it before you apply.',
  },
  {
    id: 'residence',
    category: 'Proof of Residence',
    fileName: '',
    status: 'missing',
    maxAgeMonths: 3,
    hint: 'Municipal bill, bank statement or lease, not older than 3 months.',
  },
  {
    id: 'payslip',
    category: 'Latest Payslip',
    fileName: '',
    status: 'missing',
    maxAgeMonths: 1,
    hint: 'Your most recent payslip. Commission earners usually need three.',
  },
  {
    id: 'bank',
    category: '3 Months Bank Statements',
    fileName: '',
    status: 'missing',
    maxAgeMonths: 3,
    hint: 'Stamped or PDF statements covering the last three salary deposits.',
  },
  {
    id: 'sale',
    category: 'Signed Sale Agreement',
    fileName: '',
    status: 'missing',
    hint: 'Only sign once you have analysed the quotation. Keep your copy.',
  },
]

/** Merge stored documents onto the current pack definition so a pack item
 *  added after the user's last visit still appears. */
export function mergeDocs(stored: unknown): DocItem[] {
  const list = Array.isArray(stored) ? (stored as Partial<DocItem>[]) : []
  return DEFAULT_DOCS.map((def) => {
    const saved = list.find((d) => d?.id === def.id)
    return saved ? { ...def, ...saved, hint: def.hint, maxAgeMonths: def.maxAgeMonths } : def
  })
}

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
export const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/heic']
export const ACCEPT_ATTR = '.pdf,.jpg,.jpeg,.png,.heic,application/pdf,image/*'

export type Currency = {
  state: 'not-applicable' | 'unknown' | 'valid' | 'expiring' | 'expired'
  label: string
  daysLeft: number | null
}

/** Lenders reject documents older than their currency rule (usually 3 months).
 *  We assess the date the user recorded, we never inspect the file itself. */
export function assessCurrency(doc: DocItem, now = new Date()): Currency {
  if (!doc.maxAgeMonths) return { state: 'not-applicable', label: 'No expiry', daysLeft: null }
  if (doc.status !== 'added') return { state: 'unknown', label: 'Not added', daysLeft: null }
  if (!doc.docDate) {
    return { state: 'unknown', label: 'Add the document date', daysLeft: null }
  }
  const issued = new Date(doc.docDate)
  if (isNaN(issued.getTime())) {
    return { state: 'unknown', label: 'Add the document date', daysLeft: null }
  }
  const expires = new Date(issued)
  expires.setMonth(expires.getMonth() + doc.maxAgeMonths)
  const daysLeft = Math.ceil((expires.getTime() - now.getTime()) / 86_400_000)
  if (daysLeft < 0) {
    return { state: 'expired', label: `Too old, lenders want under ${doc.maxAgeMonths} month${doc.maxAgeMonths > 1 ? 's' : ''}`, daysLeft }
  }
  if (daysLeft <= 14) {
    return { state: 'expiring', label: `Too old in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`, daysLeft }
  }
  return { state: 'valid', label: `Current for ${daysLeft} more days`, daysLeft }
}

export function validateUpload(file: File): string | null {
  const okType =
    ACCEPTED_TYPES.includes(file.type) || /\.(pdf|jpe?g|png|heic)$/i.test(file.name)
  if (!okType) return 'Only PDF, JPG, PNG or HEIC files can be added.'
  if (file.size > MAX_UPLOAD_BYTES) {
    return `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 10 MB.`
  }
  if (file.size === 0) return 'That file is empty.'
  return null
}

export function packProgress(documents: DocItem[]) {
  const added = documents.filter((d) => d.status === 'added').length
  return { added, total: documents.length, pct: Math.round((added / documents.length) * 100) }
}
