import { getSupabaseAdmin } from '@/lib/server/supabaseAdmin'
import type { DebtLedgerQuery, DebtPaymentInput } from '@/lib/server/salesDebtValidation'

type PgError = {
  message?: string
  code?: string
  details?: string
}

export type DebtCoreErrorCode =
  | 'CUSTOMER_NOT_FOUND'
  | 'INVALID_PAYLOAD'
  | 'LEDGER_QUERY_FAILED'
  | 'DEBT_PAYMENT_FAILED'

export class DebtCoreError extends Error {
  code: DebtCoreErrorCode
  status: number
  details: string | null

  constructor(input: { code: DebtCoreErrorCode; status: number; message: string; details?: string | null }) {
    super(input.message)
    this.name = 'DebtCoreError'
    this.code = input.code
    this.status = input.status
    this.details = input.details ?? null
  }
}

function mapPaymentPgError(err: PgError): DebtCoreError {
  const message = err.message ?? 'Cannot create debt payment'
  const msg = message.toUpperCase()

  if (msg.includes('CUSTOMER') && msg.includes('NOT FOUND')) {
    return new DebtCoreError({
      code: 'CUSTOMER_NOT_FOUND',
      status: 404,
      message,
      details: err.details,
    })
  }

  if (msg.includes('REQUIRED') || msg.includes('INVALID') || msg.includes('AMOUNT') || msg.includes('METHOD')) {
    return new DebtCoreError({
      code: 'INVALID_PAYLOAD',
      status: 422,
      message,
      details: err.details,
    })
  }

  return new DebtCoreError({
    code: 'DEBT_PAYMENT_FAILED',
    status: 400,
    message,
    details: err.details,
  })
}

export async function createDebtPayment(input: DebtPaymentInput) {
  const supabaseAdmin = getSupabaseAdmin()

  const { data, error } = await supabaseAdmin.rpc('api_create_debt_payment', {
    p_payload: input,
  })

  if (error) {
    throw mapPaymentPgError(error)
  }

  if (!data) {
    throw new DebtCoreError({
      code: 'DEBT_PAYMENT_FAILED',
      status: 400,
      message: 'Cannot create debt payment',
    })
  }

  return data
}

export async function getCustomerLedger(input: { customerId: string; query: DebtLedgerQuery }) {
  const supabaseAdmin = getSupabaseAdmin()

  const { data: customer, error: customerError } = await supabaseAdmin
    .from('customers')
    .select('id, name, opening_debt')
    .eq('id', input.customerId)
    .maybeSingle()

  if (customerError) {
    throw new DebtCoreError({
      code: 'LEDGER_QUERY_FAILED',
      status: 400,
      message: customerError.message,
      details: customerError.details,
    })
  }

  if (!customer) {
    throw new DebtCoreError({
      code: 'CUSTOMER_NOT_FOUND',
      status: 404,
      message: 'Customer not found',
    })
  }

  let ledgerQuery = supabaseAdmin
    .from('debt_ledger')
    .select('id, customer_id, entry_type, amount, balance_after, sale_id, payment_id, occurred_at, note', { count: 'exact' })
    .eq('customer_id', input.customerId)

  if (input.query.entryType) {
    ledgerQuery = ledgerQuery.eq('entry_type', input.query.entryType)
  }

  if (input.query.from) {
    ledgerQuery = ledgerQuery.gte('occurred_at', input.query.from)
  }

  if (input.query.to) {
    ledgerQuery = ledgerQuery.lte('occurred_at', input.query.to)
  }

  const from = input.query.offset
  const to = input.query.offset + input.query.limit - 1

  const { data: entries, error: entriesError, count } = await ledgerQuery
    .order('occurred_at', { ascending: false })
    .order('id', { ascending: false })
    .range(from, to)

  if (entriesError) {
    throw new DebtCoreError({
      code: 'LEDGER_QUERY_FAILED',
      status: 400,
      message: entriesError.message,
      details: entriesError.details,
    })
  }

  const { data: balanceView, error: balanceError } = await supabaseAdmin
    .from('v_customer_debt_balance')
    .select('current_debt')
    .eq('customer_id', input.customerId)
    .maybeSingle()

  if (balanceError) {
    throw new DebtCoreError({
      code: 'LEDGER_QUERY_FAILED',
      status: 400,
      message: balanceError.message,
      details: balanceError.details,
    })
  }

  return {
    customerId: customer.id,
    customerName: customer.name,
    openingDebt: Number(customer.opening_debt ?? 0),
    currentDebt: Number(balanceView?.current_debt ?? customer.opening_debt ?? 0),
    pagination: {
      limit: input.query.limit,
      offset: input.query.offset,
      total: count ?? 0,
    },
    filters: {
      entryType: input.query.entryType ?? null,
      from: input.query.from ?? null,
      to: input.query.to ?? null,
    },
    entries:
      entries?.map((entry) => ({
        id: entry.id,
        entryType: entry.entry_type,
        amount: Number(entry.amount),
        balanceAfter: entry.balance_after == null ? null : Number(entry.balance_after),
        saleId: entry.sale_id,
        paymentId: entry.payment_id,
        occurredAt: entry.occurred_at,
        note: entry.note,
      })) ?? [],
  }
}
