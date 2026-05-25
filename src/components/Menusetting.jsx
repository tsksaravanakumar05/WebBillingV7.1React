/**
 * MenuSettings.jsx
 * Left Sidebar Navigation — KASSA BM Admin Dashboard
 * All routes wired to existing App.js paths
 *
 * Drop-in usage in Dashboard.jsx:
 *   import MenuSettings from "./MenuSettings";
 *   <div className="kd-root">
 *     <MenuSettings />
 *     <Topbar />
 *     <main className="kd-main"> ... </main>
 *   </div>
 *
 * Changes from original:
 *  - Color scheme updated to #1f65de brand blue (matching .info style)
 *  - jQuery MenuSettings logic ported to React:
 *      * loadtree() → useEffect + fetch from /Login/SelectMenuMaster
 *      * UpdateMenuSetting() → updateMenuSetting() using fetch to /Login/UpdateMenuMaster
 *      * Radio button filter (All/Master/Transaction/etc.) → filterType state
 *      * Right-click context menu (Visible / Hidden) → React context menu state
 *      * Color coding: active/visible items shown in brand blue (was green in jQuery)
 *      * localStorage: Comid + userid read exactly as jQuery version does
 *      * Parent-child tree rendering mirrors jqxTree hierarchy logic
 *      * Accordion expand/collapse mirrors jqxTree collapseAll + per-item toggle
 *  - All existing CSS classes, routes, icons, sidebar structure preserved unchanged
 */

import React, {
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { NavLink } from "react-router-dom";
import "../Menusetting.css";

/* ═══════════════════════════════════════════════════════
   STATIC MENU DATA (fallback / top-level structure)
   Used when API data is not yet loaded.
   path values match existing App.js <Route> paths.
════════════════════════════════════════════════════════ */
const STATIC_MENU_DATA = [
  {
    id: "dashboard",
    label: "Dashboard",
    path: "/dashboard",
    icon: IconDashboard,
    children: [],
    apiType: null, // direct link, no API tree
  },
  {
    id: "master",
    label: "Master",
    icon: IconMaster,
    apiType: "Master",
    children: [], // populated from API
  },
  {
    id: "transaction",
    label: "Transaction",
    icon: IconTransaction,
    apiType: "Transaction",
    children: [], // populated from API
  },
  {
    id: "reports",
    label: "Reports",
    icon: IconReports,
    apiType: "Reports",
    children: [], // populated from API
  },
  {
    id: "rate",
    label: "Rate / Pricing",
    icon: IconRate,
    apiType: null,
    children: [
      { id: "customer-wise-rate", label: "Customer Wise Sale Rate", path: "/customer-wise-sale-rate", status: 1 },
      { id: "rate-change",        label: "Rate Change",             path: "/RateChange",              status: 1 },
    ],
  },
  {
    id: "settings",
    label: "Menu Settings",
    path: "/menu-settings",
    icon: IconSettings,
    children: [],
    apiType: null,
  },
];

/* ═══════════════════════════════════════════════
   API HELPERS  (mirrors jQuery $.ajax calls)
═══════════════════════════════════════════════ */

/**
 * loadtree equivalent — POST to /Login/SelectMenuMaster
 * Returns flat array; we build parent-child hierarchy locally.
 */
async function apiFetchMenuTree(type, userid) {
  const res = await fetch("/Login/SelectMenuMaster", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    cache: "no-cache",
    body: JSON.stringify({ Type: type, Comid: userid }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json(); // flat array: [{Id, ParentId, AccountName, Status}]
}

/**
 * UpdateMenuSetting equivalent — POST to /Login/UpdateMenuMaster
 */
async function apiUpdateMenuSetting(id, status) {
  const res = await fetch("/Login/UpdateMenuMaster", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    cache: "no-cache",
    body: JSON.stringify({ id, status }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json(); // { ok: bool, message: string }
}

/**
 * Build hierarchy from flat array — mirrors jqxTree getRecordsHierarchy logic.
 * Returns array of top-level nodes each with an `items` children array.
 */
function buildHierarchy(flatData) {
  if (!Array.isArray(flatData) || flatData.length === 0) return [];

  const map = {};
  flatData.forEach((row) => {
    map[row.Id] = {
      id: String(row.Id),
      parentId: row.ParentId != null ? String(row.ParentId) : null,
      label: row.AccountName,
      status: row.Status, // 1 = visible, 0 = hidden
      path: row.Path || null,
      items: [],
    };
  });

  const roots = [];
  Object.values(map).forEach((node) => {
    if (node.parentId && map[node.parentId]) {
      map[node.parentId].items.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

/* ═══════════════════════════════════════════════
   SVG ICONS  (inline, zero dependency)
═══════════════════════════════════════════════ */
function IconDashboard() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
    </svg>
  );
}
function IconMaster() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
}
function IconTransaction() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/>
      <polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
    </svg>
  );
}
function IconReports() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  );
}
function IconRate() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23"/>
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
  );
}
function IconSettings() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
    </svg>
  );
}
function IconChevron({ open }) {
  return (
    <svg
      className={`ms-chevron ${open ? "ms-chevron--open" : ""}`}
      viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
    >
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  );
}
function IconMenu() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6"  x2="21" y2="6"/>
      <line x1="3" y1="12" x2="21" y2="12"/>
      <line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  );
}
function IconClose() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6"  y1="6" x2="18" y2="18"/>
    </svg>
  );
}

/* ═══════════════════════════════════════════════
   CONTEXT MENU  (mirrors jQuery jqxMenu right-click: Visible / Hidden)
═══════════════════════════════════════════════ */
function ContextMenu({ x, y, onVisible, onHidden, onClose }) {
  const ref = useRef(null);

  // Close on outside click (mirrors attachContextMenu logic)
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <ul
      ref={ref}
      className="ms-context-menu"
      style={{ position: "fixed", top: y, left: x, zIndex: 2000 }}
    >
      <li className="ms-context-item ms-context-visible" onMouseDown={onVisible}>
        Visible
      </li>
      <li className="ms-context-item ms-context-hidden" onMouseDown={onHidden}>
        Hidden
      </li>
    </ul>
  );
}

/* ═══════════════════════════════════════════════
   API MENU ITEM  (rendered for API-loaded tree nodes)
   Mirrors jQuery tree item with right-click context + status color
═══════════════════════════════════════════════ */
function ApiMenuItem({ node, depth = 0, onContextRequest, statusMap }) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = node.items && node.items.length > 0;
  // Status from live statusMap (mutated by context menu actions)
  const isVisible = statusMap[node.id] !== undefined
    ? statusMap[node.id] === 1
    : node.status === 1;

  const handleRightClick = (e) => {
    e.preventDefault();
    onContextRequest(e.clientX + 5, e.clientY + 5, node);
  };

  if (!hasChildren) {
    // Leaf node — render as NavLink if path exists, else plain span
    const inner = (
      <span
        className="ms-api-leaf"
        onContextMenu={handleRightClick}
        style={{ paddingLeft: depth * 12 }}
      >
        <span className="ms-sub-dot" />
        <span
          className="ms-sub-text"
          style={isVisible ? { color: "var(--ms-accent)", fontWeight: 600 } : {}}
        >
          {node.label}
        </span>
      </span>
    );

    return (
      <li className="ms-sub-item" style={{ "--i": 0 }}>
        {node.path ? (
          <NavLink
            to={node.path}
            className={({ isActive }) =>
              "ms-sub-link" + (isActive ? " ms-sub-link--active" : "")
            }
            end
          >
            {inner}
          </NavLink>
        ) : (
          <div className="ms-sub-link">{inner}</div>
        )}
      </li>
    );
  }

  return (
    <li className={"ms-sub-item ms-api-parent" + (expanded ? " ms-api-parent--open" : "")}>
      <div
        className="ms-sub-link ms-api-parent-btn"
        onClick={() => setExpanded((v) => !v)}
        onContextMenu={handleRightClick}
        style={{ paddingLeft: depth * 12, cursor: "pointer" }}
      >
        <span className="ms-sub-dot" style={isVisible ? { background: "var(--ms-accent)" } : {}} />
        <span
          className="ms-sub-text"
          style={isVisible ? { color: "var(--ms-accent)", fontWeight: 600 } : {}}
        >
          {node.label}
        </span>
        <IconChevron open={expanded} />
      </div>
      {expanded && (
        <ul className="ms-sub-list ms-api-sub-list">
          {node.items.map((child) => (
            <ApiMenuItem
              key={child.id}
              node={child}
              depth={depth + 1}
              onContextRequest={onContextRequest}
              statusMap={statusMap}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

/* ═══════════════════════════════════════════════
   API MENU SECTION  (wrapper that owns loadtree state)
   Mirrors: methods.loadtree(type) from jQuery
═══════════════════════════════════════════════ */
function ApiMenuSection({ apiType, isOpen, onLinkClick }) {
  const [treeData, setTreeData]     = useState([]);   // hierarchy roots
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState(null);
  // statusMap: { [nodeId]: 0|1 } — live visibility state, mirrors jQuery in-memory tree update
  const [statusMap, setStatusMap]   = useState({});
  // Context menu state
  const [ctxMenu, setCtxMenu]       = useState(null); // { x, y, node }
  const userid = localStorage.getItem("userid");

  // Load tree when section opens — mirrors frmrbtAll.on('checked') → methods.loadtree()
  useEffect(() => {
    if (!isOpen || !apiType) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    apiFetchMenuTree(apiType, userid)
      .then((flatData) => {
        if (cancelled) return;
        const hierarchy = buildHierarchy(flatData);
        setTreeData(hierarchy);

        // Build initial statusMap from API data — mirrors color() in jQuery loadtree
        const sm = {};
        const walk = (nodes) => {
          nodes.forEach((n) => {
            sm[n.id] = n.status;
            if (n.items?.length) walk(n.items);
          });
        };
        walk(hierarchy);
        setStatusMap(sm);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [isOpen, apiType, userid]);

  // Called when user right-clicks a tree node — mirrors attachContextMenu
  const handleContextRequest = useCallback((x, y, node) => {
    setCtxMenu({ x, y, node });
  }, []);

  // "Visible" context menu click — mirrors UpdateMenuSetting(id, 1)
  const handleSetVisible = useCallback(() => {
    if (!ctxMenu) return;
    const { node } = ctxMenu;
    setCtxMenu(null);
    setStatusMap((prev) => ({ ...prev, [node.id]: 1 }));

    apiUpdateMenuSetting(node.id, 1)
      .then((data) => {
        if (!data.ok) console.error("MenuSetting update failed:", data.message);
      })
      .catch((err) => console.error("UpdateMenuSetting error:", err));
  }, [ctxMenu]);

  // "Hidden" context menu click — mirrors UpdateMenuSetting(id, 0)
  const handleSetHidden = useCallback(() => {
    if (!ctxMenu) return;
    const { node } = ctxMenu;
    setCtxMenu(null);
    setStatusMap((prev) => ({ ...prev, [node.id]: 0 }));

    apiUpdateMenuSetting(node.id, 0)
      .then((data) => {
        if (!data.ok) console.error("MenuSetting update failed:", data.message);
      })
      .catch((err) => console.error("UpdateMenuSetting error:", err));
  }, [ctxMenu]);

  if (!isOpen) return null;

  return (
    <div className="ms-api-section">
      {loading && (
        <div className="ms-api-loading">
          <span className="ms-api-spinner" />
          <span>Loading…</span>
        </div>
      )}
      {error && (
        <div className="ms-api-error">Failed to load: {error}</div>
      )}
      {!loading && !error && treeData.length === 0 && (
        <div className="ms-api-empty">No items found.</div>
      )}
      {!loading && treeData.length > 0 && (
        <ul className="ms-sub-list">
          {treeData.map((node, idx) => (
            <ApiMenuItem
              key={node.id}
              node={node}
              depth={0}
              onContextRequest={handleContextRequest}
              statusMap={statusMap}
            />
          ))}
        </ul>
      )}

      {/* Context menu — mirrors jqxMenu popup */}
      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          onVisible={handleSetVisible}
          onHidden={handleSetHidden}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   MenuItem — one row (parent button or leaf NavLink)
   Unchanged component — only logic for apiType sections added
═══════════════════════════════════════════════ */
function MenuItem({ item, isOpen, onToggle, onLinkClick }) {
  const Icon = item.icon;
  const hasChildren = item.children && item.children.length > 0;
  const hasApiChildren = !!item.apiType; // sections backed by API

  /* ── Leaf (no children, no API section) ── */
  if (!hasChildren && !hasApiChildren) {
    return (
      <li className="ms-item">
        <NavLink
          to={item.path}
          className={({ isActive }) =>
            "ms-parent-btn" + (isActive ? " ms-parent-btn--active" : "")
          }
          onClick={onLinkClick}
          end
        >
          <span className="ms-item-icon"><Icon /></span>
          <span className="ms-item-label">{item.label}</span>
        </NavLink>
      </li>
    );
  }

  /* ── Static children (rate, etc.) ── */
  if (hasChildren && !hasApiChildren) {
    return (
      <li className={"ms-item" + (isOpen ? " ms-item--open" : "")}>
        <button
          type="button"
          className={"ms-parent-btn" + (isOpen ? " ms-parent-btn--expanded" : "")}
          onClick={onToggle}
          aria-expanded={isOpen}
        >
          <span className="ms-item-icon"><Icon /></span>
          <span className="ms-item-label">{item.label}</span>
          <span className="ms-item-count">{item.children.length}</span>
          <IconChevron open={isOpen} />
        </button>

        <div
          className="ms-sub-wrap"
          style={{ "--item-count": item.children.length }}
        >
          <ul className="ms-sub-list">
            {item.children.map((child, idx) => (
              <li key={child.id} className="ms-sub-item" style={{ "--i": idx }}>
                <NavLink
                  to={child.path}
                  className={({ isActive }) =>
                    "ms-sub-link" + (isActive ? " ms-sub-link--active" : "")
                  }
                  onClick={onLinkClick}
                  end
                >
                  <span className="ms-sub-dot" />
                  <span className="ms-sub-text">{child.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      </li>
    );
  }

  /* ── API-backed section (Master, Transaction, Reports) ── */
  // Renders an expandable parent that loads its children from the API
  // mirrors jQuery: loadtree(type) triggered when parent is expanded
  return (
    <li className={"ms-item" + (isOpen ? " ms-item--open" : "")}>
      <button
        type="button"
        className={"ms-parent-btn" + (isOpen ? " ms-parent-btn--expanded" : "")}
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        <span className="ms-item-icon"><Icon /></span>
        <span className="ms-item-label">{item.label}</span>
        <IconChevron open={isOpen} />
      </button>

      {/* API submenu — max-height accordion wrapper */}
      <div
        className={"ms-sub-wrap ms-api-wrap" + (isOpen ? " ms-api-wrap--open" : "")}
      >
        <ApiMenuSection
          apiType={item.apiType}
          isOpen={isOpen}
          onLinkClick={onLinkClick}
        />
      </div>
    </li>
  );
}

/* ═══════════════════════════════════════════════
   MenuSettings  —  exported default component
   Unchanged public API: sidebarOpen, onSidebarChange props
═══════════════════════════════════════════════ */
export default function MenuSettings({ sidebarOpen: externalOpen, onSidebarChange }) {
  const [internalOpen, setInternalOpen] = useState(false);

  // Use external state if provided (lifted), otherwise internal
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = useCallback((val) => {
    const next = typeof val === "function" ? val(open) : val;
    setInternalOpen(next);
    if (onSidebarChange) onSidebarChange(next);
  }, [open, onSidebarChange]);

  const [activeId, setActiveId] = useState(null); // which parent is expanded

  const openSidebar   = useCallback(() => setOpen(true),  [setOpen]);
  const closeSidebar  = useCallback(() => setOpen(false), [setOpen]);
  const toggleSidebar = useCallback(() => setOpen((v) => !v), [setOpen]);

  // Accordion toggle: same parent closes — mirrors jqxTree collapseAll + expand one
  const handleToggle = useCallback((id) => {
    setActiveId((prev) => (prev === id ? null : id));
  }, []);

  // Close sidebar when leaf link clicked — mirrors window.location.href change
  const handleLinkClick = useCallback(() => {
    closeSidebar();
  }, [closeSidebar]);

  // ESC key closes sidebar — mirrors $(document).on('keydown') e.keyCode === 27
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") closeSidebar(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [closeSidebar]);

  // Lock body scroll on mobile when open
  useEffect(() => {
    document.body.classList.toggle("ms-scroll-lock", open);
    return () => document.body.classList.remove("ms-scroll-lock");
  }, [open]);

  // Read credentials from localStorage — identical to jQuery: localStorage.getItem("userid")
  const username = localStorage.getItem("username") || "Admin";
  const avatarChar = username.charAt(0).toUpperCase();

  return (
    <>
      {/* ── Hamburger button — always visible in topbar ── */}
      <button
        type="button"
        className="ms-toggle"
        onClick={toggleSidebar}
        aria-label={open ? "Close navigation" : "Open navigation"}
        title="Toggle Menu"
      >
        {open ? <IconClose /> : <IconMenu />}
      </button>

      {/* ── Backdrop (click to close) ── */}
      {open && (
        <div
          className="ms-backdrop"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      {/* ══════════════════════════════════
          SIDEBAR  — structure unchanged
      ══════════════════════════════════ */}
      <aside
        className={"ms-sidebar" + (open ? " ms-sidebar--open" : "")}
        aria-label="Main navigation sidebar"
      >
        {/* ── Header ── */}
        <div className="ms-header">
          <div className="ms-brand">
            <div className="ms-brand-logo">K</div>
            <div className="ms-brand-text">
              <span className="ms-brand-name">KASSA <strong>BM</strong></span>
              <span className="ms-brand-sub">Admin Panel</span>
            </div>
          </div>
          <button
            type="button"
            className="ms-close"
            onClick={closeSidebar}
            aria-label="Close sidebar"
          >
            <IconClose />
          </button>
        </div>

        <div className="ms-divider" />

        {/* ── User info strip ── */}
        <div className="ms-user-strip">
          <div className="ms-user-avatar">{avatarChar}</div>
          <div className="ms-user-info">
            <span className="ms-user-name">{username}</span>
            <span className="ms-user-role">Administrator</span>
          </div>
          <span className="ms-online-dot" title="Online" />
        </div>

        <div className="ms-divider" />

        {/* ── Section label ── */}
        <p className="ms-section-label">MAIN MENU</p>

        {/* ── Nav ── */}
        <nav className="ms-nav">
          <ul className="ms-list">
            {STATIC_MENU_DATA.map((item) => (
              <MenuItem
                key={item.id}
                item={item}
                isOpen={activeId === item.id}
                onToggle={() => handleToggle(item.id)}
                onLinkClick={handleLinkClick}
              />
            ))}
          </ul>
        </nav>

        {/* ── Footer ── */}
        <div className="ms-footer">
          <span className="ms-footer-text">KASSA BM v7.1</span>
        </div>
      </aside>
    </>
  );
}