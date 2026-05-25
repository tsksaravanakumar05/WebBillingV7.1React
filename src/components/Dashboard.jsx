import React, { useState, useMemo, useCallback, memo } from "react";
import { useNavigate } from "react-router-dom";
import "../dashboard.css";
import MenuSetting from "./Menusetting";
// comit test
// comit test

/* ═══════════════════════════════════════════════
   DATA LAYER  –  In production, replace with API hooks
═══════════════════════════════════════════════ */
const SALE_METRICS = [
  { id: "today",     label: "Today's Sales",    value: 4820,  prefix: "₹", delta: +12.4, icon: SunIcon },
  { id: "yesterday", label: "Yesterday",        value: 3960,  prefix: "₹", delta: -5.2,  icon: ClockIcon },
  { id: "weekly",    label: "This Week",        value: 28340, prefix: "₹", delta: +8.1,  icon: TrendIcon },
  { id: "monthly",   label: "This Month",       value: 13782, prefix: "₹", delta: +22.7, icon: CalIcon },
];

const STAT_METRICS = [
  { id: "customers", label: "Customers",        value: 16,  accentClass: "accent-orange", icon: UsersIcon },
  { id: "suppliers", label: "Suppliers",        value: 5,   accentClass: "accent-teal",   icon: TruckIcon },
  { id: "purchase",  label: "Purchase Invoice", value: 22,  accentClass: "accent-navy",   icon: InvoiceIcon },
  { id: "sales",     label: "Sales Invoice",    value: 212, accentClass: "accent-green",  icon: ReceiptIcon },
];

const WEEKLY_BARS = [
  { day: "Mon", value: 60,  color: "#4f7df9" },
  { day: "Tue", value: 40,  color: "#4f7df9" },
  { day: "Wed", value: 78,  color: "#00c9b1" },
  { day: "Thu", value: 120, color: "#ff7849" },
  { day: "Fri", value: 30,  color: "#4f7df9" },
  { day: "Sat", value: 200, color: "#22c55e" },
  { day: "Sun", value: 20,  color: "#a78bfa" },
];
const MAX_BAR = Math.max(...WEEKLY_BARS.map(b => b.value));

const PRODUCTS_DATA = [
  { id: 1, name: "Basmati Rice 5kg",  category: "Grains",    qty: 48,  amount: 9600,  status: "in_stock"   },
  { id: 2, name: "Toor Dal 1kg",      category: "Pulses",    qty: 120, amount: 8400,  status: "in_stock"   },
  { id: 3, name: "Sunflower Oil 1L",  category: "Oil",       qty: 65,  amount: 7150,  status: "low_stock"  },
  { id: 4, name: "Wheat Flour 10kg",  category: "Grains",    qty: 30,  amount: 5700,  status: "in_stock"   },
  { id: 5, name: "Sugar 1kg",         category: "Sweeteners",qty: 200, amount: 5000,  status: "in_stock"   },
  { id: 6, name: "Green Tea 100g",    category: "Beverages", qty: 18,  amount: 2700,  status: "low_stock"  },
  { id: 7, name: "Coconut Oil 500ml", category: "Oil",       qty: 10,  amount: 1800,  status: "out_stock"  },
  { id: 8, name: "Chana Dal 1kg",     category: "Pulses",    qty: 55,  amount: 3850,  status: "in_stock"   },
  { id: 9, name: "Turmeric Powder",   category: "Spices",    qty: 90,  amount: 2250,  status: "in_stock"   },
  { id: 10, name: "Cardamom 50g",     category: "Spices",    qty: 6,   amount: 1200,  status: "low_stock"  },
];

const ACTIVITY_FEED = [
  { id: 1, type: "sale",     message: "Invoice #INV-2409 created",      sub: "Basmati Rice 5kg × 4",  time: "2 min ago",  dot: "#22c55e" },
  { id: 2, type: "purchase", message: "Purchase from Ravi Traders",     sub: "₹12,400 — 8 items",     time: "18 min ago", dot: "#4f7df9" },
  { id: 3, type: "alert",    message: "Low stock: Sunflower Oil 1L",    sub: "Only 5 units remaining", time: "1 hr ago",   dot: "#ff7849" },
  { id: 4, type: "customer", message: "New customer registered",        sub: "Meena Stores, Chennai",  time: "3 hr ago",   dot: "#00c9b1" },
  { id: 5, type: "sale",     message: "Invoice #INV-2408 paid",         sub: "₹3,200 received",        time: "5 hr ago",   dot: "#22c55e" },
  { id: 6, type: "alert",    message: "Out of stock: Cardamom 50g",     sub: "Reorder suggested",      time: "Yesterday",  dot: "#ef4444" },
];

const PAGE_SIZE_OPTIONS = [5, 10, 20];

/* ═══════════════════════════════════════════════
   SVG ICON COMPONENTS  –  lightweight, no dep
═══════════════════════════════════════════════ */
function SunIcon()     { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>; }
function ClockIcon()   { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>; }
function TrendIcon()   { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>; }
function CalIcon()     { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>; }
function UsersIcon()   { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>; }
function TruckIcon()   { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>; }
function InvoiceIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>; }
function ReceiptIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>; }
function ChevronUp()   { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>; }
function ChevronDown() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>; }
function ChevronLeft() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>; }
function ChevronRight(){ return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>; }
function BellIcon()    { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>; }
function GridIcon()    { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>; }
function SearchIcon()  { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>; }

/* ═══════════════════════════════════════════════
   UTILITY HELPERS
═══════════════════════════════════════════════ */
const fmt = (n) =>
  n >= 1_00_000
    ? `${(n / 1_00_000).toFixed(1)}L`
    : n >= 1_000
    ? `${(n / 1_000).toFixed(1)}k`
    : String(n);

const fmtCurrency = (n) => `₹${n.toLocaleString("en-IN")}`;

/* ═══════════════════════════════════════════════
   REUSABLE: METRIC CARD  (sale summary row)
═══════════════════════════════════════════════ */
const MetricCard = memo(({ label, value, prefix, delta, icon: Icon }) => {
  const isPositive = delta >= 0;
  return (
    <div className="kd-metric-card">
      <div className="kd-metric-icon">
        <Icon />
      </div>
      <div className="kd-metric-body">
        <p className="kd-metric-label">{label}</p>
        <p className="kd-metric-value">{prefix}{fmt(value)}</p>
      </div>
      <div className={`kd-metric-delta ${isPositive ? "delta-up" : "delta-down"}`}>
        {isPositive ? <ChevronUp /> : <ChevronDown />}
        <span>{Math.abs(delta)}%</span>
      </div>
    </div>
  );
});

/* ═══════════════════════════════════════════════
   REUSABLE: STAT CARD  (customers / suppliers…)
═══════════════════════════════════════════════ */
const StatCard = memo(({ label, value, accentClass, icon: Icon }) => (
  <div className={`kd-stat-card ${accentClass}`}>
    <div className="kd-stat-icon"><Icon /></div>
    <div className="kd-stat-body">
      <p className="kd-stat-value">{value}</p>
      <p className="kd-stat-label">{label}</p>
    </div>
    <div className="kd-stat-bar" />
  </div>
));

/* ═══════════════════════════════════════════════
   REUSABLE: WEEKLY CHART  (pure CSS bars)
═══════════════════════════════════════════════ */
const WeeklyChart = memo(() => {
  const [hovered, setHovered] = useState(null);
  return (
    <div className="kd-panel kd-chart-panel">
      <div className="kd-panel-header">
        <h3 className="kd-panel-title">Weekly Sales</h3>
        <span className="kd-badge kd-badge-blue">This Week</span>
      </div>
      <div className="kd-chart-wrap">
        <div className="kd-chart-y">
          {[200, 150, 100, 50, 0].map(v => (
            <span key={v}>{v}</span>
          ))}
        </div>
        <div className="kd-chart-bars">
          {WEEKLY_BARS.map((bar, i) => {
            const pct = (bar.value / MAX_BAR) * 100;
            return (
              <div
                key={bar.day}
                className="kd-chart-col"
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
              >
                {hovered === i && (
                  <div className="kd-tooltip">{fmtCurrency(bar.value * 120)}</div>
                )}
                <div
                  className="kd-bar"
                  style={{
                    height: `${pct}%`,
                    background: bar.color,
                    opacity: hovered !== null && hovered !== i ? 0.35 : 1,
                    animationDelay: `${i * 0.07}s`,
                  }}
                />
                <span className="kd-bar-label">{bar.day}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});

/* ═══════════════════════════════════════════════
   REUSABLE: PRODUCTS TABLE  (sort + paginate)
═══════════════════════════════════════════════ */
const COLS = [
  { key: "id",       label: "#",        sortable: true  },
  { key: "name",     label: "Product",  sortable: true  },
  { key: "category", label: "Category", sortable: true  },
  { key: "qty",      label: "Qty",      sortable: true  },
  { key: "amount",   label: "Amount",   sortable: true  },
  { key: "status",   label: "Status",   sortable: false },
];

const STATUS_MAP = {
  in_stock:  { label: "In Stock",   cls: "status-green" },
  low_stock: { label: "Low Stock",  cls: "status-amber" },
  out_stock: { label: "Out Stock",  cls: "status-red"   },
};

const ProductsTable = memo(() => {
  const [sortKey,   setSortKey]   = useState("amount");
  const [sortDir,   setSortDir]   = useState("desc");
  const [page,      setPage]      = useState(1);
  const [pageSize,  setPageSize]  = useState(5);
  const [search,    setSearch]    = useState("");

  const handleSort = useCallback((key) => {
    setSortKey(prev => {
      if (prev === key) { setSortDir(d => d === "asc" ? "desc" : "asc"); return prev; }
      setSortDir("asc");
      return key;
    });
    setPage(1);
  }, []);

  const filtered = useMemo(() =>
    PRODUCTS_DATA.filter(r =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.category.toLowerCase().includes(search.toLowerCase())
    ),
  [search]);

  const sorted = useMemo(() => {
    const d = [...filtered];
    d.sort((a, b) => {
      const va = a[sortKey], vb = b[sortKey];
      if (typeof va === "number") return sortDir === "asc" ? va - vb : vb - va;
      return sortDir === "asc"
        ? String(va).localeCompare(String(vb))
        : String(vb).localeCompare(String(va));
    });
    return d;
  }, [filtered, sortKey, sortDir]);

  const totalPages  = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage    = Math.min(page, totalPages);
  const paginated   = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  const SortIcon = ({ col }) => {
    if (!col.sortable) return null;
    if (sortKey !== col.key) return <span className="kd-sort-icon kd-sort-idle">⇅</span>;
    return <span className="kd-sort-icon kd-sort-active">{sortDir === "asc" ? "↑" : "↓"}</span>;
  };

  return (
    <div className="kd-panel kd-table-panel">
      <div className="kd-panel-header">
        <h3 className="kd-panel-title">Top Products</h3>
        <div className="kd-table-controls">
          <div className="kd-search-wrap">
            <span className="kd-search-icon"><SearchIcon /></span>
            <input
              className="kd-search"
              placeholder="Search products…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <select
            className="kd-page-size"
            value={pageSize}
            onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
          >
            {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n} / page</option>)}
          </select>
        </div>
      </div>

      <div className="kd-table-wrap">
        <table className="kd-table">
          <thead>
            <tr>
              {COLS.map(col => (
                <th
                  key={col.key}
                  className={col.sortable ? "kd-th-sort" : ""}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  {col.label}<SortIcon col={col} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={COLS.length} className="kd-empty">No products match your search.</td>
              </tr>
            ) : paginated.map((row, i) => {
              const st = STATUS_MAP[row.status];
              return (
                <tr key={row.id} className="kd-tr" style={{ animationDelay: `${i * 0.04}s` }}>
                  <td className="kd-td-muted">{row.id}</td>
                  <td className="kd-td-bold">{row.name}</td>
                  <td><span className="kd-cat-pill">{row.category}</span></td>
                  <td className="kd-td-num">{row.qty}</td>
                  <td className="kd-td-amt">{fmtCurrency(row.amount)}</td>
                  <td><span className={`kd-status ${st.cls}`}>{st.label}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="kd-pagination">
        <span className="kd-pag-info">
          {sorted.length === 0 ? "0 results" : `${(safePage-1)*pageSize+1}–${Math.min(safePage*pageSize, sorted.length)} of ${sorted.length}`}
        </span>
        <div className="kd-pag-btns">
          <button
            type="button"
            className="kd-pag-btn"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={safePage <= 1}
          ><ChevronLeft /></button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <button
              key={p}
              type="button"
              className={`kd-pag-btn ${p === safePage ? "kd-pag-active" : ""}`}
              onClick={() => setPage(p)}
            >{p}</button>
          ))}
          <button
            type="button"
            className="kd-pag-btn"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
          ><ChevronRight /></button>
        </div>
      </div>
    </div>
  );
});

/* ═══════════════════════════════════════════════
   REUSABLE: ACTIVITY FEED
═══════════════════════════════════════════════ */
const ActivityFeed = memo(() => (
  <div className="kd-panel kd-activity-panel">
    <div className="kd-panel-header">
      <h3 className="kd-panel-title">Recent Activity</h3>
      <span className="kd-badge kd-badge-green">{ACTIVITY_FEED.length} events</span>
    </div>
    <ul className="kd-feed">
      {ACTIVITY_FEED.map((item, i) => (
        <li key={item.id} className="kd-feed-item" style={{ animationDelay: `${i * 0.06}s` }}>
          <span className="kd-feed-dot" style={{ background: item.dot }} />
          <div className="kd-feed-body">
            <p className="kd-feed-msg">{item.message}</p>
            <p className="kd-feed-sub">{item.sub}</p>
          </div>
          <span className="kd-feed-time">{item.time}</span>
        </li>
      ))}
    </ul>
  </div>
));

/* ═══════════════════════════════════════════════
   TOPBAR
═══════════════════════════════════════════════ */
const Topbar = memo(() => {
  const navigate = useNavigate();
  const username = localStorage.getItem("username") || "User";
  // Show first letter of username as avatar
  const avatarLetter = username.charAt(0).toUpperCase();

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    navigate("/", { replace: true });
  };

  return (
    <header className="kd-topbar">
      <div className="kd-topbar-left">
        <span className="kd-logo-mark">K</span>
        <span className="kd-logo-text">KASSA <strong>BM</strong></span>
      </div>
      <div className="kd-topbar-right">
        <button type="button" className="kd-icon-btn" title="Notifications">
          <BellIcon />
          <span className="kd-notif-dot" />
        </button>
        <button type="button" className="kd-icon-btn" title="Apps">
          <GridIcon />
        </button>
        <div className="kd-user-pill">
          <div className="kd-avatar">{avatarLetter}</div>
          <div className="kd-user-info">
            <span className="kd-user-name">{username}</span>
            <span className="kd-user-role">Admin</span>
          </div>
        </div>
        {/* Logout button */}
        <button
          type="button"
          className="kd-logout-btn"
          title="Logout"
          onClick={handleLogout}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          <span>Logout</span>
        </button>
      </div>
    </header>
  );
});

/* ═══════════════════════════════════════════════
   ROOT DASHBOARD
═══════════════════════════════════════════════ */
const Dashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="kd-root">
      <Topbar />
      <MenuSetting sidebarOpen={sidebarOpen} onSidebarChange={setSidebarOpen} />

      {/* kd-content-wrap shifts right when sidebar is open */}
      <div className={`kd-content-wrap${sidebarOpen ? " kd-content-wrap--shifted" : ""}`}>
        <main className="kd-main">

          {/* Page heading */}
          <div className="kd-page-head">
            <div>
              <h1 className="kd-page-title">Dashboard</h1>
              <p className="kd-page-sub">Welcome back — here's what's happening today.</p>
            </div>
            <div className="kd-page-date">{new Date().toLocaleDateString("en-IN", { weekday:"long", day:"numeric", month:"long", year:"numeric" })}</div>
          </div>

          {/* Row 1 — sale metrics */}
          <section className="kd-metric-row">
            {SALE_METRICS.map(m => <MetricCard key={m.id} {...m} />)}
          </section>

          {/* Row 2 — stat pills */}
          <section className="kd-stat-row">
            {STAT_METRICS.map(s => <StatCard key={s.id} {...s} />)}
          </section>

          {/* Row 3 — chart + activity */}
          <section className="kd-mid-row">
            <WeeklyChart />
            <ActivityFeed />
          </section>

          {/* Row 4 — full-width products table */}
          <section className="kd-table-row">
            <ProductsTable />
          </section>

        </main>
      </div>
    </div>
  );
};

export default Dashboard;