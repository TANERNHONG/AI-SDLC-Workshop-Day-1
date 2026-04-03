# Profit Optimizer — User Guide

## Table of Contents
1. [Overview](#1-overview)
2. [Accessing the Optimizer](#2-accessing-the-optimizer)
3. [Understanding the Parameters](#3-understanding-the-parameters)
4. [Running the Optimizer](#4-running-the-optimizer)
5. [Reading the Results](#5-reading-the-results)
6. [Size Group Analysis](#6-size-group-analysis)
7. [Product Recommendation Table](#7-product-recommendation-table)
8. [Mathematical Framework](#8-mathematical-framework)
9. [Product Classification](#9-product-classification)
10. [Workflow Examples](#10-workflow-examples)
11. [Interpreting Key Metrics](#11-interpreting-key-metrics)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Overview

### What It Does

The **Profit Optimizer** is a budget-constrained inventory optimization engine on the **Release Calendar** page. It answers the question: *"Given my monthly budget, which products should I order, how many of each, and in what priority?"*

It analyzes your entire product catalog using historical sales data, upcoming release events, product dimensions, and cost/margin information to produce ranked order recommendations that maximize expected profit while respecting your budget.

### Key Problems It Solves

| Problem | How the Optimizer Handles It |
|---|---|
| Many different products to choose from | Ranks all products by a composite priority score |
| Products have different physical sizes | Groups by size for pooled safety stock analysis |
| Limited monthly budget | Hard budget constraint with greedy allocation |
| 3–4 week shipping lead time | Factors lead time into safety stock and reorder points |
| Evergreen items with predictable demand | Normal distribution demand model with burn rate |
| Rare products with sporadic demand | Poisson distribution + Newsvendor critical ratio |
| Discontinued protector stock-up | Conservative stock-up-to-safety-stock logic |
| Bulk buyer stockout spikes | Safety stock captures demand variance |
| Risk of inventory waste (muda) | Exponential overstock penalty in scoring |
| Release events boosting demand | Configurable demand multiplier for linked products |

---

## 2. Accessing the Optimizer

1. Navigate to **Stock → Calendar** (the Release Calendar page)
2. The **Profit Optimizer** panel appears between the Purchase Suggestions section and the calendar/list view
3. It has a purple gradient icon (⚡) and header

### Panel Layout

```
┌──────────────────────────────────────────────┐
│ ⚡ Profit Optimizer                [Run Optimizer] │
│    Budget-constrained order recommendations        │
├──────────────────────────────────────────────┤
│ Budget │ Lead Time │ Service │ Holding │ ...  │  ← Parameters
├──────────────────────────────────────────────┤
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ │
│ │Budget   │ │Expected │ │Products │ │Stockout │ │  ← Summary KPIs
│ │Used     │ │Profit   │ │to Order │ │Risks    │ │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘ │
├──────────────────────────────────────────────┤
│ ▶ Size Group Analysis (N groups)                   │  ← Collapsible
├──────────────────────────────────────────────┤
│ ▼ Product Recommendations                          │  ← Collapsible table
│ Product │ Type │ Risk │ Stock │ μ/day │ ...        │
│ ...     │ ...  │ ...  │ ...   │ ...   │ ...        │
└──────────────────────────────────────────────┘
```

---

## 3. Understanding the Parameters

The parameter bar is always visible below the header. Adjust these **before** clicking Run.

### Budget (SGD)

- **What**: Your total purchasing budget for the planning month
- **Default**: $1,000
- **Step**: $100 increments
- **Tip**: Set this to the actual cash you can allocate to restocking. The optimizer will not exceed this amount.

### Lead Time (days)

- **What**: How many days from placing an order to receiving stock
- **Default**: 28 days (4 weeks)
- **Range**: 1–90 days
- **Tip**: For overseas suppliers shipping by sea, use 21–28. For local suppliers, use 3–7. This directly affects how much safety stock is recommended.

### Service Level

- **What**: The probability of NOT stocking out during the lead time
- **Default**: 95%
- **Options**: 90%, 95%, 99%
- **How it works**: Higher service level → more safety stock → higher cost but fewer stockouts

| Service Level | Z-Score | Risk Tolerance |
|---|---|---|
| 90% | 1.28 | Acceptable for low-margin evergreen items |
| 95% | 1.645 | Balanced — recommended default |
| 99% | 2.33 | Conservative — use for high-margin or critical items |

### Holding Cost %

- **What**: Monthly cost of holding one unit of inventory, expressed as a percentage of its cost price
- **Default**: 5%
- **Range**: 0–50%
- **Includes**: Storage space, capital opportunity cost, potential obsolescence
- **Tip**: If you store at home, 2–5% is typical. If you rent warehouse space, 5–10%.

### Lookback (days)

- **What**: How many days of historical sales data to use for demand estimation
- **Default**: 90 days
- **Range**: 7–365 days
- **Tip**: Short lookback (30 days) captures recent trends but is noisy. Long lookback (180+ days) is smoother but may miss seasonal shifts. 90 days is a good balance.

### Release Boost

- **What**: Demand multiplier applied to products linked to an upcoming release event
- **Default**: 1.5× (50% demand increase)
- **Range**: 1.0–5.0×
- **Tip**: If releases typically double your sales, set to 2.0. If the boost is modest, use 1.2–1.5. This only applies to products explicitly linked to a release event via the calendar.

### Horizon (days)

- **What**: How many days ahead the optimizer plans for
- **Default**: 30 days (1 month)
- **Range**: 7–90 days
- **Tip**: Match this to your restocking cycle. If you order monthly, use 30. If bi-weekly, use 14.

---

## 4. Running the Optimizer

### Steps

1. **Adjust parameters** in the parameter bar (or leave defaults)
2. Click **"Run Optimizer"** (purple button, top-right of panel)
3. Wait for results (button shows "Running…")
4. Results populate below with summary KPIs, size groups, and product table

### Re-running

- After changing any parameter, click **"Re-run"** to recalculate
- Each run is a fresh computation — previous results are replaced
- The optimizer uses the latest sales, stock, and release event data from the database

---

## 5. Reading the Results

### Summary KPI Cards

Four color-coded cards appear at the top of the results:

#### Budget Used (Purple)
- Shows how much of your budget the optimizer has allocated
- Format: `$X.XX of $Y.YY`
- If significantly under budget, you may have excess capacity or limited profitable items to order

#### Expected Profit (Green)
- Total expected gross profit from all recommended orders
- Shows ROI percentage: `(Expected Profit / Budget Used) × 100`
- This is **gross profit** (revenue − cost), not accounting for holding costs

#### Products to Order (Amber)
- Count of products with a non-zero order recommendation
- Format: `X of Y active` — shows how many products in your catalog warranted an order

#### Stockout Risks (Red)
- Count of products currently at **critical** or **high** stockout risk
- These need attention regardless of budget — consider prioritizing them

---

## 6. Size Group Analysis

Click **"▶ Size Group Analysis (N groups)"** to expand.

### What It Shows

Products are grouped by their physical dimensions (length × width, or length × width × height). This table shows:

| Column | Description |
|---|---|
| **Size Group** | Dimension string, e.g. `6.5×9cm`, `8.5×12×3cm`, or `unspecified` |
| **Products** | Number of products in this size group |
| **Pooled SS** | Pooled safety stock for the entire group (lower than sum of individual) |
| **Order Qty** | Total recommended units across all products in the group |
| **Order Cost** | Total SGD cost for the group |

### Why Size Groups Matter

Products that share the same physical dimensions (e.g., standard card sleeves for Pokémon TCG main sets) can **pool** their safety stock. The pooled safety stock is calculated as:

```
Pooled SS = z × √(σ₁² + σ₂² + ... + σₙ²) × √(lead_time)
```

This is mathematically **less than** the sum of individual safety stocks because demand fluctuations in one product can offset another of the same size. This means:

- **Common sizes** (evergreen items) benefit from diversification — you need less total buffer
- **Unique sizes** (rare products) get no pooling benefit — their safety stock stands alone
- **Unspecified sizes** are grouped together but pooling is less meaningful without real dimensions

### Actionable Insight

If a size group has high pooled SS relative to individual SS totals, you're already well-diversified. If they're nearly equal, each product has independent, uncorrelated demand.

---

## 7. Product Recommendation Table

Click **"▶ Show Product Recommendations"** to expand the full table.

### Columns

| Column | Symbol | Description |
|---|---|---|
| **Product** | — | Product name and SKU |
| **Type** | — | `evergreen`, `rare`, or `discontinued` (see [Classification](#9-product-classification)) |
| **Risk** | — | Stockout risk level: `critical`, `high`, `medium`, `low`, `none` |
| **Stock** | — | Current stock, with pending orders in green `(+N)` |
| **μ/day** | μ | Mean daily demand (units per day) |
| **σ/day** | σ | Daily demand standard deviation |
| **CV** | — | Coefficient of variation (σ/μ). Higher = more erratic demand |
| **SS** | — | Safety stock: buffer units to protect against demand variability |
| **ROP** | — | Reorder point: stock level that triggers a new order |
| **Order** | — | **Recommended order quantity** (the key output) |
| **Cost** | — | Order cost in SGD (Order × unit cost) |
| **Exp. Profit** | — | Expected gross profit (Order × unit margin) |
| **Score** | — | Priority score used for budget allocation ranking |
| **Release** | 🚀 | Days until linked release event (if any) |

### Reading the Table

- Products are **sorted by priority score** (highest first) — this is the order in which budget is allocated
- Products with **Order = "—"** either need no restocking or were cut due to budget constraints
- Products with **0 recommended** appear faded (40% opacity)
- Green expected profit = positive margin; red = negative margin (cost exceeds selling price)
- The 🚀 badge with `Xd` shows days until the linked release event

### Row Highlighting

- **Full opacity**: Product has a recommended order quantity
- **40% opacity**: No order recommended (sufficient stock or zero demand)

---

## 8. Mathematical Framework

### Objective Function

The optimizer maximizes expected profit across all products subject to a budget constraint:

```
Maximize: Σ [ E[Revenue_i] − Cost_i × q_i − Holding_i × E[Inventory_i] ]
Subject to: Σ Cost_i × q_i ≤ Budget
```

### Priority Score (determines budget allocation order)

```
Score_i = (Margin / Cost) × (Demand / (Stock + 1)) × Release_Boost × e^(-0.5 × Overstock_Ratio)
```

Where:
- `Margin / Cost` = ROI component — favors high-margin-relative-to-cost products
- `Demand / (Stock + 1)` = urgency component — favors products running low
- `Release_Boost` = demand multiplier for upcoming release events
- `e^(-0.5 × Overstock_Ratio)` = muda penalty — penalizes products already overstocked

### Safety Stock

**For evergreen (Normal distribution):**
```
SS = z_α × σ_daily × √(lead_time_days) × release_boost
```

**For rare products (Poisson + Newsvendor):**
```
Critical Ratio = (Price − Cost) / (Price − Cost + Holding_Cost)
SS = Poisson_Quantile(λ = horizon_demand, p = Critical_Ratio)
```

The Newsvendor model balances the cost of overstocking (holding cost) against the cost of understocking (lost margin). For rare, high-margin items where collectors can't find alternatives, the critical ratio is high → the model recommends stocking more aggressively.

### Reorder Point

```
ROP = μ_daily × lead_time × release_boost + safety_stock
```

### Recommended Order Quantity

```
Order_Qty = max(0, ROP + Horizon_Demand − Current_Stock − Pending_Stock)
```

### Budget Allocation

Products are sorted by priority score (descending). Budget is allocated greedily:
1. If the full order cost fits within remaining budget → allocate fully
2. If not → allocate as many units as budget allows (partial fill)
3. Products below the budget cutoff get zero allocation

---

## 9. Product Classification

The optimizer classifies each product into one of three types based on its sales pattern:

### Evergreen

- **Criteria**: Regular, predictable sales with moderate variability
- **Demand model**: Normal distribution (μ, σ estimated from daily sales)
- **Safety stock**: z-score based
- **Examples**: Standard card sleeves for common TCG sizes, popular accessories
- **Badge**: Green `evergreen`

### Rare

- **Criteria**: Coefficient of variation (CV) > 2.0, OR active selling days < 10% of lookback period
- **Demand model**: Poisson distribution with Newsvendor critical ratio
- **Safety stock**: Quantile-based — stocks more aggressively when margin is high
- **Examples**: Special-size sleeves for limited sets, unique accessories for rare products
- **Badge**: Purple `rare`

### Discontinued

- **Criteria**: Product is marked inactive (`is_active = false`)
- **Demand model**: Fixed safety stock target
- **Safety stock**: Conservative — only orders up to safety stock level
- **Examples**: Protectors for products whose production has stopped
- **Badge**: Gray `discontinued`

---

## 10. Workflow Examples

### Example 1: Monthly Restocking

**Scenario**: You have $1,500 to spend this month. Shipping takes 4 weeks. A new Pokémon set releases in 3 weeks.

1. Set **Budget** = 1500
2. Set **Lead Time** = 28
3. Set **Service Level** = 95%
4. Set **Release Boost** = 2.0 (Pokémon sets tend to spike sales)
5. Click **Run Optimizer**
6. Check summary: Budget Used shows how much is allocated
7. Check stockout risks: Address any critical items first
8. Open product table: Top-scored items are your priority orders
9. Products linked to the Pokémon release event will show 🚀 badges

### Example 2: Conservative Budget with Bulk Risk

**Scenario**: You've experienced unexpected bulk buyers clearing out evergreen items. You want extra buffer.

1. Set **Service Level** = 99% (higher safety stock)
2. Set **Holding Cost** = 3% (you store at home, low cost)
3. Set **Lookback** = 60 days (capture recent bulk spikes in the variance)
4. Click **Run Optimizer**
5. Check the **CV** column — products with high CV had the most erratic demand
6. The safety stock (SS) column will be larger due to the 99% service level

### Example 3: Stocking Up on Discontinued Protectors

**Scenario**: A protector size is being discontinued. You want to stock up while you can.

1. Ensure the product is marked **inactive** in your product catalog (so it classifies as `discontinued`)
2. Set **Budget** to your available cash
3. Run the optimizer
4. Discontinued items will appear with gray `discontinued` badges
5. The optimizer recommends stocking up to the safety stock level only — it won't over-order because future demand decays

### Example 4: Evaluating a Rare Product

**Scenario**: A new set has a rare insert product with a unique size. You're not sure if it's worth stocking.

1. Add the product to your catalog with its cost and selling price
2. Link it to the release event on the calendar
3. Run the optimizer
4. Check its **Score** — if high, the margin justifies the risk
5. Check its **Type** — it should classify as `rare` if sales are sporadic
6. The Newsvendor model will recommend a quantity based on the critical ratio (margin vs. holding cost)

---

## 11. Interpreting Key Metrics

### Days of Stock Left

| Value | Meaning |
|---|---|
| **-1** | No demand detected — infinite stock days (or no sales history) |
| **0–7** | Critical — will stock out within a week |
| **7–14** | High risk — stock out within two weeks |
| **14–28** | Medium risk — stock out within lead time |
| **28+** | Low risk — comfortable buffer |

### Coefficient of Variation (CV)

| CV | Demand Pattern | Product Type |
|---|---|---|
| **< 0.5** | Very stable, predictable | Evergreen staple |
| **0.5–1.0** | Moderate variability | Evergreen with some fluctuation |
| **1.0–2.0** | High variability | Borderline — may have seasonal spikes |
| **> 2.0** | Very erratic/sporadic | Classified as rare |

### Priority Score

The score is a composite of four factors:

```
Score = ROI × Urgency × Release_Boost × Muda_Penalty
```

| Score Range | Interpretation |
|---|---|
| **> 5.0** | Extremely high priority — stock immediately |
| **1.0–5.0** | High priority — include in this month's order |
| **0.1–1.0** | Medium priority — order if budget allows |
| **< 0.1** | Low priority — skip this cycle or already well-stocked |

### Stockout Risk Levels

| Level | Color | Criteria |
|---|---|---|
| **Critical** | 🔴 Red | ≤ 7 days of stock left |
| **High** | 🟠 Orange | ≤ 14 days of stock left |
| **Medium** | 🟡 Yellow | ≤ lead time days of stock left |
| **Low** | 🟢 Green | > lead time days of stock left |
| **None** | ⚪ Gray | No demand detected |

---

## 12. Troubleshooting

### Optimizer Returns No Recommendations

**Possible causes:**
- All products have sufficient stock for the planning horizon
- No sales history exists (new catalog)
- Budget is set to $0

**Solutions:**
1. Check that products have sales history (increase lookback period)
2. Verify products have cost and selling prices set
3. Ensure budget is greater than zero
4. Check that products are marked as active

### All Products Show "none" Stockout Risk

**Cause**: No sales data in the lookback period.

**Solutions:**
1. Increase **Lookback** to capture older sales
2. Verify sales are recorded in the system
3. For new products, the optimizer has no demand signal — it won't recommend ordering until sales data exists

### Rare Products Getting Too Much / Too Little Stock

**Adjust the Holding Cost %:**
- **Lower holding cost** → Newsvendor critical ratio increases → more aggressive stocking of rare items
- **Higher holding cost** → critical ratio decreases → more conservative

**Adjust the Release Boost:**
- If a rare product is linked to a hot release, increase the boost to reflect expected demand

### Budget Not Fully Allocated

This happens when the remaining budget is less than one unit cost for any remaining product. It's normal and indicates efficient allocation.

### Products Not Showing Release Event Link

- Verify the product is **linked to a release event** on the calendar (via the event edit modal)
- Check that the release date is within `planning_horizon + lead_time` days from today
- Events more than 10 days in the past are excluded

### Size Groups Showing "unspecified"

Products without **length_cm** and **width_cm** set are grouped into "unspecified". To get proper size grouping:
1. Go to **Products** page
2. Edit each product
3. Fill in the physical dimensions (length, width, height in cm)

### Optimizer Running Slowly

The optimizer queries your entire sales history and product catalog. If slow:
1. Reduce **Lookback** period (e.g., 60 instead of 365)
2. Deactivate products no longer sold
3. The computation is server-side — should complete in under a second for typical catalogs (< 500 products)
