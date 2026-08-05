// ─────────────────────────────────────────────────────────────────────────────
//  ReorderExpiryPopup.jsx
//
//  React port of the jqxWindow auto-popup concept from Home.js -> Load():
//    - Runs ONLY right after a fresh login   (sessionStorage "home" === "1")
//    - Runs ONLY for Admin                   (localStorage "priv" === "Admin")
//    - Reads Mainsetting.ReorderPOPUP / ExpDatePOPUP from localStorage
//      (same object MainSetting.jsx already saves as "Mainsetting")
//    - Calls the same two backend queries the jqx grid used
//        /Stock/ReOrderLevel   -> products where stock <= Min level
//        /Stock/ExpDateReport  -> products nearing expiry
//    - Shows them in a small modal grid (replaces jqxGrid + jqxWindow)
//
//  Nothing in Dashboard.jsx / Mainsetting.jsx / Itemmaster.jsx business logic
//  is changed — this file is purely additive. Drop it next to Dashboard.jsx,
//  Topbar.jsx and Common.jsx, then render <ReorderExpiryPopup /> once inside
//  Dashboard's root div.
//
//  ⚠ VERIFY THESE TWO URLS against your actual Web API routes — they are the
//  "/api/..." equivalents of the legacy MVC actions "/Stock/ReOrderLevel" and
//  "/Stock/ExpDateReport", following the same convention Dashboard.jsx already
//  uses for CC.api("/api/CompanyApp/Dashboard", ...).
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from "react";
import * as CC from "./Common";

const REORDER_URL = "/api/StockInwardApp/ReOrderLevel";
const EXPDATE_URL = "/api/StockInwardApp/ExpDateReport";

const todayMMDDYYYY = () => {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}/${dd}/${d.getFullYear()}`;
};

const toBool = (v) => v === true || v === "true" || v === 1 || v === "1";

const asRows = (res) =>
  Array.isArray(res?.Data) ? res.Data
  : Array.isArray(res?.data) ? res.data
  : Array.isArray(res?.Data1) ? res.Data1
  : [];

export default function ReorderExpiryPopup() {
  const [reorderOpen, setReorderOpen] = useState(false);
  const [reorderRows, setReorderRows] = useState([]);
  const [reorderLoading, setReorderLoading] = useState(false);

  const [expiryOpen, setExpiryOpen] = useState(false);
  const [expiryRows, setExpiryRows] = useState([]);
  const [expiryLoading, setExpiryLoading] = useState(false);

  // ── /Stock/ReOrderLevel — same payload shape as ReorderLoad() in Home.js ──
  const loadReorder = useCallback(async (Comid, MComid) => {
    setReorderLoading(true);
    try {
      const res = await CC.api(REORDER_URL, null, {}, {
        GroupBy: "Supplier",
        GroupByName: "",
        TillDate: todayMMDDYYYY(),
        MinLeval: 1,
        Comid,
        MComid,
      });

      if (res?.ok === false) {
        console.warn("[Reorder] API returned error:", {
          status: res?.status,
          statusText: res?.statusText,
          isSuccess: res?.IsSuccess,
          message: res?.Message,
          statusCode: res?.StatusCode,
        });
        return;
      }

      // Handle both success and partial-success responses
      if (res?.IsSuccess === false) {
        console.warn("[Reorder] Backend returned IsSuccess=false:", res?.Message);
        return;
      }

      const rows = asRows(res);
      setReorderRows(rows);
      if (rows.length > 0) setReorderOpen(true);
    } catch (err) {
      console.error("[Reorder] Fetch error:", err.message);
    } finally {
      setReorderLoading(false);
    }
  }, []);

  // ── /Stock/ExpDateReport — same payload shape as ExpiryLoad() in Home.js ──
  const loadExpiry = useCallback(async (Comid, MComid, days) => {
    setExpiryLoading(true);
    try {
      const res = await CC.api(EXPDATE_URL, null, {}, {
        GroupBy: "",
        GroupByText: "",
        Days: days || 0,
        Comid,
        MComid,
      });

      if (res?.ok === false) {
        console.warn("[Expiry] API returned error:", {
          status: res?.status,
          statusText: res?.statusText,
          isSuccess: res?.IsSuccess,
          message: res?.Message,
          statusCode: res?.StatusCode,
        });
        return;
      }

      // Handle both success and partial-success responses
      if (res?.IsSuccess === false) {
        console.warn("[Expiry] Backend returned IsSuccess=false:", res?.Message);
        return;
      }

      const rows = asRows(res);
      setExpiryRows(rows);
      if (rows.length > 0) setExpiryOpen(true);
    } catch (err) {
      console.error("[Expiry] Fetch error:", err.message);
    } finally {
      setExpiryLoading(false);
    }
  }, []);

  useEffect(() => {
    // Exactly the Load() gate from Home.js:
    //   Priv must be "Admin", and this must be the post-login pass
    //   (sessionStorage "home" is set to "1" at login, and Dashboard.jsx
    //   already flips it back to "0" once the dashboard data is fetched —
    //   see the existing `sessionStorage.setItem("home", "0")` call).
    const priv = localStorage.getItem("priv");
    const home = sessionStorage.getItem("home");
    if (priv !== "Admin" || home !== "1") return;

    let mainSet = [];
    try {
      mainSet = JSON.parse(localStorage.getItem("Mainsetting")) || [];
    } catch {
      mainSet = [];
    }
    const setting = mainSet[0] || {};

    const Comid = CC.getStr("Comid") || "1";
    const MComid = CC.getStr("MComid") || Comid;

    if (toBool(setting.ReorderPOPUP)) {
      loadReorder(Comid, MComid);
    }
    if (toBool(setting.ExpDatePOPUP)) {
      loadExpiry(Comid, MComid, setting.ExpDateBeforeDays);
    }
  }, [loadReorder, loadExpiry]);

  if (!reorderOpen && !expiryOpen) return null;

  return (
    <>
      {reorderOpen && (
        <PopupModal
          title="Reorder Level — Stock Below Minimum"
          width={900}
          onClose={() => setReorderOpen(false)}
          loading={reorderLoading}
        >
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Product Code</th>
                <th style={thStyle}>Description</th>
                <th style={thStyle}>Supplier</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Min Qty</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Stock</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Order Qty</th>
              </tr>
            </thead>
            <tbody>
              {reorderRows.map((r, i) => (
                <tr key={r.Code ?? i}>
                  <td style={tdStyle}>{r.Code}</td>
                  <td style={tdStyle}>{r.Description}</td>
                  <td style={tdStyle}>{r.BrandName}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{r.Min}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{r.Closingqty}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{r.MaxOrderQty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </PopupModal>
      )}

      {expiryOpen && (
        <PopupModal
          title="Expiry Date Alert"
          width={700}
          onClose={() => setExpiryOpen(false)}
          loading={expiryLoading}
        >
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Description</th>
                <th style={thStyle}>Exp Date</th>
                <th style={thStyle}>Mfg Date</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Qty</th>
              </tr>
            </thead>
            <tbody>
              {expiryRows.map((r, i) => (
                <tr key={i}>
                  <td style={tdStyle}>{r.Pname}</td>
                  <td style={tdStyle}>{r.ExpiryDate}</td>
                  <td style={tdStyle}>{r.MfgDate}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{r.Stock}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </PopupModal>
      )}
    </>
  );
}

function PopupModal({ title, width, onClose, loading, children }) {
  return (
    <div style={overlayStyle}>
      <div style={{ ...modalStyle, width, maxWidth: "95vw" }}>
        <div style={headerStyle}>
          <span>{title}</span>
          <button type="button" style={closeBtnStyle} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div style={bodyStyle}>
          {loading ? <div style={{ padding: 24, textAlign: "center" }}>Loading...</div> : children}
        </div>
      </div>
    </div>
  );
}

// ── inline styles (no extra CSS file needed) ──────────────────────────────
const overlayStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.55)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 2000,
};

const modalStyle = {
  background: "#fff",
  borderRadius: 10,
  boxShadow: "0 20px 50px rgba(0,0,0,0.25)",
  overflow: "hidden",
  maxHeight: "85vh",
  display: "flex",
  flexDirection: "column",
};

const headerStyle = {
  background: "#4f7df9",
  color: "#fff",
  padding: "12px 16px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  fontWeight: 600,
  fontSize: 15,
};

const closeBtnStyle = {
  background: "transparent",
  border: "none",
  color: "#fff",
  fontSize: 16,
  cursor: "pointer",
  lineHeight: 1,
  padding: 4,
};

const bodyStyle = {
  padding: 0,
  overflow: "auto",
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 13,
};

const thStyle = {
  textAlign: "left",
  padding: "8px 12px",
  background: "#f1f5f9",
  borderBottom: "1px solid #e2e8f0",
  position: "sticky",
  top: 0,
};

const tdStyle = {
  padding: "7px 12px",
  borderBottom: "1px solid #f1f5f9",
};
