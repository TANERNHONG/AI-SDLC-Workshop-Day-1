import Database from 'better-sqlite3';
import path from 'path';
import {
  MARKET_ANALYSIS_DECISIONS,
  createEmptyMarketTable,
  type MarketAnalysisCriteria,
  type MarketAnalysisDecision,
  type MarketAnalysisMapping,
  type MarketAnalysisRecord,
  type MarketAnalysisTable,
} from './market-analysis-types';

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
  pending_stock: number;
  category: string | null;
  image_url: string | null;
  length_cm: number | null;
  width_cm: number | null;
  height_cm: number | null;
  thickness_length_mm: number | null;
  thickness_width_mm: number | null;
  thickness_height_mm: number | null;
  is_hypothetical: boolean;
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

export interface ProductMarginSummary {
  product_id: number;
  product_name: string;
  total_quantity: number;
  total_revenue: number;
  total_cost: number;
  gross_profit: number;
  margin_pct: number;
}

export interface CategoryRevenueSummary {
  category: string;
  total_revenue: number;
  total_quantity: number;
  product_count: number;
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
  delivery_days: number | null;
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

export interface BurnRateROP {
  product_id: number;
  product_name: string;
  current_stock: number;
  total_sold: number;
  period_days: number;
  stockout_days: number;
  naive_burn_rate: number;
  adjusted_burn_rate: number;
  lead_time_days: number;
  reorder_point: number;
  days_of_stock_left: number;   // -1 means infinite (no burn)
  needs_reorder: boolean;
}

export interface ReleaseEvent {
  id: number;
  name: string;
  release_date: string;
  description: string | null;
  game_series: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReleaseEventWithProducts extends ReleaseEvent {
  products: Product[];
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

  CREATE TABLE IF NOT EXISTS release_events (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT    NOT NULL,
    release_date    TEXT    NOT NULL,
    description     TEXT,
    game_series     TEXT,
    created_at      TEXT    DEFAULT (datetime('now')),
    updated_at      TEXT    DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS release_event_products (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    release_event_id INTEGER NOT NULL,
    product_id       INTEGER NOT NULL,
    FOREIGN KEY (release_event_id) REFERENCES release_events(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    UNIQUE(release_event_id, product_id)
  );

  CREATE INDEX IF NOT EXISTS idx_release_events_date ON release_events(release_date);
  CREATE INDEX IF NOT EXISTS idx_release_event_products_event ON release_event_products(release_event_id);
  CREATE INDEX IF NOT EXISTS idx_release_event_products_prod ON release_event_products(product_id);

  CREATE TABLE IF NOT EXISTS market_analysis_criteria (
    id                         INTEGER PRIMARY KEY AUTOINCREMENT,
    name                       TEXT NOT NULL,
    description                TEXT,
    market_product_table_json  TEXT NOT NULL DEFAULT '{"columns":[],"rows":[]}',
    product_table_json         TEXT NOT NULL DEFAULT '{"columns":[],"rows":[]}',
    mapping_table_json         TEXT NOT NULL DEFAULT '[]',
    viability_notes            TEXT,
    predicted_roi_pct          REAL,
    created_at                 TEXT DEFAULT (datetime('now')),
    updated_at                 TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS market_analyses (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    name              TEXT DEFAULT '',
    criteria_id       INTEGER DEFAULT 0,
    description       TEXT,
    viability_status  TEXT NOT NULL DEFAULT 'review',
    predicted_roi_pct REAL,
    summary           TEXT,
    created_at        TEXT DEFAULT (datetime('now')),
    updated_at        TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_market_analysis_criteria_name ON market_analysis_criteria(name);
  CREATE INDEX IF NOT EXISTS idx_market_analyses_criteria ON market_analyses(criteria_id);
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
try { db.exec('ALTER TABLE products ADD COLUMN length_cm REAL'); } catch { /* already exists */ }
try { db.exec('ALTER TABLE products ADD COLUMN width_cm REAL'); } catch { /* already exists */ }
try { db.exec('ALTER TABLE products ADD COLUMN height_cm REAL'); } catch { /* already exists */ }
try { db.exec('ALTER TABLE products ADD COLUMN thickness_mm REAL'); } catch { /* already exists */ }
try { db.exec('ALTER TABLE products ADD COLUMN thickness_length_mm REAL'); } catch { /* already exists */ }
try { db.exec('ALTER TABLE products ADD COLUMN thickness_width_mm REAL'); } catch { /* already exists */ }
try { db.exec('ALTER TABLE products ADD COLUMN thickness_height_mm REAL'); } catch { /* already exists */ }
try { db.exec('ALTER TABLE products ADD COLUMN is_hypothetical INTEGER NOT NULL DEFAULT 0'); } catch { /* already exists */ }
try { db.exec('ALTER TABLE purchases ADD COLUMN delivery_days INTEGER'); } catch { /* already exists */ }
try { db.exec("ALTER TABLE market_analyses ADD COLUMN combination_table_json TEXT NOT NULL DEFAULT '{}'"); } catch { /* already exists */ }

// Relax name / criteria_id NOT NULL on existing market_analyses tables
try {
  const info = db.prepare("PRAGMA table_info(market_analyses)").all() as any[];
  const nameCol = info.find((c: any) => c.name === 'name');
  if (nameCol && nameCol.notnull === 1) {
    db.transaction(() => {
      db.exec(`
        CREATE TABLE market_analyses_tmp (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT DEFAULT '',
          criteria_id INTEGER DEFAULT 0,
          description TEXT,
          viability_status TEXT NOT NULL DEFAULT 'review',
          predicted_roi_pct REAL,
          summary TEXT,
          combination_table_json TEXT NOT NULL DEFAULT '{}',
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        )
      `);
      db.exec("INSERT INTO market_analyses_tmp SELECT id, name, criteria_id, description, viability_status, predicted_roi_pct, summary, combination_table_json, created_at, updated_at FROM market_analyses");
      db.exec("DROP TABLE market_analyses");
      db.exec("ALTER TABLE market_analyses_tmp RENAME TO market_analyses");
      db.exec("CREATE INDEX IF NOT EXISTS idx_market_analyses_criteria ON market_analyses(criteria_id)");
    })();
  }
} catch { /* already migrated or fresh DB */ }

// ─── Product DB ──────────────────────────────────────────────────────────────

export const productDB = {
  create(data: Omit<Product, 'id' | 'created_at' | 'updated_at' | 'pending_stock'>): Product {
    const stmt = db.prepare(`
      INSERT INTO products (name, sku, description, price, cost, cost_currency, cost_exchange_rate, stock_quantity, category, image_url, length_cm, width_cm, height_cm, thickness_length_mm, thickness_width_mm, thickness_height_mm, is_hypothetical, is_active)
      VALUES (@name, @sku, @description, @price, @cost, @cost_currency, @cost_exchange_rate, 0, @category, @image_url, @length_cm, @width_cm, @height_cm, @thickness_length_mm, @thickness_width_mm, @thickness_height_mm, @is_hypothetical, @is_active)
    `);
    const result = stmt.run({
      ...data,
      cost_currency: data.cost_currency ?? 'SGD',
      cost_exchange_rate: data.cost_exchange_rate ?? 1,
      length_cm: data.length_cm ?? null,
      width_cm: data.width_cm ?? null,
      height_cm: data.height_cm ?? null,
      thickness_length_mm: data.thickness_length_mm ?? null,
      thickness_width_mm: data.thickness_width_mm ?? null,
      thickness_height_mm: data.thickness_height_mm ?? null,
      is_hypothetical: data.is_hypothetical ? 1 : 0,
      is_active: data.is_active ? 1 : 0,
    });
    return productDB.getById(Number(result.lastInsertRowid))!;
  },

  getById(id: number): Product | undefined {
    const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as any;
    if (!row) return undefined;
    const computed = productDB.getComputedStockForProduct(id);
    return { ...row, is_active: Boolean(row.is_active), is_hypothetical: Boolean(row.is_hypothetical), stock_quantity: computed };
  },

  list(includeInactive = false): Product[] {
    const rows = db.prepare(
      includeInactive
        ? 'SELECT * FROM products ORDER BY name ASC'
        : 'SELECT * FROM products WHERE is_active = 1 ORDER BY name ASC'
    ).all() as any[];
    const stockMap = productDB.getComputedStockAll();
    const pendingMap = productDB.getPendingStockAll();
    return rows.map(r => ({
      ...r,
      is_active: Boolean(r.is_active),
      is_hypothetical: Boolean(r.is_hypothetical),
      stock_quantity: stockMap.get(r.id) ?? 0,
      pending_stock: pendingMap.get(r.id) ?? 0,
    }));
  },

  update(id: number, data: Partial<Omit<Product, 'id' | 'created_at' | 'updated_at'>>): Product | undefined {
    // stock_quantity is computed — ignore it if passed
    const allowed = ['name', 'sku', 'description', 'price', 'cost', 'cost_currency', 'cost_exchange_rate', 'category', 'image_url', 'length_cm', 'width_cm', 'height_cm', 'thickness_length_mm', 'thickness_width_mm', 'thickness_height_mm', 'is_hypothetical', 'is_active'];
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

  /** Compute pending stock (from purchases with status = 'pending') for all products */
  getPendingStockAll(): Map<number, number> {
    const rows = db.prepare(`
      SELECT pi.product_id, COALESCE(SUM(pi.quantity), 0) AS total
      FROM purchase_items pi
      INNER JOIN purchases p ON p.id = pi.purchase_id
      WHERE p.status = 'pending'
      GROUP BY pi.product_id
    `).all() as Array<{ product_id: number; total: number }>;
    const map = new Map<number, number>();
    for (const r of rows) map.set(r.product_id, r.total);
    return map;
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

  getProductMarginSummary(startDate: string, endDate: string): ProductMarginSummary[] {
    return db.prepare(`
      SELECT
        si.product_id,
        si.product_name,
        SUM(si.quantity)                                AS total_quantity,
        SUM(si.line_total)                              AS total_revenue,
        SUM(si.unit_cost_sgd * si.quantity)             AS total_cost,
        SUM(si.line_total) - SUM(si.unit_cost_sgd * si.quantity) AS gross_profit,
        CASE WHEN SUM(si.line_total) > 0
          THEN ((SUM(si.line_total) - SUM(si.unit_cost_sgd * si.quantity)) / SUM(si.line_total)) * 100
          ELSE 0
        END AS margin_pct
      FROM sale_items si
      INNER JOIN sales s ON s.id = si.sale_id
      WHERE s.status = 'completed'
        AND s.sale_date >= ?
        AND s.sale_date <= ?
      GROUP BY si.product_id, si.product_name
      ORDER BY margin_pct DESC
    `).all(startDate, endDate + ' 23:59:59') as ProductMarginSummary[];
  },

  getCategoryRevenueSummary(startDate: string, endDate: string): CategoryRevenueSummary[] {
    return db.prepare(`
      SELECT
        COALESCE(p.category, 'Uncategorized') AS category,
        SUM(si.line_total)                    AS total_revenue,
        SUM(si.quantity)                      AS total_quantity,
        COUNT(DISTINCT si.product_id)         AS product_count
      FROM sale_items si
      INNER JOIN sales s ON s.id = si.sale_id
      LEFT JOIN products p ON p.id = si.product_id
      WHERE s.status = 'completed'
        AND s.sale_date >= ?
        AND s.sale_date <= ?
      GROUP BY COALESCE(p.category, 'Uncategorized')
      ORDER BY total_revenue DESC
    `).all(startDate, endDate + ' 23:59:59') as CategoryRevenueSummary[];
  },

  getBurnRateAndROP(startDate: string, endDate: string, leadTimeDays: number = 7): BurnRateROP[] {
    const products = db.prepare('SELECT id, name FROM products WHERE is_active = 1').all() as Array<{ id: number; name: string }>;
    const stockMap = productDB.getComputedStockAll();

    const dailySales = db.prepare(`
      SELECT si.product_id, date(s.sale_date) AS sale_date,
             SUM(si.quantity - si.refunded_quantity) AS qty
      FROM sale_items si
      INNER JOIN sales s ON s.id = si.sale_id
      WHERE s.status IN ('completed', 'partial_refund')
        AND s.sale_date >= ? AND s.sale_date <= ?
      GROUP BY si.product_id, date(s.sale_date)
    `).all(startDate, endDate + ' 23:59:59') as Array<{ product_id: number; sale_date: string; qty: number }>;

    const dailyPurchases = db.prepare(`
      SELECT pi.product_id, date(p.purchase_date) AS purchase_date, SUM(pi.quantity) AS qty
      FROM purchase_items pi
      INNER JOIN purchases p ON p.id = pi.purchase_id
      WHERE p.status = 'received'
        AND p.purchase_date >= ? AND p.purchase_date <= ?
      GROUP BY pi.product_id, date(p.purchase_date)
    `).all(startDate, endDate + ' 23:59:59') as Array<{ product_id: number; purchase_date: string; qty: number }>;

    const dailyAdjustments = db.prepare(`
      SELECT product_id, date(event_date) AS event_date, SUM(quantity) AS qty
      FROM stock_events
      WHERE event_date >= ? AND event_date <= ?
      GROUP BY product_id, date(event_date)
    `).all(startDate, endDate + ' 23:59:59') as Array<{ product_id: number; event_date: string; qty: number }>;

    // Build per-product daily lookup maps
    const salesMap = new Map<number, Map<string, number>>();
    for (const r of dailySales) {
      if (!salesMap.has(r.product_id)) salesMap.set(r.product_id, new Map());
      salesMap.get(r.product_id)!.set(r.sale_date, r.qty);
    }
    const purchaseMap = new Map<number, Map<string, number>>();
    for (const r of dailyPurchases) {
      if (!purchaseMap.has(r.product_id)) purchaseMap.set(r.product_id, new Map());
      purchaseMap.get(r.product_id)!.set(r.purchase_date, r.qty);
    }
    const adjustmentMap = new Map<number, Map<string, number>>();
    for (const r of dailyAdjustments) {
      if (!adjustmentMap.has(r.product_id)) adjustmentMap.set(r.product_id, new Map());
      adjustmentMap.get(r.product_id)!.set(r.event_date, r.qty);
    }

    // Generate all dates in range
    const dates: string[] = [];
    const cur = new Date(startDate);
    const end = new Date(endDate);
    while (cur <= end) {
      dates.push(cur.toISOString().slice(0, 10));
      cur.setDate(cur.getDate() + 1);
    }
    const periodDays = dates.length;

    return products.map(product => {
      const currentStock = stockMap.get(product.id) ?? 0;
      const pSales = salesMap.get(product.id) ?? new Map();
      const pPurchases = purchaseMap.get(product.id) ?? new Map();
      const pAdjustments = adjustmentMap.get(product.id) ?? new Map();

      const totalSold = Array.from(pSales.values()).reduce((s, q) => s + q, 0);

      // Reconstruct stock levels backwards from current stock to identify stockout days
      let stockoutDays = 0;
      let runningStock = currentStock;
      for (let i = dates.length - 1; i >= 0; i--) {
        const date = dates[i];
        const sold = pSales.get(date) ?? 0;
        const purchased = pPurchases.get(date) ?? 0;
        const adjusted = pAdjustments.get(date) ?? 0;
        if (runningStock <= 0 && sold === 0) stockoutDays++;
        // Reverse the day: end_of_prev = end_of_today + sold - purchased - adjusted
        runningStock = runningStock + sold - purchased - adjusted;
      }

      const activeDays = Math.max(periodDays - stockoutDays, 1);
      const naiveBurnRate = periodDays > 0 ? totalSold / periodDays : 0;
      const adjustedBurnRate = totalSold / activeDays;
      const reorderPoint = Math.ceil(adjustedBurnRate * leadTimeDays);
      const daysLeft = adjustedBurnRate > 0 ? currentStock / adjustedBurnRate : -1;

      return {
        product_id: product.id,
        product_name: product.name,
        current_stock: currentStock,
        total_sold: totalSold,
        period_days: periodDays,
        stockout_days: stockoutDays,
        naive_burn_rate: Math.round(naiveBurnRate * 100) / 100,
        adjusted_burn_rate: Math.round(adjustedBurnRate * 100) / 100,
        lead_time_days: leadTimeDays,
        reorder_point: reorderPoint,
        days_of_stock_left: daysLeft === -1 ? -1 : Math.round(daysLeft * 10) / 10,
        needs_reorder: adjustedBurnRate > 0 && currentStock <= reorderPoint,
      };
    })
    .filter(p => p.total_sold > 0)
    .sort((a, b) => {
      if (a.needs_reorder !== b.needs_reorder) return a.needs_reorder ? -1 : 1;
      const aLeft = a.days_of_stock_left === -1 ? Infinity : a.days_of_stock_left;
      const bLeft = b.days_of_stock_left === -1 ? Infinity : b.days_of_stock_left;
      return aLeft - bLeft;
    });
  },

  /** Returns daily sale quantities per product for the last N days (for sparklines). */
  getProductDailySparkline(days: number = 30): Record<number, number[]> {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days + 1);
    const startStr = start.toISOString().slice(0, 10);
    const endStr = end.toISOString().slice(0, 10);

    // Build date array
    const dates: string[] = [];
    const cur = new Date(startStr);
    while (cur <= end) {
      dates.push(cur.toISOString().slice(0, 10));
      cur.setDate(cur.getDate() + 1);
    }

    const rows = db.prepare(`
      SELECT si.product_id, date(s.sale_date) AS sale_date,
             SUM(si.quantity - si.refunded_quantity) AS qty
      FROM sale_items si
      INNER JOIN sales s ON s.id = si.sale_id
      WHERE s.status IN ('completed', 'partial_refund')
        AND s.sale_date >= ? AND s.sale_date <= ?
      GROUP BY si.product_id, date(s.sale_date)
    `).all(startStr, endStr + ' 23:59:59') as Array<{ product_id: number; sale_date: string; qty: number }>;

    // Build per-product lookup
    const map = new Map<number, Map<string, number>>();
    for (const r of rows) {
      if (!map.has(r.product_id)) map.set(r.product_id, new Map());
      map.get(r.product_id)!.set(r.sale_date, r.qty);
    }

    // Build result: product_id -> array of daily quantities
    const result: Record<number, number[]> = {};
    for (const [pid, dayMap] of map) {
      result[pid] = dates.map(d => dayMap.get(d) ?? 0);
    }
    return result;
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
    opts: { discount?: number; tax?: number; shipping_cost?: number; currency?: string; exchange_rate?: number; notes?: string; purchase_date?: string; invoice_ref?: string; status?: string; delivery_days?: number } = {}
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
        INSERT INTO purchases (supplier_id, purchase_date, invoice_ref, subtotal, discount, tax, shipping_cost, currency, exchange_rate, total_cost, notes, status, delivery_days)
        VALUES (@supplier_id, @purchase_date, @invoice_ref, @subtotal, @discount, @tax, @shipping_cost, @currency, @exchange_rate, @total_cost, @notes, @status, @delivery_days)
      `).run({
        supplier_id,
        purchase_date: opts.purchase_date ?? new Date().toISOString().replace('T', ' ').slice(0, 19),
        invoice_ref: opts.invoice_ref?.trim() || generatePurchaseRef(),
        subtotal, discount, tax, shipping_cost, currency, exchange_rate, total_cost,
        notes: opts.notes ?? null,
        status,
        delivery_days: opts.delivery_days ?? null,
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
      notes?: string; status?: string; delivery_days?: number | null;
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
          notes=@notes, status=@status, delivery_days=@delivery_days, updated_at=datetime('now')
        WHERE id=@id
      `).run({
        id, subtotal, discount, tax, shipping_cost, currency, exchange_rate, total_cost,
        notes: data.notes ?? purchase.notes,
        status: newStatus,
        delivery_days: data.delivery_days !== undefined ? data.delivery_days : (purchase.delivery_days ?? null),
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

// ─── Shipping & Courier Schema ───────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS couriers (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL UNIQUE,
    slug        TEXT    NOT NULL UNIQUE,
    is_active   INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT    DEFAULT (datetime('now')),
    updated_at  TEXT    DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS courier_rate_tables (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    courier_id            INTEGER NOT NULL,
    max_weight_kg         REAL    NOT NULL,
    max_length_cm         REAL    NOT NULL DEFAULT 0,
    max_width_cm          REAL    NOT NULL DEFAULT 0,
    max_height_cm         REAL    NOT NULL DEFAULT 0,
    price                 REAL    NOT NULL,
    FOREIGN KEY (courier_id) REFERENCES couriers(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS courier_bulk_savings (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    courier_id    INTEGER NOT NULL,
    min_orders    INTEGER NOT NULL,
    max_orders    INTEGER,
    discount_pct  REAL    NOT NULL,
    FOREIGN KEY (courier_id) REFERENCES couriers(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS courier_surcharges (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    courier_id  INTEGER NOT NULL,
    item_name   TEXT    NOT NULL,
    price       REAL    NOT NULL,
    description TEXT,
    FOREIGN KEY (courier_id) REFERENCES couriers(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS courier_additional_services (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    courier_id    INTEGER NOT NULL,
    service_name  TEXT    NOT NULL,
    price         REAL    NOT NULL,
    description   TEXT,
    FOREIGN KEY (courier_id) REFERENCES couriers(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS shipping_orders (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id     INTEGER NOT NULL UNIQUE,
    status      TEXT    NOT NULL DEFAULT 'not_prepared',
    notes       TEXT,
    created_at  TEXT    DEFAULT (datetime('now')),
    updated_at  TEXT    DEFAULT (datetime('now')),
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS packages (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    shipping_order_id   INTEGER NOT NULL,
    length_cm           REAL    NOT NULL DEFAULT 0,
    width_cm            REAL    NOT NULL DEFAULT 0,
    height_cm           REAL    NOT NULL DEFAULT 0,
    weight_kg           REAL    NOT NULL DEFAULT 0,
    courier_id          INTEGER,
    courier_name        TEXT,
    estimated_cost      REAL,
    notes               TEXT,
    created_at          TEXT    DEFAULT (datetime('now')),
    FOREIGN KEY (shipping_order_id) REFERENCES shipping_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (courier_id) REFERENCES couriers(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_shipping_orders_sale ON shipping_orders(sale_id);
  CREATE INDEX IF NOT EXISTS idx_packages_shipping    ON packages(shipping_order_id);
  CREATE INDEX IF NOT EXISTS idx_rate_tables_courier   ON courier_rate_tables(courier_id);
  CREATE INDEX IF NOT EXISTS idx_bulk_savings_courier  ON courier_bulk_savings(courier_id);
  CREATE INDEX IF NOT EXISTS idx_surcharges_courier    ON courier_surcharges(courier_id);
  CREATE INDEX IF NOT EXISTS idx_addl_services_courier ON courier_additional_services(courier_id);
`);

// ─── Seed uParcel courier ────────────────────────────────────────────────────

(function seedCouriers() {
  const existing = db.prepare("SELECT id FROM couriers WHERE slug = 'uparcel'").get();
  if (existing) return; // already seeded

  // Insert couriers
  const couriersToSeed = [
    { name: 'uParcel', slug: 'uparcel' },
    { name: 'NinjaVan', slug: 'ninjavan' },
    { name: 'Singapore Post', slug: 'singapore-post' },
    { name: 'Others', slug: 'others' },
  ];
  const insertCourier = db.prepare("INSERT OR IGNORE INTO couriers (name, slug) VALUES (@name, @slug)");
  for (const c of couriersToSeed) insertCourier.run(c);

  const insertRate = db.prepare("INSERT INTO courier_rate_tables (courier_id, max_weight_kg, max_length_cm, max_width_cm, max_height_cm, price) VALUES (@courier_id, @max_weight_kg, @max_length_cm, @max_width_cm, @max_height_cm, @price)");

  // ── uParcel rate tables ──
  const uparcelId = (db.prepare("SELECT id FROM couriers WHERE slug = 'uparcel'").get() as any).id;
  const uparcelRates = [
    { max_weight_kg: 1,  max_length_cm: 30,  max_width_cm: 20, max_height_cm: 10, price: 10 },
    { max_weight_kg: 5,  max_length_cm: 40,  max_width_cm: 25, max_height_cm: 15, price: 11 },
    { max_weight_kg: 8,  max_length_cm: 50,  max_width_cm: 30, max_height_cm: 20, price: 13 },
    { max_weight_kg: 10, max_length_cm: 60,  max_width_cm: 35, max_height_cm: 25, price: 16 },
    { max_weight_kg: 15, max_length_cm: 70,  max_width_cm: 40, max_height_cm: 30, price: 18 },
    { max_weight_kg: 20, max_length_cm: 80,  max_width_cm: 50, max_height_cm: 30, price: 21 },
    { max_weight_kg: 25, max_length_cm: 100, max_width_cm: 60, max_height_cm: 40, price: 25 },
  ];
  for (const r of uparcelRates) insertRate.run({ courier_id: uparcelId, ...r });

  // ── NinjaVan rate tables ──
  const ninjavanId = (db.prepare("SELECT id FROM couriers WHERE slug = 'ninjavan'").get() as any).id;
  const ninjavanRates = [
    { max_weight_kg: 2,  max_length_cm: 30, max_width_cm: 30, max_height_cm: 20, price: 3.49 },
    { max_weight_kg: 5,  max_length_cm: 40, max_width_cm: 40, max_height_cm: 30, price: 4.49 },
    { max_weight_kg: 10, max_length_cm: 50, max_width_cm: 50, max_height_cm: 40, price: 5.99 },
    { max_weight_kg: 20, max_length_cm: 60, max_width_cm: 60, max_height_cm: 50, price: 8.99 },
    { max_weight_kg: 30, max_length_cm: 70, max_width_cm: 70, max_height_cm: 60, price: 14.99 },
  ];
  for (const r of ninjavanRates) insertRate.run({ courier_id: ninjavanId, ...r });

  // ── Singapore Post rate tables ──
  const singpostId = (db.prepare("SELECT id FROM couriers WHERE slug = 'singapore-post'").get() as any).id;
  const singpostRates = [
    { max_weight_kg: 2, max_length_cm: 32.4, max_width_cm: 22.9, max_height_cm: 0.65, price: 2.00 },
  ];
  for (const r of singpostRates) insertRate.run({ courier_id: singpostId, ...r });

  // ── uParcel bulk savings ──
  const bulks = [
    { min_orders: 5,  max_orders: 9,    discount_pct: 5 },
    { min_orders: 10, max_orders: 19,   discount_pct: 10 },
    { min_orders: 20, max_orders: 29,   discount_pct: 15 },
    { min_orders: 30, max_orders: null,  discount_pct: 20 },
  ];
  const insertBulk = db.prepare("INSERT INTO courier_bulk_savings (courier_id, min_orders, max_orders, discount_pct) VALUES (@courier_id, @min_orders, @max_orders, @discount_pct)");
  for (const b of bulks) insertBulk.run({ courier_id: uparcelId, ...b });

  // ── uParcel surcharges ──
  const surcharges = [
    { item_name: 'Area: City',      price: 2,    description: '' },
    { item_name: 'Area: Tuas',      price: 4,    description: '' },
    { item_name: 'Area: Changi',    price: 15,   description: '' },
    { item_name: 'Entry Fee',       price: 10,   description: '' },
    { item_name: 'Distance',        price: 2,    description: 'Trips exceeding 18 km' },
    { item_name: 'Night Delivery',  price: 15,   description: 'Bookings made from 11 pm to 7 am. Only 1 hour rush available' },
    { item_name: 'Waiting Time',    price: 0.40, description: '$0.40/min — any time beyond 10 minutes of waiting' },
  ];
  const insertSurcharge = db.prepare("INSERT INTO courier_surcharges (courier_id, item_name, price, description) VALUES (@courier_id, @item_name, @price, @description)");
  for (const s of surcharges) insertSurcharge.run({ courier_id: uparcelId, ...s });
})();

// ─── Courier Types ───────────────────────────────────────────────────────────

export interface Courier {
  id: number;
  name: string;
  slug: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CourierRateTable {
  id: number;
  courier_id: number;
  max_weight_kg: number;
  max_length_cm: number;
  max_width_cm: number;
  max_height_cm: number;
  price: number;
}

export interface CourierBulkSaving {
  id: number;
  courier_id: number;
  min_orders: number;
  max_orders: number | null;
  discount_pct: number;
}

export interface CourierSurcharge {
  id: number;
  courier_id: number;
  item_name: string;
  price: number;
  description: string | null;
}

export interface CourierAdditionalService {
  id: number;
  courier_id: number;
  service_name: string;
  price: number;
  description: string | null;
}

export type ShippingStatus = 'not_prepared' | 'packed' | 'shipped' | 'received' | 'cancelled';

export interface ShippingOrder {
  id: number;
  sale_id: number;
  status: ShippingStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Package {
  id: number;
  shipping_order_id: number;
  length_cm: number;
  width_cm: number;
  height_cm: number;
  weight_kg: number;
  courier_id: number | null;
  courier_name: string | null;
  estimated_cost: number | null;
  notes: string | null;
  created_at: string;
}

export interface ShippingOrderWithPackages extends ShippingOrder {
  packages: Package[];
  invoice_number?: string;
}

export interface CourierQuote {
  courier_id: number;
  courier_name: string;
  base_price: number;
  bulk_discount_pct: number;
  discounted_price: number;
  fits: boolean;
}

// ─── Courier DB ──────────────────────────────────────────────────────────────

export const courierDB = {
  list(includeInactive = false): Courier[] {
    const rows = db.prepare(
      includeInactive
        ? 'SELECT * FROM couriers ORDER BY name ASC'
        : 'SELECT * FROM couriers WHERE is_active = 1 ORDER BY name ASC'
    ).all() as any[];
    return rows.map(r => ({ ...r, is_active: Boolean(r.is_active) }));
  },

  getById(id: number): Courier | undefined {
    const row = db.prepare('SELECT * FROM couriers WHERE id = ?').get(id) as any;
    return row ? { ...row, is_active: Boolean(row.is_active) } : undefined;
  },

  create(data: { name: string; slug: string }): Courier {
    const result = db.prepare("INSERT INTO couriers (name, slug) VALUES (@name, @slug)").run(data);
    return courierDB.getById(Number(result.lastInsertRowid))!;
  },

  update(id: number, data: { name?: string; slug?: string; is_active?: boolean }): Courier | undefined {
    const allowed = ['name', 'slug', 'is_active'];
    const entries = Object.entries(data).filter(([k]) => allowed.includes(k));
    if (entries.length === 0) return courierDB.getById(id);
    const sets = entries.map(([k]) => `${k} = @${k}`).join(', ');
    const params: any = Object.fromEntries(entries.map(([k, v]) => [k, typeof v === 'boolean' ? (v ? 1 : 0) : v]));
    params.id = id;
    db.prepare(`UPDATE couriers SET ${sets}, updated_at = datetime('now') WHERE id = @id`).run(params);
    return courierDB.getById(id);
  },

  delete(id: number): void {
    db.prepare('DELETE FROM couriers WHERE id = ?').run(id);
  },

  // ─── Rate Tables ───
  getRateTables(courierId: number): CourierRateTable[] {
    return db.prepare('SELECT * FROM courier_rate_tables WHERE courier_id = ? ORDER BY max_weight_kg ASC').all(courierId) as CourierRateTable[];
  },
  addRateTable(data: { courier_id: number; max_weight_kg: number; max_length_cm: number; max_width_cm: number; max_height_cm: number; price: number }): CourierRateTable {
    const result = db.prepare("INSERT INTO courier_rate_tables (courier_id, max_weight_kg, max_length_cm, max_width_cm, max_height_cm, price) VALUES (@courier_id, @max_weight_kg, @max_length_cm, @max_width_cm, @max_height_cm, @price)").run(data);
    return db.prepare('SELECT * FROM courier_rate_tables WHERE id = ?').get(Number(result.lastInsertRowid)) as CourierRateTable;
  },
  updateRateTable(id: number, data: { max_weight_kg?: number; max_length_cm?: number; max_width_cm?: number; max_height_cm?: number; price?: number }): CourierRateTable | undefined {
    const entries = Object.entries(data).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return db.prepare('SELECT * FROM courier_rate_tables WHERE id = ?').get(id) as CourierRateTable | undefined;
    const sets = entries.map(([k]) => `${k} = @${k}`).join(', ');
    const params: any = Object.fromEntries(entries);
    params.id = id;
    db.prepare(`UPDATE courier_rate_tables SET ${sets} WHERE id = @id`).run(params);
    return db.prepare('SELECT * FROM courier_rate_tables WHERE id = ?').get(id) as CourierRateTable | undefined;
  },
  deleteRateTable(id: number): void {
    db.prepare('DELETE FROM courier_rate_tables WHERE id = ?').run(id);
  },

  // ─── Bulk Savings ───
  getBulkSavings(courierId: number): CourierBulkSaving[] {
    return db.prepare('SELECT * FROM courier_bulk_savings WHERE courier_id = ? ORDER BY min_orders ASC').all(courierId) as CourierBulkSaving[];
  },
  addBulkSaving(data: { courier_id: number; min_orders: number; max_orders: number | null; discount_pct: number }): CourierBulkSaving {
    const result = db.prepare("INSERT INTO courier_bulk_savings (courier_id, min_orders, max_orders, discount_pct) VALUES (@courier_id, @min_orders, @max_orders, @discount_pct)").run(data);
    return db.prepare('SELECT * FROM courier_bulk_savings WHERE id = ?').get(Number(result.lastInsertRowid)) as CourierBulkSaving;
  },
  updateBulkSaving(id: number, data: { min_orders?: number; max_orders?: number | null; discount_pct?: number }): CourierBulkSaving | undefined {
    const entries = Object.entries(data).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return db.prepare('SELECT * FROM courier_bulk_savings WHERE id = ?').get(id) as CourierBulkSaving | undefined;
    const sets = entries.map(([k]) => `${k} = @${k}`).join(', ');
    const params: any = Object.fromEntries(entries);
    params.id = id;
    db.prepare(`UPDATE courier_bulk_savings SET ${sets} WHERE id = @id`).run(params);
    return db.prepare('SELECT * FROM courier_bulk_savings WHERE id = ?').get(id) as CourierBulkSaving | undefined;
  },
  deleteBulkSaving(id: number): void {
    db.prepare('DELETE FROM courier_bulk_savings WHERE id = ?').run(id);
  },

  // ─── Surcharges ───
  getSurcharges(courierId: number): CourierSurcharge[] {
    return db.prepare('SELECT * FROM courier_surcharges WHERE courier_id = ? ORDER BY item_name ASC').all(courierId) as CourierSurcharge[];
  },
  addSurcharge(data: { courier_id: number; item_name: string; price: number; description?: string }): CourierSurcharge {
    const result = db.prepare("INSERT INTO courier_surcharges (courier_id, item_name, price, description) VALUES (@courier_id, @item_name, @price, @description)").run({ ...data, description: data.description ?? null });
    return db.prepare('SELECT * FROM courier_surcharges WHERE id = ?').get(Number(result.lastInsertRowid)) as CourierSurcharge;
  },
  updateSurcharge(id: number, data: { item_name?: string; price?: number; description?: string }): CourierSurcharge | undefined {
    const entries = Object.entries(data).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return db.prepare('SELECT * FROM courier_surcharges WHERE id = ?').get(id) as CourierSurcharge | undefined;
    const sets = entries.map(([k]) => `${k} = @${k}`).join(', ');
    const params: any = Object.fromEntries(entries);
    params.id = id;
    db.prepare(`UPDATE courier_surcharges SET ${sets} WHERE id = @id`).run(params);
    return db.prepare('SELECT * FROM courier_surcharges WHERE id = ?').get(id) as CourierSurcharge | undefined;
  },
  deleteSurcharge(id: number): void {
    db.prepare('DELETE FROM courier_surcharges WHERE id = ?').run(id);
  },

  // ─── Additional Services ───
  getAdditionalServices(courierId: number): CourierAdditionalService[] {
    return db.prepare('SELECT * FROM courier_additional_services WHERE courier_id = ? ORDER BY service_name ASC').all(courierId) as CourierAdditionalService[];
  },
  addAdditionalService(data: { courier_id: number; service_name: string; price: number; description?: string }): CourierAdditionalService {
    const result = db.prepare("INSERT INTO courier_additional_services (courier_id, service_name, price, description) VALUES (@courier_id, @service_name, @price, @description)").run({ ...data, description: data.description ?? null });
    return db.prepare('SELECT * FROM courier_additional_services WHERE id = ?').get(Number(result.lastInsertRowid)) as CourierAdditionalService;
  },
  updateAdditionalService(id: number, data: { service_name?: string; price?: number; description?: string }): CourierAdditionalService | undefined {
    const entries = Object.entries(data).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return db.prepare('SELECT * FROM courier_additional_services WHERE id = ?').get(id) as CourierAdditionalService | undefined;
    const sets = entries.map(([k]) => `${k} = @${k}`).join(', ');
    const params: any = Object.fromEntries(entries);
    params.id = id;
    db.prepare(`UPDATE courier_additional_services SET ${sets} WHERE id = @id`).run(params);
    return db.prepare('SELECT * FROM courier_additional_services WHERE id = ?').get(id) as CourierAdditionalService | undefined;
  },
  deleteAdditionalService(id: number): void {
    db.prepare('DELETE FROM courier_additional_services WHERE id = ?').run(id);
  },

  // ─── Auto-Recommendation ───
  /** Get quotes for a package from all active couriers. Returns sorted cheapest-first. */
  getQuotes(weightKg: number, lengthCm: number, widthCm: number, heightCm: number): CourierQuote[] {
    const couriers = courierDB.list();

    // Count shipped orders this month for bulk discount calc
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-31 23:59:59`;
    const monthlyOrders = (db.prepare(`
      SELECT COUNT(*) AS cnt FROM shipping_orders
      WHERE status IN ('shipped', 'received')
        AND created_at >= ? AND created_at <= ?
    `).get(monthStart, monthEnd) as any).cnt;

    const quotes: CourierQuote[] = [];

    for (const courier of couriers) {
      // Find cheapest tier that fits — check each dimension individually
      const tier = db.prepare(`
        SELECT * FROM courier_rate_tables
        WHERE courier_id = ? AND max_weight_kg >= ? AND max_length_cm >= ? AND max_width_cm >= ? AND max_height_cm >= ?
        ORDER BY price ASC LIMIT 1
      `).get(courier.id, weightKg, lengthCm, widthCm, heightCm) as CourierRateTable | undefined;

      const fits = !!tier;
      const basePrice = tier?.price ?? 0;

      // Find applicable bulk discount
      const bulk = db.prepare(`
        SELECT * FROM courier_bulk_savings
        WHERE courier_id = ? AND min_orders <= ?
          AND (max_orders IS NULL OR max_orders >= ?)
        ORDER BY discount_pct DESC LIMIT 1
      `).get(courier.id, monthlyOrders, monthlyOrders) as CourierBulkSaving | undefined;

      const discountPct = bulk?.discount_pct ?? 0;
      const discountedPrice = basePrice * (1 - discountPct / 100);

      quotes.push({
        courier_id: courier.id,
        courier_name: courier.name,
        base_price: basePrice,
        bulk_discount_pct: discountPct,
        discounted_price: Math.round(discountedPrice * 100) / 100,
        fits,
      });
    }

    // Sort: fitting couriers first (cheapest), then non-fitting
    quotes.sort((a, b) => {
      if (a.fits && !b.fits) return -1;
      if (!a.fits && b.fits) return 1;
      return a.discounted_price - b.discounted_price;
    });

    return quotes;
  },
};

// ─── Shipping Order DB ───────────────────────────────────────────────────────

export const shippingOrderDB = {
  create(data: { sale_id: number; status?: ShippingStatus; notes?: string }): ShippingOrderWithPackages {
    const result = db.prepare(
      "INSERT INTO shipping_orders (sale_id, status, notes) VALUES (@sale_id, @status, @notes)"
    ).run({
      sale_id: data.sale_id,
      status: data.status ?? 'not_prepared',
      notes: data.notes ?? null,
    });
    return shippingOrderDB.getById(Number(result.lastInsertRowid))!;
  },

  getById(id: number): ShippingOrderWithPackages | undefined {
    const row = db.prepare(`
      SELECT so.*, s.invoice_number
      FROM shipping_orders so
      LEFT JOIN sales s ON s.id = so.sale_id
      WHERE so.id = ?
    `).get(id) as any;
    if (!row) return undefined;
    const packages = db.prepare('SELECT * FROM packages WHERE shipping_order_id = ? ORDER BY id ASC').all(id) as Package[];
    return { ...row, packages };
  },

  getBySaleId(saleId: number): ShippingOrderWithPackages | undefined {
    const row = db.prepare(`
      SELECT so.*, s.invoice_number
      FROM shipping_orders so
      LEFT JOIN sales s ON s.id = so.sale_id
      WHERE so.sale_id = ?
    `).get(saleId) as any;
    if (!row) return undefined;
    const packages = db.prepare('SELECT * FROM packages WHERE shipping_order_id = ? ORDER BY id ASC').all(row.id) as Package[];
    return { ...row, packages };
  },

  list(opts: { status?: string } = {}): ShippingOrderWithPackages[] {
    let query = `
      SELECT so.*, s.invoice_number
      FROM shipping_orders so
      LEFT JOIN sales s ON s.id = so.sale_id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (opts.status && opts.status !== 'all') {
      query += ' AND so.status = ?';
      params.push(opts.status);
    }
    query += ' ORDER BY so.created_at DESC, so.id DESC';
    const rows = db.prepare(query).all(...params) as any[];
    return rows.map(row => {
      const packages = db.prepare('SELECT * FROM packages WHERE shipping_order_id = ? ORDER BY id ASC').all(row.id) as Package[];
      return { ...row, packages };
    });
  },

  update(id: number, data: { status?: ShippingStatus; notes?: string }): ShippingOrderWithPackages | undefined {
    const existing = shippingOrderDB.getById(id);
    if (!existing) return undefined;
    const entries = Object.entries(data).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return existing;
    const sets = entries.map(([k]) => `${k} = @${k}`).join(', ');
    const params: any = Object.fromEntries(entries);
    params.id = id;
    db.prepare(`UPDATE shipping_orders SET ${sets}, updated_at = datetime('now') WHERE id = @id`).run(params);
    return shippingOrderDB.getById(id);
  },

  delete(id: number): void {
    db.prepare('DELETE FROM shipping_orders WHERE id = ?').run(id);
  },

  // ─── Package management ───
  addPackage(data: { shipping_order_id: number; length_cm: number; width_cm: number; height_cm: number; weight_kg: number; courier_id?: number; notes?: string }): Package {
    let courierName: string | null = null;
    let estimatedCost: number | null = null;

    if (data.courier_id) {
      const c = courierDB.getById(data.courier_id);
      courierName = c?.name ?? null;
    }

    // Auto-recommend if no courier specified
    if (!data.courier_id && data.weight_kg > 0) {
      const quotes = courierDB.getQuotes(data.weight_kg, data.length_cm, data.width_cm, data.height_cm);
      const best = quotes.find(q => q.fits);
      if (best) {
        data.courier_id = best.courier_id;
        courierName = best.courier_name;
        estimatedCost = best.discounted_price;
      }
    } else if (data.courier_id && data.weight_kg > 0) {
      const quotes = courierDB.getQuotes(data.weight_kg, data.length_cm, data.width_cm, data.height_cm);
      const match = quotes.find(q => q.courier_id === data.courier_id);
      if (match) estimatedCost = match.discounted_price;
    }

    const result = db.prepare(`
      INSERT INTO packages (shipping_order_id, length_cm, width_cm, height_cm, weight_kg, courier_id, courier_name, estimated_cost, notes)
      VALUES (@shipping_order_id, @length_cm, @width_cm, @height_cm, @weight_kg, @courier_id, @courier_name, @estimated_cost, @notes)
    `).run({
      shipping_order_id: data.shipping_order_id,
      length_cm: data.length_cm,
      width_cm: data.width_cm,
      height_cm: data.height_cm,
      weight_kg: data.weight_kg,
      courier_id: data.courier_id ?? null,
      courier_name: courierName,
      estimated_cost: estimatedCost,
      notes: data.notes ?? null,
    });
    return db.prepare('SELECT * FROM packages WHERE id = ?').get(Number(result.lastInsertRowid)) as Package;
  },

  updatePackage(id: number, data: { length_cm?: number; width_cm?: number; height_cm?: number; weight_kg?: number; courier_id?: number | null; notes?: string }): Package | undefined {
    const existing = db.prepare('SELECT * FROM packages WHERE id = ?').get(id) as Package | undefined;
    if (!existing) return undefined;

    const length_cm = data.length_cm ?? existing.length_cm;
    const width_cm = data.width_cm ?? existing.width_cm;
    const height_cm = data.height_cm ?? existing.height_cm;
    const weight_kg = data.weight_kg ?? existing.weight_kg;
    let courier_id = data.courier_id !== undefined ? data.courier_id : existing.courier_id;
    let courier_name: string | null = existing.courier_name;
    let estimated_cost: number | null = existing.estimated_cost;

    // Re-run auto-recommendation if dimensions changed and no courier override
    if (data.courier_id === undefined && weight_kg > 0) {
      const quotes = courierDB.getQuotes(weight_kg, length_cm, width_cm, height_cm);
      const best = quotes.find(q => q.fits);
      if (best) {
        courier_id = best.courier_id;
        courier_name = best.courier_name;
        estimated_cost = best.discounted_price;
      }
    } else if (courier_id) {
      const c = courierDB.getById(courier_id);
      courier_name = c?.name ?? null;
      if (weight_kg > 0) {
        const quotes = courierDB.getQuotes(weight_kg, length_cm, width_cm, height_cm);
        const match = quotes.find(q => q.courier_id === courier_id);
        estimated_cost = match?.discounted_price ?? null;
      }
    } else {
      courier_name = null;
      estimated_cost = null;
    }

    db.prepare(`
      UPDATE packages SET length_cm=@length_cm, width_cm=@width_cm, height_cm=@height_cm,
        weight_kg=@weight_kg, courier_id=@courier_id, courier_name=@courier_name,
        estimated_cost=@estimated_cost, notes=@notes
      WHERE id=@id
    `).run({
      id, length_cm, width_cm, height_cm, weight_kg,
      courier_id: courier_id ?? null,
      courier_name,
      estimated_cost,
      notes: data.notes !== undefined ? data.notes : existing.notes,
    });
    return db.prepare('SELECT * FROM packages WHERE id = ?').get(id) as Package;
  },

  deletePackage(id: number): void {
    db.prepare('DELETE FROM packages WHERE id = ?').run(id);
  },

  getPackage(id: number): Package | undefined {
    return db.prepare('SELECT * FROM packages WHERE id = ?').get(id) as Package | undefined;
  },
};

// ─── Release Event DB ────────────────────────────────────────────────────────

export const releaseEventDB = {
  create(data: { name: string; release_date: string; description?: string | null; game_series?: string | null }): ReleaseEvent {
    const result = db.prepare(`
      INSERT INTO release_events (name, release_date, description, game_series)
      VALUES (@name, @release_date, @description, @game_series)
    `).run({
      name: data.name,
      release_date: data.release_date,
      description: data.description ?? null,
      game_series: data.game_series ?? null,
    });
    return db.prepare('SELECT * FROM release_events WHERE id = ?').get(Number(result.lastInsertRowid)) as ReleaseEvent;
  },

  getById(id: number): ReleaseEventWithProducts | undefined {
    const row = db.prepare('SELECT * FROM release_events WHERE id = ?').get(id) as ReleaseEvent | undefined;
    if (!row) return undefined;
    const products = db.prepare(`
      SELECT p.* FROM products p
      INNER JOIN release_event_products rep ON rep.product_id = p.id
      WHERE rep.release_event_id = ?
      ORDER BY p.name ASC
    `).all(id) as Product[];
    return { ...row, products };
  },

  list(): ReleaseEventWithProducts[] {
    const rows = db.prepare('SELECT * FROM release_events ORDER BY release_date ASC').all() as ReleaseEvent[];
    return rows.map(row => {
      const products = db.prepare(`
        SELECT p.* FROM products p
        INNER JOIN release_event_products rep ON rep.product_id = p.id
        WHERE rep.release_event_id = ?
        ORDER BY p.name ASC
      `).all(row.id) as Product[];
      return { ...row, products };
    });
  },

  update(id: number, data: Partial<{ name: string; release_date: string; description: string | null; game_series: string | null }>): ReleaseEvent | undefined {
    const allowed = ['name', 'release_date', 'description', 'game_series'];
    const entries = Object.entries(data).filter(([k]) => allowed.includes(k));
    if (entries.length === 0) return db.prepare('SELECT * FROM release_events WHERE id = ?').get(id) as ReleaseEvent | undefined;
    const sets = entries.map(([k]) => `${k} = @${k}`).join(', ');
    const params: any = Object.fromEntries(entries);
    params.id = id;
    db.prepare(`UPDATE release_events SET ${sets}, updated_at = datetime('now') WHERE id = @id`).run(params);
    return db.prepare('SELECT * FROM release_events WHERE id = ?').get(id) as ReleaseEvent | undefined;
  },

  delete(id: number): void {
    db.prepare('DELETE FROM release_events WHERE id = ?').run(id);
  },

  addProduct(releaseEventId: number, productId: number): void {
    db.prepare('INSERT OR IGNORE INTO release_event_products (release_event_id, product_id) VALUES (?, ?)').run(releaseEventId, productId);
  },

  removeProduct(releaseEventId: number, productId: number): void {
    db.prepare('DELETE FROM release_event_products WHERE release_event_id = ? AND product_id = ?').run(releaseEventId, productId);
  },

  setProducts(releaseEventId: number, productIds: number[]): void {
    db.prepare('DELETE FROM release_event_products WHERE release_event_id = ?').run(releaseEventId);
    const insert = db.prepare('INSERT INTO release_event_products (release_event_id, product_id) VALUES (?, ?)');
    for (const pid of productIds) {
      insert.run(releaseEventId, pid);
    }
  },
};

function normalizeMarketAnalysisTable(table?: MarketAnalysisTable | null): MarketAnalysisTable {
  const columns = Array.isArray(table?.columns)
    ? table.columns.map((column, index) => ({
        id: String(column?.id || `column-${index + 1}`),
        name: String(column?.name || `Column ${index + 1}`),
      }))
    : [];

  const rows = Array.isArray(table?.rows)
    ? table.rows.map((row, rowIndex) => ({
        id: String(row?.id || `row-${rowIndex + 1}`),
        values: Object.fromEntries(
          columns.map((column) => [column.id, String(row?.values?.[column.id] ?? '')])
        ),
      }))
    : [];

  return { columns, rows };
}

function normalizeMarketAnalysisMappings(mappings?: MarketAnalysisMapping[] | null): MarketAnalysisMapping[] {
  if (!Array.isArray(mappings)) {
    return [];
  }

  return mappings.map((mapping, index) => ({
    id: String(mapping?.id || `mapping-${index + 1}`),
    marketColumnId: String(mapping?.marketColumnId ?? ''),
    productColumnId: String(mapping?.productColumnId ?? ''),
    relation: mapping?.relation ? String(mapping.relation) : null,
  }));
}

function parseMarketAnalysisTable(text?: string | null): MarketAnalysisTable {
  try {
    return normalizeMarketAnalysisTable(JSON.parse(text ?? ''));
  } catch {
    return createEmptyMarketTable();
  }
}

function parseMarketAnalysisMappings(text?: string | null): MarketAnalysisMapping[] {
  try {
    return normalizeMarketAnalysisMappings(JSON.parse(text ?? '[]'));
  } catch {
    return [];
  }
}

function mapMarketCriteriaRow(row: any): MarketAnalysisCriteria {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    market_product_table: parseMarketAnalysisTable(row.market_product_table_json),
    product_table: parseMarketAnalysisTable(row.product_table_json),
    mapping_table: parseMarketAnalysisMappings(row.mapping_table_json),
    viability_notes: row.viability_notes ?? null,
    predicted_roi_pct: row.predicted_roi_pct != null ? Number(row.predicted_roi_pct) : null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function parseCombinationTable(text?: string | null): Record<string, string> {
  try {
    const parsed = JSON.parse(text ?? '{}');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const result: Record<string, string> = {};
      for (const [key, value] of Object.entries(parsed)) {
        result[key] = String(value ?? '');
      }
      return result;
    }
    return {};
  } catch {
    return {};
  }
}

function mapMarketAnalysisRow(row: any): MarketAnalysisRecord {
  const viability = MARKET_ANALYSIS_DECISIONS.includes(row.viability_status as MarketAnalysisDecision)
    ? row.viability_status as MarketAnalysisDecision
    : 'review';

  return {
    id: row.id,
    name: row.name,
    criteria_id: row.criteria_id,
    criteria_name: row.criteria_name,
    description: row.description ?? null,
    viability_status: viability,
    predicted_roi_pct: row.predicted_roi_pct != null ? Number(row.predicted_roi_pct) : null,
    summary: row.summary ?? null,
    combination_table: parseCombinationTable(row.combination_table_json),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export const marketAnalysisDB = {
  listCriteria(): MarketAnalysisCriteria[] {
    const rows = db.prepare('SELECT * FROM market_analysis_criteria ORDER BY updated_at DESC, name ASC').all() as any[];
    return rows.map(mapMarketCriteriaRow);
  },

  getCriteriaById(id: number): MarketAnalysisCriteria | undefined {
    const row = db.prepare('SELECT * FROM market_analysis_criteria WHERE id = ?').get(id) as any;
    return row ? mapMarketCriteriaRow(row) : undefined;
  },

  createCriteria(data: {
    name: string;
    description?: string | null;
    market_product_table?: MarketAnalysisTable;
    product_table?: MarketAnalysisTable;
    mapping_table?: MarketAnalysisMapping[];
    viability_notes?: string | null;
    predicted_roi_pct?: number | null;
  }): MarketAnalysisCriteria {
    const result = db.prepare(`
      INSERT INTO market_analysis_criteria (
        name,
        description,
        market_product_table_json,
        product_table_json,
        mapping_table_json,
        viability_notes,
        predicted_roi_pct
      )
      VALUES (
        @name,
        @description,
        @market_product_table_json,
        @product_table_json,
        @mapping_table_json,
        @viability_notes,
        @predicted_roi_pct
      )
    `).run({
      name: data.name,
      description: data.description ?? null,
      market_product_table_json: JSON.stringify(normalizeMarketAnalysisTable(data.market_product_table ?? createEmptyMarketTable())),
      product_table_json: JSON.stringify(normalizeMarketAnalysisTable(data.product_table ?? createEmptyMarketTable())),
      mapping_table_json: JSON.stringify(normalizeMarketAnalysisMappings(data.mapping_table ?? [])),
      viability_notes: data.viability_notes ?? null,
      predicted_roi_pct: data.predicted_roi_pct ?? null,
    });

    return marketAnalysisDB.getCriteriaById(Number(result.lastInsertRowid))!;
  },

  updateCriteria(
    id: number,
    data: Partial<{
      name: string;
      description: string | null;
      market_product_table: MarketAnalysisTable;
      product_table: MarketAnalysisTable;
      mapping_table: MarketAnalysisMapping[];
      viability_notes: string | null;
      predicted_roi_pct: number | null;
    }>
  ): MarketAnalysisCriteria | undefined {
    const allowed = ['name', 'description', 'market_product_table', 'product_table', 'mapping_table', 'viability_notes', 'predicted_roi_pct'];
    const entries = Object.entries(data).filter(([key]) => allowed.includes(key));
    if (entries.length === 0) {
      return marketAnalysisDB.getCriteriaById(id);
    }

    const sets = entries.map(([key]) => {
      if (key === 'market_product_table') return 'market_product_table_json = @market_product_table_json';
      if (key === 'product_table') return 'product_table_json = @product_table_json';
      if (key === 'mapping_table') return 'mapping_table_json = @mapping_table_json';
      return `${key} = @${key}`;
    }).join(', ');

    const params: Record<string, unknown> = { id };
    for (const [key, value] of entries) {
      if (key === 'market_product_table') {
        params.market_product_table_json = JSON.stringify(normalizeMarketAnalysisTable(value as MarketAnalysisTable));
      } else if (key === 'product_table') {
        params.product_table_json = JSON.stringify(normalizeMarketAnalysisTable(value as MarketAnalysisTable));
      } else if (key === 'mapping_table') {
        params.mapping_table_json = JSON.stringify(normalizeMarketAnalysisMappings(value as MarketAnalysisMapping[]));
      } else {
        params[key] = value ?? null;
      }
    }

    db.prepare(`UPDATE market_analysis_criteria SET ${sets}, updated_at = datetime('now') WHERE id = @id`).run(params);
    return marketAnalysisDB.getCriteriaById(id);
  },

  deleteCriteria(id: number): void {
    db.prepare('DELETE FROM market_analysis_criteria WHERE id = ?').run(id);
  },

  listAnalyses(): MarketAnalysisRecord[] {
    const rows = db.prepare(`
      SELECT ma.*, COALESCE(c.name, '') AS criteria_name
      FROM market_analyses ma
      LEFT JOIN market_analysis_criteria c ON c.id = ma.criteria_id
      ORDER BY ma.updated_at DESC, ma.name ASC
    `).all() as any[];

    return rows.map(mapMarketAnalysisRow);
  },

  getAnalysisById(id: number): MarketAnalysisRecord | undefined {
    const row = db.prepare(`
      SELECT ma.*, COALESCE(c.name, '') AS criteria_name
      FROM market_analyses ma
      LEFT JOIN market_analysis_criteria c ON c.id = ma.criteria_id
      WHERE ma.id = ?
    `).get(id) as any;

    return row ? mapMarketAnalysisRow(row) : undefined;
  },

  createAnalysis(data: {
    name?: string | null;
    criteria_id?: number | null;
    description?: string | null;
    viability_status?: MarketAnalysisDecision;
    predicted_roi_pct?: number | null;
    summary?: string | null;
    combination_table?: Record<string, string>;
  }): MarketAnalysisRecord {
    const viability_status = MARKET_ANALYSIS_DECISIONS.includes((data.viability_status ?? 'review') as MarketAnalysisDecision)
      ? data.viability_status ?? 'review'
      : 'review';

    const result = db.prepare(`
      INSERT INTO market_analyses (
        name,
        criteria_id,
        description,
        viability_status,
        predicted_roi_pct,
        summary,
        combination_table_json
      )
      VALUES (
        @name,
        @criteria_id,
        @description,
        @viability_status,
        @predicted_roi_pct,
        @summary,
        @combination_table_json
      )
    `).run({
      name: data.name ?? '',
      criteria_id: data.criteria_id ?? 0,
      description: data.description ?? null,
      viability_status,
      predicted_roi_pct: data.predicted_roi_pct ?? null,
      summary: data.summary ?? null,
      combination_table_json: JSON.stringify(data.combination_table ?? {}),
    });

    return marketAnalysisDB.getAnalysisById(Number(result.lastInsertRowid))!;
  },

  updateAnalysis(
    id: number,
    data: Partial<{
      name: string;
      criteria_id: number;
      description: string | null;
      viability_status: MarketAnalysisDecision;
      predicted_roi_pct: number | null;
      summary: string | null;
      combination_table: Record<string, string>;
    }>
  ): MarketAnalysisRecord | undefined {
    const allowed = ['name', 'criteria_id', 'description', 'viability_status', 'predicted_roi_pct', 'summary', 'combination_table'];
    const entries = Object.entries(data).filter(([key]) => allowed.includes(key));
    if (entries.length === 0) {
      return marketAnalysisDB.getAnalysisById(id);
    }

    const sets = entries.map(([key]) => {
      if (key === 'combination_table') return 'combination_table_json = @combination_table_json';
      return `${key} = @${key}`;
    }).join(', ');
    const params: Record<string, unknown> = { id };
    for (const [key, value] of entries) {
      if (key === 'viability_status') {
        params[key] = MARKET_ANALYSIS_DECISIONS.includes((value ?? 'review') as MarketAnalysisDecision)
          ? value
          : 'review';
      } else if (key === 'combination_table') {
        params.combination_table_json = JSON.stringify(value ?? {});
      } else {
        params[key] = value ?? null;
      }
    }

    db.prepare(`UPDATE market_analyses SET ${sets}, updated_at = datetime('now') WHERE id = @id`).run(params);
    return marketAnalysisDB.getAnalysisById(id);
  },

  deleteAnalysis(id: number): void {
    db.prepare('DELETE FROM market_analyses WHERE id = ?').run(id);
  },
};

// ─── Optimization Types ──────────────────────────────────────────────────────

export interface OptimizationInput {
  monthlyBudget: number;          // SGD budget for the planning month
  leadTimeDays: number;           // shipping lead time in days (default 28 = 4 weeks)
  serviceLevel: number;           // target service level 0-1 (default 0.95)
  holdingCostPct: number;         // monthly holding cost as % of unit cost (default 5)
  lookbackDays: number;           // days of history for demand estimation (default 90)
  releaseBoostMultiplier: number; // demand boost when release event is near (default 1.5)
  planningHorizonDays: number;    // days ahead to plan for (default 30)
}

export interface ProductOptimization {
  product_id: number;
  product_name: string;
  sku: string;
  category: string | null;
  // Size info
  length_cm: number | null;
  width_cm: number | null;
  height_cm: number | null;
  size_group: string;             // e.g. "66x91mm" or "unique"
  // Inventory
  current_stock: number;
  pending_stock: number;
  // Cost
  unit_cost_sgd: number;
  selling_price: number;
  unit_margin: number;
  margin_pct: number;
  // Demand
  demand_mean: number;            // daily units (mu)
  demand_stddev: number;          // daily units (sigma)
  demand_cv: number;              // coefficient of variation (sigma/mu)
  total_sold_period: number;
  active_selling_days: number;
  // Classification
  product_type: 'evergreen' | 'rare' | 'discontinued';
  has_upcoming_release: boolean;
  release_event_name: string | null;
  days_to_release: number | null;
  // Optimization outputs
  safety_stock: number;
  reorder_point: number;
  recommended_order_qty: number;
  order_cost: number;             // recommended_order_qty × unit_cost_sgd
  expected_profit: number;        // expected revenue - cost for the order
  priority_score: number;         // composite ranking score
  days_of_stock_left: number;     // -1 = infinite
  stockout_risk: string;          // 'critical' | 'high' | 'medium' | 'low' | 'none'
}

export interface OptimizationResult {
  generated_at: string;
  params: OptimizationInput;
  total_budget: number;
  total_allocated: number;
  budget_remaining: number;
  products: ProductOptimization[];
  size_group_summary: Array<{
    size_group: string;
    product_count: number;
    pooled_safety_stock: number;
    total_recommended: number;
    total_cost: number;
  }>;
}

// ─── Optimization Engine ─────────────────────────────────────────────────────

export const optimizationDB = {
  /**
   * Runs the full profit-optimization engine.
   *
   * Mathematical framework:
   * 1. Estimates demand distribution per product from historical sales
   * 2. Classifies products (evergreen / rare / discontinued)
   * 3. Computes safety stock using z-score × σ × √(lead_time)
   * 4. Applies Newsvendor critical ratio for rare items
   * 5. Scores products by ROI × urgency × release_boost × muda_penalty
   * 6. Allocates budget greedily by priority score
   */
  run(input: Partial<OptimizationInput> = {}): OptimizationResult {
    const params: OptimizationInput = {
      monthlyBudget: input.monthlyBudget ?? 1000,
      leadTimeDays: input.leadTimeDays ?? 28,
      serviceLevel: input.serviceLevel ?? 0.95,
      holdingCostPct: input.holdingCostPct ?? 5,
      lookbackDays: input.lookbackDays ?? 90,
      releaseBoostMultiplier: input.releaseBoostMultiplier ?? 1.5,
      planningHorizonDays: input.planningHorizonDays ?? 30,
    };

    const zScore = _normalZInverse(params.serviceLevel);
    const leadTimeInPlanUnits = params.leadTimeDays / params.planningHorizonDays;

    // 1. Fetch active products
    const allProducts = productDB.list(false);
    const stockMap = productDB.getComputedStockAll();
    const pendingMap = productDB.getPendingStockAll();

    // 2. Fetch sales history for demand estimation
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - params.lookbackDays);
    const startStr = startDate.toISOString().slice(0, 10);
    const endStr = endDate.toISOString().slice(0, 10);

    // Daily sales per product
    const dailySales = db.prepare(`
      SELECT si.product_id, date(s.sale_date) AS sale_date,
             SUM(si.quantity - si.refunded_quantity) AS qty
      FROM sale_items si
      INNER JOIN sales s ON s.id = si.sale_id
      WHERE s.status IN ('completed', 'partial_refund')
        AND s.sale_date >= ? AND s.sale_date <= ?
      GROUP BY si.product_id, date(s.sale_date)
    `).all(startStr, endStr + ' 23:59:59') as Array<{ product_id: number; sale_date: string; qty: number }>;

    // Build daily lookup per product
    const salesByProduct = new Map<number, number[]>();
    const dateSet = new Set<string>();
    const cur = new Date(startStr);
    const endD = new Date(endStr);
    while (cur <= endD) {
      dateSet.add(cur.toISOString().slice(0, 10));
      cur.setDate(cur.getDate() + 1);
    }
    const totalDays = dateSet.size || 1;

    for (const r of dailySales) {
      if (!salesByProduct.has(r.product_id)) salesByProduct.set(r.product_id, []);
      salesByProduct.get(r.product_id)!.push(r.qty);
    }

    // 3. Fetch upcoming release events (within planning horizon + lead time)
    const planHorizonEnd = new Date();
    planHorizonEnd.setDate(planHorizonEnd.getDate() + params.planningHorizonDays + params.leadTimeDays);
    const releaseEvents = releaseEventDB.list();
    const productReleaseMap = new Map<number, { name: string; daysTo: number }>();
    const todayMs = Date.now();
    for (const ev of releaseEvents) {
      const relDate = new Date(ev.release_date);
      const daysTo = Math.ceil((relDate.getTime() - todayMs) / 86400000);
      if (daysTo < -10 || daysTo > params.planningHorizonDays + params.leadTimeDays) continue;
      for (const p of ev.products) {
        const existing = productReleaseMap.get(p.id);
        if (!existing || daysTo < existing.daysTo) {
          productReleaseMap.set(p.id, { name: ev.name, daysTo });
        }
      }
    }

    // 4. Compute per-product optimization
    const optimized: ProductOptimization[] = allProducts.map(product => {
      const currentStock = stockMap.get(product.id) ?? 0;
      const pendingStock = pendingMap.get(product.id) ?? 0;
      const unitCostSGD = product.cost * (product.cost_exchange_rate || 1);
      const unitMargin = product.price - unitCostSGD;
      const marginPct = product.price > 0 ? (unitMargin / product.price) * 100 : 0;

      // Demand estimation
      const dailyQtys = salesByProduct.get(product.id) ?? [];
      const totalSold = dailyQtys.reduce((s, q) => s + q, 0);
      const activeDays = dailyQtys.length || 0;
      const demandMean = totalDays > 0 ? totalSold / totalDays : 0;    // daily average
      const demandStddev = _stddev(dailyQtys, demandMean, totalDays);
      const demandCV = demandMean > 0 ? demandStddev / demandMean : 0;

      // Size group classification
      const sizeGroup = _getSizeGroup(product);

      // Product type classification
      let productType: 'evergreen' | 'rare' | 'discontinued' = 'evergreen';
      if (!product.is_active) {
        productType = 'discontinued';
      } else if (demandCV > 2.0 || (activeDays < totalDays * 0.1 && totalSold > 0)) {
        productType = 'rare';   // very sporadic sales → likely rare product
      }

      // Release event context
      const release = productReleaseMap.get(product.id);
      const hasUpcomingRelease = !!release && release.daysTo >= 0;
      const releaseBoost = hasUpcomingRelease ? params.releaseBoostMultiplier : 1.0;

      // Adjusted demand for planning horizon (daily rate × horizon × release boost)
      const horizonDemand = demandMean * params.planningHorizonDays * releaseBoost;

      // Safety stock: z × σ_daily × √(lead_time_days) × release_boost
      let safetyStock: number;
      if (productType === 'rare') {
        // Newsvendor: critical ratio = (p - c) / (p - c + h)
        const holdingCost = unitCostSGD * (params.holdingCostPct / 100);
        const criticalRatio = unitMargin > 0
          ? unitMargin / (unitMargin + holdingCost)
          : 0.5;
        // Use Poisson-style: order up to the quantile of expected demand
        const lambda = horizonDemand;
        safetyStock = Math.ceil(_poissonQuantile(lambda, criticalRatio));
      } else {
        safetyStock = Math.ceil(zScore * demandStddev * Math.sqrt(params.leadTimeDays) * releaseBoost);
      }

      // Reorder point
      const reorderPoint = Math.ceil(demandMean * params.leadTimeDays * releaseBoost + safetyStock);

      // Recommended order quantity
      const effectiveStock = currentStock + pendingStock;
      let recommendedQty = Math.max(0, reorderPoint + Math.ceil(horizonDemand) - effectiveStock);

      // For discontinued items: only stock if profitable
      if (productType === 'discontinued') {
        recommendedQty = Math.max(0, safetyStock - effectiveStock);
      }

      const orderCost = recommendedQty * unitCostSGD;
      const expectedProfit = recommendedQty * unitMargin;

      // Days of stock left
      const daysLeft = demandMean > 0 ? effectiveStock / (demandMean * releaseBoost) : -1;

      // Stockout risk
      let stockoutRisk: string = 'none';
      if (demandMean > 0) {
        if (daysLeft >= 0 && daysLeft <= 7) stockoutRisk = 'critical';
        else if (daysLeft >= 0 && daysLeft <= 14) stockoutRisk = 'high';
        else if (daysLeft >= 0 && daysLeft <= params.leadTimeDays) stockoutRisk = 'medium';
        else stockoutRisk = 'low';
      }

      // Priority score = (margin/cost) × (demand/stock+1) × release_boost × e^(-β×overstock)
      const roi = unitCostSGD > 0 ? unitMargin / unitCostSGD : 0;
      const urgency = (horizonDemand + 1) / (effectiveStock + 1);
      const overstockRatio = effectiveStock > 0 && horizonDemand > 0
        ? Math.max(0, (effectiveStock - horizonDemand) / horizonDemand)
        : 0;
      const mudaPenalty = Math.exp(-0.5 * overstockRatio);
      const priorityScore = Math.max(0, roi * urgency * releaseBoost * mudaPenalty);

      return {
        product_id: product.id,
        product_name: product.name,
        sku: product.sku,
        category: product.category,
        length_cm: product.length_cm,
        width_cm: product.width_cm,
        height_cm: product.height_cm,
        size_group: sizeGroup,
        current_stock: currentStock,
        pending_stock: pendingStock,
        unit_cost_sgd: Math.round(unitCostSGD * 100) / 100,
        selling_price: product.price,
        unit_margin: Math.round(unitMargin * 100) / 100,
        margin_pct: Math.round(marginPct * 10) / 10,
        demand_mean: Math.round(demandMean * 1000) / 1000,
        demand_stddev: Math.round(demandStddev * 1000) / 1000,
        demand_cv: Math.round(demandCV * 100) / 100,
        total_sold_period: totalSold,
        active_selling_days: activeDays,
        product_type: productType,
        has_upcoming_release: hasUpcomingRelease,
        release_event_name: release?.name ?? null,
        days_to_release: release?.daysTo ?? null,
        safety_stock: safetyStock,
        reorder_point: reorderPoint,
        recommended_order_qty: recommendedQty,
        order_cost: Math.round(orderCost * 100) / 100,
        expected_profit: Math.round(expectedProfit * 100) / 100,
        priority_score: Math.round(priorityScore * 10000) / 10000,
        days_of_stock_left: daysLeft >= 0 ? Math.round(daysLeft * 10) / 10 : -1,
        stockout_risk: stockoutRisk,
      };
    });

    // 5. Sort by priority score descending, allocate budget greedily
    optimized.sort((a, b) => b.priority_score - a.priority_score);

    let budgetRemaining = params.monthlyBudget;
    for (const p of optimized) {
      if (p.recommended_order_qty === 0 || p.order_cost === 0) continue;
      if (p.order_cost <= budgetRemaining) {
        budgetRemaining -= p.order_cost;
      } else {
        // Partial: buy as many as budget allows
        const affordable = Math.floor(budgetRemaining / p.unit_cost_sgd);
        p.recommended_order_qty = affordable;
        p.order_cost = Math.round(affordable * p.unit_cost_sgd * 100) / 100;
        p.expected_profit = Math.round(affordable * p.unit_margin * 100) / 100;
        budgetRemaining -= p.order_cost;
      }
    }

    // 6. Size group pooling summary
    const sizeGroups = new Map<string, { products: ProductOptimization[] }>();
    for (const p of optimized) {
      if (!sizeGroups.has(p.size_group)) sizeGroups.set(p.size_group, { products: [] });
      sizeGroups.get(p.size_group)!.products.push(p);
    }

    const sizeGroupSummary = Array.from(sizeGroups.entries()).map(([group, data]) => {
      // Pooled safety stock: z × √(Σ σ²) × √(lead_time)
      const sumVariance = data.products.reduce((s, p) => s + p.demand_stddev ** 2, 0);
      const pooledSS = Math.ceil(zScore * Math.sqrt(sumVariance) * Math.sqrt(params.leadTimeDays));
      const individualSSTotal = data.products.reduce((s, p) => s + p.safety_stock, 0);
      return {
        size_group: group,
        product_count: data.products.length,
        pooled_safety_stock: pooledSS,
        individual_safety_stock_total: individualSSTotal,
        total_recommended: data.products.reduce((s, p) => s + p.recommended_order_qty, 0),
        total_cost: Math.round(data.products.reduce((s, p) => s + p.order_cost, 0) * 100) / 100,
      };
    }).sort((a, b) => b.total_cost - a.total_cost);

    const totalAllocated = params.monthlyBudget - budgetRemaining;

    return {
      generated_at: new Date().toISOString(),
      params,
      total_budget: params.monthlyBudget,
      total_allocated: Math.round(totalAllocated * 100) / 100,
      budget_remaining: Math.round(budgetRemaining * 100) / 100,
      products: optimized,
      size_group_summary: sizeGroupSummary,
    };
  },
};

// ─── Math Helpers ────────────────────────────────────────────────────────────

/** Standard deviation of daily sales (filling zero-sale days) */
function _stddev(dailyQtys: number[], dailyMean: number, totalDays: number): number {
  if (totalDays <= 1) return 0;
  // Fill zero-sale days
  const zeroDays = totalDays - dailyQtys.length;
  let sumSqDiff = 0;
  for (const q of dailyQtys) {
    sumSqDiff += (q - dailyMean) ** 2;
  }
  sumSqDiff += zeroDays * (dailyMean ** 2); // zero-sale days: (0 - mean)^2
  return Math.sqrt(sumSqDiff / (totalDays - 1));
}

/** Approximate inverse normal CDF (Beasley-Springer-Moro algorithm) */
function _normalZInverse(p: number): number {
  if (p <= 0) return -3.5;
  if (p >= 1) return 3.5;
  if (p === 0.5) return 0;

  const a = [
    -3.969683028665376e+01, 2.209460984245205e+02,
    -2.759285104469687e+02, 1.383577518672690e+02,
    -3.066479806614716e+01, 2.506628277459239e+00,
  ];
  const b = [
    -5.447609879822406e+01, 1.615858368580409e+02,
    -1.556989798598866e+02, 6.680131188771972e+01,
    -1.328068155288572e+01,
  ];
  const c = [
    -7.784894002430293e-03, -3.223964580411365e-01,
    -2.400758277161838e+00, -2.549732539343734e+00,
    4.374664141464968e+00, 2.938163982698783e+00,
  ];
  const d = [
    7.784695709041462e-03, 3.224671290700398e-01,
    2.445134137142996e+00, 3.754408661907416e+00,
  ];

  const pLow = 0.02425;
  const pHigh = 1 - pLow;

  let q: number, r: number;

  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
           ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  } else if (p <= pHigh) {
    q = p - 0.5;
    r = q * q;
    return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q /
           (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
            ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  }
}

/** Poisson quantile (inverse CDF) via cumulative probability */
function _poissonQuantile(lambda: number, p: number): number {
  if (lambda <= 0) return 0;
  let cumulativeP = 0;
  let k = 0;
  const maxK = Math.ceil(lambda + 10 * Math.sqrt(lambda)) + 50;
  let logLambda = Math.log(lambda);
  let logFactK = 0; // log(k!)

  while (k <= maxK) {
    const logPmf = k * logLambda - lambda - logFactK;
    cumulativeP += Math.exp(logPmf);
    if (cumulativeP >= p) return k;
    k++;
    logFactK += Math.log(k);
  }
  return k;
}

/** Classify product into a size group based on dimensions */
function _getSizeGroup(product: Product): string {
  const l = product.length_cm;
  const w = product.width_cm;
  const h = product.height_cm;
  if (l == null || w == null) return 'unspecified';

  // Round to nearest 0.5 for grouping
  const rl = Math.round(l * 2) / 2;
  const rw = Math.round(w * 2) / 2;

  if (h != null && h > 0.5) {
    const rh = Math.round(h * 2) / 2;
    return `${rl}×${rw}×${rh}cm`;
  }
  return `${rl}×${rw}cm`;
}

export default db;
