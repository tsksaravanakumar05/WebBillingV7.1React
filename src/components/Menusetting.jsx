/**
 * CLEAN MENU SETTINGS
 * Dynamic sidebar from localStorage("menulist")
 * Favourites + Master + Transaction + Reports + Utils
 */

import React, { useState, useCallback, useEffect } from "react";
import { NavLink } from "react-router-dom";
import "../Menusetting.css";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
const getLocal = (k) => {
  try {
    return JSON.parse(localStorage.getItem(k));
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
      strokeWidth="2.5"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function IconMenu() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// Build Menu
// ─────────────────────────────────────────────────────────────
function buildMenuTree(menuList = []) {
  const map = {};

  menuList.forEach((x) => {
    map[x.Id] = {
      ...x,
      children: [],
    };
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
// Menu Item
// ─────────────────────────────────────────────────────────────
function MenuNode({ item, depth = 0, onLinkClick }) {
  const [open, setOpen] = useState(false);

  const hasChildren = item.children?.length > 0;

  // hidden menu skip
  if (Number(item.Status) === 0) return null;

  // leaf
  if (!hasChildren) {
    return (
      <li className="ms-sub-item">
        <NavLink
          to={item.Url || "#"}
          className="ms-sub-link"
          onClick={onLinkClick}
        >
          <span
            className="ms-sub-dot"
            style={{ marginLeft: depth * 12 }}
          />

          <span className="ms-sub-text">
            {item.PageName}
          </span>
        </NavLink>
      </li>
    );
  }

  // parent
  return (
    <li className={`ms-item ${open ? "ms-item--open" : ""}`}>

      <button
        type="button"
        className="ms-parent-btn"
        onClick={() => setOpen(!open)}
      >
        <span className="ms-item-label">
          {item.PageName}
        </span>

        <IconChevron open={open} />
      </button>

      {open && (
        <ul className="ms-sub-list">

          {item.children.map((child) => (
            <MenuNode
              key={child.Id}
              item={child}
              depth={depth + 1}
              onLinkClick={onLinkClick}
            />
          ))}

        </ul>
      )}
    </li>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────
export default function MenuSettings() {

  const [sidebarOpen, setSidebarOpen] = useState(false);

  // full menu from localStorage
  const fullMenu = getLocal("menulist") || [];

  // favourites
  const favourites = fullMenu.filter(
    (x) =>
      Number(x.TopMenu) === 1 &&
      x.Url
  );

  // build tree
  const menuTree = buildMenuTree(fullMenu);

  const username =
    localStorage.getItem("username") || "Admin";

  const avatarChar =
    username.charAt(0).toUpperCase();

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false);
  }, []);

  // esc close
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        closeSidebar();
      }
    };

    document.addEventListener("keydown", onKey);

    return () =>
      document.removeEventListener("keydown", onKey);

  }, [closeSidebar]);

  return (
    <>

      {/* Toggle */}
      <button
        type="button"
        className="ms-toggle"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        {sidebarOpen ? <IconClose /> : <IconMenu />}
      </button>

      {/* Backdrop */}
      {sidebarOpen && (
        <div
          className="ms-backdrop"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={
          "ms-sidebar" +
          (sidebarOpen ? " ms-sidebar--open" : "")
        }
      >

        {/* Header */}
        <div className="ms-header">

          <div className="ms-brand">

            <div className="ms-brand-logo">
              K
            </div>

            <div className="ms-brand-text">

              <span className="ms-brand-name">
                KASSA <strong>BM</strong>
              </span>

              <span className="ms-brand-sub">
                Admin Panel
              </span>

            </div>
          </div>

          <button
            type="button"
            className="ms-close"
            onClick={closeSidebar}
          >
            <IconClose />
          </button>

        </div>

        <div className="ms-divider" />

        {/* User */}
        <div className="ms-user-strip">

          <div className="ms-user-avatar">
            {avatarChar}
          </div>

          <div className="ms-user-info">

            <span className="ms-user-name">
              {username}
            </span>

            <span className="ms-user-role">
              Administrator
            </span>

          </div>

        </div>

        <div className="ms-divider" />

        {/* Menu */}
        <nav className="ms-nav">

          <ul className="ms-list">

            {/* FAVOURITES */}
            {favourites.length > 0 && (
              <li className="ms-item ms-item--open">

                <div className="ms-fav-header">
                  Favourites
                </div>

                <ul className="ms-sub-list">

                  {favourites.map((fav) => (
                    <li
                      key={fav.Id}
                      className="ms-sub-item"
                    >

                      <NavLink
                        to={fav.Url}
                        className="ms-sub-link"
                        onClick={closeSidebar}
                      >
                        <span className="ms-sub-dot" />

                        <span className="ms-sub-text">
                          {fav.PageName}
                        </span>
                      </NavLink>

                    </li>
                  ))}

                </ul>

              </li>
            )}

            {/* MAIN MENU */}
            {menuTree.map((item) => (
              <MenuNode
                key={item.Id}
                item={item}
                onLinkClick={closeSidebar}
              />
            ))}

          </ul>

        </nav>

        {/* Footer */}
        <div className="ms-footer">
          <span className="ms-footer-text">
            KASSA BM v7.1
          </span>
        </div>

      </aside>

    </>
  );
}