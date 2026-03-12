# TapHoaThao — Quản lý Tạp Hoá

> Web app quản lý cửa hàng tạp hoá / thể thao cho 1 admin. Theo dõi hàng hoá, tồn kho theo lô, bán hàng, công nợ khách hàng.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4 |
| Backend | Next.js API Routes (App Router) |
| Database | PostgreSQL (Supabase) |
| Auth | Supabase Auth (email/password) |
| Hosting | Vercel (planned) |

## Features

- **Sản phẩm & Đơn vị** — CRUD sản phẩm với đơn vị tính (cái, hộp, kg…)
- **Tồn kho theo lô** — Import lô hàng (batch), theo dõi giá nhập/bán, số lượng tồn, hạn sử dụng
- **Bán hàng** — POS-style sales UI with 2 allocation modes:
  - `AUTO_FIFO`: server tự trừ theo lô nhập sớm nhất
  - `MANUAL_LOT`: chọn lô cụ thể khi bán
- **Công nợ** — Sổ công nợ khách hàng, thu nợ, ledger timeline, payment form
- **Dòng tiền** — Ghi nhận thu/chi khi bán hàng và thu nợ
- **Auth guard** — Session-based route protection with redirect to login

## Getting Started

### Prerequisites

- Node.js ≥ 18
- npm
- Supabase project (URL + anon key + service role key)

### Setup

```bash
# Clone & install
git clone <repo-url>
cd taphoathao
npm install

# Configure environment
cp .env.local.example .env.local
# Edit .env.local with your Supabase credentials:
#   NEXT_PUBLIC_SUPABASE_URL=
#   NEXT_PUBLIC_SUPABASE_ANON_KEY=
#   SUPABASE_SERVICE_ROLE_KEY=

# Run database migrations
# Apply docs/pm/schema.sql first, then docs/pm/migrations/*.sql

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

## Project Structure

```
taphoathao/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/                # API Routes
│   │   │   ├── products/       # Products CRUD
│   │   │   ├── batches/        # Batch import
│   │   │   ├── sales/          # Sales creation
│   │   │   ├── debt/           # Debt ledger & payments
│   │   │   └── units/          # Units CRUD
│   │   ├── products/           # Products UI pages
│   │   ├── sales/              # Sales POS UI
│   │   ├── customers/[id]/debt/# Customer debt ledger UI
│   │   ├── batches/import/     # Batch import UI
│   │   ├── login/              # Admin login + redirect
│   │   └── layout.tsx          # Root layout
│   └── lib/
│       ├── server/             # Server-side business logic
│       │   ├── inventory.ts    # Products & batches data layer
│       │   ├── inventoryValidation.ts
│       │   ├── salesCore.ts    # Sales via RPC
│       │   ├── debtCore.ts     # Debt ledger & payments
│       │   └── salesDebtValidation.ts
│       ├── useRequireSession.ts # Auth guard hook
│       └── supabaseClient.ts   # Browser Supabase client
├── docs/
│   └── pm/                     # PM documents & migrations
├── public/                     # Static assets
└── package.json
```

## API Overview

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/products` | List all products (with unit) |
| POST | `/api/products` | Create product |
| GET | `/api/products/:id` | Get product by ID |
| PATCH | `/api/products/:id` | Update product |
| DELETE | `/api/products/:id` | Delete product |
| GET | `/api/products/:id/batches` | List product batches |
| POST | `/api/batches` | Create single batch |
| POST | `/api/batches/import` | Bulk import batches |
| GET | `/api/units` | List units |
| POST | `/api/units` | Create unit |
| POST | `/api/sales` | Create sale (FIFO or manual lot) |
| POST | `/api/debt/payments` | Create debt payment |
| GET | `/api/debt/customers/:id/ledger` | Customer debt ledger |

## Database Schema

9 core tables: `units`, `products`, `product_batches`, `customers`, `sales`, `sale_items`, `sale_allocations`, `debt_ledger`, `debt_payments`, `cash_transactions`.

Full schema: [docs/pm/schema.sql](docs/pm/schema.sql)

## Documentation

| Document | Description |
|----------|-------------|
| [Project Overview & PDR](docs/project-overview-pdr.md) | Requirements & product vision |
| [Codebase Summary](docs/codebase-summary.md) | File-by-file analysis |
| [Code Standards](docs/code-standards.md) | Patterns & conventions |
| [System Architecture](docs/system-architecture.md) | Architecture & data flow |
| [Project Roadmap](docs/project-roadmap.md) | Milestones & backlog |
| [PM Plan](docs/pm/PLAN.md) | Original PM plan |
| [Estimates](docs/pm/EST.md) | Task estimates |
| [Sales/Debt API Spec](docs/pm/sales-debt-api.md) | Sales API spec |
| [UI Wireframes](docs/pm/ui.md) | Route wireframes |

## License

Private project.
