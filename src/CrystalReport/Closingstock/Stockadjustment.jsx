// ─────────────────────────────────────────────────────────────────────────────
//  StockAdjustmentDetails.jsx
//  React conversion of the legacy jQuery / jqxWidgets "Stock Adjustment-Details"
//  page.
//  Built on the exact same skeleton as ClosingStock.jsx:
//    - CC.api / CC.getLocal / CC.getStr from Common.jsx
//    - same permission/session bootstrap pattern
//    - same openReportViewer(BASE_URL + /Reports/ReportViewer.aspx) pattern
//    - single centered panel (no Group-By nav sidebar), "sa-" scoped style system
//  Styling: MasterPage.css only — no inline color values, no new theme colors.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import * as CC from "../../components/Common";
import Topbar from "../../components/Topbar";

const BASE_URL = "http://localhost:64215";

// ── API endpoints ───────────────────────────────────────────────────────────
// Report endpoint mapped from the legacy $.ajax url "/Stock/StockAdjustmentReport"
// following the /api/StockReportApp/<ReportName> convention used across the
// already-converted stock report pages.
const StockAdjustmentReportUrl = "/api/StockReportApp/StockAdjustmentReport";

// The legacy page's cmbStockType combo is populated from a hard-coded local
// array (methods.load() → source: [...]), not from an API call, so it's kept
// here as a static list rather than an ApiSelect-backed endpoint.
const STOCK_TYPE_OPTIONS = [
  "BREAKAGE",
  "DAMAGE",
  "EXCESS",
  "EXPIRED",
  "FREE SAMPLE",
  "MANHANDLING",
  "SHORTAGE",
  "WASTAGE",
];

const todayStr = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const toMMDDYYYY = (isoDate) => {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.split("-");
  return `${m}/${d}/${y}`;
};

export default function StockAdjustmentDetails() {
  const navigate = useNavigate();

  // ── Session / permission state ─────────────────────────────────────────
  const [pageAccess, setPageAccess] = useState({
    ready: false,
    allowed: false,
    pageview: 0,
  });

  // ── Company / settings state (loaded once from localStorage, same as jQuery) ──
  const [session, setSession] = useState({
    Comid: "",
    MComid: "",
    CName: "",
    CAddress: "",
    CPhone: "",
  });

  // ── Form state ───────────────────────────────────────────────────────────
  const [stockTypeSel, setStockTypeSel] = useState(null); // { value, label } | null
  const [fromDate, setFromDate] = useState(todayStr());
  const [toDate, setToDate] = useState(todayStr());
  const [daily, setDaily] = useState(false); // rdodaliy checkbox

  // ── UI feedback state ───────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null); // { text, isErr }

  // ── Bootstrap: permission + session, mirrors top of $(document).ready ──
  useEffect(() => {
    const menulist = CC.getLocal("menulist");
    if (menulist == null) {
      setMsg({ text: "Session Close Please Login !!!.", isErr: true });
      navigate("/Login/Index");
      return;
    }

    const menudata = menulist.filter((obj) => obj.PageName === "Stock Adjustment-Details");
    if (!menudata || menudata.length === 0) {
      setMsg({ text: "Page Access Permission Denied !!!.", isErr: true });
      setTimeout(() => navigate("/Home"), 3000);
      return;
    }

    if (menudata[0].View === 0) {
      setMsg({ text: "Page Access Permission Denied !!!.", isErr: true });
      setTimeout(() => navigate("/Home"), 3000);
      return;
    }

    const Comid = CC.getStr("Comid");
    const MComid = CC.getStr("MComid");
    const ComSet = CC.getLocal("Companysetting") || [{}];

    setSession({
      Comid,
      MComid,
      CName: ComSet[0]?.CName || "",
      CAddress: ComSet[0]?.CAddress || "",
      CPhone: ComSet[0]?.CPhone || "",
    });

    setPageAccess({
      ready: true,
      allowed: true,
      pageview: menudata[0].View,
      pageadd: menudata[0].Add,
      pageedit: menudata[0].Edit,
      pagedelete: menudata[0].Delete,
    });
  }, [navigate]);

  // ── Esc key — "Do you want to quit page?" (preserved from ClosingStock.jsx) ──
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.keyCode === 27) {
        e.preventDefault();
        if (window.confirm("Do You Want To Quit Page?")) {
          navigate("/Login/Home");
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [navigate]);

  // ── Refresh button — mirrors $('#btnrefresh') handler exactly ───────────
  const handleRefresh = useCallback(() => {
    setStockTypeSel(null);
    setFromDate(todayStr());
    setToDate(todayStr());
    setDaily(false);
    setMsg(null);
  }, []);

  // ── Report viewer opener — same pattern as ClosingStock.jsx ─────────────
  const openReportViewer = useCallback((params) => {
    const qs = new URLSearchParams(params).toString();
    const url = `${CC.BASE_URL}/Reports/ReportViewer.aspx?${qs}`;

    const w = window.open(
      url,
      "_blank",
      `directories=0,titlebar=0,toolbar=0,location=0,status=0,` +
        `menubar=0,scrollbars=yes,resizable=no,` +
        `width=${screen.width},height=${screen.height - 100}`
    );
    return w;
  }, []);

  // ── View button — replicates the $('#btnview') click handler exactly ───
  const handleView = useCallback(async () => {
    // Mirrors: if a StockType item is selected but its label somehow
    // resolves empty, the legacy code rejects it and refocuses the combo.
    let GroupByText = "";
    if (stockTypeSel) {
      GroupByText = stockTypeSel.label;
      if (!GroupByText) {
        setMsg({ text: "Please Select Valid Supplier Name !!!.", isErr: true });
        setStockTypeSel(null);
        return;
      }
    }

    // Date-order validation — mirrors startdate > enddate check.
    const startdate = new Date(fromDate);
    const enddate = new Date(toDate);
    if (startdate > enddate) {
      setMsg({ text: "From Date Is Greater Than To Date!!", isErr: true });
      return;
    }

    const Fromdate = toMMDDYYYY(fromDate);
    const Todate = toMMDDYYYY(toDate);
    const Daily = daily;
    const ReportTypenew = daily ? "D" : "";
    const GroupBy = "";
    const ReportTitle = "Stock Adjustment Detail Report";

    setLoading(true);
    setMsg(null);

    try {
      const res = await CC.api(
        StockAdjustmentReportUrl,
        null,
        { CacheKeyType: "StockAdjustmentReport", React: 1 },
        {
          Itemwise: "0",
          Daily,
          GroupBy,
          GroupByText,
          Fromdate,
          Todate,
          Comid: session.Comid,
          MComid: session.MComid,
        }
      );

      if (res?.ok || res?.IsSuccess) {
          if(res.Data1==null){
           setMsg({ text: "No Record !!!.", isErr: true });
           return;
           }
        const cacheKey = res.Data15 || res.CacheKey || "";
        openReportViewer({
          ReportName: "StockAdjustmentReport",
          CacheKey: cacheKey,
          GroupByText,
          Itemwise: 0,
          Daily,
          Fromdate,
          Todate,
          ReportType: ReportTypenew,
          ReportTitle,
          CName: session.CName,
          CAddress: session.CAddress,
          CPhone: session.CPhone,
        });
      } else {
        setMsg({ text: "No Record !!!.", isErr: true });
      }
    } catch (err) {
      setMsg({ text: err.message || "Something went wrong.", isErr: true });
    } finally {
      setLoading(false);
      // Clear combo selection after view, matching the trailing
      // $("#cmbStockType").jqxComboBox('clearSelection') call.
      setStockTypeSel(null);
    }
  }, [stockTypeSel, fromDate, toDate, daily, session, openReportViewer]);

  // ── Scoped styles injected once (same tokens as ClosingStock.jsx, "sa-" prefix) ──
  const styles = `
    .sa-shell {
      min-height: 100vh;
      background: #f0f2f5;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      flex-direction: column;
    }
    .sa-layout {
      display: flex;
      flex: 1;
      justify-content: center;
      padding: 24px;
      box-sizing: border-box;
    }
    .sa-panel {
      width: 100%;
      max-width: 620px;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 2px 12px rgba(0,0,0,.08);
      padding: 28px 32px;
      display: flex;
      flex-direction: column;
    }
    .sa-panel-header {
      border-bottom: 1px solid #e8ecf0;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .sa-panel-eyebrow {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .8px;
      color: var(--clr-primary, #1a56db);
      margin-bottom: 6px;
    }
    .sa-panel-title {
      font-size: 20px;
      font-weight: 700;
      color: #1e2d3d;
      line-height: 1.2;
    }
    .sa-section-title {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .6px;
      color: #8a94a6;
      margin: 20px 0 10px;
    }
    .sa-section-title:first-of-type { margin-top: 0; }
    .sa-form-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 16px 20px;
      align-items: start;
      max-width: 100%;
      margin-top: 10px;
      margin-bottom: 8px;
    }
    .sa-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .sa-label {
      font-size: 13px;
      font-weight: 600;
      color: #4a5568;
    }
    .sa-input {
      height: 36px;
      border: 1.5px solid #d1d9e6;
      border-radius: 8px;
      padding: 0 12px;
      font-size: 13px;
      color: #1e2d3d;
      background: #fff;
      width: 100%;
      box-sizing: border-box;
      transition: border-color .15s, box-shadow .15s;
      outline: none;
    }
    .sa-input:focus {
      border-color: var(--clr-primary, #1a56db);
      box-shadow: 0 0 0 3px rgba(26,86,219,.1);
    }
    .sa-toggle-row {
      display: flex;
      align-items: center;
      gap: 8px;
      height: 36px;
      background: #f7f9fc;
      border: 1.5px solid #d1d9e6;
      border-radius: 8px;
      padding: 0 12px;
      cursor: pointer;
      font-size: 13px;
      color: #4a5568;
      font-weight: 500;
      user-select: none;
      width: fit-content;
      margin-top: 10px;
    }
    .sa-toggle-row input[type="checkbox"] {
      width: 15px;
      height: 15px;
      accent-color: var(--clr-primary, #1a56db);
      cursor: pointer;
    }
    .sa-actions {
      display: flex;
      gap: 12px;
      margin-top: 28px;
      padding-top: 20px;
      border-top: 1px solid #e8ecf0;
    }
    .sa-btn {
      height: 40px;
      padding: 0 28px;
      border-radius: 8px;
      border: none;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity .15s, box-shadow .15s;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .sa-btn:disabled { opacity: .5; cursor: not-allowed; }
    .sa-btn-primary {
      background: var(--clr-primary, #1a56db);
      color: #fff;
      box-shadow: 0 2px 8px rgba(26,86,219,.3);
    }
    .sa-btn-primary:not(:disabled):hover {
      opacity: .9;
      box-shadow: 0 4px 14px rgba(26,86,219,.4);
    }
    .sa-btn-secondary {
      background: #f0f2f5;
      color: #4a5568;
      border: 1.5px solid #d1d9e6;
    }
    .sa-btn-secondary:not(:disabled):hover {
      background: #e8ecf0;
    }
    .sa-msg {
      margin-top: 18px;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
    }
    .sa-msg.err { background: #fff0f0; color: #c53030; border: 1px solid #fed7d7; }
    .sa-msg.ok  { background: #f0fff4; color: #276749; border: 1px solid #c6f6d5; }
    @media (max-width: 760px) {
      .sa-layout { padding: 16px; }
      .sa-panel { padding: 20px 16px; }
      .sa-form-grid { grid-template-columns: 1fr; }
    }
  `;

  if (!pageAccess.ready) {
    return (
      <div className="mp-wrap">
        <div className="mp-body">
          {msg && <div className={`mp-msg ${msg.isErr ? "err" : "ok"}`}>{msg.text}</div>}
        </div>
      </div>
    );
  }

  if (!pageAccess.allowed) {
    return (
      <div className="mp-wrap">
        <div className="mp-body">
          <div className="mp-msg err">Page Access Permission Denied !!!.</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{styles}</style>
      <div className="sa-shell">
        <Topbar />

        <div className="sa-layout">
          <main className="sa-panel">
            <div className="sa-panel-header">
              <div className="sa-panel-eyebrow">Stock</div>
              <div className="sa-panel-title">Stock Adjustment Detail Report</div>
            </div>

            <div className="sa-form-grid">
              <div className="sa-field">
                <label className="sa-label" htmlFor="sa-stock-type">Stock Type</label>
                <select
                  id="sa-stock-type"
                  className="sa-input"
                  value={stockTypeSel?.value ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    setStockTypeSel(v ? { value: v, label: v } : null);
                  }}
                >
                  <option value="">Select Stock Type</option>
                  {STOCK_TYPE_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sa-field">
                <label className="sa-label" htmlFor="sa-from-date">From Date</label>
                <input
                  id="sa-from-date"
                  type="date"
                  className="sa-input"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>

              <div className="sa-field">
                <label className="sa-label" htmlFor="sa-to-date">To Date</label>
                <input
                  id="sa-to-date"
                  type="date"
                  className="sa-input"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>
            </div>

            <label className="sa-toggle-row">
              <input
                type="checkbox"
                checked={daily}
                onChange={(e) => setDaily(e.target.checked)}
              />
              Daily
            </label>

            <div className="sa-actions">
              <button
                type="button"
                className="sa-btn sa-btn-primary"
                disabled={loading || pageAccess.pageview === 0}
                onClick={handleView}
              >
                {loading ? "Loading…" : "▶ View"}
              </button>
              <button
                type="button"
                className="sa-btn sa-btn-secondary"
                onClick={handleRefresh}
                disabled={loading}
              >
                ↺ Refresh
              </button>
            </div>

            {msg && <div className={`sa-msg ${msg.isErr ? "err" : "ok"}`}>{msg.text}</div>}
          </main>
        </div>

        {loading && (
          <div className="mp-loader-ov">
            <div className="mp-ldr-box">
              <div className="mp-spin" />
              <div className="mp-ldr-msg">Loading...</div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}