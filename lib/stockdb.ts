import Database from 'better-sqlite3';
import path from 'path';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Product {
  id: number;
  name: string;
  sku: string;
  description: string | null;
  price: number;          // selling price (dollars)
  cost: number;           // cost price (dollars)
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
  notes: string | null;
  status: 'completed' | 'refunded' | 'void';
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
  unit_cost: number;      // cost price snapshot at time of sale (for PnL)
  quantity: number;
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
  total_cost: number;
  status: 'received' | 'pending' | 'cancelled';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PurchaseWithItems extends Purchase {
  items: PurchaseItem[];
}

export interface PnLSummary {
  revenue: number;
  cogs: number;
  gross_profit: number;
  gross_margin_pct: number;
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
`);

// ─── Migrations ──────────────────────────────────────────────────────────────
try { db.exec('ALTER TABLE sale_items ADD COLUMN unit_cost REAL NOT NULL DEFAULT 0'); } catch { /* already exists */ }

// ─── Product DB ──────────────────────────────────────────────────────────────

export const productDB = {
  create(data: Omit<Product, 'id' | 'created_at' | 'updated_at'>): Product {
    const stmt = db.prepare(`
      INSERT INTO products (name, sku, description, price, cost, stock_quantity, category, image_url, is_active)
      VALUES (@name, @sku, @description, @price, @cost, @stock_quantity, @category, @image_url, @is_active)
    `);
    const result = stmt.run({
      ...data,
      is_active: data.is_active ? 1 : 0,
    });
    return productDB.getById(Number(result.lastInsertRowid))!;
  },

  getById(id: number): Product | undefined {
    const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as any;
    return row ? { ...row, is_active: Boolean(row.is_active) } : undefined;
  },

  list(includeInactive = false): Product[] {
    const rows = db.prepare(
      includeInactive
        ? 'SELECT * FROM products ORDER BY name ASC'
        : 'SELECT * FROM products WHERE is_active = 1 ORDER BY name ASC'
    ).all() as any[];
    return rows.map(r => ({ ...r, is_active: Boolean(r.is_active) }));
  },

  update(id: number, data: Partial<Omit<Product, 'id' | 'created_at' | 'updated_at'>>): Product | undefined {
    const allowed = ['name', 'sku', 'description', 'price', 'cost', 'stock_quantity', 'category', 'image_url', 'is_active'];
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

  adjustStock(id: number, delta: number): void {
    db.prepare('UPDATE products SET stock_quantity = stock_quantity + ?, updated_at = datetime(\'now\') WHERE id = ?').run(delta, id);
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
    opts: { discount?: number; tax?: number; notes?: string; sale_date?: string } = {}
  ): SaleWithItems {
    const subtotal = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
    const discount = opts.discount ?? 0;
    const tax = opts.tax ?? 0;
    const total = subtotal - discount + tax;

    const insertSale = db.transaction(() => {
      const saleStmt = db.prepare(`
        INSERT INTO sales (invoice_number, sale_date, subtotal, discount, tax, total, notes, status)
        VALUES (@invoice_number, @sale_date, @subtotal, @discount, @tax, @total, @notes, 'completed')
      `);
      const saleResult = saleStmt.run({
        invoice_number: generateInvoiceNumber(),
        sale_date: opts.sale_date ?? new Date().toISOString().replace('T', ' ').slice(0, 19),
        subtotal,
        discount,
        tax,
        total,
        notes: opts.notes ?? null,
      });
      const saleId = Number(saleResult.lastInsertRowid);

      const itemStmt = db.prepare(`
        INSERT INTO sale_items (sale_id, product_id, product_name, product_sku, unit_price, unit_cost, quantity, line_total)
        VALUES (@sale_id, @product_id, @product_name, @product_sku, @unit_price, @unit_cost, @quantity, @line_total)
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
          quantity: item.quantity,
          line_total: item.unit_price * item.quantity,
        });
        productDB.adjustStock(item.product_id, -item.quantity);
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

  update(id: number, data: { notes?: string; discount?: number; tax?: number; sale_date?: string; status?: string }): SaleWithItems | undefined {
    const allowed = ['notes', 'discount', 'tax', 'sale_date', 'status'];
    const entries = Object.entries(data).filter(([k]) => allowed.includes(k));
    if (entries.length === 0) return saleDB.getById(id);
    const sets = entries.map(([k]) => `${k} = @${k}`).join(', ');
    const params: any = Object.fromEntries(entries);
    params.id = id;
    // Recalculate total if financials changed
    const existing = saleDB.getById(id);
    if (!existing) return undefined;
    const discount = data.discount ?? existing.discount;
    const tax = data.tax ?? existing.tax;
    params.total = existing.subtotal - discount + tax;
    db.prepare(`UPDATE sales SET ${sets}, total = @total, updated_at = datetime('now') WHERE id = @id`).run(params);
    return saleDB.getById(id);
  },

  updateStatus(id: number, status: 'completed' | 'refunded' | 'void'): void {
    const sale = saleDB.getById(id);
    if (!sale) return;
    // If voiding/refunding, restore stock
    if ((status === 'refunded' || status === 'void') && sale.status === 'completed') {
      for (const item of sale.items) {
        productDB.adjustStock(item.product_id, item.quantity);
      }
    }
    db.prepare("UPDATE sales SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, id);
  },

  delete(id: number): void {
    const sale = saleDB.getById(id);
    if (sale && sale.status === 'completed') {
      for (const item of sale.items) {
        productDB.adjustStock(item.product_id, item.quantity);
      }
    }
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
    opts: { discount?: number; tax?: number; notes?: string; purchase_date?: string; invoice_ref?: string; status?: string } = {}
  ): PurchaseWithItems {
    const subtotal = items.reduce((s, i) => s + i.unit_cost * i.quantity, 0);
    const discount = opts.discount ?? 0;
    const tax = opts.tax ?? 0;
    const total_cost = subtotal - discount + tax;
    const status = opts.status ?? 'received';

    const run = db.transaction(() => {
      const purchaseResult = db.prepare(`
        INSERT INTO purchases (supplier_id, purchase_date, invoice_ref, subtotal, discount, tax, total_cost, notes, status)
        VALUES (@supplier_id, @purchase_date, @invoice_ref, @subtotal, @discount, @tax, @total_cost, @notes, @status)
      `).run({
        supplier_id,
        purchase_date: opts.purchase_date ?? new Date().toISOString().replace('T', ' ').slice(0, 19),
        invoice_ref: opts.invoice_ref?.trim() || generatePurchaseRef(),
        subtotal, discount, tax, total_cost,
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
        // On receive: add stock + update product cost to latest purchase cost
        if (status === 'received') {
          productDB.adjustStock(item.product_id, item.quantity);
          productDB.update(item.product_id, { cost: item.unit_cost });
        }
      }
      return purchaseDB.getById(purchaseId)!;
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
    if (status === 'cancelled' && purchase.status === 'received') {
      for (const item of purchase.items) productDB.adjustStock(item.product_id, -item.quantity);
    }
    if (status === 'received' && purchase.status === 'pending') {
      for (const item of purchase.items) {
        productDB.adjustStock(item.product_id, item.quantity);
        productDB.update(item.product_id, { cost: item.unit_cost });
      }
    }
    db.prepare("UPDATE purchases SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, id);
  },

  delete(id: number): void {
    const purchase = purchaseDB.getById(id);
    if (purchase?.status === 'received') {
      for (const item of purchase.items) productDB.adjustStock(item.product_id, -item.quantity);
    }
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
      SELECT COALESCE(SUM(si.unit_cost * si.quantity), 0) AS cogs
      FROM sale_items si
      INNER JOIN sales s ON s.id = si.sale_id
      WHERE s.status = 'completed' AND s.sale_date >= ? AND s.sale_date <= ?
    `).get(startDate, end) as any;
    const purchaseRow = db.prepare(`
      SELECT COALESCE(SUM(total_cost), 0) AS purchase_spend, COUNT(*) AS purchase_count
      FROM purchases WHERE status = 'received' AND purchase_date >= ? AND purchase_date <= ?
    `).get(startDate, end) as any;

    const revenue = revenueRow.revenue;
    const cogs = cogsRow.cogs;
    const gross_profit = revenue - cogs;
    return {
      revenue, cogs, gross_profit,
      gross_margin_pct: revenue > 0 ? (gross_profit / revenue) * 100 : 0,
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
        SELECT sale_id, SUM(unit_cost * quantity) AS item_cogs FROM sale_items GROUP BY sale_id
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
        SUM(si.unit_cost * si.quantity)               AS cogs,
        SUM(si.line_total) - SUM(si.unit_cost * si.quantity) AS gross_profit
      FROM sale_items si
      INNER JOIN sales s ON s.id = si.sale_id
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

export default db;
