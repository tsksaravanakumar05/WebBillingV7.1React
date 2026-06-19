import React, { memo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../dashboard.css";
import MenuSetting from "./Menusetting";


/* ═══════════════════════════════════════════════
   SVG ICONS (Used only in Topbar)
═══════════════════════════════════════════════ */
function BellIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>; }
function GridIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>; }

/* ═══════════════════════════════════════════════
   TOPBAR COMPONENT
═══════════════════════════════════════════════ */
const Topbar = memo(() => {
  const navigate = useNavigate();
  const username = localStorage.getItem("username") || "User";
  const CompanyName = localStorage.getItem("CompanyName");
  const avatarLetter = username.charAt(0).toUpperCase();

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    navigate("/", { replace: true });
  };
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <header className="kd-topbar">
      <MenuSetting sidebarOpen={sidebarOpen} onSidebarChange={setSidebarOpen} />

      <div className="kd-topbar-left">
        <span className="kd-logo-mark">K</span>
        <span className="kd-logo-text"><strong>{CompanyName}</strong></span>
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

export default Topbar;