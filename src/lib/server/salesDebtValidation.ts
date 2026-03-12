export type ManualLotInput = {
  lotId: string
  qty: number
}

export type SaleItemInput = {
  clientLineId?: string
  skuId: string
  qty: number
  unitPrice: number
  allocationMode?: 'MANUAL_LOT' | 'AUTO_FIFO'
  manualLots?: ManualLotInput[]
}

export type CreateSaleInput = {
  storeId?: string
  customerId?: string
  currency?: string
  note?: string
  soldAt?: string
  discountAmount?: number
  paidAmount?: number
  items: SaleItemInput[]
}

export type DebtPaymentInput = {
  customerId: string
  amount: number
  method?: 'cash' | 'bank_transfer' | 'card' | 'ewallet' | 'other'
  note?: string
  reference?: string
  paidAt?: string
}

export type DebtLedgerQuery = {
  limit: number
  offset: number
  entryType?: 'sale_debt' | 'payment' | 'adjustment'
  from?: string
  to?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function parseCreateSaleInput(raw: unknown): CreateSaleInput {
  if (!isRecord(raw)) {
    throw new Error('Request body must be an object')
  }

  const items = raw.items
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('items must be non-empty array')
  }

  const parsedItems: SaleItemInput[] = items.map((item, idx) => {
    if (!isRecord(item)) {
      throw new Error(`items[${idx}] must be object`)
    }

    const skuId = String(item.skuId ?? '').trim()
    if (!skuId) {
      throw new Error(`items[${idx}].skuId is required`)
    }

    const qty = Number(item.qty)
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new Error(`items[${idx}].qty must be > 0`)
    }

    const unitPrice = Number(item.unitPrice)
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      throw new Error(`items[${idx}].unitPrice must be >= 0`)
    }

    const modeRaw = String(item.allocationMode ?? 'AUTO_FIFO').toUpperCase()
    if (modeRaw !== 'MANUAL_LOT' && modeRaw !== 'AUTO_FIFO') {
      throw new Error(`items[${idx}].allocationMode invalid`)
    }

    let manualLots: ManualLotInput[] | undefined

    if (modeRaw === 'MANUAL_LOT') {
      if (!Array.isArray(item.manualLots) || item.manualLots.length === 0) {
        throw new Error(`items[${idx}].manualLots required for MANUAL_LOT`)
      }

      manualLots = item.manualLots.map((lot, lotIdx) => {
        if (!isRecord(lot)) {
          throw new Error(`items[${idx}].manualLots[${lotIdx}] must be object`)
        }

        const lotId = String(lot.lotId ?? '').trim()
        const lotQty = Number(lot.qty)

        if (!lotId) {
          throw new Error(`items[${idx}].manualLots[${lotIdx}].lotId is required`)
        }

        if (!Number.isFinite(lotQty) || lotQty <= 0) {
          throw new Error(`items[${idx}].manualLots[${lotIdx}].qty must be > 0`)
        }

        return { lotId, qty: lotQty }
      })

      const totalManual = manualLots.reduce((sum, x) => sum + x.qty, 0)
      if (Math.abs(totalManual - qty) > 1e-9) {
        throw new Error(`items[${idx}].manualLots qty sum must equal item.qty`)
      }
    }

    return {
      clientLineId: item.clientLineId ? String(item.clientLineId) : undefined,
      skuId,
      qty,
      unitPrice,
      allocationMode: modeRaw,
      manualLots,
    }
  })

  const discountAmount = raw.discountAmount == null ? undefined : Number(raw.discountAmount)
  if (discountAmount != null && (!Number.isFinite(discountAmount) || discountAmount < 0)) {
    throw new Error('discountAmount must be >= 0')
  }

  const paidAmount = raw.paidAmount == null ? undefined : Number(raw.paidAmount)
  if (paidAmount != null && (!Number.isFinite(paidAmount) || paidAmount < 0)) {
    throw new Error('paidAmount must be >= 0')
  }

  return {
    storeId: raw.storeId ? String(raw.storeId) : undefined,
    customerId: raw.customerId ? String(raw.customerId) : undefined,
    currency: raw.currency ? String(raw.currency) : undefined,
    note: raw.note ? String(raw.note) : undefined,
    soldAt: raw.soldAt ? String(raw.soldAt) : undefined,
    discountAmount,
    paidAmount,
    items: parsedItems,
  }
}

export function parseDebtPaymentInput(raw: unknown): DebtPaymentInput {
  if (!isRecord(raw)) {
    throw new Error('Request body must be an object')
  }

  const customerId = String(raw.customerId ?? '').trim()
  if (!customerId) {
    throw new Error('customerId is required')
  }

  const amount = Number(raw.amount)
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('amount must be > 0')
  }

  const method = raw.method ? String(raw.method) : undefined
  if (method && !['cash', 'bank_transfer', 'card', 'ewallet', 'other'].includes(method)) {
    throw new Error('method invalid')
  }

  if (raw.paidAt && Number.isNaN(Date.parse(String(raw.paidAt)))) {
    throw new Error('paidAt invalid datetime')
  }

  return {
    customerId,
    amount,
    method: method as DebtPaymentInput['method'],
    note: raw.note ? String(raw.note) : undefined,
    reference: raw.reference ? String(raw.reference) : undefined,
    paidAt: raw.paidAt ? String(raw.paidAt) : undefined,
  }
}

export function parseDebtLedgerQuery(raw: URLSearchParams): DebtLedgerQuery {
  const limitRaw = Number(raw.get('limit') ?? '50')
  const offsetRaw = Number(raw.get('offset') ?? '0')
  const entryTypeRaw = raw.get('entryType')
  const fromRaw = raw.get('from')
  const toRaw = raw.get('to')

  if (!Number.isFinite(limitRaw) || !Number.isInteger(limitRaw) || limitRaw < 1 || limitRaw > 200) {
    throw new Error('limit must be an integer from 1 to 200')
  }

  if (!Number.isFinite(offsetRaw) || !Number.isInteger(offsetRaw) || offsetRaw < 0) {
    throw new Error('offset must be an integer >= 0')
  }

  if (entryTypeRaw && !['sale_debt', 'payment', 'adjustment'].includes(entryTypeRaw)) {
    throw new Error('entryType invalid')
  }

  if (fromRaw && Number.isNaN(Date.parse(fromRaw))) {
    throw new Error('from invalid datetime')
  }

  if (toRaw && Number.isNaN(Date.parse(toRaw))) {
    throw new Error('to invalid datetime')
  }

  return {
    limit: limitRaw,
    offset: offsetRaw,
    entryType: entryTypeRaw ? (entryTypeRaw as DebtLedgerQuery['entryType']) : undefined,
    from: fromRaw ?? undefined,
    to: toRaw ?? undefined,
  }
}
