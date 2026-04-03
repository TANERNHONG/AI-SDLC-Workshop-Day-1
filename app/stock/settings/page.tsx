'use client';

import { useEffect, useState } from 'react';
import {
  DEFAULT_STOCK_FONT,
  DEFAULT_STOCK_THEME,
  STOCK_FONT_OPTIONS,
  STOCK_THEME_OPTIONS,
  applyStockFont,
  applyStockTheme,
  readStoredStockFont,
  readStoredStockTheme,
  type StockFont,
  type StockTheme,
} from '@/lib/stock-ui-preferences';

export default function StockSettingsPage() {
  const [theme, setTheme] = useState<StockTheme>(DEFAULT_STOCK_THEME);
  const [font, setFont] = useState<StockFont>(DEFAULT_STOCK_FONT);

  useEffect(() => {
    setTheme(readStoredStockTheme());
    setFont(readStoredStockFont());
  }, []);

  function handleThemeChange(nextTheme: StockTheme) {
    setTheme(nextTheme);
    applyStockTheme(nextTheme);
  }

  function handleFontChange(nextFont: StockFont) {
    setFont(nextFont);
    applyStockFont(nextFont);
  }

  function resetAppearance() {
    handleThemeChange(DEFAULT_STOCK_THEME);
    handleFontChange(DEFAULT_STOCK_FONT);
  }

  const activeFontPreview = STOCK_FONT_OPTIONS.find((option) => option.value === font)?.previewFamily
    ?? STOCK_FONT_OPTIONS[0].previewFamily;

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border px-6 py-7 shadow-sm sm:px-8" style={{ background: 'var(--card-bg)', borderColor: 'var(--border-color)' }}>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="max-w-2xl space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: 'var(--text-muted)' }}>
              Settings
            </p>
            <h1 className="text-3xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              Appearance
            </h1>
            <p className="text-sm leading-6" style={{ color: 'var(--text-body)' }}>
              Tune the stock workspace with saved color palettes and typography. Changes apply immediately and are stored in this browser.
            </p>
          </div>

          <button
            type="button"
            onClick={resetAppearance}
            className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition-colors"
            style={{
              background: 'var(--sidebar-active-bg)',
              color: 'var(--sidebar-active-text)',
              border: '1px solid var(--border-color)',
            }}
          >
            Reset to defaults
          </button>
        </div>
      </section>

      <section className="grid gap-8 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-8">
          <div className="rounded-3xl border p-6 shadow-sm" style={{ background: 'var(--card-bg)', borderColor: 'var(--border-color)' }}>
            <div className="mb-5 space-y-1">
              <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>Color Themes</h2>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Choose from the original Light, Dark, Warm, and Pastel palettes plus the new Green, Blue, Modern, and Minimalistic variants.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {STOCK_THEME_OPTIONS.map((option) => {
                const isActive = option.value === theme;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleThemeChange(option.value)}
                    className="rounded-2xl border p-4 text-left transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md"
                    style={{
                      background: isActive ? 'var(--badge-active)' : 'var(--card-bg)',
                      borderColor: isActive ? 'var(--accent-primary)' : 'var(--border-color)',
                      boxShadow: isActive ? '0 0 0 1px var(--accent-primary)' : 'none',
                    }}
                  >
                    <div className="mb-4 h-20 rounded-xl border" style={{ background: option.preview, borderColor: 'var(--border-color)' }} />
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{option.label}</h3>
                        <p className="text-xs leading-5" style={{ color: 'var(--text-secondary)' }}>{option.description}</p>
                      </div>
                      {isActive && (
                        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-[11px] font-semibold"
                          style={{ background: 'var(--accent-primary)', color: '#ffffff' }}>
                          Live
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-3xl border p-6 shadow-sm" style={{ background: 'var(--card-bg)', borderColor: 'var(--border-color)' }}>
            <div className="mb-5 space-y-1">
              <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>Typography</h2>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Switch the main interface font. Every card, table, and settings screen updates immediately.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {STOCK_FONT_OPTIONS.map((option) => {
                const isActive = option.value === font;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleFontChange(option.value)}
                    className="rounded-2xl border p-4 text-left transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md"
                    style={{
                      background: isActive ? 'var(--badge-active)' : 'var(--card-bg)',
                      borderColor: isActive ? 'var(--accent-primary)' : 'var(--border-color)',
                      boxShadow: isActive ? '0 0 0 1px var(--accent-primary)' : 'none',
                    }}
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{option.label}</h3>
                          <p className="text-xs leading-5" style={{ color: 'var(--text-secondary)' }}>{option.description}</p>
                        </div>
                        {isActive && (
                          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-[11px] font-semibold"
                            style={{ background: 'var(--accent-primary)', color: '#ffffff' }}>
                            Live
                          </span>
                        )}
                      </div>
                      <div className="rounded-xl border px-3 py-4" style={{ borderColor: 'var(--border-color)', background: 'var(--panel-bg)' }}>
                        <p className="text-lg font-semibold" style={{ color: 'var(--text-primary)', fontFamily: option.previewFamily }}>
                          Abc 123
                        </p>
                        <p className="text-sm" style={{ color: 'var(--text-body)', fontFamily: option.previewFamily }}>
                          Orders, revenue, and stock sync.
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <aside className="rounded-3xl border p-6 shadow-sm" style={{ background: 'var(--card-bg)', borderColor: 'var(--border-color)' }}>
          <div className="space-y-1">
            <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>Live Preview</h2>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Confirm how your current palette and font pair look together before moving back to operations.
            </p>
          </div>

          <div className="mt-6 rounded-3xl border p-5" style={{ background: 'var(--panel-bg)', borderColor: 'var(--border-color)' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.25em]" style={{ color: 'var(--text-muted)', fontFamily: activeFontPreview }}>
                  Business Snapshot
                </p>
                <h3 className="mt-2 text-2xl font-semibold" style={{ color: 'var(--text-primary)', fontFamily: activeFontPreview }}>
                  SGD 48,320
                </h3>
              </div>
              <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ background: 'var(--badge-active)', color: 'var(--badge-active-text)', fontFamily: activeFontPreview }}>
                +18.4%
              </span>
            </div>

            <div className="mt-5 grid gap-3">
              {[
                { label: 'Orders this week', value: '182' },
                { label: 'Low-stock alerts', value: '7' },
                { label: 'Average order value', value: 'SGD 265' },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between rounded-2xl border px-4 py-3"
                  style={{ background: 'var(--card-bg)', borderColor: 'var(--border-color)' }}>
                  <span className="text-sm" style={{ color: 'var(--text-body)', fontFamily: activeFontPreview }}>{row.label}</span>
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)', fontFamily: activeFontPreview }}>{row.value}</span>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-2xl px-4 py-4" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
              <p className="text-xs uppercase tracking-[0.25em]" style={{ color: 'var(--text-muted)', fontFamily: activeFontPreview }}>
                Sample copy
              </p>
              <p className="mt-2 text-sm leading-6" style={{ color: 'var(--text-body)', fontFamily: activeFontPreview }}>
                Ship faster, review margins earlier, and keep every operational view aligned with the visual style your team prefers.
              </p>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}