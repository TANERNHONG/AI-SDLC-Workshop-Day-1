import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { saleDB, purchaseDB, pnlDB } from '@/lib/stockdb';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toExcelBlob(sheetData: Record<string, unknown>[], sheetName: string): Blob {
  const ws = XLSX.utils.json_to_sheet(sheetData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  // xlsx returns Uint8Array<ArrayBufferLike>; Buffer.from converts to a proper Blob-compatible type
  const raw = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  const safe = Buffer.from(raw);
  return new Blob([safe], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

// ─── Export Handler ───────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type   = searchParams.get('type')   ?? 'sales';
  const format = searchParams.get('format') ?? 'json';
  const startDate = searchParams.get('startDate') ?? '';
  const endDate   = searchParams.get('endDate')   ?? '';

  try {
    // ── Sales export ──────────────────────────────────────────────────────────
    if (type === 'sales') {
      const sales = saleDB.list({ startDate: startDate || undefined, endDate: endDate || undefined });

      // Flatten sales to rows
      const rows = sales.flatMap(sale =>
        sale.items.map(item => ({
          invoice_number: sale.invoice_number,
          sale_date:      sale.sale_date,
          channel:        sale.channel ?? 'direct',
          status:         sale.status,
          product_name:   item.product_name,
          product_sku:    item.product_sku,
          quantity:       item.quantity,
          unit_price:     item.unit_price,
          line_total:     item.line_total,
          discount:       sale.discount,
          tax:            sale.tax,
          sale_total:     sale.total,
          notes:          sale.notes ?? '',
        }))
      );

      if (format === 'excel') {
        const blob = toExcelBlob(rows, 'Sales');
        return new NextResponse(blob, {
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': 'attachment; filename="sales-export.xlsx"',
          },
        });
      }
      return NextResponse.json(rows);
    }

    // ── Purchases export ──────────────────────────────────────────────────────
    if (type === 'purchases') {
      const purchases = purchaseDB.list({ startDate: startDate || undefined, endDate: endDate || undefined });

      const rows = purchases.flatMap(po =>
        po.items.map(item => ({
          invoice_ref:    po.invoice_ref ?? '',
          purchase_date:  po.purchase_date,
          supplier_name:  po.supplier_name,
          status:         po.status,
          product_name:   item.product_name,
          product_sku:    item.product_sku,
          quantity:       item.quantity,
          unit_cost:      item.unit_cost,
          line_total:     item.line_total,
          discount:       po.discount,
          tax:            po.tax,
          po_total:       po.total_cost,
          notes:          po.notes ?? '',
        }))
      );

      if (format === 'excel') {
        const blob = toExcelBlob(rows, 'Purchases');
        return new NextResponse(blob, {
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': 'attachment; filename="purchases-export.xlsx"',
          },
        });
      }
      return NextResponse.json(rows);
    }

    // ── P&L export ────────────────────────────────────────────────────────────
    if (type === 'pnl') {
      if (!startDate || !endDate) {
        return NextResponse.json({ error: 'startDate and endDate are required for P&L export' }, { status: 400 });
      }

      const summary  = pnlDB.getSummary(startDate, endDate);
      const daily    = pnlDB.getDailyPnL(startDate, endDate);
      const products = pnlDB.getProductPnL(startDate, endDate);

      if (format === 'excel') {
        const summaryRows = [{
          revenue:           summary.revenue,
          cogs:              summary.cogs,
          gross_profit:      summary.gross_profit,
          gross_margin_pct:  summary.gross_margin_pct,
          purchase_spend:    summary.purchase_spend,
          order_count:       summary.order_count,
          purchase_count:    summary.purchase_count,
          period_start:      startDate,
          period_end:        endDate,
        }];

        const wbSummary  = XLSX.utils.json_to_sheet(summaryRows);
        const wbDaily    = XLSX.utils.json_to_sheet(daily);
        const wbProducts = XLSX.utils.json_to_sheet(products);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, wbSummary,  'Summary');
        XLSX.utils.book_append_sheet(wb, wbDaily,    'Daily');
        XLSX.utils.book_append_sheet(wb, wbProducts, 'Products');
        const rawPnl = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
        const blob = new Blob([Buffer.from(rawPnl)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

        return new NextResponse(blob, {
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': 'attachment; filename="pnl-export.xlsx"',
          },
        });
      }

      return NextResponse.json({ summary, daily, products });
    }

    return NextResponse.json({ error: 'Invalid type. Use: sales, purchases, pnl' }, { status: 400 });

  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Export failed' }, { status: 500 });
  }
}
