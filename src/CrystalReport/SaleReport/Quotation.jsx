// ─────────────────────────────────────────────────────────────────────────────
//  Quotation.jsx
//  React conversion of Quotation.js (jQuery) — "All Type Of Quotation Report"
//  Uses API helpers from Common.jsx (CC.api / CC.mkUrl / CC.authHeaders etc.)
//  Design & architecture mirrored 1:1 from SaleOrderReport.jsx.
//  Styling: matches BranchWise.jsx design system exactly (card, header,
//  radio-nav, field rows, buttons, palette). Only visuals/layout were
//  changed here — all business logic, state, handlers, and API calls
//  are 100% unchanged from the original.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Save, XCircle } from "lucide-react";
import * as CC from "../../components/Common";
import Topbar from "../../components/Topbar";

// Report-type identifiers (mirrors the 3 jqxRadioButtons in the original markup:
// rdbSalesRetunConsolidate / rdbSalesReturnDetails / rdbSalerReturnItemwise)
const REPORT_TYPES = {
  CONSOLIDATE: "CONSOLIDATE",
  DETAILS: "DETAILS",
  ITEMWISE: "ITEMWISE",
};

const BASE_URL = "http://localhost:64215";

// API endpoints used by this screen — kept EXACTLY as in the original
// Quotation.js jQuery file ($.ajax url values). Do not change.
const QuotationConsolidateReportUrl = "/api/SalesReportApp/QuotationConsolidateReport";
const QuotationDetailsReportUrl     = "/api/SalesReportApp/QuotationDetailsReport";
const QuotationItemwiseReportUrl    = "/api/SalesReportApp/QuotationItemwiseReport";

const ItemGroupPopupUrl             = "/Report/ItemGroup";

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

export default function Quotation() {
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
    taxInclusiveDontShow: 1,
    CName: "",
    CAddress: "",
    CPhone: "",
  });

  // ── Form state (controlled inputs replacing jqx widgets) ───────────────
  const [reportType, setReportType] = useState(REPORT_TYPES.CONSOLIDATE);
  const [fromDate, setFromDate] = useState(todayStr());
  const [toDate, setToDate] = useState(todayStr());
  const [daily, setDaily] = useState(false);
  const [chkMrp, setChkMrp] = useState(false);

  // ── ItemWise "Group By" state — populated via the F11 ItemGroup popup ──
  // (mirrors SearchGroupName / SearchGroupText globals in the jQuery file)
  const [groupBy, setGroupBy] = useState("");
  const [groupByText, setGroupByText] = useState("");
  const [showGroupPopup, setShowGroupPopup] = useState(false);

  // ── UI feedback state ───────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null); // { text, isErr }

  // Itemwise extras (MRP checkbox + F11 hint) are only relevant for the
  // ItemWise report type, mirroring show()/hide() logic in the jQuery file.
  const showItemwiseExtras = reportType === REPORT_TYPES.ITEMWISE;

  // ── Bootstrap: permission + session, mirrors top of $(document).ready ──
  useEffect(() => {
    const menulist = CC.getLocal("menulist");
    if (menulist == null) {
      setMsg({ text: "Session Close Please Login !!!.", isErr: true });
      navigate("/Login/Index");
      return;
    }

    const menudata = menulist.filter((obj) => obj.PageName === "Quotation Report");
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
    const taxInclusiveDontShow = ComSet[0]?.POSTax !== "Inclusive Don't Show Tax" ? 0 : 1;

    setSession({
      Comid,
      MComid,
      taxInclusiveDontShow,
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

  // ── Esc key — "Do you want to quit page?" (preserved from jQuery) ───────
  // ── F11 key — opens ProductGroup popup, only for ItemWise report type ──
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.keyCode === 122) {
        // F11 — only meaningful for ItemWise report (rdbSalerReturnItemwise)
        if (reportType === REPORT_TYPES.ITEMWISE) {
          e.preventDefault();
          setShowGroupPopup(true);
        }
      }
      if (e.keyCode === 27) {
        e.preventDefault();
        if (window.confirm("Do You Want To Quit Page?")) {
          navigate("/Login/Home");
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [reportType, navigate]);

  // ── Radio-button change handler — resets Daily exactly like jQuery ─────
  // (all three rdb click handlers in the original reset rdodaliy to
  //  unchecked, show it, and hide chkmrp/f11id — chkmrp/F11 visibility is
  //  instead driven declaratively here via showItemwiseExtras)
  const handleReportTypeChange = useCallback((type) => {
    setReportType(type);
    setDaily(false);
  }, []);

  // ── Refresh button ───────────────────────────────────────────────────────
  // NOTE: the original jQuery handler only re-initialises the date-picker
  // FORMAT and resets Daily / MRP checkboxes — it does NOT reset the actual
  // From/To date values. Preserved exactly (dates are left untouched).
  const handleRefresh = useCallback(() => {
    setDaily(false);
    setChkMrp(false);
  }, []);

  // ── ItemGroup popup close handler — captures GroupBy / GroupByText ─────
  const handleGroupPopupClose = useCallback((selectedGroup, selectedGroupText) => {
    setGroupBy(selectedGroup || "");
    setGroupByText(selectedGroupText || "");
    setShowGroupPopup(false);
  }, []);

  // ── ReportViewer opener — replicates window.open(...) + title-set exactly ──
  const openReportViewer = useCallback((params, windowTitle) => {
    const qs = new URLSearchParams(params).toString();
    const url = `${BASE_URL}/../Reports/ReportViewer.aspx?${qs}`;

    const w = window.open(
      url,
      "_blank",
      `directories=0,titlebar=0,toolbar=0,location=0,status=0,` +
      `menubar=0,scrollbars=yes,resizable=no,` +
      `width=${screen.width},height=${screen.height - 100}`
    );

    if (w && windowTitle) {
      w.addEventListener("load", function () { w.document.title = windowTitle; }, false);
    }
  }, []);

  // ── View button — replicates the three $.ajax branches exactly ─────────
  const handleView = useCallback(async () => {
    const Fromdate = toMMDDYYYY(fromDate);
    const Todate = toMMDDYYYY(toDate);

    // "From Date Is Greater Than To Date!!" validation (preserved exactly)
    const startdate = new Date(Fromdate);
    const enddate = new Date(Todate);
    if (startdate > enddate) {
      setMsg({ text: "From Date Is Greater Than To Date!!", isErr: true });
      return;
    }

    const ReportTypenew = daily ? "D" : "";
    const TaxSuppressId = session.taxInclusiveDontShow === 1 ? 1 : 0;

    // Resolve GroupBy / GroupByText from the F11 popup selection, exactly
    // like `if (SearchGroupName != "") GroupBy = SearchGroupName;`
    let GroupBy = "";
    let GroupByText = "";
    if (groupBy !== "") GroupBy = groupBy;
    if (groupByText !== "") GroupByText = groupByText;

    setLoading(true);
    setMsg(null);

    try {
      const Comid = session.Comid;
      const MComid = session.MComid;

      // ── Quotation Consolidate ──────────────────────────────────────
      if (reportType === REPORT_TYPES.CONSOLIDATE) {
        const ReportTitle = "Quotation Consolidate";
      
        const res = await CC.api(
          QuotationConsolidateReportUrl,
          null,
          { React: 1 },
          {
            Fromdate,
            Todate,
            Comid,
            MComid,
          }
        );
      
        console.log("Quotation Consolidate API Response:", res);
      
        if (res.ok === true || res.IsSuccess === true) {
          const cacheKey =
            res.data15 ??
            res.Data15 ??
            res.data?.Data15 ??
            "";
      
          console.log("CacheKey:", cacheKey);
      
          openReportViewer(
            {
              ReportName: "QuotationConsolidateReport",
              CacheKey: cacheKey,
              Daily: daily,
              GroupBy: groupBy,
              Fromdate,
              Todate,
              ReportType: ReportTypenew,
              ReportTitle,
              CName: session.CName,
              CAddress: session.CAddress,
              CPhone: session.CPhone,
            },
            "Quotation Consolidate"
          );
        } else {
          setMsg({ text: "No Record !!!.", isErr: true });
        }
      }

      // ── Quotation Details ───────────────────────────────────────────
// ── Quotation Details ───────────────────────────────────────────
else if (reportType === REPORT_TYPES.DETAILS) {
    const ReportTitle = "Quotation Details";
  
    const res = await CC.api(
      QuotationDetailsReportUrl,
      null,
      { React: 1 },
      {
        Fromdate,
        Todate,
        Comid,
        MComid,
      }
    );
  
    console.log("Quotation Details API Response:", res);
  
    if (res.ok === true || res.IsSuccess === true) {
      const cacheKey =
        res.data15 ??
        res.Data15 ??
        res.data?.Data15 ??
        "";
  
      console.log("CacheKey:", cacheKey);
  
      openReportViewer(
        {
          ReportName: "QuotationDetailsReport",
          CacheKey: cacheKey,
          Daily: daily,
          GroupBy: groupBy,
          Fromdate,
          Todate,
          ReportType: ReportTypenew,
          ReportTitle,
          taxinclusivedontshow: TaxSuppressId,
          CName: session.CName,
          CAddress: session.CAddress,
          CPhone: session.CPhone,
        },
        "Quotation Details-Report"
      );
    } else {
      setMsg({ text: "No Record !!!.", isErr: true });
    }
  }

      // ── Quotation ItemWise ───────────────────────────────────────────
// ── Quotation ItemWise ───────────────────────────────────────────
else if (reportType === REPORT_TYPES.ITEMWISE) {
    const ReportTitle = "Quotation ItemWise Report";
  
    const res = await CC.api(
      QuotationItemwiseReportUrl,
      null,
      { React: 1 },
      {
        Daily: daily,
        Fromdate,
        Todate,
        Comid,
        MComid,
      }
    );
  
    console.log("Quotation ItemWise API Response:", res);
  
    if (res.ok === true || res.IsSuccess === true) {
      const cacheKey =
        res.data15 ??
        res.Data15 ??
        res.data?.Data15 ??
        "";
  
      console.log("CacheKey:", cacheKey);
  
      openReportViewer(
        {
          ReportName: "QuotationItemWiseReport",
          CacheKey: cacheKey,
          Daily: daily,
          MRP: chkMrp,
          GroupBy: groupBy,
          Fromdate,
          Todate,
          TaxSuppressId,
          ReportType: ReportTypenew,
          ReportTitle,
          CName: session.CName,
          CAddress: session.CAddress,
          CPhone: session.CPhone,
        },
        "Quotation ItemWise-Report"
      );
    } else {
      setMsg({ text: "No Record !!!.", isErr: true });
      setGroupBy("");
      setGroupByText("");
    }
  }
    } catch (err) {
      setMsg({ text: err.message || "Something went wrong.", isErr: true });
    } finally {
      setLoading(false);
      // SearchGroupName = ""; SearchGroupText = 0; (reset after every view, like jQuery)
      setGroupBy("");
      setGroupByText("");
    }
  }, [
    reportType,
    fromDate,
    toDate,
    daily,
    chkMrp,
    groupBy,
    groupByText,
    session,
    openReportViewer,
  ]);

  const radioOptions = useMemo(
    () => [
      { value: REPORT_TYPES.CONSOLIDATE, label: "Quotation Consolidate" },
      { value: REPORT_TYPES.DETAILS, label: "Quotation Details" },
      { value: REPORT_TYPES.ITEMWISE, label: "Quotation Itemwise" },
    ],
    []
  );

  // ── Scoped styles injected once ─────────────────────────────────────────
  // Design system copied 1:1 from BranchWise.jsx (card, header, radio-nav,
  // field rows, buttons, palette). Only class names/markup for this page's
  // own fields (Daily / MRP toggles, F11 hint) were added, following the
  // same look.
  //   Border / header / heading : blue  #1a56db
  //   Save accent                : green #1e7e34
  //   Cancel / link accent       : red   #dc3545
  const styles = `
    .qt-shell { min-height: 100vh; background: #f0f2f5; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; flex-direction: column; }
    .qt-topbar { background: linear-gradient(135deg, #3b6fe0, #1a4fd1); color: #fff; display: flex; align-items: center; justify-content: space-between; padding: 0 24px; height: 52px; box-shadow: 0 2px 8px rgba(0,0,0,.18); flex-shrink: 0; }
    .qt-topbar-title { font-size: 15px; font-weight: 600; letter-spacing: .3px; }
    .qt-close-btn { background: rgba(255,255,255,.15); border: none; color: #fff; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; transition: background .15s; }
    .qt-close-btn:hover { background: rgba(255,255,255,.28); }

    .qt-layout { flex: 1; display: flex; align-items: flex-start; justify-content: center; padding: 24px; box-sizing: border-box; }
    .qt-card { width: 100%; max-width: 740px; background: #fff; border: 2px solid #1a56db; border-radius: 10px; box-shadow: 0 4px 16px rgba(26,86,219,.18); overflow: hidden; }

    .qt-card-header { background: linear-gradient(135deg, #3b6fe0, #1a4fd1); border-bottom: 1px solid #1a4fd1; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; }
    .qt-card-header-title { font-size: 14px; font-weight: 700; color: #fff; letter-spacing: .2px; }
    .qt-close-x { background: rgba(255,255,255,.15); border: none; font-size: 14px; color: #fff; cursor: pointer; line-height: 1; padding: 6px 8px; border-radius: 6px; transition: background .15s; }
    .qt-close-x:hover { background: rgba(255,255,255,.28); }

    .qt-card-body { padding: 24px 32px 30px; }
    .qt-report-title { text-align: center; font-size: 22px; font-weight: 800; color: #1a3fd6; margin: 0 0 26px; }

    .qt-content { display: flex; gap: 32px; }

    .qt-left { flex: 0 0 190px; display: flex; flex-direction: column; gap: 14px; }
    .qt-right { flex: 1; display: flex; flex-direction: column; gap: 16px; max-width: 320px; }

    .qt-radio-row { display: flex; align-items: center; gap: 8px; cursor: pointer; user-select: none; font-size: 13px; color: #2b2b2b; font-weight: 500; }
    .qt-radio-row input[type="radio"] { width: 16px; height: 16px; accent-color: #1a56db; cursor: pointer; flex-shrink: 0; }

    .qt-field { display: flex; align-items: center; gap: 14px; }
    .qt-label { font-size: 13px; font-weight: 600; color: #1e293b; width: 96px; flex-shrink: 0; }
    .qt-input { height: 34px; border: 1px solid #c7cdd6; border-radius: 4px; padding: 0 10px; font-size: 13px; color: #1e2d3d; background: #fff; width: 100%; box-sizing: border-box; transition: border-color .15s, box-shadow .15s; outline: none; }
    .qt-input:focus { border-color: #1a56db; box-shadow: 0 0 0 3px rgba(26,86,219,.15); }

    .qt-toggle-row { display: flex; align-items: center; gap: 10px; height: 34px; background: #f7f9fc; border: 1px solid #c7cdd6; border-radius: 4px; padding: 0 10px; cursor: pointer; font-size: 13px; color: #1e2d3d; font-weight: 500; user-select: none; transition: border-color .15s; width: 100%; box-sizing: border-box; }
    .qt-toggle-row:hover { border-color: #1a56db; }
    .qt-toggle-row input[type="checkbox"] { width: 15px; height: 15px; accent-color: #1a56db; cursor: pointer; flex-shrink: 0; }

    /* ── F11 hint (ProductGroup shortcut, ItemWise only) ── */
    .qt-f11-hint { font-size: 12px; color: #6b7280; background: #f7f9fc; border: 1px dashed #c7cdd6; border-radius: 6px; padding: 8px 10px; line-height: 1.5; }
    .qt-f11-hint kbd { background: #fff; border: 1px solid #c7cdd6; border-radius: 4px; padding: 1px 6px; font-family: inherit; font-weight: 700; color: #1e2d3d; }

    .qt-actions { display: flex; gap: 12px; justify-content: center; margin-top: 32px; padding-top: 22px; border-top: 1px solid #e8ecf0; }
    .qt-btn { height: 38px; padding: 0 30px; border-radius: 6px; border: 1px solid #1a56db; font-size: 14px; font-weight: 700; cursor: pointer; transition: opacity .15s, box-shadow .15s, background .15s; display: flex; align-items: center; gap: 8px; background: #fff; color: #1a56db; }
    .qt-btn:disabled { opacity: .5; cursor: not-allowed; }
    .qt-btn:not(:disabled):hover { background: #eef3ff; }
    .qt-btn-primary { border-color: #1e7e34; color: #1e7e34; }
    .qt-btn-primary .qt-icon-save { color: #1e7e34; }
    .qt-btn-secondary { border-color: #dc3545; color: #dc3545; }
    .qt-btn-secondary .qt-icon-cancel { color: #dc3545; }

    .qt-msg { margin-top: 18px; padding: 10px 14px; border-radius: 8px; font-size: 13px; font-weight: 500; text-align: center; }
    .qt-msg.err { background: #fff0f0; color: #c53030; border: 1px solid #fed7d7; }
    .qt-msg.ok  { background: #f0fff4; color: #276749; border: 1px solid #c6f6d5; }

    @media (max-width: 620px) {
      .qt-card-body { padding: 20px; }
      .qt-content { flex-direction: column; gap: 22px; }
      .qt-left { flex: none; }
      .qt-right { max-width: none; }
    }
  `;

  const navItems = [
    { value: REPORT_TYPES.CONSOLIDATE, label: "Quotation Consolidate" },
    { value: REPORT_TYPES.DETAILS,     label: "Quotation Details" },
    { value: REPORT_TYPES.ITEMWISE,    label: "Quotation Itemwise" },
  ];

  if (!pageAccess.ready) {
    return (
      <>
        <style>{styles}</style>
        <div className="qt-shell">
          <Topbar />
          <div className="qt-layout">
            <div className="qt-card">
              <div className="qt-card-body">
                {msg && (
                  <div className={`qt-msg ${msg.isErr ? "err" : "ok"}`}>{msg.text}</div>
                )}
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
        <div className="qt-shell">
          <Topbar />
          <div className="qt-layout">
            <div className="qt-card">
              <div className="qt-card-body">
                <div className="qt-msg err">Page Access Permission Denied !!!.</div>
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
      <div className="qt-shell">

        {/* ── Top bar ── */}
        <Topbar />

        <div className="qt-layout">
          <div className="qt-card">
            <div className="qt-card-header">
              <div className="qt-card-header-title">Quotation Reports</div>
              <button type="button" className="qt-close-x" aria-label="Close" onClick={() => navigate(-1)}>✕</button>
            </div>

            <div className="qt-card-body">
              <div className="qt-report-title">All Type Of Quotation Report</div>

              <div className="qt-content">
                {/* ── Left: report type selection ── */}
                <div className="qt-left">
                  {navItems.map((item) => (
                    <label key={item.value} className="qt-radio-row">
                      <input
                        type="radio"
                        name="qt-report-type"
                        checked={reportType === item.value}
                        onChange={() => handleReportTypeChange(item.value)}
                      />
                      {item.label}
                    </label>
                  ))}
                </div>

                {/* ── Right: dates + toggles ── */}
                <div className="qt-right">
                  <div className="qt-field">
                    <label className="qt-label" htmlFor="qt-from-date">From Date</label>
                    <input
                      id="qt-from-date"
                      type="date"
                      className="qt-input"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                    />
                  </div>

                  <div className="qt-field">
                    <label className="qt-label" htmlFor="qt-to-date">To Date</label>
                    <input
                      id="qt-to-date"
                      type="date"
                      className="qt-input"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                    />
                  </div>

                  <div className="qt-field">
                    <label className="qt-label">Daily</label>
                    <label className="qt-toggle-row">
                      <input
                        type="checkbox"
                        checked={daily}
                        onChange={(e) => setDaily(e.target.checked)}
                      />
                      {daily ? "Enabled" : "Disabled"}
                    </label>
                  </div>

                  {showItemwiseExtras && (
                    <>
                      <div className="qt-field">
                        <label className="qt-label">MRP</label>
                        <label className="qt-toggle-row">
                          <input
                            type="checkbox"
                            checked={chkMrp}
                            onChange={(e) => setChkMrp(e.target.checked)}
                          />
                          {chkMrp ? "Enabled" : "Disabled"}
                        </label>
                      </div>

                      <div className="qt-f11-hint">
                        Press <kbd>F11</kbd> to choose a Product Group for this report
                        {groupByText ? ` — Selected: ${groupByText}` : ""}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="qt-actions">
                <button
                  type="button"
                  className="qt-btn qt-btn-primary"
                  disabled={loading || pageAccess.pageview === 0}
                  onClick={handleView}
                >
                  <Save size={16} className="qt-icon-save" />
                  {loading ? "Loading…" : "View"}
                </button>
                <button
                  type="button"
                  className="qt-btn qt-btn-secondary"
                  onClick={handleRefresh}
                  disabled={loading}
                >
                  <XCircle size={16} className="qt-icon-cancel" />
                  Refresh
                </button>
              </div>

              {msg && (
                <div className={`qt-msg ${msg.isErr ? "err" : "ok"}`}>
                  {msg.text}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Loader overlay ── */}
        {loading && (
          <div className="mp-loader-ov">
            <div className="mp-ldr-box">
              <div className="mp-spin" />
              <div className="mp-ldr-msg">Loading...</div>
            </div>
          </div>
        )}

        {/* ── ItemGroup picker dialog (F11 / internal state trigger) ── */}
        {showGroupPopup && (
          <div className="mp-picker-ov" onClick={() => setShowGroupPopup(false)}>
            <div
              className="mp-picker"
              style={{ width: 580, height: 460 }}
              onClick={(e) => e.stopPropagation()}
            >
              <header>
                <h3>ProductGroup</h3>
                <button className="mp-picker-close" onClick={() => setShowGroupPopup(false)}>
                  ✕
                </button>
              </header>
              <iframe
                title="ItemGroup"
                src={ItemGroupPopupUrl}
                style={{ width: "100%", height: "100%", border: "none" }}
                onLoad={() => {
                  const grp = sessionStorage.getItem("GroupBy");
                  const grpText = sessionStorage.getItem("GroupByText");
                  if (grp) {
                    handleGroupPopupClose(grp, grpText);
                    sessionStorage.setItem("GroupBy", "");
                    sessionStorage.setItem("GroupByText", "");
                  }
                }}
              />
            </div>
          </div>
        )}

      </div>
    </>
  );
}