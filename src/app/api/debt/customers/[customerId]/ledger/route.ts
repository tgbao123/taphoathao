import { NextRequest, NextResponse } from 'next/server'

import { DebtCoreError, getCustomerLedger } from '@/lib/server/debtCore'
import { parseDebtLedgerQuery } from '@/lib/server/salesDebtValidation'

type RouteContext = {
  params: Promise<{
    customerId: string
  }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { customerId } = await context.params
    const { searchParams } = new URL(request.url)

    if (!customerId) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'customerId is required',
          },
        },
        { status: 422 }
      )
    }

    const query = parseDebtLedgerQuery(searchParams)

    const data = await getCustomerLedger({
      customerId,
      query,
    })

    return NextResponse.json(data, { status: 200 })
  } catch (error) {
    if (error instanceof DebtCoreError) {
      return NextResponse.json(
        {
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
          },
        },
        { status: error.status }
      )
    }

    const message = error instanceof Error ? error.message : 'Unexpected error'

    if (message.includes('must') || message.includes('invalid')) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message,
          },
        },
        { status: 422 }
      )
    }

    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message,
        },
      },
      { status: 500 }
    )
  }
}
