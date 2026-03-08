import Database from 'better-sqlite3';
import path from 'path';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Product {
  id: number;
  name: string;
  sku: string;
  description: string | null;
  price: number;              // selling price (SGD)
  cost: number;               // cost price (in cost_currency)
  cost_currency: string;      // currency of cost price (e.g. 'USD', 'SGD')
  cost_exchange_rate: number; // rate to convert cost → SGD (cost × rate = SGD cost)
  stock_quantity: number;
  category: string | null;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Sale {
  id: number;
  invoice_number: string;
  sale_date: string;       // ISO date string (YYYY-MM-DD HH:MM:SS)
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  shipping_charged: number;
  shipping_actual: number;
  notes: string | null;
  buyer_name: string | null;
  buyer_username: string | null;
  paynow_ref: string | null;
  status: 'completed' | 'refunded' | 'partial_refund' | 'void';
  channel: string;         // e.g. 'direct' | 'carousell' | 'shopee' | 'lazada' | 'telegram'
  created_at: string;
  updated_at: string;
}

export interface SaleItem {
  id: number;
  sale_id: number;
  product_id: number;
  product_name: string;   // snapshot at time of sale
  product_sku: string;
  unit_price: number;
  unit_cost: number;      // cost price snapshot at time of sale (in original currency)
  unit_cost_sgd: number;  // unit cost converted to SGD for PnL calculations
  quantity: number;
  refunded_quantity: number; // how many units have been refunded
  line_total: number;
}

export interface SaleWithItems extends Sale {
  items: SaleItem[];
}

export interface DailySalesSummary {
  date: string;
  total: number;
  order_count: number;
}

export interface ProductSalesSummary {
  product_id: number;
  product_name: string;
  total_quantity: number;
  total_revenue: number;
}

export interface Supplier {
  id: number;
  name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PurchaseItem {
  id: number;
  purchase_id: number;
  product_id: number;
  product_name: string;
  product_sku: string;
  quantity: number;
  unit_cost: number;
  line_total: number;
}

export interface Purchase {
  id: number;
  supplier_id: number;
  supplier_name: string;
  purchase_date: string;
  invoice_ref: string | null;
  subtotal: number;
  discount: number;
  tax: number;
  shipping_cost: number;
  currency: string;
  exchange_rate: number;
  total_cost: number;
  status: 'received' | 'pending' | 'cancelled';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PurchaseWithItems extends Purchase {
  items: PurchaseItem[];
}

export interface StockEvent {
  id: number;
  product_id: number;
  product_name: string;
  product_sku: string;
  event_type: string;       // e.g. 'Damage', 'Exchange', 'Incorrect Size', 'Inventory Count', 'Other'
  quantity: number;          // positive = add stock, negative = remove stock
  notes: string | null;
  event_date: string;
  created_at: string;
}

export interface ComputedStock {
  product_id: number;
  purchased: number;         // total qty from received purchases
  sold: number;              // total effective qty sold (qty - refunded)
  adjustments: number;       // total from stock events
  stock_quantity: number;    // purchased - sold + adjustments
}

export interface PnLSummary {
  revenue: number;
  cogs: number;
  gross_profit: number;
  gross_margin_pct: number;
  shipping_profit: number;
  purchase_spend: number;
  order_count: number;
  purchase_count: number;
}

export interface DailyPnL {
  date: string;
  revenue: number;
  cogs: number;
  gross_profit: number;
}

export interface ProductPnL {
  product_id: number;
  product_name: string;
  total_quantity: number;
  revenue: number;
  cogs: number;
  gross_profit: number;
  gross_margin_pct: number;
}

// ─── DB Instance ─────────────────────────────────────────────────────────────

const dbPath = path.join(process.cwd(), 'stock.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── Schema ──────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT    NOT NULL,
    sku             TEXT    UNIQUE NOT NULL,
    description     TEXT,
    price           REAL    NOT NULL DEFAULT 0,
    cost            REAL    NOT NULL DEFAULT 0,
    stock_quantity  INTEGER NOT NULL DEFAULT 0,
    category        TEXT,
    image_url       TEXT,
    is_active       INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT    DEFAULT (datetime('now')),
    updated_at      TEXT    DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sales (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_number  TEXT    UNIQUE NOT NULL,
    sale_date       TEXT    NOT NULL DEFAULT (datetime('now')),
    subtotal        REAL    NOT NULL DEFAULT 0,
    discount        REAL    NOT NULL DEFAULT 0,
    tax             REAL    NOT NULL DEFAULT 0,
    total           REAL    NOT NULL DEFAULT 0,
    notes           TEXT,
    status          TEXT    NOT NULL DEFAULT 'completed',
    created_at      TEXT    DEFAULT (datetime('now')),
    updated_at      TEXT    DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sale_items (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id         INTEGER NOT NULL,
    product_id      INTEGER NOT NULL,
    product_name    TEXT    NOT NULL,
    product_sku     TEXT    NOT NULL,
    unit_price      REAL    NOT NULL,
    quantity        INTEGER NOT NULL DEFAULT 1,
    line_total      REAL    NOT NULL,
    FOREIGN KEY (sale_id)    REFERENCES sales(id)    ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
  );

  CREATE INDEX IF NOT EXISTS idx_sales_date       ON sales(sale_date);
  CREATE INDEX IF NOT EXISTS idx_sale_items_sale  ON sale_items(sale_id);
  CREATE INDEX IF NOT EXISTS idx_sale_items_prod  ON sale_items(product_id);
  CREATE INDEX IF NOT EXISTS idx_products_active  ON products(is_active);

  CREATE TABLE IF NOT EXISTS suppliers (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT    NOT NULL,
    contact_person  TEXT,
    email           TEXT,
    phone           TEXT,
    address         TEXT,
    notes           TEXT,
    is_active       INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT    DEFAULT (datetime('now')),
    updated_at      TEXT    DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS purchases (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id     INTEGER NOT NULL,
    purchase_date   TEXT    NOT NULL DEFAULT (datetime('now')),
    invoice_ref     TEXT,
    subtotal        REAL    NOT NULL DEFAULT 0,
    discount        REAL    NOT NULL DEFAULT 0,
    tax             REAL    NOT NULL DEFAULT 0,
    total_cost      REAL    NOT NULL DEFAULT 0,
    status          TEXT    NOT NULL DEFAULT 'received',
    notes           TEXT,
    created_at      TEXT    DEFAULT (datetime('now')),
    updated_at      TEXT    DEFAULT (datetime('now')),
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
  );

  CREATE TABLE IF NOT EXISTS purchase_items (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_id     INTEGER NOT NULL,
    product_id      INTEGER NOT NULL,
    product_name    TEXT    NOT NULL,
    product_sku     TEXT    NOT NULL,
    quantity        INTEGER NOT NULL DEFAULT 1,
    unit_cost       REAL    NOT NULL,
    line_total      REAL    NOT NULL,
    FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id)  REFERENCES products(id)  ON DELETE RESTRICT
  );

  CREATE INDEX IF NOT EXISTS idx_purchases_date      ON purchases(purchase_date);
  CREATE INDEX IF NOT EXISTS idx_purchases_supplier  ON purchases(supplier_id);
  CREATE INDEX IF NOT EXISTS idx_purchase_items_pur  ON purchase_items(purchase_id);
  CREATE INDEX IF NOT EXISTS idx_purchase_items_prod ON purchase_items(product_id);

  CREATE TABLE IF NOT EXISTS stock_events (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id      INTEGER NOT NULL,
    product_name    TEXT    NOT NULL,
    product_sku     TEXT    NOT NULL,
    event_type      TEXT    NOT NULL,
    quantity        INTEGER NOT NULL,
    notes           TEXT,
    event_date      TEXT    NOT NULL DEFAULT (datetime('now')),
    created_at      TEXT    DEFAULT (datetime('now')),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
  );

  CREATE INDEX IF NOT EXISTS idx_stock_events_prod ON stock_events(product_id);
  CREATE INDEX IF NOT EXISTS idx_stock_events_date ON stock_events(event_date);
`);

// ─── Migrations ──────────────────────────────────────────────────────────────
try { db.exec('ALTER TABLE sale_items ADD COLUMN unit_cost REAL NOT NULL DEFAULT 0'); } catch { /* already exists */ }
try { db.exec("ALTER TABLE sales ADD COLUMN channel TEXT NOT NULL DEFAULT 'direct'"); } catch { /* already exists */ }
try { db.exec('ALTER TABLE sale_items ADD COLUMN refunded_quantity INTEGER NOT NULL DEFAULT 0'); } catch { /* already exists */ }
try { db.exec('ALTER TABLE sales ADD COLUMN buyer_name TEXT'); } catch { /* already exists */ }
try { db.exec('ALTER TABLE sales ADD COLUMN buyer_username TEXT'); } catch { /* already exists */ }
try { db.exec('ALTER TABLE sales ADD COLUMN paynow_ref TEXT'); } catch { /* already exists */ }
try { db.exec('ALTER TABLE sales ADD COLUMN shipping_charged REAL NOT NULL DEFAULT 0'); } catch { /* already exists */ }
try { db.exec('ALTER TABLE sales ADD COLUMN shipping_actual REAL NOT NULL DEFAULT 0'); } catch { /* already exists */ }
try { db.exec('ALTER TABLE purchases ADD COLUMN shipping_cost REAL NOT NULL DEFAULT 0'); } catch { /* already exists */ }
try { db.exec("ALTER TABLE purchases ADD COLUMN currency TEXT NOT NULL DEFAULT 'SGD'"); } catch { /* already exists */ }
try { db.exec('ALTER TABLE purchases ADD COLUMN exchange_rate REAL NOT NULL DEFAULT 1'); } catch { /* already exists */ }
try { db.exec("ALTER TABLE products ADD COLUMN cost_currency TEXT NOT NULL DEFAULT 'SGD'"); } catch { /* already exists */ }
try { db.exec('ALTER TABLE products ADD COLUMN cost_exchange_rate REAL NOT NULL DEFAULT 1'); } catch { /* already exists */ }
try { db.exec('ALTER TABLE sale_items ADD COLUMN unit_cost_sgd REAL NOT NULL DEFAULT 0'); } catch { /* already exists */ }

// ─── Product DB ──────────────────────────────────────────────────────────────

export const productDB = {
  create(data: Omit<Product, 'id' | 'created_at' | 'updated_at'>): Product {
    const stmt = db.prepare(`
      INSERT INTO products (name, sku, description, price, cost, cost_currency, cost_exchange_rate, stock_quantity, category, image_url, is_active)
      VALUES (@name, @sku, @description, @price, @cost, @cost_currency, @cost_exchange_rate, 0, @category, @image_url, @is_active)
    `);
    const result = stmt.run({
      ...data,
      cost_currency: data.cost_currency ?? 'SGD',
      cost_exchange_rate: data.cost_exchange_rate ?? 1,
      is_active: data.is_active ? 1 : 0,
    });
    return productDB.getById(Number(result.lastInsertRowid))!;
  },

  getById(id: number): Product | undefined {
    const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as any;
    if (!row) return undefined;
    const computed = productDB.getComputedStockForProduct(id);
    return { ...row, is_active: Boolean(row.is_active), stock_quantity: computed };
  },

  list(includeInactive = false): Product[] {
    const rows = db.prepare(
      includeInactive
        ? 'SELECT * FROM products ORDER BY name ASC'
        : 'SELECT * FROM products WHERE is_active = 1 ORDER BY name ASC'
    ).all() as any[];
    const stockMap = productDB.getComputedStockAll();
    return rows.map(r => ({
      ...r,
      is_active: Boolean(r.is_active),
      stock_quantity: stockMap.get(r.id) ?? 0,
    }));
  },

  update(id: number, data: Partial<Omit<Product, 'id' | 'created_at' | 'updated_at'>>): Product | undefined {
    // stock_quantity is computed — ignore it if passed
    const allowed = ['name', 'sku', 'description', 'price', 'cost', 'cost_currency', 'cost_exchange_rate', 'category', 'image_url', 'is_active'];
    const entries = Object.entries(data).filter(([k]) => allowed.includes(k));
    if (entries.length === 0) return productDB.getById(id);
    const sets = entries.map(([k]) => `${k} = @${k}`).join(', ');
    const params: any = Object.fromEntries(entries.map(([k, v]) => [k, typeof v === 'boolean' ? (v ? 1 : 0) : v]));
    params.id = id;
    db.prepare(`UPDATE products SET ${sets}, updated_at = datetime('now') WHERE id = @id`).run(params);
    return productDB.getById(id);
  },

  delete(id: number): void {
    db.prepare('UPDATE products SET is_active = 0, updated_at = datetime(\'now\') WHERE id = ?').run(id);
  },

  /** Compute stock for a single product: purchased − sold + adjustments */
  getComputedStockForProduct(id: number): number {
    const purchased = (db.prepare(`
      SELECT COALESCE(SUM(pi.quantity), 0) AS total
      FROM purchase_items pi
      INNER JOIN purchases p ON p.id = pi.purchase_id
      WHERE pi.product_id = ? AND p.status = 'received'
    `).get(id) as any).total;

    const sold = (db.prepare(`
      SELECT COALESCE(SUM(si.quantity - si.refunded_quantity), 0) AS total
      FROM sale_items si
      INNER JOIN sales s ON s.id = si.sale_id
      WHERE si.product_id = ? AND s.status IN ('completed', 'partial_refund')
    `).get(id) as any).total;

    const adjustments = (db.prepare(`
      SELECT COALESCE(SUM(quantity), 0) AS total
      FROM stock_events WHERE product_id = ?
    `).get(id) as any).total;

    return purchased - sold + adjustments;
  },

  /** Compute stock for ALL products in one go (efficient for list views) */
  getComputedStockAll(): Map<number, number> {
    const purchasedRows = db.prepare(`
      SELECT pi.product_id, COALESCE(SUM(pi.quantity), 0) AS total
      FROM purchase_items pi
      INNER JOIN purchases p ON p.id = pi.purchase_id
      WHERE p.status = 'received'
      GROUP BY pi.product_id
    `).all() as Array<{ product_id: number; total: number }>;

    const soldRows = db.prepare(`
      SELECT si.product_id, COALESCE(SUM(si.quantity - si.refunded_quantity), 0) AS total
      FROM sale_items si
      INNER JOIN sales s ON s.id = si.sale_id
      WHERE s.status IN ('completed', 'partial_refund')
      GROUP BY si.product_id
    `).all() as Array<{ product_id: number; total: number }>;

    const adjustRows = db.prepare(`
      SELECT product_id, COALESCE(SUM(quantity), 0) AS total
      FROM stock_events
      GROUP BY product_id
    `).all() as Array<{ product_id: number; total: number }>;

    const map = new Map<number, number>();
    for (const r of purchasedRows) map.set(r.product_id, (map.get(r.product_id) ?? 0) + r.total);
    for (const r of soldRows) map.set(r.product_id, (map.get(r.product_id) ?? 0) - r.total);
    for (const r of adjustRows) map.set(r.product_id, (map.get(r.product_id) ?? 0) + r.total);
    return map;
  },

  /** Get detailed computed stock breakdown for all products */
  getComputedStockDetails(): ComputedStock[] {
    const products = db.prepare('SELECT id FROM products').all() as Array<{ id: number }>;
    const stockMap = productDB.getComputedStockAll();

    const purchasedMap = new Map<number, number>();
    const soldMap = new Map<number, number>();
    const adjustMap = new Map<number, number>();

    (db.prepare(`
      SELECT pi.product_id, COALESCE(SUM(pi.quantity), 0) AS total
      FROM purchase_items pi
      INNER JOIN purchases p ON p.id = pi.purchase_id
      WHERE p.status = 'received'
      GROUP BY pi.product_id
    `).all() as Array<{ product_id: number; total: number }>).forEach(r => purchasedMap.set(r.product_id, r.total));

    (db.prepare(`
      SELECT si.product_id, COALESCE(SUM(si.quantity - si.refunded_quantity), 0) AS total
      FROM sale_items si
      INNER JOIN sales s ON s.id = si.sale_id
      WHERE s.status IN ('completed', 'partial_refund')
      GROUP BY si.product_id
    `).all() as Array<{ product_id: number; total: number }>).forEach(r => soldMap.set(r.product_id, r.total));

    (db.prepare(`
      SELECT product_id, COALESCE(SUM(quantity), 0) AS total
      FROM stock_events
      GROUP BY product_id
    `).all() as Array<{ product_id: number; total: number }>).forEach(r => adjustMap.set(r.product_id, r.total));

    return products.map(p => ({
      product_id: p.id,
      purchased: purchasedMap.get(p.id) ?? 0,
      sold: soldMap.get(p.id) ?? 0,
      adjustments: adjustMap.get(p.id) ?? 0,
      stock_quantity: stockMap.get(p.id) ?? 0,
    }));
  },
};

// ─── Sale DB ─────────────────────────────────────────────────────────────────

function generateInvoiceNumber(): string {
  const now = new Date();
  const yyyymmdd = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `INV-${yyyymmdd}-${rand}`;
}

export const saleDB = {
  create(
    items: Array<{ product_id: number; quantity: number; unit_price: number }>,
    opts: { discount?: number; tax?: number; notes?: string; sale_date?: string; channel?: string; buyer_name?: string; buyer_username?: string; paynow_ref?: string; shipping_charged?: number; shipping_actual?: number } = {}
  ): SaleWithItems {
    const subtotal = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
    const discount = opts.discount ?? 0;
    const tax = opts.tax ?? 0;
    const shipping_charged = opts.shipping_charged ?? 0;
    const total = subtotal - discount + tax + shipping_charged;

    const insertSale = db.transaction(() => {
      const saleStmt = db.prepare(`
        INSERT INTO sales (invoice_number, sale_date, subtotal, discount, tax, total, notes, channel, status, buyer_name, buyer_username, paynow_ref, shipping_charged, shipping_actual)
        VALUES (@invoice_number, @sale_date, @subtotal, @discount, @tax, @total, @notes, @channel, 'completed', @buyer_name, @buyer_username, @paynow_ref, @shipping_charged, @shipping_actual)
      `);
      const saleResult = saleStmt.run({
        invoice_number: generateInvoiceNumber(),
        sale_date: opts.sale_date ?? new Date().toISOString().replace('T', ' ').slice(0, 19),
        subtotal,
        discount,
        tax,
        total,
        notes: opts.notes ?? null,
        channel: opts.channel ?? 'direct',
        buyer_name: opts.buyer_name ?? null,
        buyer_username: opts.buyer_username ?? null,
        paynow_ref: opts.paynow_ref ?? null,
        shipping_charged,
        shipping_actual: opts.shipping_actual ?? 0,
      });
      const saleId = Number(saleResult.lastInsertRowid);

      const itemStmt = db.prepare(`
        INSERT INTO sale_items (sale_id, product_id, product_name, product_sku, unit_price, unit_cost, unit_cost_sgd, quantity, line_total)
        VALUES (@sale_id, @product_id, @product_name, @product_sku, @unit_price, @unit_cost, @unit_cost_sgd, @quantity, @line_total)
      `);

      for (const item of items) {
        const product = productDB.getById(item.product_id);
        if (!product) throw new Error(`Product ${item.product_id} not found`);
        itemStmt.run({
          sale_id: saleId,
          product_id: item.product_id,
          product_name: product.name,
          product_sku: product.sku,
          unit_price: item.unit_price,
          unit_cost: product.cost,
          unit_cost_sgd: product.cost * (product.cost_exchange_rate ?? 1),
          quantity: item.quantity,
          line_total: item.unit_price * item.quantity,
        });
      }

      return saleDB.getById(saleId)!;
    });

    return insertSale();
  },

  getById(id: number): SaleWithItems | undefined {
    const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(id) as Sale | undefined;
    if (!sale) return undefined;
    const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(id) as SaleItem[];
    return { ...sale, items };
  },

  list(opts: { startDate?: string; endDate?: string; status?: string } = {}): SaleWithItems[] {
    let query = 'SELECT * FROM sales WHERE 1=1';
    const params: any[] = [];
    if (opts.startDate) { query += ' AND sale_date >= ?'; params.push(opts.startDate); }
    if (opts.endDate)   { query += ' AND sale_date <= ?'; params.push(opts.endDate + ' 23:59:59'); }
    if (opts.status)    { query += ' AND status = ?'; params.push(opts.status); }
    query += ' ORDER BY sale_date DESC';
    const sales = db.prepare(query).all(...params) as Sale[];
    return sales.map(s => {
      const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(s.id) as SaleItem[];
      return { ...s, items };
    });
  },

  update(id: number, data: { notes?: string; discount?: number; tax?: number; sale_date?: string; status?: string; channel?: string; buyer_name?: string; buyer_username?: string; paynow_ref?: string; shipping_charged?: number; shipping_actual?: number }): SaleWithItems | undefined {
    const allowed = ['notes', 'discount', 'tax', 'sale_date', 'status', 'channel', 'buyer_name', 'buyer_username', 'paynow_ref', 'shipping_charged', 'shipping_actual'];
    const entries = Object.entries(data).filter(([k, v]) => allowed.includes(k) && v !== undefined);
    if (entries.length === 0) return saleDB.getById(id);
    const sets = entries.map(([k]) => `${k} = @${k}`).join(', ');
    const params: any = Object.fromEntries(entries);
    params.id = id;
    // Recalculate total if financials changed
    const existing = saleDB.getById(id);
    if (!existing) return undefined;
    const discount = data.discount ?? existing.discount;
    const tax = data.tax ?? existing.tax;
    const shippingCharged = data.shipping_charged ?? existing.shipping_charged;
    params.total = existing.subtotal - discount + tax + shippingCharged;
    db.prepare(`UPDATE sales SET ${sets}, total = @total, updated_at = datetime('now') WHERE id = @id`).run(params);
    return saleDB.getById(id);
  },

  updateStatus(id: number, status: 'completed' | 'refunded' | 'partial_refund' | 'void'): void {
    const sale = saleDB.getById(id);
    if (!sale) return;
    // If fully voiding/refunding a completed sale, mark items as refunded
    if ((status === 'refunded' || status === 'void') && (sale.status === 'completed' || sale.status === 'partial_refund')) {
      db.prepare('UPDATE sale_items SET refunded_quantity = quantity WHERE sale_id = ?').run(id);
    }
    db.prepare("UPDATE sales SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, id);
  },

  /** Partial-refund specific items. Returns updated sale. */
  refundItems(saleId: number, refunds: Array<{ sale_item_id: number; refund_qty: number }>): SaleWithItems | undefined {
    const sale = saleDB.getById(saleId);
    if (!sale) return undefined;
    if (sale.status === 'refunded' || sale.status === 'void') return sale;

    const doRefund = db.transaction(() => {
      for (const r of refunds) {
        const item = sale.items.find(i => i.id === r.sale_item_id);
        if (!item) continue;
        const maxRefundable = item.quantity - (item.refunded_quantity ?? 0);
        const qty = Math.min(r.refund_qty, maxRefundable);
        if (qty <= 0) continue;

        db.prepare('UPDATE sale_items SET refunded_quantity = refunded_quantity + ? WHERE id = ?').run(qty, r.sale_item_id);
      }

      // Determine new sale status
      const updatedItems = db.prepare('SELECT quantity, refunded_quantity FROM sale_items WHERE sale_id = ?').all(saleId) as Array<{ quantity: number; refunded_quantity: number }>;
      const allFullyRefunded = updatedItems.every(i => i.refunded_quantity >= i.quantity);
      const anyRefunded = updatedItems.some(i => i.refunded_quantity > 0);

      let newStatus: string;
      if (allFullyRefunded) {
        newStatus = 'refunded';
      } else if (anyRefunded) {
        newStatus = 'partial_refund';
      } else {
        newStatus = sale.status;
      }

      // Recalculate sale totals to reflect refunded amounts
      const recalcItems = db.prepare('SELECT quantity, refunded_quantity, unit_price FROM sale_items WHERE sale_id = ?').all(saleId) as Array<{ quantity: number; refunded_quantity: number; unit_price: number }>;
      const newSubtotal = recalcItems.reduce((sum, i) => {
        const effectiveQty = i.quantity - (i.refunded_quantity ?? 0);
        return sum + i.unit_price * effectiveQty;
      }, 0);
      const newTotal = newSubtotal - sale.discount + sale.tax;

      db.prepare("UPDATE sales SET status = ?, subtotal = ?, total = ?, updated_at = datetime('now') WHERE id = ?").run(newStatus, newSubtotal, newTotal, saleId);
    });

    doRefund();
    return saleDB.getById(saleId);
  },

  delete(id: number): void {
    db.prepare('DELETE FROM sales WHERE id = ?').run(id);
  },

  getDailySummary(startDate: string, endDate: string): DailySalesSummary[] {
    return db.prepare(`
      SELECT
        date(sale_date) AS date,
        SUM(total)      AS total,
        COUNT(*)        AS order_count
      FROM sales
      WHERE status = 'completed'
        AND sale_date >= ?
        AND sale_date <= ?
      GROUP BY date(sale_date)
      ORDER BY date ASC
    `).all(startDate, endDate + ' 23:59:59') as DailySalesSummary[];
  },

  getProductSummary(startDate: string, endDate: string): ProductSalesSummary[] {
    return db.prepare(`
      SELECT
        si.product_id,
        si.product_name,
        SUM(si.quantity)   AS total_quantity,
        SUM(si.line_total) AS total_revenue
      FROM sale_items si
      INNER JOIN sales s ON s.id = si.sale_id
      WHERE s.status = 'completed'
        AND s.sale_date >= ?
        AND s.sale_date <= ?
      GROUP BY si.product_id, si.product_name
      ORDER BY total_revenue DESC
    `).all(startDate, endDate + ' 23:59:59') as ProductSalesSummary[];
  },
};

// ─── Supplier DB ─────────────────────────────────────────────────────────────

export const supplierDB = {
  create(data: Omit<Supplier, 'id' | 'created_at' | 'updated_at'>): Supplier {
    const result = db.prepare(`
      INSERT INTO suppliers (name, contact_person, email, phone, address, notes, is_active)
      VALUES (@name, @contact_person, @email, @phone, @address, @notes, @is_active)
    `).run({ ...data, is_active: data.is_active ? 1 : 0 });
    return supplierDB.getById(Number(result.lastInsertRowid))!;
  },

  getById(id: number): Supplier | undefined {
    const row = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id) as any;
    return row ? { ...row, is_active: Boolean(row.is_active) } : undefined;
  },

  list(includeInactive = false): Supplier[] {
    const rows = db.prepare(
      includeInactive
        ? 'SELECT * FROM suppliers ORDER BY name ASC'
        : 'SELECT * FROM suppliers WHERE is_active = 1 ORDER BY name ASC'
    ).all() as any[];
    return rows.map(r => ({ ...r, is_active: Boolean(r.is_active) }));
  },

  update(id: number, data: Partial<Omit<Supplier, 'id' | 'created_at' | 'updated_at'>>): Supplier | undefined {
    const allowed = ['name', 'contact_person', 'email', 'phone', 'address', 'notes', 'is_active'];
    const entries = Object.entries(data).filter(([k]) => allowed.includes(k));
    if (entries.length === 0) return supplierDB.getById(id);
    const sets = entries.map(([k]) => `${k} = @${k}`).join(', ');
    const params: any = Object.fromEntries(entries.map(([k, v]) => [k, typeof v === 'boolean' ? (v ? 1 : 0) : v]));
    params.id = id;
    db.prepare(`UPDATE suppliers SET ${sets}, updated_at = datetime('now') WHERE id = @id`).run(params);
    return supplierDB.getById(id);
  },

  delete(id: number): void {
    db.prepare("UPDATE suppliers SET is_active = 0, updated_at = datetime('now') WHERE id = ?").run(id);
  },
};

// ─── Purchase DB ─────────────────────────────────────────────────────────────

function generatePurchaseRef(): string {
  const now = new Date();
  const yyyymmdd = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `PO-${yyyymmdd}-${rand}`;
}

export const purchaseDB = {
  create(
    supplier_id: number,
    items: Array<{ product_id: number; quantity: number; unit_cost: number }>,
    opts: { discount?: number; tax?: number; shipping_cost?: number; currency?: string; exchange_rate?: number; notes?: string; purchase_date?: string; invoice_ref?: string; status?: string } = {}
  ): PurchaseWithItems {
    const subtotal = items.reduce((s, i) => s + i.unit_cost * i.quantity, 0);
    const discount = opts.discount ?? 0;
    const tax = opts.tax ?? 0;
    const shipping_cost = opts.shipping_cost ?? 0;
    const currency = opts.currency ?? 'SGD';
    const exchange_rate = opts.exchange_rate ?? 1;
    const total_cost = (subtotal - discount + tax + shipping_cost) * exchange_rate;
    const status = opts.status ?? 'received';

    const run = db.transaction(() => {
      const purchaseResult = db.prepare(`
        INSERT INTO purchases (supplier_id, purchase_date, invoice_ref, subtotal, discount, tax, shipping_cost, currency, exchange_rate, total_cost, notes, status)
        VALUES (@supplier_id, @purchase_date, @invoice_ref, @subtotal, @discount, @tax, @shipping_cost, @currency, @exchange_rate, @total_cost, @notes, @status)
      `).run({
        supplier_id,
        purchase_date: opts.purchase_date ?? new Date().toISOString().replace('T', ' ').slice(0, 19),
        invoice_ref: opts.invoice_ref?.trim() || generatePurchaseRef(),
        subtotal, discount, tax, shipping_cost, currency, exchange_rate, total_cost,
        notes: opts.notes ?? null,
        status,
      });
      const purchaseId = Number(purchaseResult.lastInsertRowid);

      const itemStmt = db.prepare(`
        INSERT INTO purchase_items (purchase_id, product_id, product_name, product_sku, quantity, unit_cost, line_total)
        VALUES (@purchase_id, @product_id, @product_name, @product_sku, @quantity, @unit_cost, @line_total)
      `);

      for (const item of items) {
        const product = productDB.getById(item.product_id);
        if (!product) throw new Error(`Product ${item.product_id} not found`);
        itemStmt.run({
          purchase_id: purchaseId,
          product_id: item.product_id,
          product_name: product.name,
          product_sku: product.sku,
          quantity: item.quantity,
          unit_cost: item.unit_cost,
          line_total: item.unit_cost * item.quantity,
        });
        // Update product cost to latest purchase cost on receive
        if (status === 'received') {
          productDB.update(item.product_id, { cost: item.unit_cost, cost_currency: currency, cost_exchange_rate: exchange_rate });
        }
      }
      return purchaseDB.getById(purchaseId)!;
    });
    return run();
  },

  update(
    id: number,
    data: {
      items?: Array<{ product_id: number; quantity: number; unit_cost: number }>;
      discount?: number; tax?: number; shipping_cost?: number;
      currency?: string; exchange_rate?: number;
      notes?: string; status?: string;
    }
  ): PurchaseWithItems | undefined {
    const purchase = purchaseDB.getById(id);
    if (!purchase) return undefined;

    const run = db.transaction(() => {
      // If items are provided, recalculate everything
      if (data.items) {

        // Delete old items and insert new
        db.prepare('DELETE FROM purchase_items WHERE purchase_id = ?').run(id);
        const itemStmt = db.prepare(`
          INSERT INTO purchase_items (purchase_id, product_id, product_name, product_sku, quantity, unit_cost, line_total)
          VALUES (@purchase_id, @product_id, @product_name, @product_sku, @quantity, @unit_cost, @line_total)
        `);
        for (const item of data.items) {
          const product = productDB.getById(item.product_id);
          if (!product) throw new Error(`Product ${item.product_id} not found`);
          itemStmt.run({
            purchase_id: id,
            product_id: item.product_id,
            product_name: product.name,
            product_sku: product.sku,
            quantity: item.quantity,
            unit_cost: item.unit_cost,
            line_total: item.unit_cost * item.quantity,
          });
        }
        // Update product cost if status is (or will be) received
        const newStatus = (data.status ?? purchase.status) as string;
        const updCurrency = data.currency ?? purchase.currency;
        const updRate = data.exchange_rate ?? purchase.exchange_rate;
        if (newStatus === 'received') {
          for (const item of data.items) {
            productDB.update(item.product_id, { cost: item.unit_cost, cost_currency: updCurrency, cost_exchange_rate: updRate });
          }
        }
      }

      // Recalculate totals
      const itemsForCalc = data.items ?? purchase.items.map(i => ({ product_id: i.product_id, quantity: i.quantity, unit_cost: i.unit_cost }));
      const subtotal = itemsForCalc.reduce((s, i) => s + i.unit_cost * i.quantity, 0);
      const discount = data.discount ?? purchase.discount;
      const tax = data.tax ?? purchase.tax;
      const shipping_cost = data.shipping_cost ?? purchase.shipping_cost;
      const currency = data.currency ?? purchase.currency;
      const exchange_rate = data.exchange_rate ?? purchase.exchange_rate;
      const total_cost = (subtotal - discount + tax + shipping_cost) * exchange_rate;
      const newStatus = data.status ?? purchase.status;

      // Update product cost when status changes to received
      if (!data.items && newStatus === 'received' && purchase.status === 'pending') {
        for (const item of purchase.items) {
          productDB.update(item.product_id, { cost: item.unit_cost, cost_currency: currency, cost_exchange_rate: exchange_rate });
        }
      }

      db.prepare(`
        UPDATE purchases SET subtotal=@subtotal, discount=@discount, tax=@tax, shipping_cost=@shipping_cost,
          currency=@currency, exchange_rate=@exchange_rate, total_cost=@total_cost,
          notes=@notes, status=@status, updated_at=datetime('now')
        WHERE id=@id
      `).run({
        id, subtotal, discount, tax, shipping_cost, currency, exchange_rate, total_cost,
        notes: data.notes ?? purchase.notes,
        status: newStatus,
      });

      return purchaseDB.getById(id)!;
    });
    return run();
  },

  getById(id: number): PurchaseWithItems | undefined {
    const row = db.prepare(`
      SELECT p.*, s.name AS supplier_name
      FROM purchases p LEFT JOIN suppliers s ON s.id = p.supplier_id
      WHERE p.id = ?
    `).get(id) as any;
    if (!row) return undefined;
    const items = db.prepare('SELECT * FROM purchase_items WHERE purchase_id = ?').all(id) as PurchaseItem[];
    return { ...row, items };
  },

  list(opts: { startDate?: string; endDate?: string; supplier_id?: number; status?: string } = {}): PurchaseWithItems[] {
    let query = `
      SELECT p.*, s.name AS supplier_name
      FROM purchases p LEFT JOIN suppliers s ON s.id = p.supplier_id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (opts.startDate)   { query += ' AND p.purchase_date >= ?'; params.push(opts.startDate); }
    if (opts.endDate)     { query += ' AND p.purchase_date <= ?'; params.push(opts.endDate + ' 23:59:59'); }
    if (opts.supplier_id) { query += ' AND p.supplier_id = ?'; params.push(opts.supplier_id); }
    if (opts.status && opts.status !== 'all') { query += ' AND p.status = ?'; params.push(opts.status); }
    query += ' ORDER BY p.purchase_date DESC, p.id DESC';
    const rows = db.prepare(query).all(...params) as any[];
    return rows.map(p => {
      const items = db.prepare('SELECT * FROM purchase_items WHERE purchase_id = ?').all(p.id) as PurchaseItem[];
      return { ...p, items };
    });
  },

  updateStatus(id: number, status: 'received' | 'pending' | 'cancelled'): void {
    const purchase = purchaseDB.getById(id);
    if (!purchase) return;
    // Update product cost when marking as received
    if (status === 'received' && purchase.status === 'pending') {
      for (const item of purchase.items) {
        productDB.update(item.product_id, { cost: item.unit_cost, cost_currency: purchase.currency, cost_exchange_rate: purchase.exchange_rate });
      }
    }
    db.prepare("UPDATE purchases SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, id);
  },

  delete(id: number): void {
    db.prepare('DELETE FROM purchases WHERE id = ?').run(id);
  },

  getSupplierSummary(startDate: string, endDate: string) {
    return db.prepare(`
      SELECT s.id, s.name AS supplier_name,
        COUNT(p.id) AS purchase_count,
        COALESCE(SUM(p.total_cost), 0) AS total_spend
      FROM suppliers s
      LEFT JOIN purchases p
        ON p.supplier_id = s.id AND p.status = 'received'
        AND p.purchase_date >= ? AND p.purchase_date <= ?
      WHERE s.is_active = 1
      GROUP BY s.id, s.name
      ORDER BY total_spend DESC
    `).all(startDate, endDate + ' 23:59:59') as Array<{ id: number; supplier_name: string; purchase_count: number; total_spend: number }>;
  },
};

// ─── PnL DB ──────────────────────────────────────────────────────────────────

export const pnlDB = {
  getSummary(startDate: string, endDate: string): PnLSummary {
    const end = endDate + ' 23:59:59';
    const revenueRow = db.prepare(`
      SELECT COALESCE(SUM(total), 0) AS revenue, COUNT(*) AS order_count
      FROM sales WHERE status = 'completed' AND sale_date >= ? AND sale_date <= ?
    `).get(startDate, end) as any;
    const cogsRow = db.prepare(`
      SELECT COALESCE(SUM(
        COALESCE(p.cost * p.cost_exchange_rate, 0) * si.quantity
      ), 0) AS cogs
      FROM sale_items si
      INNER JOIN sales s ON s.id = si.sale_id
      LEFT JOIN products p ON p.id = si.product_id
      WHERE s.status = 'completed' AND s.sale_date >= ? AND s.sale_date <= ?
    `).get(startDate, end) as any;
    const purchaseRow = db.prepare(`
      SELECT COALESCE(SUM(total_cost), 0) AS purchase_spend, COUNT(*) AS purchase_count
      FROM purchases WHERE status = 'received' AND purchase_date >= ? AND purchase_date <= ?
    `).get(startDate, end) as any;

    const shippingRow = db.prepare(`
      SELECT COALESCE(SUM(shipping_charged - shipping_actual), 0) AS shipping_profit
      FROM sales WHERE status = 'completed' AND sale_date >= ? AND sale_date <= ?
    `).get(startDate, end) as any;

    const revenue = revenueRow.revenue;
    const cogs = cogsRow.cogs;
    const shipping_profit = shippingRow.shipping_profit;
    const gross_profit = revenue - cogs + shipping_profit;
    return {
      revenue, cogs, gross_profit,
      gross_margin_pct: revenue > 0 ? (gross_profit / revenue) * 100 : 0,
      shipping_profit,
      purchase_spend: purchaseRow.purchase_spend,
      order_count: revenueRow.order_count,
      purchase_count: purchaseRow.purchase_count,
    };
  },

  getDailyPnL(startDate: string, endDate: string): DailyPnL[] {
    return db.prepare(`
      SELECT
        date(s.sale_date) AS date,
        COALESCE(SUM(s.total), 0) AS revenue,
        COALESCE(SUM(agg.item_cogs), 0) AS cogs,
        COALESCE(SUM(s.total), 0) - COALESCE(SUM(agg.item_cogs), 0) AS gross_profit
      FROM sales s
      LEFT JOIN (
        SELECT si2.sale_id, SUM(
          COALESCE(p2.cost * p2.cost_exchange_rate, 0) * si2.quantity
        ) AS item_cogs
        FROM sale_items si2
        LEFT JOIN products p2 ON p2.id = si2.product_id
        GROUP BY si2.sale_id
      ) agg ON agg.sale_id = s.id
      WHERE s.status = 'completed' AND s.sale_date >= ? AND s.sale_date <= ?
      GROUP BY date(s.sale_date)
      ORDER BY date ASC
    `).all(startDate, endDate + ' 23:59:59') as DailyPnL[];
  },

  getProductPnL(startDate: string, endDate: string): ProductPnL[] {
    const rows = db.prepare(`
      SELECT
        si.product_id,
        si.product_name,
        SUM(si.quantity)                              AS total_quantity,
        SUM(si.line_total)                            AS revenue,
        SUM(COALESCE(p.cost * p.cost_exchange_rate, 0) * si.quantity) AS cogs,
        SUM(si.line_total) - SUM(COALESCE(p.cost * p.cost_exchange_rate, 0) * si.quantity) AS gross_profit
      FROM sale_items si
      INNER JOIN sales s ON s.id = si.sale_id
      LEFT JOIN products p ON p.id = si.product_id
      WHERE s.status = 'completed' AND s.sale_date >= ? AND s.sale_date <= ?
      GROUP BY si.product_id, si.product_name
      ORDER BY gross_profit DESC
    `).all(startDate, endDate + ' 23:59:59') as any[];
    return rows.map(r => ({
      ...r,
      gross_margin_pct: r.revenue > 0 ? (r.gross_profit / r.revenue) * 100 : 0,
    }));
  },
};

// ─── Stock Events DB ─────────────────────────────────────────────────────────

export const stockEventDB = {
  create(data: { product_id: number; event_type: string; quantity: number; notes?: string; event_date?: string }): StockEvent {
    const product = productDB.getById(data.product_id);
    if (!product) throw new Error(`Product ${data.product_id} not found`);
    const result = db.prepare(`
      INSERT INTO stock_events (product_id, product_name, product_sku, event_type, quantity, notes, event_date)
      VALUES (@product_id, @product_name, @product_sku, @event_type, @quantity, @notes, @event_date)
    `).run({
      product_id: data.product_id,
      product_name: product.name,
      product_sku: product.sku,
      event_type: data.event_type,
      quantity: data.quantity,
      notes: data.notes ?? null,
      event_date: data.event_date ?? new Date().toISOString().replace('T', ' ').slice(0, 19),
    });
    return stockEventDB.getById(Number(result.lastInsertRowid))!;
  },

  getById(id: number): StockEvent | undefined {
    return db.prepare('SELECT * FROM stock_events WHERE id = ?').get(id) as StockEvent | undefined;
  },

  list(opts: { product_id?: number; startDate?: string; endDate?: string } = {}): StockEvent[] {
    let query = 'SELECT * FROM stock_events WHERE 1=1';
    const params: any[] = [];
    if (opts.product_id) { query += ' AND product_id = ?'; params.push(opts.product_id); }
    if (opts.startDate)  { query += ' AND event_date >= ?'; params.push(opts.startDate); }
    if (opts.endDate)    { query += ' AND event_date <= ?'; params.push(opts.endDate + ' 23:59:59'); }
    query += ' ORDER BY event_date DESC, id DESC';
    return db.prepare(query).all(...params) as StockEvent[];
  },

  update(id: number, data: { event_type?: string; quantity?: number; notes?: string; event_date?: string }): StockEvent | undefined {
    const existing = stockEventDB.getById(id);
    if (!existing) return undefined;
    const allowed = ['event_type', 'quantity', 'notes', 'event_date'];
    const entries = Object.entries(data).filter(([k, v]) => allowed.includes(k) && v !== undefined);
    if (entries.length === 0) return existing;
    const sets = entries.map(([k]) => `${k} = @${k}`).join(', ');
    const params: any = Object.fromEntries(entries);
    params.id = id;
    db.prepare(`UPDATE stock_events SET ${sets} WHERE id = @id`).run(params);
    return stockEventDB.getById(id);
  },

  delete(id: number): void {
    db.prepare('DELETE FROM stock_events WHERE id = ?').run(id);
  },
};

export default db;
