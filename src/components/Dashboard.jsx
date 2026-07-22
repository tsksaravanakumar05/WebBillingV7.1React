import React, { useState, useMemo, useCallback, memo, useEffect } from "react";
import "../dashboard.css";

import Topbar from "./Topbar";
import * as CC from "./Common";

const PRODUCTS_DATA = [
  { id: 1, name: "Basmati Rice 5kg", category: "Grains", qty: 48, amount: 9600, status: "in_stock" },
  { id: 2, name: "Toor Dal 1kg", category: "Pulses", qty: 120, amount: 8400, status: "in_stock" },
  { id: 3, name: "Sunflower Oil 1L", category: "Oil", qty: 65, amount: 7150, status: "low_stock" },
  { id: 4, name: "Wheat Flour 10kg", category: "Grains", qty: 30, amount: 5700, status: "in_stock" },
  { id: 5, name: "Sugar 1kg", category: "Sweeteners", qty: 200, amount: 5000, status: "in_stock" },
  { id: 6, name: "Green Tea 100g", category: "Beverages", qty: 18, amount: 2700, status: "low_stock" },
  { id: 7, name: "Coconut Oil 500ml", category: "Oil", qty: 10, amount: 1800, status: "out_stock" },
  { id: 8, name: "Chana Dal 1kg", category: "Pulses", qty: 55, amount: 3850, status: "in_stock" },
  { id: 9, name: "Turmeric Powder", category: "Spices", qty: 90, amount: 2250, status: "in_stock" },
  { id: 10, name: "Cardamom 50g", category: "Spices", qty: 6, amount: 1200, status: "low_stock" },
];

const ACTIVITY_FEED = [
  { id: 1, message: "Invoice #INV-2409 created", sub: "Basmati Rice 5kg x 4", time: "2 min ago", dot: "#22c55e" },
  { id: 2, message: "Purchase from Ravi Traders", sub: "Rs 12,400 - 8 items", time: "18 min ago", dot: "#4f7df9" },
  { id: 3, message: "Low stock: Sunflower Oil 1L", sub: "Only 5 units remaining", time: "1 hr ago", dot: "#ff7849" },
  { id: 4, message: "New customer registered", sub: "Meena Stores, Chennai", time: "3 hr ago", dot: "#00c9b1" },
  { id: 5, message: "Invoice #INV-2408 paid", sub: "Rs 3,200 received", time: "5 hr ago", dot: "#22c55e" },
  { id: 6, message: "Out of stock: Cardamom 50g", sub: "Reorder suggested", time: "Yesterday", dot: "#ef4444" },
];

const PAGE_SIZE_OPTIONS = [5, 10, 20];

function SunIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg>; }
function ClockIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>; }
function TrendIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>; }
function CalIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>; }
function UsersIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>; }
function TruckIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" /><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></svg>; }
function InvoiceIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>; }
function ReceiptIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>; }
function ChevronUp() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15" /></svg>; }
function ChevronDown() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>; }
function ChevronLeft() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>; }
function ChevronRight() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>; }
function SearchIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>; }

const ValNum = (value) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const cleaned = value.replace(/[^\d.-]/g, "");
    const parsed = Number.parseFloat(cleaned);

    return Number.isFinite(parsed) ? parsed : 0;
  }

  const parsed = Number.parseFloat(value);

  return Number.isFinite(parsed) ? parsed : 0;
};

const formatFullAmount = (value) => {
  const amount = ValNum(value);
  return amount.toFixed(Number.isInteger(amount) ? 0 : 2);
};

const formatCurrency = (value) =>
  `₹${ValNum(value).toFixed(2)}`;

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const WEEKDAY_LOOKUP = {
  mon: "Mon",
  monday: "Mon",
  tue: "Tue",
  tues: "Tue",
  tuesday: "Tue",
  wed: "Wed",
  wednesday: "Wed",
  thu: "Thu",
  thur: "Thu",
  thurs: "Thu",
  thursday: "Thu",
  fri: "Fri",
  friday: "Fri",
  sat: "Sat",
  saturday: "Sat",
  sun: "Sun",
  sunday: "Sun",
};

const getCaseInsensitiveValue = (row, keys) => {
  if (!row || typeof row !== "object") {
    return undefined;
  }

  const entries = Object.entries(row);

  for (const key of keys) {
    const found = entries.find(
      ([entryKey]) => entryKey.toLowerCase() === key.toLowerCase()
    );

    if (found && found[1] !== undefined && found[1] !== null && found[1] !== "") {
      return found[1];
    }
  }

  return undefined;
};

const resolveWeekdayLabel = (row) => {
  const rawDay = getCaseInsensitiveValue(row, ["y", "day", "weekday", "dayName", "name", "label"]);

  if (typeof rawDay === "string" && rawDay.trim()) {
    const normalized = rawDay.trim().toLowerCase();

    if (WEEKDAY_LOOKUP[normalized]) {
      return WEEKDAY_LOOKUP[normalized];
    }

    const firstThree = normalized.slice(0, 3);

    if (WEEKDAY_LOOKUP[firstThree]) {
      return WEEKDAY_LOOKUP[firstThree];
    }
  }

  const rawDate = getCaseInsensitiveValue(row, ["date", "salesDate", "billDate", "createdDate"]);

  if (rawDate) {
    const parsedDate = new Date(rawDate);

    if (!Number.isNaN(parsedDate.getTime())) {
      return WEEKDAY_LABELS[(parsedDate.getDay() + 6) % 7];
    }
  }

  return null;
};

const normalizeWeeklyChartRows = (rows) => {
  const normalizedRows = WEEKDAY_LABELS.map((label) => ({
    label,
    currentWeek: 0,
    previousWeek: 0,
  }));

  if (!Array.isArray(rows)) {
    return normalizedRows;
  }

  rows.forEach((row) => {
    const label = resolveWeekdayLabel(row);

    if (!label) {
      return;
    }

    // Backend WeeklyChart model: b = current week amount, a = previous week amount
    const currentValue = getCaseInsensitiveValue(row, [
      "b",
      "currentWeek",
      "currentSale",
      "currentAmount",
      "currentNetAmount",
      "netAmount",
      "amount",
    ]);

    const previousValue = getCaseInsensitiveValue(row, [
      "a",
      "previousWeek",
      "previousSale",
      "previousAmount",
      "previousNetAmount",
    ]);

    const index = WEEKDAY_LABELS.indexOf(label);

    if (index === -1) {
      return;
    }

    normalizedRows[index] = {
      label,
      currentWeek: ValNum(currentValue),
      previousWeek: ValNum(previousValue),
    };
  });

  return normalizedRows;
};

const extractWeeklyRowsFromResponse = (response) => {
  // Backend contract:
  // Data1 = dashboard summary
  // Data2 = top products
  // Data3 = weekly chart

  if (Array.isArray(response?.Data3)) {
    return response.Data3;
  }

  if (Array.isArray(response?.data3)) {
    return response.data3;
  }

  if (Array.isArray(response?.weeklyData)) {
    return response.weeklyData;
  }

  if (Array.isArray(response?.WeeklyData)) {
    return response.WeeklyData;
  }

  if (Array.isArray(response?.weeklyRows)) {
    return response.weeklyRows;
  }

  if (Array.isArray(response?.WeeklyRows)) {
    return response.WeeklyRows;
  }

  return null;
};

function useDashboardData() {
  const [metrics, setMetrics] = useState({
    todaysale: 0,
    yesterdaysale: 0,
    weeklysale: 0,
    monthlysale: 0,
    customercount: 0,
    suppliercount: 0,
    purchasecount: 0,
    salecount: 0,
  });
  const [weeklyChartRows, setWeeklyChartRows] = useState(() => normalizeWeeklyChartRows([]));
  const [weeklyDataSource, setWeeklyDataSource] = useState("missing");
  const [loading, setLoading] = useState(false);

  const Comid = CC.getStr("Comid") || "1";
  const MComid = CC.getStr("MComid") || Comid;

  useEffect(() => {
    let cancelled = false;

    async function fetchDashboard() {
      setLoading(true);

      try {
        const res = await CC.api("/api/CompanyApp/Dashboard", null, {}, { Comid, MComid });

        if (cancelled) return;

        console.log("[Dashboard] Raw dashboard response", res);
        console.log("[Dashboard] Raw weekly response candidate", extractWeeklyRowsFromResponse(res));

        // ---- Metric cards (Data1) ----
        const arr = Array.isArray(res?.Data1)
          ? res.Data1
          : Array.isArray(res?.data)
            ? res.data
            : Array.isArray(res)
              ? res
              : [];

        if (arr.length > 0) {
          const record = arr[0];
          const result = {
            todaysale: record.Todaysale ?? 0,
            yesterdaysale: record.yesderdaysale ?? record.yesterdaysale ?? 0,
            weeklysale: record.weeklysale ?? 0,
            monthlysale: record.monthlysale ?? 0,
            customercount: record.customercount ?? 0,
            suppliercount: record.suppliercount ?? 0,
            purchasecount: record.purchasecount ?? 0,
            salecount: record.salecount ?? 0,
          };

          Object.entries(result).forEach(([key, val]) => sessionStorage.setItem(key, String(val ?? 0)));
          setMetrics(result);
        }

        // ---- Weekly chart (Data3) ----
        // IMPORTANT: always trust a fresh API response over any cached copy.
        // Previously this only fetched conditionally and silently fell back
        // to a stale sessionStorage snapshot, which is why the chart looked
        // "wrong" even though the backend was sending correct Data3 rows.
        const rawWeeklyRows = extractWeeklyRowsFromResponse(res);

        console.log("[Dashboard] Weekly Data3 rows", rawWeeklyRows);

        if (Array.isArray(rawWeeklyRows) && rawWeeklyRows.length > 0) {
          const normalizedWeeklyRows = normalizeWeeklyChartRows(rawWeeklyRows);

          console.log("[Dashboard] Normalized weekly rows", normalizedWeeklyRows);

          sessionStorage.setItem("dashboardWeeklyRows", JSON.stringify(rawWeeklyRows));
          setWeeklyChartRows(normalizedWeeklyRows);
          setWeeklyDataSource("api");
        } else {
          // API genuinely returned nothing this time - fall back to last
          // known-good cache only as a last resort, never as the default path.
          const cachedWeeklyRows = sessionStorage.getItem("dashboardWeeklyRows");

          if (cachedWeeklyRows) {
            try {
              const parsedWeeklyRows = JSON.parse(cachedWeeklyRows);
              setWeeklyChartRows(normalizeWeeklyChartRows(parsedWeeklyRows));
              setWeeklyDataSource("cache");
            } catch {
              sessionStorage.removeItem("dashboardWeeklyRows");
              setWeeklyChartRows(normalizeWeeklyChartRows([]));
              setWeeklyDataSource("missing");
            }
          } else {
            setWeeklyChartRows(normalizeWeeklyChartRows([]));
            setWeeklyDataSource("missing");
          }
        }
      } catch (error) {
        console.error("Dashboard fetch error:", error);

        if (cancelled) return;

        // Network/API failure - use cache if we have one, otherwise show empty state.
        const cachedWeeklyRows = sessionStorage.getItem("dashboardWeeklyRows");

        if (cachedWeeklyRows) {
          try {
            setWeeklyChartRows(normalizeWeeklyChartRows(JSON.parse(cachedWeeklyRows)));
            setWeeklyDataSource("cache");
          } catch {
            setWeeklyChartRows(normalizeWeeklyChartRows([]));
            setWeeklyDataSource("missing");
          }
        }

        setMetrics({
          todaysale: sessionStorage.getItem("todaysale") ?? 0,
          yesterdaysale: sessionStorage.getItem("yesterdaysale") ?? 0,
          weeklysale: sessionStorage.getItem("weeklysale") ?? 0,
          monthlysale: sessionStorage.getItem("monthlysale") ?? 0,
          customercount: sessionStorage.getItem("customercount") ?? 0,
          suppliercount: sessionStorage.getItem("suppliercount") ?? 0,
          purchasecount: sessionStorage.getItem("purchasecount") ?? 0,
          salecount: sessionStorage.getItem("salecount") ?? 0,
        });
      } finally {
        if (!cancelled) {
          sessionStorage.setItem("home", "0");
          setLoading(false);
        }
      }
    }

    fetchDashboard();

    return () => {
      cancelled = true;
    };
  }, [Comid, MComid]);

  return { metrics, weeklyChartRows, weeklyDataSource, loading };
}

const MetricCard = memo(({ label, value, delta, icon: Icon, loading, isCurrency = false }) => {
  const isPositive = delta >= 0;

  return (
    <div className="kd-metric-card">
      <div className="kd-metric-icon"><Icon /></div>
      <div className="kd-metric-body">
        <p className="kd-metric-label">{label}</p>
        <p className="kd-metric-value">
          {loading ? <span className="kd-skeleton">-</span> : isCurrency ? formatCurrency(value) : String(value)}
        </p>
      </div>
      {delta !== undefined && (
        <div className={`kd-metric-delta ${isPositive ? "delta-up" : "delta-down"}`}>
          {isPositive ? <ChevronUp /> : <ChevronDown />}
          <span>{Math.abs(delta)}%</span>
        </div>
      )}
    </div>
  );
});

const StatCard = memo(({ label, value, accentClass, icon: Icon, loading }) => (
  <div className={`kd-stat-card ${accentClass}`}>
    <div className="kd-stat-icon"><Icon /></div>
    <div className="kd-stat-body">
      <p className="kd-stat-value">
        {loading ? <span className="kd-skeleton">-</span> : value}
      </p>
      <p className="kd-stat-label">{label}</p>
    </div>
    <div className="kd-stat-bar" />
  </div>
));

const WeeklyChart = memo(({ bars, dataSource }) => {
  const [hovered, setHovered] = useState(null);

  const maxBar = Math.max(
    ...bars.flatMap((bar) => [ValNum(bar.currentWeek), ValNum(bar.previousWeek)]),
    0
  );

  const axisValues = useMemo(() => {
    if (maxBar <= 0) {
      return [0, 0, 0, 0, 0];
    }

    return Array.from({ length: 5 }, (_, index) => Math.round((maxBar * (4 - index)) / 4));
  }, [maxBar]);

  return (
    <div className="kd-panel kd-chart-panel">
      <div className="kd-panel-header">
        <div>
          <h3 className="kd-panel-title">Weekly Sales Bar Chart</h3>

          <p className="kd-chart-subtitle">
            {dataSource === "missing"
              ? "Weekly API data not returned by backend"
              : dataSource === "cache"
                ? "Showing last cached data (API unavailable)"
                : "Current week vs previous week"}
          </p>
        </div>

        <div className="kd-chart-legend">
          <span className="kd-legend-item">
            <span className="kd-legend-dot kd-legend-dot-prev" />
            Previous Week
          </span>

          <span className="kd-legend-item">
            <span className="kd-legend-dot kd-legend-dot-current" />
            Current Week
          </span>
        </div>
      </div>

      <div className="kd-chart-wrap">
        <div className="kd-chart-y">
          {axisValues.map((value, index) => (
            <span key={`${value}-${index}`}>{formatFullAmount(value)}</span>
          ))}
        </div>

        <div className="kd-chart-bars">
          <div className="kd-chart-grid">
            {axisValues.map((value, index) => (
              <span key={`grid-${value}-${index}`} className="kd-chart-grid-line" />
            ))}
          </div>

          {bars.map((bar, index) => {
            const currentAmount = ValNum(bar.currentWeek);
            const previousAmount = ValNum(bar.previousWeek);

            const currentPct = maxBar > 0 ? (currentAmount / maxBar) * 100 : 0;
            const previousPct = maxBar > 0 ? (previousAmount / maxBar) * 100 : 0;

            return (
              <div
                key={bar.label}
                className="kd-chart-col"
                onMouseEnter={() => setHovered(index)}
                onMouseLeave={() => setHovered(null)}
              >
                {hovered === index && (
                  <div className="kd-tooltip">
                    <div>{bar.label}</div>
                    <div>Previous: ₹{formatFullAmount(previousAmount)}</div>
                    <div>Current: ₹{formatFullAmount(currentAmount)}</div>
                  </div>
                )}

                <div className="kd-bar-pair">
                  <div
                    className="kd-bar kd-bar-prev"
                    style={{
                      height: `${previousPct}%`,
                      minHeight: previousAmount > 0 ? "4px" : "0px",
                      opacity: hovered !== null && hovered !== index ? 0.35 : 1,
                      animationDelay: `${index * 0.06}s`,
                    }}
                  />

                  <div
                    className="kd-bar kd-bar-current"
                    style={{
                      height: `${currentPct}%`,
                      minHeight: currentAmount > 0 ? "4px" : "0px",
                      opacity: hovered !== null && hovered !== index ? 0.35 : 1,
                      animationDelay: `${index * 0.08}s`,
                    }}
                  />
                </div>

                <span className="kd-bar-label">{bar.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});

const COLS = [
  { key: "id", label: "#", sortable: true },
  { key: "name", label: "Product", sortable: true },
  { key: "category", label: "Category", sortable: true },
  { key: "qty", label: "Qty", sortable: true },
  { key: "amount", label: "Amount", sortable: true },
];

const ProductsTable = memo(() => {
  const [sortKey, setSortKey] = useState("amount");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [search, setSearch] = useState("");

  const handleSort = useCallback((key) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
        return prev;
      }

      setSortDir("asc");
      return key;
    });
    setPage(1);
  }, []);

  const filtered = useMemo(
    () =>
      PRODUCTS_DATA.filter(
        (row) =>
          row.name.toLowerCase().includes(search.toLowerCase()) ||
          row.category.toLowerCase().includes(search.toLowerCase())
      ),
    [search]
  );

  const sorted = useMemo(() => {
    const data = [...filtered];
    data.sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];

      if (typeof va === "number") {
        return sortDir === "asc" ? va - vb : vb - va;
      }

      return sortDir === "asc" ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });
    return data;
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  const SortIcon = ({ col }) => {
    if (!col.sortable) return null;
    if (sortKey !== col.key) return <span className="kd-sort-icon kd-sort-idle">↕</span>;
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
              placeholder="Search products..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <select
            className="kd-page-size"
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setPage(1);
            }}
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>{size} / page</option>
            ))}
          </select>
        </div>
      </div>

      <div className="kd-table-wrap">
        <table className="kd-table">
          <thead>
            <tr>
              {COLS.map((col) => (
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
              <tr><td colSpan={COLS.length} className="kd-empty">No products match your search.</td></tr>
            ) : (
              paginated.map((row, index) => {
                return (
                  <tr key={row.id} className="kd-tr" style={{ animationDelay: `${index * 0.04}s` }}>
                    <td className="kd-td-muted">{row.id}</td>
                    <td className="kd-td-bold">{row.name}</td>
                    <td><span className="kd-cat-pill">{row.category}</span></td>
                    <td className="kd-td-num">{row.qty}</td>
                    <td className="kd-td-amt">{formatCurrency(row.amount)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="kd-pagination">
        <span className="kd-pag-info">
          {sorted.length === 0
            ? "0 results"
            : `${(safePage - 1) * pageSize + 1}-${Math.min(safePage * pageSize, sorted.length)} of ${sorted.length}`}
        </span>
        <div className="kd-pag-btns">
          <button type="button" className="kd-pag-btn" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={safePage <= 1}>
            <ChevronLeft />
          </button>
          {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
            <button
              key={pageNumber}
              type="button"
              className={`kd-pag-btn ${pageNumber === safePage ? "kd-pag-active" : ""}`}
              onClick={() => setPage(pageNumber)}
            >
              {pageNumber}
            </button>
          ))}
          <button type="button" className="kd-pag-btn" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={safePage >= totalPages}>
            <ChevronRight />
          </button>
        </div>
      </div>
    </div>
  );
});

const Dashboard = () => {
  const { metrics, weeklyChartRows, weeklyDataSource, loading } = useDashboardData();

  const saleMetrics = [
    { id: "today", label: "Today's Sales", value: metrics.todaysale, icon: SunIcon, isCurrency: true },
    { id: "yesterday", label: "Yesterday", value: metrics.yesterdaysale, icon: ClockIcon, isCurrency: true },
    { id: "weekly", label: "This Week", value: metrics.weeklysale, icon: TrendIcon, isCurrency: true },
    { id: "monthly", label: "This Month", value: metrics.monthlysale, icon: CalIcon, isCurrency: true },
  ];

  const statMetrics = [
    { id: "customers", label: "Customers", value: metrics.customercount, accentClass: "accent-orange", icon: UsersIcon },
    { id: "suppliers", label: "Suppliers", value: metrics.suppliercount, accentClass: "accent-teal", icon: TruckIcon },
    { id: "purchase", label: "Purchase Invoice", value: metrics.purchasecount, accentClass: "accent-navy", icon: InvoiceIcon },
    { id: "sales", label: "Sales Invoice", value: metrics.salecount, accentClass: "accent-green", icon: ReceiptIcon },
  ];

  return (
    <div className="kd-root">
      <Topbar />

      <div className="kd-content-wrap">
        <main className="kd-main">
          <div className="kd-page-head">
            <div>
              <h1 className="kd-page-title">Dashboard</h1>
              <p className="kd-page-sub">Welcome back - here's what's happening today.</p>
            </div>
            <div className="kd-page-date">
              {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </div>
          </div>

          <section className="kd-metric-row">
            {saleMetrics.map((metric) => <MetricCard key={metric.id} {...metric} loading={loading} />)}
          </section>

          <section className="kd-stat-row">
            {statMetrics.map((stat) => <StatCard key={stat.id} {...stat} loading={loading} />)}
          </section>

          <section className="kd-mid-row">
            <WeeklyChart bars={weeklyChartRows} dataSource={weeklyDataSource} />
            <ProductsTable />
          </section>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
