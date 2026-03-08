import type { Metadata } from 'next';
import StockShell from './StockShell';

export const metadata: Metadata = {
  title: 'StockCheck — Inventory & Sales',
  description: 'Modern stock check and sales management app',
};

export default function StockLayout({ children }: { children: React.ReactNode }) {
  return <StockShell>{children}</StockShell>;
}
