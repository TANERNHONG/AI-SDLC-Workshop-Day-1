# Product Requirement Prompts (PRPs) - Index

This directory contains detailed Product Requirement Prompts split by feature. Each PRP provides comprehensive guidance for implementing a specific feature using AI coding assistants.

## 📋 PRP Files

### Core Features (v1.0 — ✅ Shipped 8 Mar 2026)

1. **[01-product-management.md](01-product-management.md)** - Product Catalogue & Inventory
   - Add / edit / deactivate products with SKU, price, cost, category, and stock quantity
   - Auto-calculated margin % with colour-coded thresholds; low-stock warnings

2. **[02-sales-invoicing.md](02-sales-invoicing.md)** - Sales & Invoice Builder
   - Cart-based invoice builder with product search, qty/price editing, discount & tax
   - Auto-generated invoice numbers (INV-YYYYMMDD-XXXX); atomic stock decrement on submit

3. **[03-dashboard.md](03-dashboard.md)** - Dashboard & Sales Calendar
   - Heatmap calendar with revenue-intensity colouring and day-detail modal
   - Stat cards (revenue, orders, avg. order, active products) + recent-sales table

### Advanced Features

4. **[04-analytics.md](04-analytics.md)** - Analytics Charts
   - Recharts LineChart for daily revenue/orders with 7 / 30 / 90-day range selector
   - Horizontal BarChart ranking top-10 products by revenue and units sold

5. **[05-sale-edit-void.md](05-sale-edit-void.md)** - Sale Editing & Voiding
   - Status toggle (completed / refunded / void) with automatic stock restoration
   - Notes and sale-date editing; hard-delete with confirmation and stock restore

### Shipped Features (v1.1 — 8 Mar 2026)

6. **[06-purchase-tracking.md](06-purchase-tracking.md)** - Purchase Tracking & Supplier Management
   - Supplier catalogue (add/edit/deactivate) with contact details
   - Purchase orders with line items; cost price editable per purchase; status: pending/received/cancelled
   - Stock incremented and product cost price updated on receive; stock restored on cancel

7. **[07-pnl-dashboard.md](07-pnl-dashboard.md)** - Profit & Loss Dashboard
   - COGS captured as snapshot per sale line (unit_cost at time of sale)
   - Summary cards: Revenue, COGS, Gross Profit, Margin %, Purchase Spend
   - Line chart (Revenue vs COGS vs Gross Profit) + per-product PnL breakdown table

### Shipped Features (v1.2 — ✅ Shipped 8 Mar 2026)

8. **[08-sales-channel.md](08-sales-channel.md)** - Sales Channel Tracking
   - Channel selector in New Sale modal: Direct, Carousell, Shopee, Lazada, Telegram
   - Channel badge in sales list table; safe ALTER TABLE migration (existing data preserved)
   - Channel editable in Edit Sale modal; filterable in future analytics breakdowns

9. **[09-import-export.md](09-import-export.md)** - Data Import & Export
   - Export Sales, Purchases, and P&L as Excel (.xlsx) or JSON
   - Download Template button provides header-only sheets with example rows
   - Server-side validation: rejects files with missing/wrong columns with "Input malformed" error
   - Powered by `xlsx` (SheetJS) library

10. **[10-html-report.md](10-html-report.md)** - HTML Analytics Report
    - "Generate Report" button on Analytics page builds self-contained HTML
    - Embeds Chart.js (CDN) bar/line chart data, top-products table, and summary stats
    - Opens in new browser tab; fully printable/saveable with inline CSS

### Planned Features (v1.3 — 🔜 Planned 9 Mar 2026)

11. **[11-shipping-orders.md](11-shipping-orders.md)** - Shipping Orders & Package Management
    - Each Sale can optionally have one Shipping Order with status tracking (Not Prepared → Packed → Shipped → Received → Cancelled)
    - A Shipping Order contains one or more Packages, each with Length, Width, Height (cm), Weight (kg), and optional Courier
    - Supported couriers: uParcel, ezShip, SpeedPost, NinjaVan, Others
    - System auto-recommends the cheapest courier per package based on dimensions/weight via courier rate tables
    - User can manually override the courier selection (e.g. for proximity, convenience, delivery timing)

12. **[12-courier-management.md](12-courier-management.md)** - Courier Rate Management & Auto-Recommendation
    - Manage courier services with four configurable sub-tables per courier:
      - **Rate Tables**: weight tier (kg) × dimension tier (L+W+H cm) → base price (SGD)
      - **Bulk Savings**: order-count thresholds → percentage discount (e.g. 5–9 orders = 5% off)
      - **Surcharges**: named add-on charges with price and description (e.g. area surcharge, night delivery, waiting time)
      - **Additional Services**: optional value-added services with price and description
    - Users can add, edit, and delete entries in each table
    - Auto-recommendation engine: queries all couriers' rate tables for a given package's dimensions/weight, applies bulk savings from current month's order count, ranks cheapest-first
    - Courier field on Package remains editable for manual override
    - Seed data: uParcel with 7 rate tiers, 4 bulk-savings bands, 6 surcharge items

### Planned Features (v2.0)

13. **[13-auth-roles.md](13-auth-roles.md)** - Role-Based Authentication
    - Admin (full access) and Staff (sales + view-only) roles
    - Session management; protect all /stock routes behind login

## 🎯 How to Use These PRPs

### For AI Coding Assistants (GitHub Copilot, etc.)

1. **Feature Implementation**: Copy the entire PRP into your chat to implement a feature from scratch
2. **Bug Fixes**: Reference specific sections when debugging issues
3. **Code Review**: Use acceptance criteria to validate implementations
4. **Testing**: Use test case sections to generate E2E and unit tests

### For Developers

1. **Architecture Understanding**: Read PRPs to understand design decisions
2. **API Contracts**: Reference for endpoint specifications
3. **Edge Cases**: Comprehensive coverage of edge cases and error handling
4. **Best Practices**: Each PRP includes project-specific patterns

## 📚 PRP Structure

Each PRP follows this consistent structure:

- **Feature Overview** - High-level description
- **User Stories** - User personas and their needs
- **User Flow** - Step-by-step interaction patterns
- **Technical Requirements** - Database schema, API endpoints, types
- **UI Components** - React component examples
- **Edge Cases** - Unusual scenarios and handling
- **Acceptance Criteria** - Testable requirements
- **Testing Requirements** - E2E and unit test specifications
- **Out of Scope** - Explicitly excluded features
- **Success Metrics** - Measurable outcomes

## 🔗 Related Documentation

- **[.github/copilot-instructions.md](../.github/copilot-instructions.md)** - AI agent instructions for the entire codebase
- **[docs/USER_GUIDE.md](../docs/USER_GUIDE.md)** - Comprehensive user documentation
- **[README.md](../README.md)** - Setup and installation guide

## 🚀 Development Workflow

### Implementing a New Feature

1. Read the corresponding PRP file thoroughly
2. Reference `.github/copilot-instructions.md` for project patterns
3. Check `USER_GUIDE.md` for user-facing behavior
4. Implement following the technical requirements
5. Validate against acceptance criteria
6. Write tests based on testing requirements section

### Using with GitHub Copilot Chat

```plaintext
"I want to implement [feature name]. 
Here's the PRP: [paste PRP content]
Please help me implement this following the project patterns."
```

### Feature Dependencies

```
01-product-management → 02-sales-invoicing   (products must exist before a sale can be built)
01-product-management → 06-purchase-tracking (products must exist before a purchase can be created)
01-product-management → 09-low-stock-alerts  (threshold config lives on the product record)
02-sales-invoicing    → 05-sale-edit-void    (a sale must exist before it can be edited or voided)
02-sales-invoicing    → 07-pnl-dashboard     (COGS captured per sale; PnL requires sale data)
06-purchase-tracking  → 07-pnl-dashboard     (purchase spend feed into PnL summary card)
02-sales-invoicing    → 08-sales-channel     (channel is a property of a sale)
02-sales-invoicing    → 09-import-export     (export requires existing sales/purchases data)
04-analytics          → 10-html-report       (report embeds analytics data)
02-sales-invoicing    → 11-shipping-orders   (a shipping order is linked to an existing sale)
11-shipping-orders    → 12-courier-management(courier rate tables power the auto-recommendation on packages)
13-auth-roles         → all features         (auth wraps all /stock routes in v2.0)
```

## 📊 Implementation Priority

Recommended implementation order:

1. **Phase 1 — Foundation** ✅ Complete (v1.0, 8 Mar 2026)
   - 01: Product Management (catalogue, SKU, stock levels, margin)
   - 02: Sales & Invoice Builder (cart, stock decrement, invoice number)

2. **Phase 2 — Visibility** ✅ Complete (v1.0, 8 Mar 2026)
   - 03: Dashboard & Sales Calendar (heatmap, stat cards, recent sales)
   - 04: Analytics Charts (line chart, bar chart, range selector)
   - 05: Sale Editing & Voiding (status toggle, stock restore)

3. **Phase 3 — Procurement & Profitability** ✅ Complete (v1.1, 8 Mar 2026)
   - 06: Purchase Tracking & Supplier Management
   - 07: Profit & Loss Dashboard

4. **Phase 4 — Reporting & Data** ✅ Complete (v1.2, 8 Mar 2026)
   - 08: Sales Channel Tracking (Direct / Carousell / Shopee / Lazada / Telegram)
   - 09: Data Import & Export (Excel + JSON with templates and server-side validation)
   - 10: HTML Analytics Report (self-contained with embedded Chart.js)

5. **Phase 5 — Shipping & Logistics** 🔜 Planned (v1.3, 9 Mar 2026)
   - 11: Shipping Orders & Package Management (per-sale shipping with multi-package support)
   - 12: Courier Rate Management & Auto-Recommendation (rate tables, bulk savings, surcharges, seed uParcel data)

6. **Phase 6 — Scale & Security** 🔲 Planned (v2.0)
   - 13: Role-Based Authentication
   - 14: PostgreSQL Migration (replace SQLite for multi-user concurrency)
   - 15: PWA / Offline Support
   - 16: Barcode Scanner Integration

## 🛠️ Technical Stack Reference

All PRPs assume:
- **Framework**: Next.js 15.5.6 (App Router) + React 19 + TypeScript (strict)
- **Database**: SQLite via `better-sqlite3` (synchronous) — `stock.db` in project root
- **Charts**: Recharts 2.x (`LineChart`, `BarChart`, `ResponsiveContainer`)
- **Excel**: `xlsx` (SheetJS) for import/export
- **Auth**: None on `/stock` routes (v1.0–v1.2); Role-based JWT planned for v2.0
- **Testing**: Playwright E2E (virtual authenticator config in `playwright.config.ts`)
- **Styling**: Tailwind CSS 4 (utility-first, `dark:` prefix for dark mode)
- **Currency / Locale**: SGD, `en-SG` locale throughout
- **Key Files**: `lib/stockdb.ts` (DB module), `app/stock/StockShell.tsx` (shell + sidebar), `app/api/stock/**` (REST routes)

## 💡 Tips for AI Assistants

1. **Always reference `.github/copilot-instructions.md`** first for project-wide patterns
2. **Follow the established API route patterns** for consistency
3. **Database operations** - note whether your DB library is sync or async
4. **Client vs Server components** - be explicit about rendering boundaries
5. **Type safety** - import shared types from a single source of truth

## 📝 Contributing

When adding new PRPs:
1. Follow the established structure
2. Include all required sections
3. Provide specific code examples
4. Document edge cases thoroughly
5. Update this index file

---

**Last Updated**: 9 March 2026  
**Total PRPs**: 13 (10 shipped · 2 planned v1.3 · 1 infrastructure)  
**Total Features Documented**: 13 across v1.0, v1.1, v1.2, v1.3, and v2.0 
