/**
 * KASSA BM — Premium Sidebar Navigation
 * Professional ERP/SaaS admin panel sidebar
 * Dynamic from localStorage("menulist")
 * Sections: Favourites + Full Menu Tree
 */

import React, { useState, useCallback, useEffect, useRef } from "react";
import { NavLink, useLocation } from "react-router-dom";
import "../Menusetting.css";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
const getLocal = (k) => {
  try {
    return JSON.parse(localStorage.getItem(k)) || [];
  } catch {
    return [];
  }
};

// ─────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────
function IconChevron({ open }) {
  return (
    <svg
      className={`ms-chevron ${open ? "ms-chevron--open" : ""}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function IconMenu() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function IconStar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function IconFolder() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function IconLink() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// Icon map — keyed by icon name OR page name (lowercase)
// Add more entries here as your menu grows
// ─────────────────────────────────────────────────────────────
const ICON_MAP = {
  // ── by Icon/IconName field ──
  home: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  report: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  ),
  chart: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  invoice: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  ),
  product: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  ),
  warehouse: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  ),
  dollar: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  truck: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="3" width="15" height="13" />
      <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  ),
  person: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  calendar: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  list: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  ),
};

// ─────────────────────────────────────────────────────────────
// PAGE NAME → icon key mapping
// Add entries here to match whatever PageName values your
// menu data uses. Keys are lowercased + trimmed for matching.
// ─────────────────────────────────────────────────────────────
const PAGE_NAME_ICON_MAP = {
  // Master group
  "master":            "warehouse",
  "item master":       "product",
  "item":              "product",
  "product":           "product",
  "supplier":          "truck",
  "customer":          "person",
  "unit":              "list",
  "category":          "warehouse",
  "brand":             "product",
  "tax":               "dollar",
  "price list":        "dollar",
  "pricelist":         "dollar",
  "opening stock":     "warehouse",
  "godown":            "warehouse",
  "location":          "warehouse",
  "account":           "dollar",
  "bank":              "dollar",
  "user":              "users",
  "users":             "users",
  "employee":          "person",
  "company":           "warehouse",

  // Transaction group
  "transaction":       "report",
  "purchase":          "truck",
  "purchase order":    "truck",
  "purchase invoice":  "invoice",
  "purchase return":   "truck",
  "sales":             "chart",
  "sales invoice":     "invoice",
  "billing":           "invoice",
  "billing-pos":       "invoice",
  "billing pos":       "invoice",
  "pos":               "invoice",
  "sale return":       "invoice",
  "sales return":      "invoice",
  "stock transfer":    "warehouse",
  "stock":             "warehouse",
  "closing stock":     "warehouse",
  "payment":           "dollar",
  "receipt":           "dollar",
  "supplier payment":  "dollar",
  "customer receipt":  "dollar",
  "expense":           "dollar",
  "journal":           "report",
  "delivery":          "truck",
  "delivery note":     "truck",

  // Report group
  "crystal report":    "report",
  "report":            "report",
  "sales report":      "chart",
  "sales report part1":"chart",
  "sales report part2":"chart",
  "purchase report":   "chart",
  "stock report":      "chart",
  "ledger":            "report",
  "profit":            "chart",

  // Utils / settings
  "utils":             "settings",
  "settings":          "settings",
  "utility":           "settings",
  "backup":            "settings",
  "restore":           "settings",
  "configuration":     "settings",
  "config":            "settings",
  "log":               "list",
  "audit":             "list",
};

// ─────────────────────────────────────────────────────────────
// Resolve icon — checks in order:
//   1. item.Icon or item.IconName field (your existing logic)
//   2. item.PageName matched against PAGE_NAME_ICON_MAP
//   3. Falls back to defaultIcon
// ─────────────────────────────────────────────────────────────
function resolveIcon(item, defaultIcon) {
  // 1. Explicit icon field
  const iconField = (item.Icon || item.IconName || "").toString().toLowerCase().trim();
  if (iconField && ICON_MAP[iconField]) return ICON_MAP[iconField];

  // 2. PageName-based fallback
  const pageName = (item.PageName || "").toString().toLowerCase().trim();
  if (pageName) {
    // Exact match first
    if (PAGE_NAME_ICON_MAP[pageName] && ICON_MAP[PAGE_NAME_ICON_MAP[pageName]]) {
      return ICON_MAP[PAGE_NAME_ICON_MAP[pageName]];
    }
    // Partial/contains match
    for (const [key, iconKey] of Object.entries(PAGE_NAME_ICON_MAP)) {
      if (pageName.includes(key) || key.includes(pageName)) {
        if (ICON_MAP[iconKey]) return ICON_MAP[iconKey];
      }
    }
  }

  // 3. Default
  return defaultIcon;
}

// ─────────────────────────────────────────────────────────────
// Build Menu Tree
// ─────────────────────────────────────────────────────────────
function buildMenuTree(menuList = []) {
  const map = {};
  menuList.forEach((x) => {
    map[x.Id] = { ...x, children: [] };
  });
  const roots = [];
  menuList.forEach((x) => {
    if (x.ParentId && map[x.ParentId]) {
      map[x.ParentId].children.push(map[x.Id]);
    } else {
      roots.push(map[x.Id]);
    }
  });
  return roots;
}

// ─────────────────────────────────────────────────────────────
// Check if any descendant URL matches current route
// ─────────────────────────────────────────────────────────────
function hasActiveChild(item, pathname) {
  if (item.Url && pathname.startsWith(item.Url) && item.Url !== "#") return true;
  if (item.children) {
    return item.children.some((child) => hasActiveChild(child, pathname));
  }
  return false;
}

// ─────────────────────────────────────────────────────────────
// Menu Node — recursive
// ─────────────────────────────────────────────────────────────
function MenuNode({ item, depth = 0, onLinkClick }) {
  const location = useLocation();
  const isChildActive = hasActiveChild(item, location.pathname);
  const [open, setOpen] = useState(isChildActive);

  useEffect(() => {
    if (isChildActive) setOpen(true);
  }, [location.pathname, isChildActive]);

  const hasChildren = item.children?.length > 0;

  if (Number(item.Status) === 0) return null;

  // ── Leaf node
  if (!hasChildren) {
    const leafIcon = resolveIcon(item, <IconLink />);
    return (
      <li className="ms-sub-item">
        <NavLink
          to={item.Url || "#"}
          className={({ isActive }) =>
            "ms-sub-link" + (isActive ? " ms-sub-link--active" : "")
          }
          onClick={onLinkClick}
          end
        >
          <span
            className="ms-item-icon ms-sub-icon"
            style={{ marginLeft: depth > 1 ? (depth - 1) * 10 : 0 }}
          >
            {leafIcon}
          </span>
          <span className="ms-sub-text">{item.PageName}</span>
        </NavLink>
      </li>
    );
  }

  // ── Parent node
  const parentIcon = resolveIcon(item, <IconFolder />);
  return (
    <li
      className={`ms-item ${open ? "ms-item--open" : ""} ${
        isChildActive ? "ms-item--active-parent" : ""
      }`}
    >
      <button
        type="button"
        className={`ms-parent-btn ${open ? "ms-parent-btn--expanded" : ""} ${
          isChildActive && !open ? "ms-parent-btn--has-active" : ""
        }`}
        onClick={() => setOpen((v) => !v)}
        style={{ paddingLeft: depth > 0 ? `${11 + depth * 10}px` : undefined }}
      >
        <span className="ms-item-icon">{parentIcon}</span>
        <span className="ms-item-label">{item.PageName}</span>
        {item.children.length > 0 && (
          <span className="ms-item-count">{item.children.length}</span>
        )}
        <IconChevron open={open} />
      </button>

      <div className="ms-sub-wrap" style={{ "--item-count": item.children.length }}>
        <ul className="ms-sub-list">
          {item.children.map((child, i) => (
            <MenuNode
              key={child.Id}
              item={child}
              depth={depth + 1}
              onLinkClick={onLinkClick}
              style={{ "--i": i }}
            />
          ))}
        </ul>
      </div>
    </li>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────
export default function MenuSettings() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarRef = useRef(null);

  const fullMenu = getLocal("menulist") || [];

  const favourites = fullMenu.filter(
    (x) => Number(x.TopMenu) === 1 && x.Url && x.Url !== "#"
  );

  const menuTree = buildMenuTree(fullMenu);

  const username = localStorage.getItem("username") || "Admin";
  const avatarChar = username.charAt(0).toUpperCase();

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const toggleSidebar = useCallback(() => setSidebarOpen((v) => !v), []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") closeSidebar(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [closeSidebar]);

  useEffect(() => {
    if (sidebarOpen) {
      document.body.classList.add("ms-scroll-lock");
    } else {
      document.body.classList.remove("ms-scroll-lock");
    }
    return () => document.body.classList.remove("ms-scroll-lock");
  }, [sidebarOpen]);

  return (
    <>
      {/* Hamburger Toggle */}
      
{!sidebarOpen && (
  <button
    type="button"
    className="ms-toggle"
    onClick={toggleSidebar}
    aria-expanded={sidebarOpen}
  >
    <IconMenu />
  </button>
)}

      {/* Backdrop */}
      {sidebarOpen && (
        <div className="ms-backdrop" onClick={closeSidebar} aria-hidden="true" />
      )}

      {/* Sidebar Panel */}
      <aside
        ref={sidebarRef}
        className={`ms-sidebar ${sidebarOpen ? "ms-sidebar--open" : ""}`}
        aria-label="Main navigation"
        role="navigation"
      >
        {/* Header */}
        <div className="ms-header">
          <div className="ms-brand">
            <div className="ms-brand-logo">K</div>
            <div className="ms-brand-text">
              <span className="ms-brand-name">
                KASSA <strong>BM</strong>
              </span>
              <span className="ms-brand-sub">Admin Panel</span>
            </div>
          </div>
          <button type="button" className="ms-close" onClick={closeSidebar} aria-label="Close sidebar">
            <IconClose />
          </button>
        </div>

        <div className="ms-divider" />
        <div className="ms-divider" />

        {/* Navigation */}
        <nav className="ms-nav">
          <ul className="ms-list">

            {/* FAVOURITES */}
            {favourites.length > 0 && (
              <li className="ms-item ms-item--open ms-item--fav-group">
                <div className="ms-fav-header">
                  <span className="ms-fav-icon"><IconStar /></span>
                  <span>Favourites</span>
                </div>
                <ul className="ms-sub-list ms-fav-list">
                  {favourites.map((fav) => {
                    const favIcon = resolveIcon(fav, <IconLink />);
                    return (
                      <li key={fav.Id} className="ms-sub-item">
                        <NavLink
                          to={fav.Url}
                          className={({ isActive }) =>
                            "ms-sub-link" + (isActive ? " ms-sub-link--active" : "")
                          }
                          onClick={closeSidebar}
                          end
                        >
                          <span className="ms-item-icon ms-sub-icon">{favIcon}</span>
                          <span className="ms-sub-text">{fav.PageName}</span>
                        </NavLink>
                      </li>
                    );
                  })}
                </ul>
              </li>
            )}

            {favourites.length > 0 && menuTree.length > 0 && (
              <li className="ms-section-divider" aria-hidden="true" />
            )}

            {menuTree.length > 0 && (
              <li className="ms-section-label">Menu</li>
            )}

            {menuTree.map((item) => (
              <MenuNode key={item.Id} item={item} onLinkClick={closeSidebar} />
            ))}

          </ul>
        </nav>

        {/* Footer */}
        <div className="ms-footer">
          <div className="ms-footer-inner">
            <span className="ms-footer-text">KASSA BM v7.1</span>
            <span className="ms-footer-dot" />
            <span className="ms-footer-text">© 2025</span>
          </div>
        </div>
      </aside>
    </>
  );
}