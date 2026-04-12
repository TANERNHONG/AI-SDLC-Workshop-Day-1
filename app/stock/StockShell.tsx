'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/* ── Categorised navigation ─────────────────────────────────────────────── */

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

interface NavGroup {
  key: string;
  title: string;
  icon: React.ReactNode;
  items: NavItem[];
}

const DASHBOARD_ITEM: NavItem = {
  href: '/stock',
  label: 'Dashboard',
  icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
};

const NAV_GROUPS: NavGroup[] = [
  {
    key: 'operations',
    title: 'Operations',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
    items: [
      {
        href: '/stock/calendar',
        label: 'Calendar',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        ),
      },
      {
        href: '/stock/shipping',
        label: 'Shipping',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 7h12l-4 9H8l-4-9h4m0 0V4m0 3H4m4 9a2 2 0 100 4 2 2 0 000-4zm8 0a2 2 0 100 4 2 2 0 000-4z" />
          </svg>
        ),
      },
      {
        href: '/stock/couriers',
        label: 'Couriers',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
          </svg>
        ),
      },
      {
        href: '/stock/messages',
        label: 'Messages',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        ),
      },
    ],
  },
  {
    key: 'books',
    title: 'Books',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
    items: [
      {
        href: '/stock/sales',
        label: 'Sales',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
        ),
      },
      {
        href: '/stock/purchases',
        label: 'Purchases',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        ),
      },
    ],
  },
  {
    key: 'inventory',
    title: 'Inventory & Products',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
    items: [
      {
        href: '/stock/products',
        label: 'Products',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        ),
      },
      {
        href: '/stock/adjustments',
        label: 'Adjustments',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        ),
      },
    ],
  },
  {
    key: 'data',
    title: 'Data',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
      </svg>
    ),
    items: [
      {
        href: '/stock/data',
        label: 'Data',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        ),
      },
      {
        href: '/stock/data/market-analysis',
        label: 'Market Analysis',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 17v-6m4 6V7m4 10V4M5 20h14" />
          </svg>
        ),
      },
      {
        href: '/stock/data/market-research',
        label: 'Market Research',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
          </svg>
        ),
      },
    ],
  },
  {
    key: 'statistics',
    title: 'Business Statistics',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    items: [
      {
        href: '/stock/analytics',
        label: 'Analytics',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        ),
      },
      {
        href: '/stock/pnl',
        label: 'P&L',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
      },
      {
        href: '/stock/budget',
        label: 'Budget',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 7h6m0 10v-3m-3 3v-6m-3 6v-1m6-9a2 2 0 012 2v8a2 2 0 01-2 2H9a2 2 0 01-2-2V9a2 2 0 012-2m-2 0V5a2 2 0 012-2h6a2 2 0 012 2v2" />
          </svg>
        ),
      },
    ],
  },
  {
    key: 'others',
    title: 'Others',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M12 6v.01M12 12v.01M12 18v.01M19 12a1 1 0 11-2 0 1 1 0 012 0zM7 12a1 1 0 11-2 0 1 1 0 012 0zM13 12a1 1 0 11-2 0 1 1 0 012 0z" />
      </svg>
    ),
    items: [
      {
        href: '/stock/settings',
        label: 'Settings',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        ),
      },
    ],
  },
];

/* ── Constants ── */
const RAIL_W = 70;       // px – compact icon rail width with captions
const PANEL_W = 170;     // px – flyout panel width

export default function StockShell({ children }: { children: React.ReactNode }) {
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const pathname = usePathname();
  const flyoutRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);

  // Auto-expand group that contains the current route
  useEffect(() => {
    for (const group of NAV_GROUPS) {
      if (group.items.some((item) => pathname === item.href || (pathname.startsWith(item.href + '/') && item.href !== '/stock'))) {
        setExpandedGroup(group.key);
        return;
      }
    }
    setExpandedGroup(null);
  }, [pathname]);

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [pathname]);

  // Close flyout on outside click (desktop)
  useEffect(() => {
    if (!expandedGroup) return;
    const handler = (e: MouseEvent) => {
      if (
        railRef.current?.contains(e.target as Node) ||
        flyoutRef.current?.contains(e.target as Node)
      ) return;
      setExpandedGroup(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [expandedGroup]);

  // Close mobile sidebar on outside click
  useEffect(() => {
    if (!mobileSidebarOpen) return;
    const handler = (e: MouseEvent) => {
      const sidebar = document.getElementById('stock-sidebar');
      const toggle = document.getElementById('sidebar-toggle');
      if (sidebar && !sidebar.contains(e.target as Node) && !toggle?.contains(e.target as Node)) {
        setMobileSidebarOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [mobileSidebarOpen]);

  /* ── Helper: does this group contain the active route? ── */
  function isItemActive(href: string) {
    return pathname === href || (pathname.startsWith(href + '/') && href !== '/stock');
  }

  function groupIsActive(group: NavGroup) {
    return group.items.some((item) => isItemActive(item.href));
  }

  /* ── Helper: render a nav link in the flyout panel ── */
  function renderSubLink(item: NavItem) {
    const isActive = isItemActive(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150"
        style={isActive
          ? { background: 'var(--sidebar-active-bg)', color: 'var(--sidebar-active-text)' }
          : { color: 'var(--sidebar-text)' }
        }
        onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'var(--sidebar-hover)'; }}
        onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = isActive ? 'var(--sidebar-active-bg)' : 'transparent'; }}
      >
        <span className="shrink-0" style={{ color: isActive ? 'var(--sidebar-active-text)' : 'var(--sidebar-text-muted)' }}>
          {item.icon}
        </span>
        <span>{item.label}</span>
      </Link>
    );
  }

  /* ── Compute main content margin ── */
  const mainMargin = expandedGroup ? RAIL_W + PANEL_W : RAIL_W;

  return (
    <div className="min-h-screen" style={{ background: 'var(--page-bg)', color: 'var(--text-primary)' }}>

      {/* ═══════════════════ MOBILE ═══════════════════ */}

      {/* Mobile overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Mobile sidebar (slide-in drawer) */}
      <aside
        id="stock-sidebar"
        className={`
          fixed top-0 left-0 z-40 h-full w-64
          shadow-2xl flex flex-col lg:hidden
          transform transition-transform duration-300 ease-in-out
          ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
        style={{ background: 'var(--sidebar-bg)', borderRight: '1px solid var(--sidebar-border)' }}
      >
        {/* Close button */}
        <button
          onClick={() => setMobileSidebarOpen(false)}
          className="absolute top-4 right-3 p-1.5 rounded-lg transition-colors"
          style={{ color: 'var(--text-muted)' }}
          aria-label="Close sidebar"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 shrink-0" style={{ borderBottom: '1px solid var(--sidebar-border)' }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--accent-primary)' }}>
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <span className="font-bold text-lg tracking-tight" style={{ color: 'var(--sidebar-text)' }}>StockCheck</span>
        </div>

        {/* Mobile nav — flat grouped list */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
          {/* Dashboard */}
          <Link
            href={DASHBOARD_ITEM.href}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150"
            style={pathname === '/stock'
              ? { background: 'var(--sidebar-active-bg)', color: 'var(--sidebar-active-text)' }
              : { color: 'var(--sidebar-text)' }
            }
          >
            <span style={{ color: pathname === '/stock' ? 'var(--sidebar-active-text)' : 'var(--sidebar-text-muted)' }}>
              {DASHBOARD_ITEM.icon}
            </span>
            Dashboard
          </Link>

          {NAV_GROUPS.map((group) => (
            <div key={group.key} className="pt-4">
              <h3 className="px-3 mb-1 text-[10px] font-bold uppercase tracking-widest"
                style={{ color: 'var(--sidebar-text-muted)' }}>
                {group.title}
              </h3>
              <div className="space-y-0.5">
                {group.items.map((item) => renderSubLink(item))}
              </div>
            </div>
          ))}
        </nav>

        <div className="shrink-0 px-5 py-4" style={{ borderTop: '1px solid var(--sidebar-border)', color: 'var(--sidebar-text-muted)' }}>
          <p className="text-xs">StockCheck v1.4</p>
        </div>
      </aside>

      {/* ═══════════════════ DESKTOP ═══════════════════ */}

      {/* Icon Rail — always visible on lg+ */}
      <div
        ref={railRef}
        className="hidden lg:flex flex-col fixed top-0 left-0 z-30 h-full"
        style={{
          width: RAIL_W,
          background: 'var(--sidebar-bg)',
          borderRight: '1px solid var(--sidebar-border)',
        }}
      >
        {/* Logo mark */}
        <div className="flex items-center justify-center py-4 shrink-0" style={{ borderBottom: '1px solid var(--sidebar-border)' }}>
          <Link href="/stock">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent-primary)' }}>
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
          </Link>
        </div>

        {/* Rail icons */}
        <nav className="flex-1 overflow-y-auto py-3 flex flex-col items-center gap-1.5">
          {/* Dashboard — direct link, no flyout */}
          <Link
            href="/stock"
            title="Dashboard"
            className="flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-150"
            style={pathname === '/stock'
              ? { background: 'var(--sidebar-active-bg)', color: 'var(--sidebar-active-text)' }
              : { color: 'var(--sidebar-text-muted)' }
            }
            onMouseEnter={(e) => { if (pathname !== '/stock') e.currentTarget.style.background = 'var(--sidebar-hover)'; }}
            onMouseLeave={(e) => { if (pathname !== '/stock') e.currentTarget.style.background = 'transparent'; }}
          >
            {DASHBOARD_ITEM.icon}
          </Link>

          <div className="w-6 my-1 border-t" style={{ borderColor: 'var(--sidebar-border)' }} />

          {/* Category group icons */}
          {NAV_GROUPS.map((group) => {
            const isExpanded = expandedGroup === group.key;
            const hasActive = groupIsActive(group);
            return (
              <button
                key={group.key}
                title={group.title}
                onClick={() => setExpandedGroup(isExpanded ? null : group.key)}
                className="flex w-16 min-h-[56px] flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-center transition-all duration-150"
                style={
                  isExpanded
                    ? { background: 'var(--sidebar-active-bg)', color: 'var(--sidebar-active-text)' }
                    : hasActive
                      ? { color: 'var(--sidebar-active-text)' }
                      : { color: 'var(--sidebar-text-muted)' }
                }
                onMouseEnter={(e) => { if (!isExpanded) e.currentTarget.style.background = 'var(--sidebar-hover)'; }}
                onMouseLeave={(e) => { if (!isExpanded) e.currentTarget.style.background = isExpanded ? 'var(--sidebar-active-bg)' : 'transparent'; }}
              >
                <span className="shrink-0">{group.icon}</span>
                <span
                  className="max-w-full whitespace-normal text-[7px] font-medium leading-[9px] tracking-tight"
                  style={{ color: isExpanded || hasActive ? 'inherit' : 'var(--sidebar-text)' }}
                >
                  {group.title}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="shrink-0 py-3 text-center text-[10px]" style={{ borderTop: '1px solid var(--sidebar-border)', color: 'var(--sidebar-text-muted)' }}>
          v1.5
        </div>
      </div>

      {/* Flyout Panel — appears to the right of the rail when a category is expanded */}
      <div
        ref={flyoutRef}
        className={`
          hidden lg:flex flex-col fixed top-0 z-20 h-full
          shadow-lg transition-all duration-300 ease-in-out overflow-hidden
        `}
        style={{
          left: RAIL_W,
          width: expandedGroup ? PANEL_W : 0,
          opacity: expandedGroup ? 1 : 0,
          background: 'var(--sidebar-bg)',
          borderRight: expandedGroup ? '1px solid var(--sidebar-border)' : 'none',
        }}
      >
        {expandedGroup && (() => {
          const group = NAV_GROUPS.find((g) => g.key === expandedGroup);
          if (!group) return null;
          return (
            <>
              {/* Group title */}
              <div className="shrink-0 px-4 py-5 flex items-center gap-3" style={{ borderBottom: '1px solid var(--sidebar-border)' }}>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: 'var(--sidebar-active-bg)', color: 'var(--sidebar-active-text)' }}>
                  {group.icon}
                </span>
                <h2 className="min-w-0 text-sm font-bold tracking-tight" style={{ color: 'var(--sidebar-text)' }}>
                  {group.title}
                </h2>
              </div>

              {/* Sub-items */}
              <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
                {group.items.map((item) => renderSubLink(item))}
              </nav>

              <div className="shrink-0 px-4 py-3" style={{ borderTop: '1px solid var(--sidebar-border)', color: 'var(--sidebar-text-muted)' }}>
                <p className="text-[10px]">StockCheck v1.4</p>
              </div>
            </>
          );
        })()}
      </div>

      {/* ═══════════════════ MAIN CONTENT ═══════════════════ */}

      {/* Dynamic margin for desktop sidebar */}
      <style>{`
        @media (min-width: 1024px) {
          .stock-main-area { margin-left: ${mainMargin}px !important; }
        }
      `}</style>

      <div className="stock-main-area flex flex-col min-h-screen transition-all duration-300">
        {/* Top Bar */}
        <header className="sticky top-0 z-10 shadow-sm" style={{ background: 'var(--header-bg)', borderBottom: '1px solid var(--header-border)' }}>
          <div className="flex items-center gap-4 px-4 sm:px-6 h-14">
            {/* Hamburger — mobile only */}
            <button
              id="sidebar-toggle"
              onClick={() => setMobileSidebarOpen(true)}
              className="p-2 rounded-lg transition-colors lg:hidden"
              style={{ color: 'var(--text-secondary)' }}
              aria-label="Open navigation"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm">
              <Link href="/stock" className="font-medium transition-colors" style={{ color: 'var(--text-muted)' }}>
                StockCheck
              </Link>
              {pathname !== '/stock' && (
                <>
                  <svg className="w-3 h-3" style={{ color: 'var(--text-muted)' }} fill="currentColor" viewBox="0 0 24 24">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                  <span className="font-semibold capitalize" style={{ color: 'var(--text-primary)' }}>
                    {pathname.replace('/stock/', '')}
                  </span>
                </>
              )}
            </div>

            <div className="ml-auto flex items-center gap-3">
              <span className="text-xs hidden sm:block" style={{ color: 'var(--text-muted)' }}>
                {new Date().toLocaleDateString('en-SG', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
              <Link
                href="/stock/settings"
                className="p-2 rounded-lg transition-colors lg:hidden"
                style={{ color: 'var(--text-secondary)' }}
                aria-label="Settings"
                title="Settings"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </Link>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 px-4 sm:px-6 py-6 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
