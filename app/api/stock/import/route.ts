import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

// ─── Template Download ────────────────────────────────────────────────────────
// GET /api/stock/import?template=sales|purchases

const SALES_HEADERS = [
  'sale_date',       // YYYY-MM-DD or YYYY-MM-DD HH:MM:SS
  'channel',         // direct | carousell | shopee | lazada | telegram
  'product_sku',     // must match an existing product SKU
  'quantity',        // positive integer
  'unit_price',      // positive number
  'discount',        // number >= 0 (order-level, shared across items)
  'tax',             // number >= 0 (order-level, shared across items)
  'notes',           // optional text
];

const PURCHASES_HEADERS = [
  'purchase_date',   // YYYY-MM-DD or YYYY-MM-DD HH:MM:SS
  'supplier_name',   // must match an existing active supplier name
  'product_sku',     // must match an existing product SKU
  'quantity',        // positive integer
  'unit_cost',       // positive number
  'discount',        // number >= 0
  'tax',             // number >= 0
  'invoice_ref',     // optional
  'notes',           // optional text
];

const SALES_EXAMPLE = {
  sale_date: '2026-03-08 14:30:00',
  channel: 'shopee',
  product_sku: 'SKU-001',
  quantity: 2,
  unit_price: 29.90,
  discount: 0,
  tax: 0,
  notes: 'Online order',
};

const PURCHASES_EXAMPLE = {
  purchase_date: '2026-03-08',
  supplier_name: 'My Supplier',
  product_sku: 'SKU-001',
  quantity: 10,
  unit_cost: 12.00,
  discount: 0,
  tax: 0,
  invoice_ref: 'PO-001',
  notes: '',
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const templateType = searchParams.get('template');

  if (templateType === 'sales') {
    const ws = XLSX.utils.json_to_sheet([SALES_EXAMPLE], { header: SALES_HEADERS });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sales Import');
    const rawSales = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const blobSales = new Blob([Buffer.from(rawSales)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    return new NextResponse(blobSales, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="sales-import-template.xlsx"',
      },
    });
  }

  if (templateType === 'purchases') {
    const ws = XLSX.utils.json_to_sheet([PURCHASES_EXAMPLE], { header: PURCHASES_HEADERS });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Purchases Import');
    const rawPur = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const blobPur = new Blob([Buffer.from(rawPur)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    return new NextResponse(blobPur, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="purchases-import-template.xlsx"',
      },
    });
  }

  return NextResponse.json({
    templates: [
      { type: 'sales',     url: '/api/stock/import?template=sales' },
      { type: 'purchases', url: '/api/stock/import?template=purchases' },
    ],
  });
}

// ─── Import Handler ───────────────────────────────────────────────────────────
// POST /api/stock/import?type=sales|purchases  multipart/form-data  field: file

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') ?? 'sales';

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Input malformed', details: ['No file uploaded'] }, { status: 400 });
    }

    const ext = file.name.split('.').pop()?.toLowerCase();
    let rows: Record<string, unknown>[];

    if (ext === 'json') {
      const text = await file.text();
      try {
        const parsed = JSON.parse(text);
        rows = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        return NextResponse.json({ error: 'Input malformed', details: ['JSON file could not be parsed'] }, { status: 400 });
      }
    } else if (ext === 'xlsx' || ext === 'xls') {
      const arrayBuf = await file.arrayBuffer();
      const wb = XLSX.read(arrayBuf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[];
    } else {
      return NextResponse.json({ error: 'Input malformed', details: ['File must be .xlsx, .xls, or .json'] }, { status: 400 });
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'Input malformed', details: ['File contains no data rows'] }, { status: 400 });
    }

    if (type === 'sales') return importSales(rows);
    if (type === 'purchases') return importPurchases(rows);

    return NextResponse.json({ error: 'Invalid type. Use: sales or purchases' }, { status: 400 });

  } catch (err: any) {
    return NextResponse.json({ error: 'Import failed', details: [err?.message ?? 'Unknown error'] }, { status: 500 });
  }
}

// ─── Sales Import ─────────────────────────────────────────────────────────────

async function importSales(rows: Record<string, unknown>[]) {
  // Lazy-import DB to avoid circular issues
  const { saleDB, productDB } = await import('@/lib/stockdb');

  const REQUIRED = ['sale_date', 'product_sku', 'quantity', 'unit_price'];
  const VALID_CHANNELS = ['direct', 'carousell', 'shopee', 'lazada', 'telegram'];

  const errors: string[] = [];

  // Validate all rows first
  rows.forEach((row, idx) => {
    const r = idx + 2; // 1-indexed + header row
    for (const field of REQUIRED) {
      if (row[field] === undefined || row[field] === null || row[field] === '') {
        errors.push(`Row ${r}: missing required field "${field}"`);
      }
    }
    if (row.quantity !== undefined && (isNaN(Number(row.quantity)) || Number(row.quantity) <= 0)) {
      errors.push(`Row ${r}: "quantity" must be a positive number`);
    }
    if (row.unit_price !== undefined && (isNaN(Number(row.unit_price)) || Number(row.unit_price) < 0)) {
      errors.push(`Row ${r}: "unit_price" must be >= 0`);
    }
    if (row.channel && !VALID_CHANNELS.includes(String(row.channel).toLowerCase())) {
      errors.push(`Row ${r}: "channel" must be one of: ${VALID_CHANNELS.join(', ')}`);
    }
    if (row.product_sku) {
      const product = productDB.list(true).find(p => p.sku === String(row.product_sku));
      if (!product) errors.push(`Row ${r}: product with SKU "${row.product_sku}" not found`);
    }
  });

  if (errors.length > 0) {
    return NextResponse.json({ error: 'Input malformed', details: errors }, { status: 400 });
  }

  // Group rows by sale_date + channel + notes (treat each unique group as one sale)
  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = `${row.sale_date}|${row.channel ?? 'direct'}|${row.notes ?? ''}|${row.discount ?? 0}|${row.tax ?? 0}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }

  const allProducts = productDB.list(true);
  let importedCount = 0;

  for (const [, groupRows] of groups) {
    const first = groupRows[0];
    const items = groupRows.map(row => {
      const product = allProducts.find(p => p.sku === String(row.product_sku))!;
      return {
        product_id: product.id,
        quantity:   Math.round(Number(row.quantity)),
        unit_price: Number(row.unit_price),
      };
    });

    saleDB.create(items, {
      sale_date: String(first.sale_date),
      channel:   first.channel ? String(first.channel).toLowerCase() : 'direct',
      discount:  Number(first.discount ?? 0),
      tax:       Number(first.tax ?? 0),
      notes:     first.notes ? String(first.notes) : undefined,
    });
    importedCount++;
  }

  return NextResponse.json({ success: true, imported: importedCount, message: `${importedCount} sale(s) imported` });
}

// ─── Purchases Import ─────────────────────────────────────────────────────────

async function importPurchases(rows: Record<string, unknown>[]) {
  const { purchaseDB, productDB, supplierDB } = await import('@/lib/stockdb');

  const REQUIRED = ['purchase_date', 'supplier_name', 'product_sku', 'quantity', 'unit_cost'];

  const errors: string[] = [];
  const allSuppliers = supplierDB.list(true);
  const allProducts  = productDB.list(true);

  rows.forEach((row, idx) => {
    const r = idx + 2;
    for (const field of REQUIRED) {
      if (row[field] === undefined || row[field] === null || row[field] === '') {
        errors.push(`Row ${r}: missing required field "${field}"`);
      }
    }
    if (row.quantity !== undefined && (isNaN(Number(row.quantity)) || Number(row.quantity) <= 0)) {
      errors.push(`Row ${r}: "quantity" must be a positive number`);
    }
    if (row.unit_cost !== undefined && (isNaN(Number(row.unit_cost)) || Number(row.unit_cost) < 0)) {
      errors.push(`Row ${r}: "unit_cost" must be >= 0`);
    }
    if (row.supplier_name) {
      const supplier = allSuppliers.find(s => s.name === String(row.supplier_name));
      if (!supplier) errors.push(`Row ${r}: supplier "${row.supplier_name}" not found (add it first)`);
    }
    if (row.product_sku) {
      const product = allProducts.find(p => p.sku === String(row.product_sku));
      if (!product) errors.push(`Row ${r}: product with SKU "${row.product_sku}" not found`);
    }
  });

  if (errors.length > 0) {
    return NextResponse.json({ error: 'Input malformed', details: errors }, { status: 400 });
  }

  // Group by purchase_date + supplier + invoice_ref
  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = `${row.purchase_date}|${row.supplier_name}|${row.invoice_ref ?? ''}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }

  let importedCount = 0;

  for (const [, groupRows] of groups) {
    const first = groupRows[0];
    const supplier = allSuppliers.find(s => s.name === String(first.supplier_name))!;
    const items = groupRows.map(row => {
      const product = allProducts.find(p => p.sku === String(row.product_sku))!;
      return {
        product_id: product.id,
        quantity:   Math.round(Number(row.quantity)),
        unit_cost:  Number(row.unit_cost),
      };
    });

    purchaseDB.create(supplier.id, items, {
      purchase_date: String(first.purchase_date),
      invoice_ref:   first.invoice_ref ? String(first.invoice_ref) : undefined,
      discount:      Number(first.discount ?? 0),
      tax:           Number(first.tax ?? 0),
      notes:         first.notes ? String(first.notes) : undefined,
      status:        'received',
    });
    importedCount++;
  }

  return NextResponse.json({ success: true, imported: importedCount, message: `${importedCount} purchase order(s) imported` });
}
