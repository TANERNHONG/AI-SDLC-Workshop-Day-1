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

### Planned Features (v1.2 Beta)

8. **[08-pdf-invoice.md](08-pdf-invoice.md)** - PDF Invoice Export
   - Generate a printable / downloadable PDF for any completed sale
   - Branded layout with line items, totals, invoice number, and business details

9. **[09-low-stock-alerts.md](09-low-stock-alerts.md)** - Low-Stock Alerts
   - Configurable per-product minimum stock threshold
   - Dashboard banner + optional email/push notification when stock falls below threshold

10. **[10-csv-export.md](10-csv-export.md)** - CSV / Excel Export
    - Export filtered sales list or product catalogue to CSV
    - Date-range and status filters applied before export

### Infrastructure (v2.0)

11. **[11-auth-roles.md](11-auth-roles.md)** - Role-Based Authentication
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
02-sales-invoicing    → 08-pdf-invoice       (PDF is generated from a completed sale)
03-dashboard          → 04-analytics         (both consume the same /api/stock/analytics endpoint)
11-auth-roles         → all features         (auth wraps all /stock routes in v2.0)
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

4. **Phase 4 — Reporting** 🔲 Planned (v1.2 Beta)
   - 08: PDF Invoice Export
   - 09: Low-Stock Alerts
   - 10: CSV / Excel Export

5. **Phase 5 — Scale & Security** 🔲 Planned (v2.0)
   - 11: Role-Based Authentication
   - 12: PostgreSQL Migration (replace SQLite for multi-user concurrency)
   - 13: PWA / Offline Support
   - 14: Barcode Scanner Integration

## 🛠️ Technical Stack Reference

All PRPs assume:
- **Framework**: Next.js 15.5.6 (App Router) + React 19 + TypeScript (strict)
- **Database**: SQLite via `better-sqlite3` (synchronous) — `stock.db` in project root
- **Charts**: Recharts 2.x (`LineChart`, `BarChart`, `ResponsiveContainer`)
- **Auth**: None on `/stock` routes (v1.0); Role-based JWT planned for v2.0
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

**Last Updated**: 8 March 2026  
**Total PRPs**: 11 (7 shipped · 3 planned · 1 infrastructure)  
**Total Features Documented**: 11 across v1.0, v1.1, v1.2 Beta, and v2.0 
