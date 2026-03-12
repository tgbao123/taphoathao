function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toTrimmedString(value: unknown): string {
  return String(value ?? '').trim()
}

function toNonNegativeNumber(value: unknown, field: string): number {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`${field} must be >= 0`)
  }
  return n
}

function toPositiveNumber(value: unknown, field: string): number {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`${field} must be > 0`)
  }
  return n
}

export type CustomerQuery = {
  q?: string
  limit: number
  offset: number
}

export type CreateCustomerInput = {
  name: string
  code?: string
  phone?: string
  address?: string
  note?: string
  opening_debt?: number
  is_active?: boolean
}

export function parseCustomerQuery(searchParams: URLSearchParams): CustomerQuery {
  const q = toTrimmedString(searchParams.get('q'))
  const limitRaw = Number(searchParams.get('limit') ?? '100')
  const offsetRaw = Number(searchParams.get('offset') ?? '0')

  if (!Number.isInteger(limitRaw) || limitRaw < 1 || limitRaw > 200) {
    throw new Error('limit must be an integer from 1 to 200')
  }

  if (!Number.isInteger(offsetRaw) || offsetRaw < 0) {
    throw new Error('offset must be an integer >= 0')
  }

  return {
    q: q || undefined,
    limit: limitRaw,
    offset: offsetRaw,
  }
}

export function parseCreateCustomerInput(raw: unknown): CreateCustomerInput {
  if (!isRecord(raw)) {
    throw new Error('Request body must be an object')
  }

  const name = toTrimmedString(raw.name)
  if (!name) {
    throw new Error('name is required')
  }

  const code = toTrimmedString(raw.code)
  const phone = toTrimmedString(raw.phone)
  const address = toTrimmedString(raw.address)
  const note = toTrimmedString(raw.note)

  const openingDebt = raw.opening_debt == null ? undefined : toNonNegativeNumber(raw.opening_debt, 'opening_debt')

  return {
    name,
    code: code || undefined,
    phone: phone || undefined,
    address: address || undefined,
    note: note || undefined,
    opening_debt: openingDebt,
    is_active: raw.is_active == null ? true : Boolean(raw.is_active),
  }
}

export type CashflowQuery = {
  txnType?: 'in' | 'out'
  category?: string
  from?: string
  to?: string
  limit: number
  offset: number
}

export type CreateCashflowInput = {
  txnType: 'in' | 'out'
  category: string
  amount: number
  occurredAt?: string
  method?: 'cash' | 'bank_transfer' | 'card' | 'ewallet' | 'other'
  note?: string
}

export function parseCashflowQuery(searchParams: URLSearchParams): CashflowQuery {
  const txnTypeRaw = toTrimmedString(searchParams.get('txnType'))
  const category = toTrimmedString(searchParams.get('category'))
  const from = toTrimmedString(searchParams.get('from'))
  const to = toTrimmedString(searchParams.get('to'))
  const limitRaw = Number(searchParams.get('limit') ?? '100')
  const offsetRaw = Number(searchParams.get('offset') ?? '0')

  if (txnTypeRaw && txnTypeRaw !== 'in' && txnTypeRaw !== 'out') {
    throw new Error('txnType must be in|out')
  }

  if (from && Number.isNaN(Date.parse(from))) {
    throw new Error('from invalid datetime')
  }

  if (to && Number.isNaN(Date.parse(to))) {
    throw new Error('to invalid datetime')
  }

  if (!Number.isInteger(limitRaw) || limitRaw < 1 || limitRaw > 200) {
    throw new Error('limit must be an integer from 1 to 200')
  }

  if (!Number.isInteger(offsetRaw) || offsetRaw < 0) {
    throw new Error('offset must be an integer >= 0')
  }

  return {
    txnType: txnTypeRaw ? (txnTypeRaw as 'in' | 'out') : undefined,
    category: category || undefined,
    from: from || undefined,
    to: to || undefined,
    limit: limitRaw,
    offset: offsetRaw,
  }
}

export function parseCreateCashflowInput(raw: unknown): CreateCashflowInput {
  if (!isRecord(raw)) {
    throw new Error('Request body must be an object')
  }

  const entryType = toTrimmedString(raw.entryType)
  const txnTypeRaw = toTrimmedString(raw.txnType)
  const txnType = txnTypeRaw || (entryType === 'inflow' ? 'in' : entryType === 'outflow' ? 'out' : '')

  if (txnType !== 'in' && txnType !== 'out') {
    throw new Error('txnType (or entryType inflow|outflow) is required')
  }

  const category = toTrimmedString(raw.category)
  if (!category) {
    throw new Error('category is required')
  }

  const amount = toPositiveNumber(raw.amount, 'amount')

  const occurredAt = toTrimmedString(raw.occurredAt)
  if (occurredAt && Number.isNaN(Date.parse(occurredAt))) {
    throw new Error('occurredAt invalid datetime')
  }

  const methodRaw = toTrimmedString(raw.method)
  if (methodRaw && !['cash', 'bank_transfer', 'card', 'ewallet', 'other'].includes(methodRaw)) {
    throw new Error('method invalid')
  }

  const note = toTrimmedString(raw.note)

  return {
    txnType,
    category,
    amount,
    occurredAt: occurredAt || undefined,
    method: methodRaw ? (methodRaw as CreateCashflowInput['method']) : undefined,
    note: note || undefined,
  }
}
