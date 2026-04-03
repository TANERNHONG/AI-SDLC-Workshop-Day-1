export const STOCK_THEME_VALUES = [
  'default',
  'dark',
  'warm',
  'pastel',
  'green-dark',
  'blue-dark',
  'modern',
  'minimalistic',
] as const;

export type StockTheme = (typeof STOCK_THEME_VALUES)[number];

export const STOCK_FONT_VALUES = [
  'inter',
  'system',
  'manrope',
  'dm-sans',
  'space-grotesk',
  'serif',
] as const;

export type StockFont = (typeof STOCK_FONT_VALUES)[number];

export const DEFAULT_STOCK_THEME: StockTheme = 'default';
export const DEFAULT_STOCK_FONT: StockFont = 'inter';

export const STOCK_THEME_OPTIONS: Array<{
  value: StockTheme;
  label: string;
  description: string;
  preview: string;
}> = [
  {
    value: 'default',
    label: 'Light',
    description: 'Bright neutral workspace with indigo accents.',
    preview: 'linear-gradient(135deg, #f8fafc 0%, #e0e7ff 55%, #4f46e5 100%)',
  },
  {
    value: 'dark',
    label: 'Dark',
    description: 'Low-glare dark canvas with cool violet highlights.',
    preview: 'linear-gradient(135deg, #111827 0%, #1f2937 55%, #818cf8 100%)',
  },
  {
    value: 'warm',
    label: 'Warm',
    description: 'Soft cream surfaces with amber accents.',
    preview: 'linear-gradient(135deg, #fff7ed 0%, #fde68a 50%, #d97706 100%)',
  },
  {
    value: 'pastel',
    label: 'Pastel',
    description: 'Lavender-tinted surfaces with soft contrast.',
    preview: 'linear-gradient(135deg, #fdf4ff 0%, #ede9fe 55%, #8b5cf6 100%)',
  },
  {
    value: 'green-dark',
    label: 'Green with Dark Accents',
    description: 'Fresh green workspace anchored by deep emerald navigation.',
    preview: 'linear-gradient(135deg, #ecfdf5 0%, #bbf7d0 52%, #14532d 100%)',
  },
  {
    value: 'blue-dark',
    label: 'Blue with Dark Accents',
    description: 'Airy blue canvas with a structured navy sidebar.',
    preview: 'linear-gradient(135deg, #eff6ff 0%, #bfdbfe 52%, #1e3a5f 100%)',
  },
  {
    value: 'modern',
    label: 'Modern',
    description: 'Editorial contrast with a dark shell and bright content area.',
    preview: 'linear-gradient(135deg, #fafafa 0%, #f5f3ff 52%, #18181b 100%)',
  },
  {
    value: 'minimalistic',
    label: 'Minimalistic',
    description: 'Clean monochrome palette with restrained contrast.',
    preview: 'linear-gradient(135deg, #ffffff 0%, #f5f5f5 52%, #262626 100%)',
  },
];

export const STOCK_FONT_OPTIONS: Array<{
  value: StockFont;
  label: string;
  description: string;
  previewFamily: string;
}> = [
  {
    value: 'inter',
    label: 'Inter',
    description: 'Balanced default for dense dashboards.',
    previewFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  {
    value: 'system',
    label: 'System UI',
    description: 'Native OS typography with maximum familiarity.',
    previewFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  {
    value: 'manrope',
    label: 'Manrope',
    description: 'Softer rounded sans for a friendlier feel.',
    previewFamily: "'Manrope', 'Inter', sans-serif",
  },
  {
    value: 'dm-sans',
    label: 'DM Sans',
    description: 'Compact geometric sans with clear numerals.',
    previewFamily: "'DM Sans', 'Inter', sans-serif",
  },
  {
    value: 'space-grotesk',
    label: 'Space Grotesk',
    description: 'Sharper display-style sans for a modern look.',
    previewFamily: "'Space Grotesk', 'Inter', sans-serif",
  },
  {
    value: 'serif',
    label: 'Serif',
    description: 'Classic editorial tone for long-form reading.',
    previewFamily: "'Georgia', 'Cambria', 'Times New Roman', serif",
  },
];

function isStockTheme(value: string | null): value is StockTheme {
  return Boolean(value) && STOCK_THEME_VALUES.includes(value as StockTheme);
}

function isStockFont(value: string | null): value is StockFont {
  return Boolean(value) && STOCK_FONT_VALUES.includes(value as StockFont);
}

export function readStoredStockTheme(): StockTheme {
  if (typeof window === 'undefined') {
    return DEFAULT_STOCK_THEME;
  }

  const value = window.localStorage.getItem('stockcheck-theme');
  return isStockTheme(value) ? value : DEFAULT_STOCK_THEME;
}

export function readStoredStockFont(): StockFont {
  if (typeof window === 'undefined') {
    return DEFAULT_STOCK_FONT;
  }

  const value = window.localStorage.getItem('stockcheck-font');
  return isStockFont(value) ? value : DEFAULT_STOCK_FONT;
}

export function applyStockTheme(theme: StockTheme) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem('stockcheck-theme', theme);

  const root = document.documentElement;
  root.classList.remove('dark');
  root.removeAttribute('data-theme');

  if (theme === 'dark') {
    root.classList.add('dark');
    root.setAttribute('data-theme', theme);
    return;
  }

  if (theme !== DEFAULT_STOCK_THEME) {
    root.setAttribute('data-theme', theme);
  }
}

export function applyStockFont(font: StockFont) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem('stockcheck-font', font);
  document.documentElement.setAttribute('data-font', font);
}