# TapHoaThao — Code Standards & Conventions

## Project Structure

```
taphoathao/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── api/                  # REST API routes
│   │   │   ├── products/         # GET, POST, PATCH, DELETE
│   │   │   ├── batches/          # POST, bulk import
│   │   │   ├── sales/            # POST (RPC-based)
│   │   │   ├── debt/             # Payments + ledger
│   │   │   ├── customers/        # GET, POST
│   │   │   ├── cashflow/         # GET, POST
│   │   │   ├── units/            # GET, POST
│   │   │   └── reports/          # Summary KPIs
│   │   ├── products/             # Product pages
│   │   ├── sales/                # Sales POS UI
│   │   ├── customers/            # Customer + debt pages
│   │   ├── batches/              # Batch import UI
│   │   ├── cashflow/             # Cashflow UI
│   │   ├── reports/              # Reports UI
│   │   ├── login/                # Login page
│   │   ├── layout.tsx            # Root layout + nav
│   │   ├── page.tsx              # Root redirect → /login
│   │   └── globals.css           # Global styles
│   └── lib/
│       ├── server/               # Server-only modules
│       │   ├── supabaseAdmin.ts  # Admin client factory
│       │   ├── inventory.ts      # Data access (products, units, batches)
│       │   ├── inventoryValidation.ts
│       │   ├── salesCore.ts      # Sales RPC + error mapping
│       │   ├── salesDebtValidation.ts
│       │   ├── debtCore.ts       # Debt operations
│       │   ├── customerCashflowCore.ts
│       │   └── customerCashflowValidation.ts
│       ├── supabaseClient.ts     # Browser client
│       └── useRequireSession.ts  # Auth guard hook
├── docs/                         # Documentation
│   └── pm/                       # PM planning docs
├── public/                       # Static assets
├── package.json
└── tsconfig.json
```

## Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Files (pages) | `page.tsx` (Next.js convention) | `src/app/products/page.tsx` |
| Files (API) | `route.ts` (Next.js convention) | `src/app/api/products/route.ts` |
| Files (server modules) | camelCase | `salesCore.ts`, `inventoryValidation.ts` |
| React components | PascalCase | `ProductsPage`, `KpiCard` |
| Functions | camelCase | `createSale`, `parseCreateProductInput` |
| Types | PascalCase | `Product`, `CreateSaleInput`, `SalesCoreError` |
| DB columns | snake_case | `default_sell_price`, `qty_remaining` |
| API request fields | camelCase | `skuId`, `unitPrice`, `allocationMode` |
| CSS classes | Tailwind utility classes | `className="rounded border px-3 py-2"` |

## Architecture Patterns

### Validation-Core Separation

Server logic is split into two layers per domain:

```
*Validation.ts  →  Parse & validate raw input
*Core.ts        →  Execute business logic with validated input
```

| Domain | Validation | Core |
|--------|-----------|------|
| Inventory | `inventoryValidation.ts` | `inventory.ts` |
| Sales/Debt | `salesDebtValidation.ts` | `salesCore.ts`, `debtCore.ts` |
| Customer/Cashflow | `customerCashflowValidation.ts` | `customerCashflowCore.ts` |

### API Route Pattern

All API routes follow a consistent pattern:

```typescript
export async function POST(req: NextRequest) {
  try {
    const raw = await req.json()              // 1. Parse body
    const input = parseCreateXxxInput(raw)     // 2. Validate
    const result = await createXxx(input)      // 3. Execute
    return NextResponse.json({ data: result }) // 4. Return
  } catch (err) {
    // 5. Error handling with status codes
    return NextResponse.json(
      { error: { message: err.message } },
      { status: err.status ?? 400 }
    )
  }
}
```

### Error Handling

Custom error classes per domain with typed error codes:

```typescript
class SalesCoreError extends Error {
  code: SalesCoreErrorCode    // 'INSUFFICIENT_STOCK' | 'LOT_NOT_FOUND' | ...
  status: number              // HTTP status code
  details: string | null      // Additional context
}
```

PostgreSQL errors are mapped to domain-specific errors via `mapPgError()` functions.

### Client-Side Patterns

- All pages use `'use client'` directive (client-side rendering)
- Auth protection via `useRequireSession()` hook at page level
- Data fetching via `fetch()` with `{ cache: 'no-store' }`
- State management: React `useState` + `useEffect` (no external state library)
- Form submission: controlled inputs with `onSubmit` handlers
- Error display: inline `<p>` elements with red/green color coding

## TypeScript Guidelines

- Strict mode enabled
- API responses typed with intersection types: `{ data?: T } & ApiError`
- Validation functions return typed outputs or throw `Error`
- `Number.isFinite()` used for all numeric validations (not `isNaN`)
- Helper utilities: `isRecord()`, `toTrimmedString()`, `toNonNegativeNumber()`, `toPositiveNumber()`

## Styling

- **TailwindCSS 4** via `@tailwindcss/postcss`
- Consistent spacing: `p-4`, `p-6`, `gap-2`, `gap-4`
- Card pattern: `rounded-lg border p-4`
- Table pattern: `min-w-full text-sm` with `bg-zinc-50` headers
- Responsive: `md:grid-cols-*` for desktop layouts
- Color scheme: zinc-based (neutral) with black CTAs

## Database Conventions

- All IDs: UUID via `gen_random_uuid()`
- All monetary values: `NUMERIC(14,2)`
- All quantities: `NUMERIC(14,3)`
- Timestamps: `TIMESTAMPTZ` with `DEFAULT NOW()`
- Auto `updated_at` via `set_updated_at()` trigger
- Computed columns: `line_total` in `sale_items` is `GENERATED ALWAYS AS`
- Check constraints: enforce data integrity at DB level
- Partial indexes: for non-null unique constraints (barcode, phone)
