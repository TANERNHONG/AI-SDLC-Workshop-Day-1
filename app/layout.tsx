import type { Metadata } from 'next';
import './globals.css';
import {
  DEFAULT_STOCK_FONT,
  DEFAULT_STOCK_THEME,
  STOCK_FONT_VALUES,
  STOCK_THEME_VALUES,
} from '@/lib/stock-ui-preferences';

export const metadata: Metadata = {
  title: 'Todo App - Modern Task Management',
  description: 'Feature-rich todo application with WebAuthn authentication',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const themeValues = JSON.stringify(STOCK_THEME_VALUES);
  const fontValues = JSON.stringify(STOCK_FONT_VALUES);

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Inter:wght@300;400;500;600;700&family=Manrope:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var validThemes = ${themeValues};
                  var validFonts = ${fontValues};
                  var theme = localStorage.getItem('stockcheck-theme');
                  var font = localStorage.getItem('stockcheck-font');

                  if (!validThemes.includes(theme)) {
                    theme = ${JSON.stringify(DEFAULT_STOCK_THEME)};
                  }

                  if (!validFonts.includes(font)) {
                    font = ${JSON.stringify(DEFAULT_STOCK_FONT)};
                  }

                  document.documentElement.classList.remove('dark');
                  document.documentElement.removeAttribute('data-theme');
                  document.documentElement.setAttribute('data-font', font);

                  if (theme === 'dark') {
                    document.documentElement.classList.add('dark');
                    document.documentElement.setAttribute('data-theme', 'dark');
                  } else if (theme !== 'default') {
                    document.documentElement.setAttribute('data-theme', theme);
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
