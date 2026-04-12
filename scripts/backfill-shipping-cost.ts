/**
 * One-time script to backfill shipping cost allocation into product costs.
 *
 * For each product, finds its most recent received purchase, calculates
 * shipping_per_unit = purchase.shipping_cost / total_items_in_purchase,
 * and updates product.cost = unit_cost + shipping_per_unit.
 *
 * Usage: npx tsx scripts/backfill-shipping-cost.ts
 *        npx tsx scripts/backfill-shipping-cost.ts --dry-run
 */

import db from '../lib/stockdb';

const dryRun = process.argv.includes('--dry-run');

interface Row {
  product_id: number;
  product_name: string;
  unit_cost: number;
  shipping_cost: number;
  currency: string;
  exchange_rate: number;
  total_qty: number;
  current_cost: number;
}

// For each product, find the most recent received purchase and compute the shipping-inclusive cost.
const rows = db.prepare(`
  SELECT
    pi.product_id,
    pi.product_name,
    pi.unit_cost,
    p.shipping_cost,
    p.currency,
    p.exchange_rate,
    (SELECT SUM(pi2.quantity) FROM purchase_items pi2 WHERE pi2.purchase_id = p.id) AS total_qty,
    pr.cost AS current_cost
  FROM purchase_items pi
  INNER JOIN purchases p ON p.id = pi.purchase_id
  INNER JOIN products pr ON pr.id = pi.product_id
  WHERE p.status = 'received'
    AND p.id = (
      SELECT p2.id FROM purchases p2
      INNER JOIN purchase_items pi3 ON pi3.purchase_id = p2.id
      WHERE p2.status = 'received' AND pi3.product_id = pi.product_id
      ORDER BY p2.purchase_date DESC, p2.id DESC
      LIMIT 1
    )
  GROUP BY pi.product_id
`).all() as Row[];

if (rows.length === 0) {
  console.log('No received purchases found. Nothing to backfill.');
  process.exit(0);
}

console.log(`Found ${rows.length} product(s) with received purchases.\n`);
console.log('Product ID | Product Name                     | Old Cost  | Shipping/Unit | New Cost  | Currency');
console.log('-'.repeat(105));

const updateStmt = db.prepare(`
  UPDATE products SET cost = ?, cost_currency = ?, cost_exchange_rate = ?, updated_at = datetime('now')
  WHERE id = ?
`);

let updated = 0;
let skipped = 0;

const txn = db.transaction(() => {
  for (const row of rows) {
    const shippingPerUnit = row.total_qty > 0 ? row.shipping_cost / row.total_qty : 0;
    const newCost = row.unit_cost + shippingPerUnit;

    const pad = (s: string, n: number) => s.padEnd(n);
    const num = (n: number) => n.toFixed(4).padStart(10);

    console.log(
      `${String(row.product_id).padStart(10)} | ${pad(row.product_name, 32)} | ${num(row.current_cost)} | ${num(shippingPerUnit)} | ${num(newCost)} | ${row.currency}`
    );

    if (Math.abs(newCost - row.current_cost) < 0.0001) {
      skipped++;
      continue;
    }

    if (!dryRun) {
      updateStmt.run(newCost, row.currency, row.exchange_rate, row.product_id);
    }
    updated++;
  }
});

txn();

console.log(`\n${dryRun ? '[DRY RUN] ' : ''}Updated: ${updated}, Skipped (no change): ${skipped}`);
if (dryRun) {
  console.log('Run without --dry-run to apply changes.');
}
