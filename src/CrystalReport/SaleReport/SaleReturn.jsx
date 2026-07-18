// ─────────────────────────────────────────────────────────────────────────────
//  SaleReturn.jsx
//  React conversion of SaleReturn.js (jQuery) — "Sale Return Report"
//  Uses API helpers from Common.jsx (CC.api / CC.mkUrl / CC.authHeaders etc.)
//  Styling: MasterPage.css only — no inline color values, no new theme colors.
//
//  Architecture mirrored from CashBook.jsx (BankBook.jsx was referenced by the
//  requester but was not present in the uploaded files — CashBook.jsx is the
//  closest available React source and was used as the structural template
//  instead. If BankBook.jsx differs, re-supply it and this file can be
//  re-aligned to match it exactly).
//
//  NOTE: unlike CashBook, this legacy screen DOES have report-type radio
//  buttons (Consolidate / Details / Itemwise), so the left nav-card
//  report-type picker IS included here, same as the original SalesReport
//  family of screens. (Cashier grouping, MRP toggle, and the F11 ItemGroup
//  picker have been removed per request — not required for this screen.)
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import * as CC from "../../components/Common";
import Topbar from "../../components/Topbar";

const BASE_URL = "http://localhost:64215";

// API endpoints used by this screen (kept exactly as the legacy jQuery file
// had them — MVC action routes, not the /api/... convention used by newer
// report screens; confirm with the backend whether they should be migrated).
const SalesReturnConsolidateUrl = "/api/SalesReportApp/SalesReturnConsolidateReport";
const SalesReturnDetailsUrl = "/api/SalesReportApp/SalesReturnDetailsReport";
const SalesReturnItemwiseUrl = "/api/SalesReportApp/SalesReturnItemwiseReport";

// Report-type radio options (left nav-card), same three as legacy markup.
const REPORT_TYPES = [
  { key: "Consolidate", label: "Sales Return Consolidated" },
  { key: "Details", label: "Sales Return Details" },
  { key: "Itemwise", label: "Sales Return Itemwise" },
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

export default function SaleReturn() {
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
    MUOM: "",
    taxinclusivedontshow: 1,
  });

  // ── Report-type selection (left panel radios, groupName: "Panel") ──────
  const [reportType, setReportType] = useState("Consolidate");

  // ── Form state (controlled inputs replacing jqx widgets) ───────────────
  const [fromDate, setFromDate] = useState(todayStr());
  const [toDate, setToDate] = useState(todayStr());
  const [daily, setDaily] = useState(false);

  // ── UI feedback state ───────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null); // { text, isErr }

  const fromDateRef = useRef(null);

  useEffect(() => {
    const menulist = CC.getLocal("menulist");
    if (menulist == null) {
      setMsg({ text: "Session Close Please Login !!!.", isErr: true });
      navigate("/Login/Index");
      return;
    }

    const menudata = menulist.filter((obj) => obj.PageName === "Sale Return-Report");
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
    const MainSet = CC.getLocal("Mainsetting") || [{}];
    const MUOM = MainSet[0]?.MultipleUOMBilling || "";
    const ComSet = CC.getLocal("Companysetting") || [{}];
    const taxinclusivedontshow = ComSet[0]?.POSTax !== "Inclusive Don't Show Tax" ? 0 : 1;

    setSession({
      Comid,
      MComid,
      CName: ComSet[0]?.CName || "",
      CAddress: ComSet[0]?.CAddress || "",
      CPhone: ComSet[0]?.CPhone || "",
      MUOM,
      taxinclusivedontshow,
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

  // Esc-to-quit
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Esc Press
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

  // Reset daily whenever report-type changes, mirroring the three
  // near-identical rdb click handlers in the legacy file.
  const handleReportTypeChange = useCallback((key) => {
    setReportType(key);
    setDaily(false);
  }, []);

  const handleRefresh = useCallback(() => {
    setFromDate(todayStr());
    setToDate(todayStr());
    setDaily(false);
  }, []);

  const openReportViewer = useCallback((params, title) => {
    const qs = new URLSearchParams(params).toString();
    const url = `${CC.BASE_URL}/Reports/ReportViewer.aspx?${qs}`;

    const w = window.open(
      url,
      "_blank",
      `directories=0,titlebar=0,toolbar=0,location=0,status=0,` +
      `menubar=0,scrollbars=yes,resizable=no,` +
      `width=${screen.width},height=${screen.height - 100}`
    );
    if (w) {
      w.addEventListener("load", () => { w.document.title = title; }, false);
    }
  }, []);

  const handleView = useCallback(async () => {
    const Fromdate = toMMDDYYYY(fromDate);
    const Todate = toMMDDYYYY(toDate);

    if (new Date(Fromdate) > new Date(Todate)) {
      setMsg({ text: "From Date Is Greater Than To Date!!", isErr: true });
      fromDateRef.current?.focus();
      return;
    }

    const GroupBy = "";
    const GroupByText = "";

    const ReportTypenew = daily ? "D" : "";
    const TaxSuppressId = session.taxinclusivedontshow === 1 ? 1 : 0;

    setLoading(true);
    setMsg(null);

    try {
      if (reportType === "Consolidate") {
        const ReportTitle = "Sales Return Consolidate";
        const res = await CC.api(SalesReturnConsolidateUrl, null, { React: 1 }, {
          Fromdate,
          Todate,
          Comid: session.Comid,
          GroupBy,
          GroupByText,
        });
        if (res.ok === true) {
          const cacheKey =
          res.Data15 ??
          res.data15 ??
          res.data?.Data15 ??
          res.data?.data15;
          openReportViewer({
            ReportName: "SaleReturnConsolidateReport",
            CacheKey    : cacheKey,
            Daily: daily,
            GroupBy,
            Fromdate,
            Todate,
            ReportType: ReportTypenew,
            ReportTitle,
            CName: session.CName,
            CAddress: session.CAddress,
            CPhone: session.CPhone,
          }, "Sales Return Consolidate");
        } else {
          setMsg({ text: "No Record !!!.", isErr: true });
        }
      } else if (reportType === "Details") {
        const ReportTitle = "Sales Return Details";
        const res = await CC.api(SalesReturnDetailsUrl, null, { React: 1 }, {
          Fromdate,
          Todate,
          Comid: session.Comid,
          MComid: session.MComid,
          GroupBy,
          GroupByText,
        });
        if (res.ok === true) {
            const cacheKey = res.Data15 || "";
            console.log("CacheKey:", cacheKey);
          openReportViewer({
            ReportName: "SaleReturnDetailsReport",
            CacheKey    : cacheKey, 
            Daily: daily,
            GroupBy,
            Fromdate,
            Todate,
            ReportType: ReportTypenew,
            ReportTitle,
            taxinclusivedontshow: session.taxinclusivedontshow,
            CName: session.CName,
            CAddress: session.CAddress,
            CPhone: session.CPhone,
          }, "Sales Return Details-Report");
        } else {
          setMsg({ text: "No Record !!!.", isErr: true });
        }
      } else if (reportType === "Itemwise") {
        const ReportTitle = "Sales Return ItemWise Report";
        const res = await CC.api(SalesReturnItemwiseUrl, null, { React: 1 }, {
          Daily: daily,
          Fromdate,
          Todate,
          MUOM: session.MUOM,
          Comid: session.Comid,
          MComid: session.MComid,
          GroupBy,
          GroupByText,
        });
        if (res.ok === true) {
            const cacheKey = res.Data15 || "";
            console.log("CacheKey:", cacheKey);
          openReportViewer({
            
            ReportName: "SaleReturnItemWiseReport",
            CacheKey    : cacheKey,
            Daily: daily,
            GroupBy,
            Fromdate,
            Todate,
            TaxSuppressId,
            ReportType: ReportTypenew,
            ReportTitle,
            CName: session.CName,
            CAddress: session.CAddress,
            CPhone: session.CPhone,
          }, "Sales Return ItemWise-Report");
        } else {
          setMsg({ text: "No Record !!!.", isErr: true });
        }
      }
    } catch (err) {
      setMsg({ text: err.message || "Something went wrong.", isErr: true });
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, reportType, daily, session, openReportViewer]);

  const styles = `
    .so-shell { min-height: 100vh; background: #f0f2f5; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; flex-direction: column; }
    .so-topbar { background: var(--clr-primary, #1a56db); color: #fff; display: flex; align-items: center; justify-content: space-between; padding: 0 24px; height: 52px; box-shadow: 0 2px 8px rgba(0,0,0,.18); flex-shrink: 0; }
    .so-topbar-title { font-size: 15px; font-weight: 600; letter-spacing: .3px; }
    .so-close-btn { background: rgba(255,255,255,.15); border: none; color: #fff; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; transition: background .15s; }
    .so-close-btn:hover { background: rgba(255,255,255,.28); }
    .so-layout { display: flex; flex: 1; gap: 20px; padding: 24px; max-width: 1200px; width: 100%; margin: 0 auto; box-sizing: border-box; }
    .so-nav-card { width: 280px; flex-shrink: 0; background: #fff; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,.08); padding: 24px 20px; display: flex; flex-direction: column; }
    .so-nav-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; color: #8592a6; margin-bottom: 14px; padding-bottom: 12px; border-bottom: 1px solid #e8ecf0; }
    .so-nav-item { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-radius: 8px; font-size: 13.5px; font-weight: 600; color: #4a5568; cursor: pointer; margin-bottom: 6px; transition: background .15s, color .15s; user-select: none; }
    .so-nav-item:hover { background: #f0f4fb; }
    .so-nav-item.active { background: var(--clr-primary, #1a56db); color: #fff; }
    .so-nav-item input[type="radio"] { accent-color: #fff; width: 14px; height: 14px; cursor: pointer; }
    .so-panel { flex: 1; background: #fff; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,.08); padding: 28px 32px; display: flex; flex-direction: column; }
    .so-panel-header { border-bottom: 1px solid #e8ecf0; padding-bottom: 16px; margin-bottom: 28px; }
    .so-panel-eyebrow { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; color: var(--clr-primary, #1a56db); margin-bottom: 6px; }
    .so-panel-title { font-size: 20px; font-weight: 700; color: #1e2d3d; line-height: 1.2; }
    .so-form-grid { display: grid; grid-template-columns: 130px 1fr; gap: 20px 16px; align-items: center; max-width: 460px; }
    .so-label { font-size: 13px; font-weight: 600; color: #4a5568; }
    .so-input { height: 38px; border: 1.5px solid #d1d9e6; border-radius: 8px; padding: 0 12px; font-size: 13px; color: #1e2d3d; background: #fff; width: 100%; box-sizing: border-box; transition: border-color .15s, box-shadow .15s; outline: none; }
    .so-input:focus { border-color: var(--clr-primary, #1a56db); box-shadow: 0 0 0 3px rgba(26,86,219,.1); }
    .so-input:disabled { background: #f7f9fc; color: #a0aec0; cursor: not-allowed; }
    .so-select { height: 38px; border: 1.5px solid #d1d9e6; border-radius: 8px; padding: 0 12px; font-size: 13px; color: #1e2d3d; background: #fff; width: 100%; box-sizing: border-box; outline: none; }
    .so-select:disabled { background: #f7f9fc; color: #a0aec0; cursor: not-allowed; }
    .so-toggle-row { display: flex; align-items: center; gap: 10px; height: 38px; background: #f7f9fc; border: 1.5px solid #d1d9e6; border-radius: 8px; padding: 0 12px; cursor: pointer; font-size: 13px; color: #4a5568; font-weight: 500; user-select: none; transition: border-color .15s; }
    .so-toggle-row:hover { border-color: var(--clr-primary, #1a56db); }
    .so-toggle-row input[type="checkbox"] { width: 15px; height: 15px; accent-color: var(--clr-primary, #1a56db); cursor: pointer; }
    .so-actions { display: flex; gap: 12px; margin-top: 32px; padding-top: 24px; border-top: 1px solid #e8ecf0; }
    .so-btn { height: 40px; padding: 0 28px; border-radius: 8px; border: none; font-size: 14px; font-weight: 600; cursor: pointer; transition: opacity .15s, box-shadow .15s; display: flex; align-items: center; gap: 8px; }
    .so-btn:disabled { opacity: .5; cursor: not-allowed; }
    .so-btn-primary { background: var(--clr-primary, #1a56db); color: #fff; box-shadow: 0 2px 8px rgba(26,86,219,.3); }
    .so-btn-primary:not(:disabled):hover { opacity: .9; box-shadow: 0 4px 14px rgba(26,86,219,.4); }
    .so-btn-secondary { background: #f0f2f5; color: #4a5568; border: 1.5px solid #d1d9e6; }
    .so-btn-secondary:not(:disabled):hover { background: #e8ecf0; }
    .so-msg { margin-top: 18px; padding: 10px 14px; border-radius: 8px; font-size: 13px; font-weight: 500; }
    .so-msg.err { background: #fff0f0; color: #c53030; border: 1px solid #fed7d7; }
    .so-msg.ok  { background: #f0fff4; color: #276749; border: 1px solid #c6f6d5; }
    .so-hint { font-size: 11.5px; color: #8592a6; margin-top: 10px; }
    @media (max-width: 900px) {
      .so-layout { flex-direction: column; padding: 16px; }
      .so-nav-card { width: 100%; }
      .so-panel { padding: 20px 16px; }
      .so-form-grid { grid-template-columns: 110px 1fr; }
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
      <div className="so-shell">
        <Topbar/>
        <div className="so-layout">
          <aside className="so-nav-card">
            <div className="so-nav-title">Report Type</div>
            {REPORT_TYPES.map((rt) => (
              <label
                key={rt.key}
                className={`so-nav-item ${reportType === rt.key ? "active" : ""}`}
              >
                <input
                  type="radio"
                  name="reportTypePanel"
                  checked={reportType === rt.key}
                  onChange={() => handleReportTypeChange(rt.key)}
                />
                {rt.label}
              </label>
            ))}
          </aside>

          <main className="so-panel">
            <div className="so-panel-header">
              <div className="so-panel-eyebrow">Sale Return</div>
              <div className="so-panel-title">All Type Of Sale Return Report</div>
            </div>

            <div className="so-form-grid">
              <label className="so-label" htmlFor="sr-from-date">From Date</label>
              <input
                id="sr-from-date"
                ref={fromDateRef}
                type="date"
                className="so-input"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />

              <label className="so-label" htmlFor="sr-to-date">To Date</label>
              <input
                id="sr-to-date"
                type="date"
                className="so-input"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />

              <label className="so-label">Daily View</label>
              <label className="so-toggle-row">
                <input type="checkbox" checked={daily} onChange={(e) => setDaily(e.target.checked)} />
                {daily ? "Enabled" : "Disabled"}
              </label>

            </div>

            <div className="so-actions">
              <button
                type="button"
                className="so-btn so-btn-primary"
                disabled={loading || pageAccess.pageview === 0}
                onClick={handleView}
              >
                {loading ? "Loading…" : "▶ View"}
              </button>
              <button type="button" className="so-btn so-btn-secondary" onClick={handleRefresh} disabled={loading}>
                ↺ Refresh
              </button>
            </div>

            {msg && <div className={`so-msg ${msg.isErr ? "err" : "ok"}`}>{msg.text}</div>}
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