/**
 * KASSA BM — Premium Sidebar Navigation
 * Reads raw <ul><li> HTML from localStorage("menulistload")
 * Parses it into a tree and renders with full icon + expand support.
 */

import React, { useState, useCallback, useEffect, useRef } from "react";
import { NavLink, useLocation } from "react-router-dom";
import "../Menusetting.css";

// ─────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────
function IconChevron({ open }) {
  return (
    <svg className={`ms-chevron ${open ? "ms-chevron--open" : ""}`} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
// Icon Map & Page-name → icon mapping (unchanged from original)
// ─────────────────────────────────────────────────────────────
const ICON_MAP = {
  home: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>),
  users: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>),
  settings: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>),
  report: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>),
  chart: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>),
  invoice: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>),
  product: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>),
  warehouse: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>),
  dollar: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>),
  truck: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>),
  person: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>),
  calendar: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>),
  list: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>),
  "file-text": (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>),
};

const PAGE_NAME_ICON_MAP = {
  "master": "warehouse", "item master": "product", "item": "product",
  "product": "product", "supplier": "truck", "customer": "person",
  "unit": "list", "category": "warehouse", "brand": "product",
  "tax": "dollar", "price list": "dollar", "pricelist": "dollar",
  "opening stock": "warehouse", "godown": "warehouse", "location": "warehouse",
  "account": "dollar", "bank": "dollar", "user": "users", "users": "users",
  "employee": "person", "company": "warehouse",
  "transaction": "report", "purchase": "truck", "purchase order": "truck",
  "purchase invoice": "invoice", "purchase return": "truck", "sales": "chart",
  "sales invoice": "invoice", "billing": "invoice", "billing-pos": "invoice",
  "billing pos": "invoice", "pos": "invoice", "sale return": "invoice",
  "sales return": "invoice", "stock transfer": "warehouse", "stock": "warehouse",
  "closing stock": "warehouse", "payment": "dollar", "receipt": "dollar",
  "supplier payment": "dollar", "customer receipt": "dollar", "expense": "dollar",
  "journal": "report", "delivery": "truck", "delivery note": "truck",
  "crystal report": "report", "report": "report", "sales report": "chart",
  "sales report part1": "chart", "sales report part2": "chart",
  "purchase report": "chart", "stock report": "chart", "ledger": "report",
  "profit": "chart", "utils": "settings", "settings": "settings",
  "utility": "settings", "backup": "settings", "restore": "settings",
  "configuration": "settings", "config": "settings", "log": "list", "audit": "list",
  "itemmaster": "product", "sizemaster": "list", "colormaster": "list",
  "modelmaster": "list", "department": "list", "uom": "list",
  "ratechange": "dollar", "subcategory": "warehouse", "cardmaster": "dollar",
  "group": "list", "salesman": "person", "crmpoints": "chart",
  "accountgroup": "dollar", "purchaseorder": "truck", "purchasereturn": "truck",
  "saleorder": "chart", "sale": "invoice", "reprintbill": "invoice",
  "cancelbill": "invoice", "salereturn": "invoice", "quotation": "invoice",
  "supplierpayment": "dollar", "customerreceipt": "dollar",
  "saledetails": "chart", "purchasedetails": "truck",
  "stockinward": "warehouse", "stockadjustment": "warehouse",
  "cash": "dollar", "physicalstock": "warehouse",
  "passwordsetting": "settings", "transactionpassword": "settings",
  "repackingmaster": "settings", "userrightsmenumaster": "settings",
  "userrightsmaster": "settings", "userrightsreport": "report",
  "mainsetting": "settings",
};

function resolveIconByName(name, defaultIcon) {
  const key = (name || "").toLowerCase().trim();
  if (ICON_MAP[key]) return ICON_MAP[key];
  if (PAGE_NAME_ICON_MAP[key] && ICON_MAP[PAGE_NAME_ICON_MAP[key]]) {
    return ICON_MAP[PAGE_NAME_ICON_MAP[key]];
  }
  for (const [mapKey, iconKey] of Object.entries(PAGE_NAME_ICON_MAP)) {
    if (key.includes(mapKey) || mapKey.includes(key)) {
      if (ICON_MAP[iconKey]) return ICON_MAP[iconKey];
    }
  }
  return defaultIcon;
}

// ─────────────────────────────────────────────────────────────
// HTML PARSER — converts <ul><li> HTML string into a node tree
// ─────────────────────────────────────────────────────────────

/**
 * Recursively walks a <ul> element and returns an array of menu nodes:
 * { id, label, url, isFavGroup, children[] }
 */
let _idCounter = 0;
function nextId() { return ++_idCounter; }

function parseUL(ulEl) {
  const nodes = [];

  Array.from(ulEl.children).forEach((child) => {
    const tag = child.tagName?.toLowerCase();

    // h6 header → skip (favourites label rendered separately)
    if (tag === "h6") return;

    if (tag === "li") {
      const node = parseLI(child);
      if (node) nodes.push(node);
    }
  });

  return nodes;
}

function parseLI(liEl) {
  // A <li> with class "submenu-open" is the Favourites wrapper
  const cls = liEl.className || "";
  if (cls.includes("submenu-open")) {
    // inner <ul> has the favourite links
    const innerUL = liEl.querySelector("ul");
    const children = innerUL ? parseUL(innerUL) : [];
    return { id: nextId(), label: "Favourites", url: null, isFavGroup: true, children };
  }

  // Normal or submenu <li>
  // Direct <a> is the link/button for this node
  const directA = getDirectChild(liEl, "a");
  const label = extractLabel(directA || liEl);
  const url = directA ? (directA.getAttribute("href") || null) : null;

  // Skip separator items (href is empty or "***")
  if (url !== null && (url === "" || url.startsWith("*"))) return null;

  // Check for nested <ul> → this is a parent node
  const nestedUL = getDirectChildUL(liEl);
  const children = nestedUL ? parseUL(nestedUL) : [];

  return {
    id: nextId(),
    label: label.trim(),
    url: url && url !== "javascript:void(0);" && url !== "#" ? url : null,
    isFavGroup: false,
    children,
  };
}

/** Get direct child element by tag (not deeply nested) */
function getDirectChild(el, tag) {
  return Array.from(el.children).find((c) => c.tagName?.toLowerCase() === tag) || null;
}

/** Get direct child <ul> */
function getDirectChildUL(el) {
  return Array.from(el.children).find((c) => c.tagName?.toLowerCase() === "ul") || null;
}

/** Extract visible text label from an <a> or element, stripping icon/arrow spans */
function extractLabel(el) {
  if (!el) return "";
  // Clone so we don't mutate DOM
  const clone = el.cloneNode(true);
  // Remove <i> (feather icons), .menu-arrow spans, <svg>
  clone.querySelectorAll("i, svg, .menu-arrow").forEach((n) => n.remove());
  // Find <span> with actual text
  const span = Array.from(clone.querySelectorAll("span")).find(
    (s) => !s.classList.contains("menu-arrow") && s.textContent.trim()
  );
  if (span) return span.textContent.trim();
  return clone.textContent.trim();
}

/**
 * Parse the raw HTML string from localStorage("menulistload")
 * Returns { favItems, menuTree }
 */
function parseMenuHTML(html) {
  _idCounter = 0;
  if (!html) return { favItems: [], menuTree: [] };

  const wrapper = document.createElement("div");
  wrapper.innerHTML = html;

  // The root should be a <ul>
  const rootUL = wrapper.querySelector("ul");
  if (!rootUL) return { favItems: [], menuTree: [] };

  const topNodes = parseUL(rootUL);

  let favItems = [];
  const menuTree = [];

  topNodes.forEach((node) => {
    if (node.isFavGroup) {
      // Flatten favourites: only leaf links
      favItems = node.children.filter((c) => c.url && !c.children.length);
    } else {
      menuTree.push(node);
    }
  });

  return { favItems, menuTree };
}

// ─────────────────────────────────────────────────────────────
// Check active descendant
// ─────────────────────────────────────────────────────────────
function hasActiveChild(node, pathname) {
  if (node.url && pathname.startsWith(node.url) && node.url !== "#") return true;
  return (node.children || []).some((c) => hasActiveChild(c, pathname));
}

// ─────────────────────────────────────────────────────────────
// Menu Node — recursive renderer
// ─────────────────────────────────────────────────────────────
function MenuNode({ item, depth = 0, onLinkClick }) {
  const location = useLocation();
  const isChildActive = hasActiveChild(item, location.pathname);
  const [open, setOpen] = useState(isChildActive);

  useEffect(() => {
    if (isChildActive) setOpen(true);
  }, [location.pathname, isChildActive]);

  const hasChildren = item.children?.length > 0;

  // ── Leaf node
  if (!hasChildren) {
    const leafIcon = resolveIconByName(item.label, <IconLink />);
    return (
      <li className="ms-sub-item">
        <NavLink
          to={item.url || "#"}
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
          <span className="ms-sub-text">{item.label}</span>
        </NavLink>
      </li>
    );
  }

  // ── Parent node
  const parentIcon = resolveIconByName(item.label, <IconFolder />);
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
        {/* <span className="ms-item-label">{item.label}</span> */}
        
        <span className="ms-item-icon">{parentIcon}</span>
        <span className="ms-item-label">{item.label}</span>
        {/* {item.children.length > 0 && (
          <span className="ms-item-count">{item.children.length}</span>
        )} */}
        <IconChevron open={open} />
      </button>

      <div className="ms-sub-wrap" style={{ "--item-count": item.children.length }}>
        <ul className="ms-sub-list">
          {item.children.map((child) => (
            <MenuNode
              key={child.id}
              item={child}
              depth={depth + 1}
              onLinkClick={onLinkClick}
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

  // ── Read & parse from localStorage on every open (stays fresh)
  const [parsed, setParsed] = useState(() => {
    const raw = localStorage.getItem("menulistload") || "";
    return parseMenuHTML(raw);
  });

  // Re-parse whenever sidebar opens so new logins get fresh menu
  useEffect(() => {
    if (sidebarOpen) {
      const raw = localStorage.getItem("menulistload") || "";
      setParsed(parseMenuHTML(raw));
    }
  }, [sidebarOpen]);

  const { favItems, menuTree } = parsed;

  const username = localStorage.getItem("username") || "Admin";

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

        {/* Navigation */}
        <nav className="ms-nav">
          <ul className="ms-list">

            {/* FAVOURITES */}
            {favItems.length > 0 && (
              <li className="ms-item ms-item--open ms-item--fav-group">
                <div className="ms-fav-header">
                  <span className="ms-fav-icon"><IconStar /></span>
                  <span>Favourites</span>
                </div>
                <ul className="ms-sub-list ms-fav-list">
                  {favItems.map((fav) => {
                    const favIcon = resolveIconByName(fav.label, <IconLink />);
                    return (
                      <li key={fav.id} className="ms-sub-item">
                        <NavLink
                          to={fav.url}
                          className={({ isActive }) =>
                            "ms-sub-link" + (isActive ? " ms-sub-link--active" : "")
                          }
                          onClick={closeSidebar}
                          end
                        >
                          <span className="ms-item-icon ms-sub-icon">{favIcon}</span>
                          <span className="ms-sub-text">{fav.label}</span>
                        </NavLink>
                      </li>
                    );
                  })}
                </ul>
              </li>
            )}

            {favItems.length > 0 && menuTree.length > 0 && (
              <li className="ms-section-divider" aria-hidden="true" />
            )}

            {menuTree.length > 0 && (
              <li className="ms-section-label">Menu</li>
            )}

            {menuTree.map((item) => (
              <MenuNode key={item.id} item={item} onLinkClick={closeSidebar} />
            ))}

            {menuTree.length === 0 && favItems.length === 0 && (
              <li style={{ padding: "2rem 1rem", color: "var(--ms-text-muted, #888)", fontSize: "0.85rem", textAlign: "center" }}>
                No menu loaded.<br />
                <small>Check localStorage "menulistload"</small>
              </li>
            )}

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