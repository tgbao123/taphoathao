import type { CreateBatchInput, CreateProductInput, CreateUnitInput, UpdateProductInput } from '@/lib/server/inventory'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toTrimmedString(value: unknown): string {
  return String(value ?? '').trim()
}

function toNonNegativeNumber(value: unknown, field: string) {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`${field} must be >= 0`)
  }
  return n
}

function toPositiveNumber(value: unknown, field: string) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`${field} must be > 0`)
  }
  return n
}

export function parseCreateUnitInput(raw: unknown): CreateUnitInput {
  if (!isRecord(raw)) throw new Error('Request body must be an object')

  const code = toTrimmedString(raw.code)
  const name = toTrimmedString(raw.name)
  const symbol = toTrimmedString(raw.symbol)

  if (!code) throw new Error('code is required')
  if (!name) throw new Error('name is required')

  return {
    code,
    name,
    symbol: symbol || undefined,
  }
}

export function parseCreateProductInput(raw: unknown): CreateProductInput {
  if (!isRecord(raw)) throw new Error('Request body must be an object')

  const sku = toTrimmedString(raw.sku)
  const name = toTrimmedString(raw.name)
  const unit_id = toTrimmedString(raw.unit_id)
  const barcode = toTrimmedString(raw.barcode)

  if (!sku) throw new Error('sku is required')
  if (!name) throw new Error('name is required')
  if (!unit_id) throw new Error('unit_id is required')

  const default_sell_price =
    raw.default_sell_price == null ? 0 : toNonNegativeNumber(raw.default_sell_price, 'default_sell_price')

  const quantity =
    raw.quantity == null ? 0 : toNonNegativeNumber(raw.quantity, 'quantity')

  return {
    sku,
    name,
    unit_id,
    barcode: barcode || undefined,
    default_sell_price,
    quantity,
    is_active: raw.is_active == null ? true : Boolean(raw.is_active),
  }
}

export function parseUpdateProductInput(raw: unknown): UpdateProductInput {
  if (!isRecord(raw)) throw new Error('Request body must be an object')

  const payload: UpdateProductInput = {}

  if ('sku' in raw) {
    const sku = toTrimmedString(raw.sku)
    if (!sku) throw new Error('sku cannot be empty')
    payload.sku = sku
  }

  if ('name' in raw) {
    const name = toTrimmedString(raw.name)
    if (!name) throw new Error('name cannot be empty')
    payload.name = name
  }

  if ('unit_id' in raw) {
    const unitId = toTrimmedString(raw.unit_id)
    if (!unitId) throw new Error('unit_id cannot be empty')
    payload.unit_id = unitId
  }

  if ('barcode' in raw) {
    const barcode = raw.barcode == null ? '' : toTrimmedString(raw.barcode)
    payload.barcode = barcode || null
  }

  if ('default_sell_price' in raw) {
    payload.default_sell_price = toNonNegativeNumber(raw.default_sell_price, 'default_sell_price')
  }

  if ('quantity' in raw) {
    payload.quantity = toNonNegativeNumber(raw.quantity, 'quantity')
  }

  if ('is_active' in raw) {
    payload.is_active = Boolean(raw.is_active)
  }

  if (Object.keys(payload).length === 0) {
    throw new Error('No fields to update')
  }

  return payload
}

export function parseCreateBatchInput(raw: unknown): CreateBatchInput {
  if (!isRecord(raw)) throw new Error('Request body must be an object')

  const product_id = toTrimmedString(raw.product_id)
  const batch_no = toTrimmedString(raw.batch_no)

  if (!product_id) throw new Error('product_id is required')

  const import_price = toNonNegativeNumber(raw.import_price, 'import_price')
  const sell_price = toNonNegativeNumber(raw.sell_price, 'sell_price')
  const qty_in = toPositiveNumber(raw.qty_in, 'qty_in')

  let qty_remaining: number | undefined
  if (raw.qty_remaining != null && raw.qty_remaining !== '') {
    qty_remaining = toNonNegativeNumber(raw.qty_remaining, 'qty_remaining')
    if (qty_remaining > qty_in) {
      throw new Error('qty_remaining must be <= qty_in')
    }
  }

  const imported_at = toTrimmedString(raw.imported_at)
  const expires_at = toTrimmedString(raw.expires_at)

  return {
    product_id,
    batch_no: batch_no || undefined,
    import_price,
    sell_price,
    qty_in,
    qty_remaining,
    imported_at: imported_at || undefined,
    expires_at: expires_at || undefined,
  }
}

export function parseImportBatchesInput(raw: unknown): CreateBatchInput[] {
  if (!isRecord(raw)) throw new Error('Request body must be an object')
  const batches = raw.batches

  if (!Array.isArray(batches) || batches.length === 0) {
    throw new Error('batches must be a non-empty array')
  }

  return batches.map((batch, index) => {
    try {
      return parseCreateBatchInput(batch)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid batch input'
      throw new Error(`batches[${index}]: ${message}`)
    }
  })
}
