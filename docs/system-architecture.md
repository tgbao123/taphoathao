# TapHoaThao — System Architecture

## Overview

TapHoaThao follows a **monolithic Next.js architecture** with Supabase as the backend-as-a-service layer. All code lives in a single Next.js 16 application using the App Router.

```mermaid
graph TB
    subgraph Client["Browser (React 19)"]
        LOGIN[Login Page]
        PAGES[Protected Pages]
        HOOK[useRequireSession Hook]
        SB_CLIENT[Supabase Client SDK]
    end

    subgraph Server["Next.js API Routes"]
        API[API Route Handlers]
        VAL[Validation Layer]
        CORE[Core Business Logic]
        SB_ADMIN[Supabase Admin Client]
    end

    subgraph Supabase["Supabase Platform"]
        AUTH[Supabase Auth]
        PG[(PostgreSQL)]
        RPC[RPC Functions]
        VIEWS[DB Views]
    end

    LOGIN --> SB_CLIENT --> AUTH
    PAGES --> HOOK --> SB_CLIENT
    PAGES --> API
    API --> VAL --> CORE --> SB_ADMIN --> PG
    SB_ADMIN --> RPC
    SB_ADMIN --> VIEWS
```

## Layers

### 1. Presentation Layer (Client)

All UI pages are React client components (`'use client'`).

| Component | Purpose |
|-----------|---------|
| `layout.tsx` | Root layout with navigation header |
| `useRequireSession` | Auth guard — redirects unauthenticated users to `/login` |
| Page components | Interactive forms, tables, cart UI |
| `supabaseClient.ts` | Browser-side Supabase client (auth only) |

**Data flow**: Page → `fetch('/api/...')` → Display response

### 2. API Layer (Server)

Next.js App Router API routes handle HTTP requests.

**Request pipeline:**

```
HTTP Request
  → route.ts handler (GET/POST/PATCH/DELETE)
    → parseXxxInput() — validation
      → xxxCore function — business logic
        → Supabase Admin SDK — database
          → JSON Response
```

### 3. Business Logic Layer

Split into two sub-layers per domain:

| Sub-layer | Files | Responsibility |
|-----------|-------|---------------|
| **Validation** | `*Validation.ts` | Parse raw input, type coercion, constraint checks |
| **Core** | `*Core.ts`, `inventory.ts` | Execute queries, RPC calls, error mapping |

### 4. Data Layer (Supabase)

| Mechanism | Usage |
|-----------|-------|
| Supabase Query Builder | CRUD on `products`, `units`, `customers`, `product_batches`, `cash_transactions` |
| Supabase RPC | `api_create_sale` (atomic sale + stock allocation), `api_create_debt_payment` |
| Supabase Views | `v_customer_debt_balance` (current debt calculation) |
| Supabase Auth | Email/password login, session management |

## Data Flow Diagrams

### Sale Creation Flow

```mermaid
sequenceDiagram
    participant UI as Sales Page
    participant API as POST /api/sales
    participant VAL as salesDebtValidation
    participant CORE as salesCore
    participant RPC as api_create_sale (PG)

    UI->>API: POST { items: [...], allocationMode }
    API->>VAL: parseCreateSaleInput(body)
    VAL-->>API: CreateSaleInput
    API->>CORE: createSale({ payload, idempotencyKey })
    CORE->>RPC: supabase.rpc('api_create_sale', ...)
    Note over RPC: Atomic transaction:<br/>1. Create sale + sale_items<br/>2. Allocate stock (FIFO/manual)<br/>3. Update qty_remaining<br/>4. Create debt_ledger entry<br/>5. Create cash_transaction
    RPC-->>CORE: { saleId }
    CORE-->>API: saleId
    API-->>UI: { saleId }
```

### Authentication Flow

```mermaid
sequenceDiagram
    participant USER as Browser
    participant LOGIN as /login
    participant HOOK as useRequireSession
    participant SB as Supabase Auth
    participant PAGE as Protected Page

    USER->>LOGIN: Navigate to app
    LOGIN->>SB: getSession()
    alt Has session
        SB-->>LOGIN: session
        LOGIN->>PAGE: redirect to /products
    else No session
        SB-->>LOGIN: null
        LOGIN-->>USER: Show login form
        USER->>LOGIN: Submit email/password
        LOGIN->>SB: signInWithPassword()
        SB-->>LOGIN: session
        LOGIN->>PAGE: redirect to nextPath
    end
    PAGE->>HOOK: useRequireSession()
    HOOK->>SB: getSession() + onAuthStateChange
    alt Session valid
        SB-->>HOOK: session
        HOOK-->>PAGE: { checkingSession: false }
    else Session expired
        SB-->>HOOK: null
        HOOK->>LOGIN: redirect with ?next=
    end
```

### Debt Management Flow

```mermaid
sequenceDiagram
    participant UI as Debt Page
    participant API as Debt API Routes
    participant CORE as debtCore
    participant DB as PostgreSQL

    UI->>API: GET /api/debt/customers/:id/ledger
    API->>CORE: getCustomerLedger(customerId, query)
    CORE->>DB: SELECT from customers
    CORE->>DB: SELECT from debt_ledger (paginated)
    CORE->>DB: SELECT from v_customer_debt_balance
    DB-->>CORE: { customer, entries, currentDebt }
    CORE-->>API: Formatted ledger response
    API-->>UI: { customerId, entries, openingDebt, currentDebt }

    UI->>API: POST /api/debt/payments
    API->>CORE: createDebtPayment(input)
    CORE->>DB: RPC api_create_debt_payment
    Note over DB: Creates debt_payment record<br/>+ debt_ledger entry (payment)<br/>+ cash_transaction (inflow)
    DB-->>CORE: paymentId
    CORE-->>API: paymentId
    API-->>UI: { paymentId }
```

## Database Schema (ER Diagram)

```mermaid
erDiagram
    units ||--o{ products : "unit_id"
    products ||--o{ product_batches : "product_id"
    products ||--o{ sale_items : "product_id"
    customers ||--o{ sales : "customer_id"
    customers ||--o{ debt_payments : "customer_id"
    customers ||--o{ debt_ledger : "customer_id"
    sales ||--o{ sale_items : "sale_id"
    sales ||--o{ debt_ledger : "sale_id"
    product_batches ||--o{ sale_items : "batch_id"
    debt_payments ||--o{ debt_ledger : "payment_id"

    units {
        uuid id PK
        text code UK
        text name
        text symbol
        boolean is_active
    }
    products {
        uuid id PK
        text sku UK
        text name
        uuid unit_id FK
        text barcode
        numeric default_sell_price
        boolean is_active
    }
    product_batches {
        uuid id PK
        uuid product_id FK
        text batch_no
        numeric import_price
        numeric sell_price
        numeric qty_in
        numeric qty_remaining
        timestamptz imported_at
        date expires_at
    }
    customers {
        uuid id PK
        text code UK
        text name
        text phone
        numeric opening_debt
        boolean is_active
    }
    sales {
        uuid id PK
        text sale_no UK
        uuid customer_id FK
        numeric subtotal
        numeric discount_amount
        numeric total_amount
        numeric paid_amount
        numeric debt_amount
        text status
    }
    sale_items {
        uuid id PK
        uuid sale_id FK
        uuid product_id FK
        uuid batch_id FK
        numeric qty
        numeric unit_price
        numeric line_total
    }
    debt_payments {
        uuid id PK
        uuid customer_id FK
        numeric amount
        text method
        timestamptz paid_at
    }
    debt_ledger {
        uuid id PK
        uuid customer_id FK
        text entry_type
        numeric amount
        numeric balance_after
        uuid sale_id FK
        uuid payment_id FK
    }
    cash_transactions {
        uuid id PK
        text txn_type
        text category
        numeric amount
        text method
        uuid customer_id FK
        uuid sale_id FK
    }
```

## Security Model

| Layer | Mechanism |
|-------|-----------|
| Authentication | Supabase Auth (email/password) |
| Client guard | `useRequireSession` hook — redirects on no session |
| API authorization | Server uses `SUPABASE_SERVICE_ROLE_KEY` (bypasses Row Level Security) |
| Input validation | All API inputs validated via `parse*Input()` functions |
| SQL injection | Prevented by Supabase query builder (parameterized queries) |
| DB integrity | CHECK constraints, FOREIGN KEY constraints, UNIQUE indexes |
