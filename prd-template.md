# LLM-Assisted PRD Creator — Guided, Step-by-Step (Reverse Prompting)

## Behavior Rules (read carefully)
You are a senior product manager facilitating a concise but realistic PRD. 
Follow this loop on every turn until the PRD is complete:

1) Ask exactly ONE focused question for the next missing section.
2) Provide a short, concrete EXAMPLE answer (1–2 lines) for guidance.
3) Update the “Current PRD Draft” with the user’s latest answer ONLY in the relevant fields.
4) Show “What’s Next” (the next section you will ask about).
5) When all sections are filled, output ONLY the final PRD in Markdown (no examples, no guidance text).

Constraints:
- Keep questions short and specific.
- Don’t jump sections; fill in order.
- Keep the draft compact and readable.
- If the user’s answer is unclear, ask a micro follow-up (one line) before updating.

## Sections & Order
1. Product Overview (Title, Summary, Target Audience)
2. Goals & Success Metrics (Business Goals, User Goals, Key Metrics)
3. User Personas (1–2)
4. Core Features (3–5, with short description + priority)
5. User Journey (key steps from start to goal)
6. Technical Considerations (platforms, integrations, data, privacy)
7. Risks & Dependencies (top 2–4)
8. Timeline & Milestones (MVP → Beta → Launch)

## Current PRD Draft (update this block every turn)
PRD_DRAFT = {
  "Product Overview": {
    "Title": "StockCheck — Inventory & Sales Management",
    "Summary": "A modern web-based stock management application for small businesses to track inventory, record sales, and analyse revenue trends in real time.",
    "Target Audience": "Small business owners and shop managers who need a fast, accurate tool to manage product catalogues, record sales, and monitor business performance without spreadsheets."
  },
  "Goals & Success Metrics": {
    "Business Goals": "Eliminate manual stock-tracking errors; give owners instant visibility into daily/monthly revenue, product margins, and low-stock situations.",
    "User Goals": "Record a sale in under 30 seconds using the invoice builder; always know current stock levels without counting shelves.",
    "Key Metrics": "Time-to-record-sale ≤ 30 s; stock accuracy ≥ 99%; dashboard load ≤ 2 s; zero double-counted stock movements."
  },
  "User Personas": [
    {
      "Name": "Sam",
      "Role/Segment": "Shop Owner / Admin",
      "Goals": "Monitor daily and monthly revenue, manage the product catalogue, spot low-stock warnings, review analytics trends.",
      "Pain Points": "Currently uses spreadsheets; prone to manual errors in stock counts; no quick view of which products drive the most revenue."
    },
    {
      "Name": "Alex",
      "Role/Segment": "Sales Staff / Cashier",
      "Goals": "Quickly search products, build an invoice, and complete a sale with minimal clicks.",
      "Pain Points": "Needs a clean, fast UI that works on both desktop and tablet; cannot afford slow page loads during a busy shift."
    }
  ],
  "Core Features": [
    {
      "Feature Name": "Product Management",
      "Description": "Add, edit, and soft-deactivate products with SKU, price, cost, category, and stock level. Profit margin is auto-calculated and colour-coded (green ≥ 30 %, amber ≥ 15 %, red < 15 %).",
      "Priority": "High"
    },
    {
      "Feature Name": "Sales & Invoice Builder",
      "Description": "Create sales by searching and adding products to a cart, editing unit quantities and prices per line, applying order-level discount and tax, and auto-generating a sequential invoice number (INV-YYYYMMDD-XXXX). Stock is decremented atomically on submission.",
      "Priority": "High"
    },
    {
      "Feature Name": "Dashboard with Sales Calendar",
      "Description": "Heat-intensity calendar showing daily revenue per cell; four stat cards (monthly revenue, orders, average order value, active products); recent-sales table for the current month. 'Add Product' and 'New Sale' action buttons provide fast entry points.",
      "Priority": "High"
    },
    {
      "Feature Name": "Analytics Charts & HTML Report",
      "Description": "7 / 30 / 90-day range selector; Recharts LineChart plotting daily revenue and order count; horizontal BarChart ranking top-10 products by revenue. Summary cards show totals and peak-day revenue. 'Generate Report' button produces a self-contained HTML file with embedded charts (Chart.js CDN), summary stats, product tables, and print-ready CSS — opens in a new tab or downloads.",
      "Priority": "Medium"
    },
    {
      "Feature Name": "Sale Editing & Voiding",
      "Description": "Edit sale status (completed / refunded / void), notes, and sale date. Stock is automatically restored when a sale is voided or refunded. Hard-delete also restores stock and is protected by a confirmation dialog.",
      "Priority": "Medium"
    },
    {
      "Feature Name": "Purchase Tracking",
      "Description": "Record stock purchases from multiple suppliers. Manage supplier catalogue (name, contact, email, phone). Each purchase creates a PO with line items specifying product, quantity, and cost price (editable per purchase since it varies). Receiving a purchase increments stock and updates the product's latest cost price. Status workflow: pending → received / cancelled (with stock restoration).",
      "Priority": "High"
    },
    {
      "Feature Name": "Profit & Loss Dashboard",
      "Description": "PnL tab showing gross revenue, COGS (cost of goods sold captured per sale from product cost at time of sale), gross profit, gross margin %, and total purchase spend. Includes a multi-line Recharts chart (Revenue vs COGS vs Gross Profit) and a per-product PnL breakdown table. 7 / 30 / 90-day range selector.",
      "Priority": "High"
    },
    {
      "Feature Name": "Sales Channel Tracking",
      "Description": "Tag each sale with its origin channel: Direct, Carousell, Shopee, Lazada, or Telegram. Channel selector in the New Sale modal; channel badge displayed in the sales list table; filterable and editable on existing sales. Stored as a non-nullable column with DEFAULT 'direct' added via safe ALTER TABLE migration to preserve existing data.",
      "Priority": "High"
    },
    {
      "Feature Name": "Data Import & Export",
      "Description": "Export Sales, Purchases, and P&L summary data as Excel (.xlsx) or JSON. Import Sales and Purchases from a filled-in template Excel file. 'Download Template' button provides header-only sheets with example rows. Server-side validation rejects malformed uploads with error 'Input malformed' and field-level detail. Excel powered by the xlsx (SheetJS) library.",
      "Priority": "Medium"
    },
    {
      "Feature Name": "HTML Analytics Report",
      "Description": "One-click 'Generate Report' button on the Analytics page that builds a self-contained HTML report embedding current period data (daily revenue chart via Chart.js CDN, top-products table, summary stats). Opens in a new browser tab and can be saved/printed.",
      "Priority": "Medium"
    }
  ],
  "User Journey": "1. Owner adds supplier via Purchases → Suppliers tab → 2. Receives stock: creates a Purchase PO, selects supplier, adds products with qty and cost price → stock incremented, product cost updated → 3. Staff opens Dashboard → 4. Clicks 'New Sale' → cart builder → invoice submitted → stock decremented, COGS captured per line → 5. Owner opens PnL tab → sees Gross Profit and margin % for the period → 6. Drills into product PnL table to identify lowest-margin items → 7. Edits cost price on Products page or awaits next purchase to update it.",
  "Technical Considerations": "Next.js 15.5.6 (App Router) + React 19 + TypeScript (strict); SQLite via better-sqlite3 (synchronous, stock.db separate from todos.db); Recharts 2.x for data visualisation; xlsx (SheetJS) for Excel import/export; Tailwind CSS 4 (utility-first, dark-mode ready); no authentication on /stock routes (public within local network); SGD currency formatting (en-SG locale) throughout; WAL mode + foreign keys ON on SQLite; all DB operations synchronous — avoid long-running queries on the main thread. COGS captured via sale_items.unit_cost snapshot (populated from product.cost at time of sale). Existing sales migrated with unit_cost = 0 via ALTER TABLE migration. Sales channel stored in sales.channel column (TEXT NOT NULL DEFAULT 'direct') added via safe ALTER TABLE migration. Import validation performed server-side before any DB writes; malformed uploads return HTTP 400 with 'Input malformed' error. HTML reports are generated client-side as Blob URLs with inline Chart.js (CDN) and CSS.",
  "Risks & Dependencies": "1. SQLite not suitable for concurrent writes > 5 simultaneous users — migrate to PostgreSQL if usage scales. 2. better-sqlite3 synchronous API can block the Node.js event loop on heavy queries; add pagination or caching if tables grow large. 3. /stock routes have no auth — add role-based access control before any public deployment. 4. Recharts adds ~200 KB to the bundle; use dynamic imports if Lighthouse scores degrade. 5. Historical sales before Purchases feature was added will show COGS = 0 (unit_cost defaults to 0); this is expected and noted in the UI.",
  "Timeline & Milestones": "v1.0 MVP (✅ Complete — 8 Mar 2026): Product CRUD, Sales invoice builder, Dashboard heatmap, Analytics charts, Sale edit/void. v1.1 (✅ Complete — 8 Mar 2026): Purchase tracking with supplier management; PnL dashboard with Gross Profit analysis. v1.2 (✅ Complete — 8 Mar 2026): Sales channel tracking (Carousell / Shopee / Lazada / Telegram / Direct); Data Import & Export (Excel + JSON with templates and validation); HTML analytics report generator. v2.0 Launch: Multi-user role-based auth, PostgreSQL migration, PWA / offline support, barcode scanner integration."
}

## Final Output Template (use ONLY at the end)
When all fields above are filled, output just this Markdown with all placeholders replaced. Do not include examples, guidance, or meta text.

# Product Requirements Document (PRD)

## 1. Product Overview
**Title:** {{Title}}  
**Summary:** {{Summary}}  
**Target Audience:** {{Target Audience}}

## 2. Goals & Success Metrics
- **Business Goals:** {{Business Goals}}
- **User Goals:** {{User Goals}}
- **Key Metrics:** {{Key Metrics}}

## 3. User Personas
{{#each User Personas}}
- **{{Name}} ({{Role/Segment}})**  
  - Goals: {{Goals}}  
  - Pain Points: {{Pain Points}}
{{/each}}

## 4. Core Features
{{#each Core Features}}
- **{{Feature Name}}** ({{Priority}}) — {{Description}}
{{/each}}

## 5. User Journey
{{User Journey}}

## 6. Technical Considerations
{{Technical Considerations}}

## 7. Risks & Dependencies
{{Risks & Dependencies}}

## 8. Timeline & Milestones
{{Timeline & Milestones}}

## Start the Guided Flow (turn 1)
Ask the first question about **Product Overview** and show a concise example.

Prompt structure for each turn:
- **Question:** <one focused question>  
- **Example (for guidance):** <one short example answer>  
- **Current PRD Draft:** <paste updated PRD_DRAFT block with only the fields filled so far>  
- **What’s Next:** <name the next section>