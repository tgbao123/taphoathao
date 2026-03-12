import { NextRequest, NextResponse } from 'next/server'

import { createCustomer, listCustomers } from '@/lib/server/customerCashflowCore'
import { parseCreateCustomerInput, parseCustomerQuery } from '@/lib/server/customerCashflowValidation'

type ApiError = { message?: string; code?: string }

function mapError(err: ApiError) {
  if (err.code === '23505') {
    return { status: 409, code: 'DUPLICATE', message: err.message ?? 'Duplicate customer field' }
  }

  return { status: 400, code: 'BAD_REQUEST', message: err.message ?? 'Request failed' }
}

export async function GET(request: NextRequest) {
  try {
    const query = parseCustomerQuery(new URL(request.url).searchParams)
    const { data, error } = await listCustomers(query)

    if (error) {
      const mapped = mapError(error)
      return NextResponse.json({ error: mapped }, { status: mapped.status })
    }

    return NextResponse.json({ data: data?.items ?? [], pagination: data?.pagination ?? null })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid request'
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message } }, { status: 422 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const input = parseCreateCustomerInput(body)
    const { data, error } = await createCustomer(input)

    if (error) {
      const mapped = mapError(error)
      return NextResponse.json({ error: mapped }, { status: mapped.status })
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid request'
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message } }, { status: 422 })
  }
}
