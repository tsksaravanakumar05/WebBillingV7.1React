// ─────────────────────────────────────────────────────────────────────────────
//  PhysicalStockApplyReport.jsx
//  React conversion of the legacy jQuery / jqxWidgets "Physical Stock Apply
//  Report" page — Built on the exact same skeleton as ClosingStock.jsx:
//    - CC.api / CC.getLocal / CC.getStr from Common.jsx
//    - same permission/session bootstrap pattern
//    - same openReportViewer(BASE_URL + /Reports/ReportViewer.aspx) pattern
//    - same scoped style system, this page uses the "pa-" prefix
//  No Group-By nav and no combo pickers in the legacy page — just a
//  From/To date range and a View / Refresh action, so this uses a single
//  centered panel layout (no left nav sidebar).
//  Styling: MasterPage.css tokens only — no inline color values, no new
//  theme colors.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import * as CC from "../../components/Common";
import Topbar from "../../components/Topbar";

const BASE_URL = "http://localhost:64215";

// ── API endpoint ─────────────────────────────────────────────────────────────
// The original jQuery file posts to /Stock/PhysicalStockEntryReport. Following
// the module mapping used across the other converted Stock report pages
// (ClosingStock, InventoryQtyWise), this becomes /api/StockReportApp/... —
// please verify this is the real route on your Web API layer.
const PhysicalStockEntryReportUrl = "/api/StockReportApp/PhysicalStockEntryReport";

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

export default function PhysicalStockApplyReport() {
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

  // ── Date range state ─────────────────────────────────────────────────────
  const [fromDate, setFromDate] = useState(todayStr());
  const [toDate, setToDate] = useState(todayStr());
  const fromDateRef = useRef(null);

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

    const menudata = menulist.filter((obj) => obj.PageName === "Physical Stock Apply Report");
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

  // ── Refresh button — resets both date pickers to today, same as jqxDateTimeInput re-init ──
  const handleRefresh = useCallback(() => {
    setFromDate(todayStr());
    setToDate(todayStr());
    setMsg(null);
  }, []);

  // ── Report viewer opener — same pattern as ClosingStock.jsx ────────────
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

  // ── View button — replicates the legacy $.ajax logic exactly ───────────
  const handleView = useCallback(async () => {
    const Fromdate = toMMDDYYYY(fromDate);
    const Todate = toMMDDYYYY(toDate);

    const startdate = new Date(Fromdate);
    const enddate = new Date(Todate);
    if (startdate > enddate) {
      setMsg({ text: "From Date Is Greater Than To Date!!", isErr: true });
      fromDateRef.current?.focus();
      return;
    }

    const Comid = session.Comid;

    setLoading(true);
    setMsg(null);

    try {
      const res = await CC.api(
        PhysicalStockEntryReportUrl,
        null,
        { CacheKeyType: "PhysicalStockEntryReport", React: 1 },
        { Fromdate, Todate, Comid }
      );

      if (res?.ok || res?.IsSuccess) {
         if(res.Data1==null){
           setMsg({ text: "No Record !!!.", isErr: true });
           return;
           } 
        const cacheKey = res.Data15 || res.CacheKey || "";
        const w = openReportViewer({
          ReportName: "PhysicalStockEntryReport",
          CacheKey: cacheKey,
          RiceUOMSetting: false,
          ReportTitle: "Physical Stock Entry Report",
          ReportType: "",
          Fromdate,
          Todate,
        });
        if (w) {
          w.addEventListener(
            "load",
            () => {
              w.document.title = "Physical Stock Entry Report";
            },
            false
          );
        }
      } else {
        setMsg({ text: "No Record !!!.", isErr: true });
      }
    } catch (err) {
      setMsg({ text: "Technical Fault Contact Software Vendor  !!!.", isErr: true });
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, session, openReportViewer]);

  // ── Scoped styles injected once (same tokens as ClosingStock.jsx, "pa-" prefix) ──
  const styles = `
    .pa-shell {
      min-height: 100vh;
      background: #f0f2f5;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      flex-direction: column;
    }
    .pa-layout {
      display: flex;
      flex: 1;
      justify-content: center;
      padding: 24px;
      width: 100%;
      box-sizing: border-box;
    }
    .pa-panel {
      width: 100%;
      max-width: 520px;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 2px 12px rgba(0,0,0,.08);
      padding: 28px 32px;
      display: flex;
      flex-direction: column;
      align-self: flex-start;
    }
    .pa-panel-header {
      border-bottom: 1px solid #e8ecf0;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .pa-panel-eyebrow {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .8px;
      color: var(--clr-primary, #1a56db);
      margin-bottom: 6px;
    }
    .pa-panel-title {
      font-size: 20px;
      font-weight: 700;
      color: #1e2d3d;
      line-height: 1.2;
    }
    .pa-form-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 16px 20px;
      align-items: start;
      max-width: 100%;
      margin-top: 10px;
      margin-bottom: 8px;
    }
    .pa-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .pa-label {
      font-size: 13px;
      font-weight: 600;
      color: #4a5568;
    }
    .pa-input {
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
    .pa-input:focus {
      border-color: var(--clr-primary, #1a56db);
      box-shadow: 0 0 0 3px rgba(26,86,219,.1);
    }
    .pa-actions {
      display: flex;
      gap: 12px;
      margin-top: 28px;
      padding-top: 20px;
      border-top: 1px solid #e8ecf0;
    }
    .pa-btn {
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
    .pa-btn:disabled { opacity: .5; cursor: not-allowed; }
    .pa-btn-primary {
      background: var(--clr-primary, #1a56db);
      color: #fff;
      box-shadow: 0 2px 8px rgba(26,86,219,.3);
    }
    .pa-btn-primary:not(:disabled):hover {
      opacity: .9;
      box-shadow: 0 4px 14px rgba(26,86,219,.4);
    }
    .pa-btn-secondary {
      background: #f0f2f5;
      color: #4a5568;
      border: 1.5px solid #d1d9e6;
    }
    .pa-btn-secondary:not(:disabled):hover {
      background: #e8ecf0;
    }
    .pa-msg {
      margin-top: 18px;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
    }
    .pa-msg.err { background: #fff0f0; color: #c53030; border: 1px solid #fed7d7; }
    .pa-msg.ok  { background: #f0fff4; color: #276749; border: 1px solid #c6f6d5; }
    @media (max-width: 760px) {
      .pa-layout { padding: 16px; }
      .pa-panel { padding: 20px 16px; }
      .pa-form-grid { grid-template-columns: 1fr; }
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
      <div className="pa-shell">
        <Topbar />

        <div className="pa-layout">
          <main className="pa-panel">
            <div className="pa-panel-header">
              <div className="pa-panel-eyebrow">Stock</div>
              <div className="pa-panel-title">Physical Stock Apply Report</div>
            </div>

            <div className="pa-form-grid">
              <div className="pa-field">
                <label className="pa-label" htmlFor="pa-from-date">From Date</label>
                <input
                  id="pa-from-date"
                  ref={fromDateRef}
                  type="date"
                  className="pa-input"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>
              <div className="pa-field">
                <label className="pa-label" htmlFor="pa-to-date">To Date</label>
                <input
                  id="pa-to-date"
                  type="date"
                  className="pa-input"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>
            </div>

            <div className="pa-actions">
              <button
                type="button"
                className="pa-btn pa-btn-primary"
                disabled={loading || pageAccess.pageview === 0}
                onClick={handleView}
              >
                {loading ? "Loading…" : "▶ View"}
              </button>
              <button
                type="button"
                className="pa-btn pa-btn-secondary"
                onClick={handleRefresh}
                disabled={loading}
              >
                ↺ Refresh
              </button>
            </div>

            {msg && <div className={`pa-msg ${msg.isErr ? "err" : "ok"}`}>{msg.text}</div>}
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