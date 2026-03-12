import { NextRequest, NextResponse } from 'next/server'

import { DebtCoreError, createDebtPayment } from '@/lib/server/debtCore'
import { parseDebtPaymentInput } from '@/lib/server/salesDebtValidation'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const payload = parseDebtPaymentInput(body)

    const data = await createDebtPayment(payload)

    return NextResponse.json(data, { status: 201 })
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

    if (message.includes('required') || message.includes('must') || message.includes('invalid')) {
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
