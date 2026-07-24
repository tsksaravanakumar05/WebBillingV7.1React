// ─────────────────────────────────────────────────────────────────────────────
//  SaleReturn.jsx
//  React conversion of SaleReturn.js (jQuery) — "Sale Return Report"
//  Uses API helpers from Common.jsx (CC.api / CC.mkUrl / CC.authHeaders etc.)
//  Styling: matches BranchWise.jsx design system exactly (card, header,
//  radio-nav, field rows, buttons, palette). Only visuals/layout were
//  changed here — all business logic, state, handlers, and API calls
//  are 100% unchanged from the original.
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
import { Save, XCircle } from "lucide-react";
import * as CC from "../../components/Common";
import Topbar from "../../components/Topbar";
import   DateFieldDDMMYYYY from "../../Commondatetime";

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
            CName: session?.CName || localStorage.getItem("CompanyName") || "",
            CAddress: session?.CAddress || localStorage.getItem("Address") || "",
            CPhone: session?.CPhone || localStorage.getItem("Phone") || "",

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
            CName: session?.CName || localStorage.getItem("CompanyName") || "",
            CAddress: session?.CAddress || localStorage.getItem("Address") || "",
            CPhone: session?.CPhone || localStorage.getItem("Phone") || "",
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
            CName: session?.CName || localStorage.getItem("CompanyName") || "",
            CAddress: session?.CAddress || localStorage.getItem("Address") || "",
            CPhone: session?.CPhone || localStorage.getItem("Phone") || "",
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

  // ── Scoped styles injected once ─────────────────────────────────────────
  // Design system copied 1:1 from BranchWise.jsx (card, header, radio-nav,
  // field rows, buttons, palette). Only class names/markup for this page's
  // own fields (Daily toggle) were added, following the same look.
  //   Border / header / heading : blue  #1a56db
  //   Save accent                : green #1e7e34
  //   Cancel / link accent       : red   #dc3545
  const styles = `
    .sr-shell { min-height: 100vh; background: #f0f2f5; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; flex-direction: column; }
    .sr-topbar { background: linear-gradient(135deg, #3b6fe0, #1a4fd1); color: #fff; display: flex; align-items: center; justify-content: space-between; padding: 0 24px; height: 52px; box-shadow: 0 2px 8px rgba(0,0,0,.18); flex-shrink: 0; }
    .sr-topbar-title { font-size: 15px; font-weight: 600; letter-spacing: .3px; }
    .sr-close-btn { background: rgba(255,255,255,.15); border: none; color: #fff; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; transition: background .15s; }
    .sr-close-btn:hover { background: rgba(255,255,255,.28); }

    .sr-layout { flex: 1; display: flex; align-items: flex-start; justify-content: center; padding: 24px; box-sizing: border-box; }
    .sr-card { width: 100%; max-width: 740px; background: #fff; border: 2px solid #1a56db; border-radius: 10px; box-shadow: 0 4px 16px rgba(26,86,219,.18); overflow: hidden; }

    .sr-card-header { background: linear-gradient(135deg, #3b6fe0, #1a4fd1); border-bottom: 1px solid #1a4fd1; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; }
    .sr-card-header-title { font-size: 14px; font-weight: 700; color: #fff; letter-spacing: .2px; }
    .sr-close-x { background: rgba(255,255,255,.15); border: none; font-size: 14px; color: #fff; cursor: pointer; line-height: 1; padding: 6px 8px; border-radius: 6px; transition: background .15s; }
    .sr-close-x:hover { background: rgba(255,255,255,.28); }

    .sr-card-body { padding: 24px 32px 30px; }
    .sr-report-title { text-align: center; font-size: 22px; font-weight: 800; color: #1a3fd6; margin: 0 0 26px; }

    .sr-content { display: flex; gap: 32px; }

    .sr-left { flex: 0 0 190px; display: flex; flex-direction: column; gap: 14px; }
    .sr-right { flex: 1; display: flex; flex-direction: column; gap: 16px; max-width: 320px; }

    .sr-radio-row { display: flex; align-items: center; gap: 8px; cursor: pointer; user-select: none; font-size: 13px; color: #2b2b2b; font-weight: 500; }
    .sr-radio-row input[type="radio"] { width: 16px; height: 16px; accent-color: #1a56db; cursor: pointer; flex-shrink: 0; }

    .sr-field { display: flex; align-items: center; gap: 14px; }
    .sr-label { font-size: 13px; font-weight: 600; color: #1e293b; width: 96px; flex-shrink: 0; }
    .sr-input { height: 34px; border: 1px solid #c7cdd6; border-radius: 4px; padding: 0 10px; font-size: 13px; color: #1e2d3d; background: #fff; width: 100%; box-sizing: border-box; transition: border-color .15s, box-shadow .15s; outline: none; }
    .sr-input:focus { border-color: #1a56db; box-shadow: 0 0 0 3px rgba(26,86,219,.15); }
    .sr-input:disabled { background: #f7f9fc; color: #a0aec0; cursor: not-allowed; }

    .sr-toggle-row { display: flex; align-items: center; gap: 10px; height: 34px; background: #f7f9fc; border: 1px solid #c7cdd6; border-radius: 4px; padding: 0 10px; cursor: pointer; font-size: 13px; color: #1e2d3d; font-weight: 500; user-select: none; transition: border-color .15s; width: 100%; box-sizing: border-box; }
    .sr-toggle-row:hover { border-color: #1a56db; }
    .sr-toggle-row input[type="checkbox"] { width: 15px; height: 15px; accent-color: #1a56db; cursor: pointer; flex-shrink: 0; }

    .sr-actions { display: flex; gap: 12px; justify-content: center; margin-top: 32px; padding-top: 22px; border-top: 1px solid #e8ecf0; }
    .sr-btn { height: 38px; padding: 0 30px; border-radius: 6px; border: 1px solid #1a56db; font-size: 14px; font-weight: 700; cursor: pointer; transition: opacity .15s, box-shadow .15s, background .15s; display: flex; align-items: center; gap: 8px; background: #fff; color: #1a56db; }
    .sr-btn:disabled { opacity: .5; cursor: not-allowed; }
    .sr-btn:not(:disabled):hover { background: #eef3ff; }
    .sr-btn-primary { border-color: #1e7e34; color: #1e7e34; }
    .sr-btn-primary .sr-icon-save { color: #1e7e34; }
    .sr-btn-secondary { border-color: #dc3545; color: #dc3545; }
    .sr-btn-secondary .sr-icon-cancel { color: #dc3545; }

    .sr-msg { margin-top: 18px; padding: 10px 14px; border-radius: 8px; font-size: 13px; font-weight: 500; text-align: center; }
    .sr-msg.err { background: #fff0f0; color: #c53030; border: 1px solid #fed7d7; }
    .sr-msg.ok  { background: #f0fff4; color: #276749; border: 1px solid #c6f6d5; }

    @media (max-width: 620px) {
      .sr-card-body { padding: 20px; }
      .sr-content { flex-direction: column; gap: 22px; }
      .sr-left { flex: none; }
      .sr-right { max-width: none; }
    }
  `;

  if (!pageAccess.ready) {
    return (
      <>
        <style>{styles}</style>
        <div className="sr-shell">
          <Topbar/>
          <div className="sr-layout">
            <div className="sr-card">
              <div className="sr-card-body">
                {msg && <div className={`sr-msg ${msg.isErr ? "err" : "ok"}`}>{msg.text}</div>}
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (!pageAccess.allowed) {
    return (
      <>
        <style>{styles}</style>
        <div className="sr-shell">
          <Topbar/>
          <div className="sr-layout">
            <div className="sr-card">
              <div className="sr-card-body">
                <div className="sr-msg err">Page Access Permission Denied !!!.</div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{styles}</style>
      <div className="sr-shell">
        <Topbar/>
        <div className="sr-layout">
          <div className="sr-card">
            <div className="sr-card-header">
              <div className="sr-card-header-title">Sale Return Reports</div>
              <button type="button" className="sr-close-x" aria-label="Close" onClick={() => navigate(-1)}>✕</button>
            </div>

            <div className="sr-card-body">
              <div className="sr-report-title">All Type Of Sale Return Report</div>

              <div className="sr-content">
                {/* ── Left: report type selection ── */}
                <div className="sr-left">
                  {REPORT_TYPES.map((rt) => (
                    <label key={rt.key} className="sr-radio-row">
                      <input
                        type="radio"
                        name="reportTypePanel"
                        checked={reportType === rt.key}
                        onChange={() => handleReportTypeChange(rt.key)}
                      />
                      {rt.label}
                    </label>
                  ))}
                </div>

                {/* ── Right: dates + toggle ── */}
                <div className="sr-right">
                  <div className="sr-field">
                    <label className="sr-label" htmlFor="sr-from-date">From Date</label>
                    <DateFieldDDMMYYYY id="pri-from-date" value={fromDate} onChange={setFromDate} />
                  </div>

                  <div className="sr-field">
                    <label className="sr-label" htmlFor="sr-to-date">To Date</label>
                    <DateFieldDDMMYYYY id="pri-to-date" value={toDate} onChange={setToDate} />
                  </div>

                  <div className="sr-field">
                    <label className="sr-label">Daily View</label>
                    <label className="sr-toggle-row">
                      <input type="checkbox" checked={daily} onChange={(e) => setDaily(e.target.checked)} />
                      {daily ? "Enabled" : "Disabled"}
                    </label>
                  </div>
                </div>
              </div>

              <div className="sr-actions">
                <button
                  type="button"
                  className="sr-btn sr-btn-primary"
                  disabled={loading || pageAccess.pageview === 0}
                  onClick={handleView}
                >
                  <Save size={16} className="sr-icon-save" />
                  {loading ? "Loading…" : "View"}
                </button>
                <button type="button" className="sr-btn sr-btn-secondary" onClick={handleRefresh} disabled={loading}>
                  <XCircle size={16} className="sr-icon-cancel" />
                  Refresh
                </button>
              </div>

              {msg && <div className={`sr-msg ${msg.isErr ? "err" : "ok"}`}>{msg.text}</div>}
            </div>
          </div>
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