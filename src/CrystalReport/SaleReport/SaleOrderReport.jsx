// ─────────────────────────────────────────────────────────────────────────────
//  SaleOrder.jsx
//  React conversion of SaleOrder.js (jQuery) — "All Type Of SaleOrder Report"
//  Uses API helpers from Common.jsx (CC.api / CC.mkUrl / CC.authHeaders etc.)
//  Styling: matches BranchWise.jsx design system exactly (card, header,
//  radio-nav, field rows, buttons, palette). Only visuals/layout were
//  changed here — all business logic, state, handlers, and API calls
//  are 100% unchanged from the original.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Save, XCircle } from "lucide-react";
import * as CC from "../../components/Common"
import Topbar from "../../components/Topbar";
import   DateFieldDDMMYYYY from "../../Commondatetime";

// Report-type identifiers (mirrors the 3 jqxRadioButtons in the original markup)
const REPORT_TYPES = {
  CONSOLIDATE: "CONSOLIDATE",
  DETAILS: "DETAILS",
  ITEMWISE: "ITEMWISE",
};

const BASE_URL = "http://localhost:64215";

// API endpoints used by this screen (kept local since they are specific
// to the SaleOrder report and are not yet defined in Common.jsx)
const SaleOrderConsolidateReportUrl = "/api/SalesReportApp/SaleOrderConsolidateReport";
const SaleOrderDetailsReportUrl     = "/api/SalesReportApp/SaleOrderDetailsReport";
const SaleOrderItemwiseReportUrl    = "/api/SalesReportApp/SaleOrderItemwiseReport";

const ItemGroupPopupUrl             = "/api/Report/ItemGroup";

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

export default function SaleOrder() {
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

    const menudata = menulist.filter((obj) => obj.PageName === "Sale Order Report");
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
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.keyCode === 122) {
        // F11 — only meaningful for ItemWise report
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

  // ── Radio-button change handler — resets Daily/MRP exactly like jQuery ──
  const handleReportTypeChange = useCallback((type) => {
    setReportType(type);
    setDaily(false);
  }, []);

  // ── Refresh button ───────────────────────────────────────────────────────
  const handleRefresh = useCallback(() => {
    setFromDate(todayStr());
    setToDate(todayStr());
    setDaily(false);
    setChkMrp(false);
  }, []);

  // ── ItemGroup popup close handler — captures GroupBy / GroupByText ─────
  const handleGroupPopupClose = useCallback((selectedGroup, selectedGroupText) => {
    setGroupBy(selectedGroup || "");
    setGroupByText(selectedGroupText || "");
    setShowGroupPopup(false);
  }, []);

 // handleView பங்க்ஷனுக்கு மேலே இதைச் சேர்க்கவும்:

// AFTER ✅ — SaleBill.jsx pattern exactly copy
const openReportViewer = useCallback((params) => {
  const qs = new URLSearchParams(params).toString();
  const url = `${CC.BASE_URL}/Reports/ReportViewer.aspx?${qs}`;
  
  window.open(
    url,
    "_blank",
    `directories=0,titlebar=0,toolbar=0,location=0,status=0,` +
    `menubar=0,scrollbars=yes,resizable=no,` +
    `width=${screen.width},height=${screen.height - 100}`
  );
}, []);

  // ── View button — replicates the three $.ajax branches exactly ─────────
  const handleView = useCallback(async () => {
    if (!fromDate || !toDate) {
      setMsg({ text: "Please select From Date and To Date.", isErr: true });
      return;
    }
  
    const Fromdate = toMMDDYYYY(fromDate);
    const Todate = toMMDDYYYY(toDate);
  
    if (new Date(Fromdate) > new Date(Todate)) {
      setMsg({ text: "From Date Is Greater Than To Date!!", isErr: true });
      return;
    }
  
    const ReportTypenew = daily ? "D" : "";
    const TaxSuppressId = session.taxInclusiveDontShow === 1 ? 1 : 0;
  
    setLoading(true);
    setMsg(null);
  
    try {
      // Convert once and reuse
      const Comid = parseInt(session.Comid, 10);
      const MComid = parseInt(session.MComid, 10);
  
      if (reportType === REPORT_TYPES.CONSOLIDATE) {
        const ReportTitle = "SaleOrder Consolidate";
  
// AFTER ✅ — SaleBill.jsx போல் res.Data15 எடுங்கள்
const res = await CC.api(SaleOrderConsolidateReportUrl, null, {}, {
  Fromdate, Todate, Comid,
});

console.log("SaleOrder API Response:", res); // debug

if (res.ok || res.IsSuccess) {
  
  // ✅ SaleBill.jsx-இல் உள்ளது போல் CacheKey எடு
  const cacheKey = res.Data15 || "";
  console.log("CacheKey:", cacheKey);

  openReportViewer({
    ReportName  : "SaleOrderConsolidateReport",
    CacheKey    : cacheKey,          // ✅ இப்போது சரியாக போகும்
    Daily       : daily,
    GroupBy     : "",
    Fromdate,
    Todate,
    Comid       : session.Comid,
    ReportType  : ReportTypenew,
    ReportTitle,
    CName: session?.CName || localStorage.getItem("CompanyName") || "",
    CAddress: session?.CAddress || localStorage.getItem("Address") || "",
    CPhone: session?.CPhone || localStorage.getItem("Phone") || "",

  });
} else {
  setMsg({ text: "No Record !!!.", isErr: true });
}
      } 
      else if (reportType === REPORT_TYPES.DETAILS) {
        const ReportTitle = "SaleOrder Details";

        const res = await CC.api(SaleOrderDetailsReportUrl, null, {}, {
          Fromdate, Todate, Comid, MComid,
        });

        console.log("SaleOrderDetails API Response:", res); // debug

        if (res.ok || res.IsSuccess) {
          const cacheKey = res.Data15 || "";
          console.log("CacheKey:", cacheKey);

          openReportViewer({
            ReportName: "SaleOrderDetailsReport",
            CacheKey: cacheKey,
            Daily: daily,
            GroupBy: "",
            Fromdate,
            Todate,
            Comid: session.Comid,
            MComid: session.MComid,
            ReportType: ReportTypenew,
            ReportTitle,
            
            taxinclusivedontshow: session.taxInclusiveDontShow,
            CName: session?.CName || localStorage.getItem("CompanyName") || "",
            CAddress: session?.CAddress || localStorage.getItem("Address") || "",
            CPhone: session?.CPhone || localStorage.getItem("Phone") || "",
          });
        } else {
          setMsg({ text: "No Record !!!.", isErr: true });
        }
      }
      else if (reportType === REPORT_TYPES.ITEMWISE) {
        const ReportTitle = "SaleOrder ItemWise Report";

        const res = await CC.api(SaleOrderItemwiseReportUrl, null, {}, {
          Daily: daily,
          Fromdate,
          Todate,
          Comid,
          MComid,
        });
  
        if (res.ok || res.IsSuccess) {
          const cacheKey = res.Data15 || "";
          openReportViewer({
            ReportName: "SaleOrderItemWiseReport",
            CacheKey    : cacheKey,
            Daily: daily,
            MRP: chkMrp,
            GroupBy: groupBy,
            Fromdate,
            Todate,
            TaxSuppressId,
            ReportType: ReportTypenew,
            ReportTitle,
            CName: session?.CName || localStorage.getItem("CompanyName") || "",
            CAddress: session?.CAddress || localStorage.getItem("Address") || "",
            CPhone: session?.CPhone || localStorage.getItem("Phone") || "",
          });
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
    session,
    openReportViewer,
  ]);
  const radioOptions = useMemo(
    () => [
      { value: REPORT_TYPES.CONSOLIDATE, label: "SaleOrder Consolidate" },
      { value: REPORT_TYPES.DETAILS, label: "SaleOrder Details" },
      { value: REPORT_TYPES.ITEMWISE, label: "SaleOrder Itemwise" },
    ],
    []
  );

  // ── Scoped styles injected once ─────────────────────────────────────────
  // Design system copied 1:1 from BranchWise.jsx (card, header, radio-nav,
  // field rows, buttons, palette). Only class names/markup for this page's
  // own fields (Daily / MRP toggles) were added, following the same look.
  //   Border / header / heading : blue  #1a56db
  //   Save accent                : green #1e7e34
  //   Cancel / link accent       : red   #dc3545
  const styles = `
    .so-shell { min-height: 100vh; background: #f0f2f5; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; flex-direction: column; }
    .so-topbar { background: linear-gradient(135deg, #3b6fe0, #1a4fd1); color: #fff; display: flex; align-items: center; justify-content: space-between; padding: 0 24px; height: 52px; box-shadow: 0 2px 8px rgba(0,0,0,.18); flex-shrink: 0; }
    .so-topbar-title { font-size: 15px; font-weight: 600; letter-spacing: .3px; }
    .so-close-btn { background: rgba(255,255,255,.15); border: none; color: #fff; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; transition: background .15s; }
    .so-close-btn:hover { background: rgba(255,255,255,.28); }

    .so-layout { flex: 1; display: flex; align-items: flex-start; justify-content: center; padding: 24px; box-sizing: border-box; }
    .so-card { width: 100%; max-width: 740px; background: #fff; border: 2px solid #1a56db; border-radius: 10px; box-shadow: 0 4px 16px rgba(26,86,219,.18); overflow: hidden; }

    .so-card-header { background: linear-gradient(135deg, #3b6fe0, #1a4fd1); border-bottom: 1px solid #1a4fd1; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; }
    .so-card-header-title { font-size: 14px; font-weight: 700; color: #fff; letter-spacing: .2px; }
    .so-close-x { background: rgba(255,255,255,.15); border: none; font-size: 14px; color: #fff; cursor: pointer; line-height: 1; padding: 6px 8px; border-radius: 6px; transition: background .15s; }
    .so-close-x:hover { background: rgba(255,255,255,.28); }

    .so-card-body { padding: 24px 32px 30px; }
    .so-report-title { text-align: center; font-size: 22px; font-weight: 800; color: #1a3fd6; margin: 0 0 26px; }

    .so-content { display: flex; gap: 32px; }

    .so-left { flex: 0 0 190px; display: flex; flex-direction: column; gap: 14px; }
    .so-right { flex: 1; display: flex; flex-direction: column; gap: 16px; max-width: 320px; }

    .so-radio-row { display: flex; align-items: center; gap: 8px; cursor: pointer; user-select: none; font-size: 13px; color: #2b2b2b; font-weight: 500; }
    .so-radio-row input[type="radio"] { width: 16px; height: 16px; accent-color: #1a56db; cursor: pointer; flex-shrink: 0; }

    .so-field { display: flex; align-items: center; gap: 14px; }
    .so-label { font-size: 13px; font-weight: 600; color: #1e293b; width: 96px; flex-shrink: 0; }
    .so-input { height: 34px; border: 1px solid #c7cdd6; border-radius: 4px; padding: 0 10px; font-size: 13px; color: #1e2d3d; background: #fff; width: 100%; box-sizing: border-box; transition: border-color .15s, box-shadow .15s; outline: none; }
    .so-input:focus { border-color: #1a56db; box-shadow: 0 0 0 3px rgba(26,86,219,.15); }
    select.so-input { appearance: auto; cursor: pointer; }

    .so-toggle-row { display: flex; align-items: center; gap: 10px; height: 34px; background: #f7f9fc; border: 1px solid #c7cdd6; border-radius: 4px; padding: 0 10px; cursor: pointer; font-size: 13px; color: #1e2d3d; font-weight: 500; user-select: none; transition: border-color .15s; width: 100%; box-sizing: border-box; }
    .so-toggle-row:hover { border-color: #1a56db; }
    .so-toggle-row input[type="checkbox"] { width: 15px; height: 15px; accent-color: #1a56db; cursor: pointer; flex-shrink: 0; }

    .so-actions { display: flex; gap: 12px; justify-content: center; margin-top: 32px; padding-top: 22px; border-top: 1px solid #e8ecf0; }
    .so-btn { height: 38px; padding: 0 30px; border-radius: 6px; border: 1px solid #1a56db; font-size: 14px; font-weight: 700; cursor: pointer; transition: opacity .15s, box-shadow .15s, background .15s; display: flex; align-items: center; gap: 8px; background: #fff; color: #1a56db; }
    .so-btn:disabled { opacity: .5; cursor: not-allowed; }
    .so-btn:not(:disabled):hover { background: #eef3ff; }
    .so-btn-primary { border-color: #1e7e34; color: #1e7e34; }
    .so-btn-primary .so-icon-save { color: #1e7e34; }
    .so-btn-secondary { border-color: #dc3545; color: #dc3545; }
    .so-btn-secondary .so-icon-cancel { color: #dc3545; }

    .so-msg { margin-top: 18px; padding: 10px 14px; border-radius: 8px; font-size: 13px; font-weight: 500; text-align: center; }
    .so-msg.err { background: #fff0f0; color: #c53030; border: 1px solid #fed7d7; }
    .so-msg.ok  { background: #f0fff4; color: #276749; border: 1px solid #c6f6d5; }

    @media (max-width: 620px) {
      .so-card-body { padding: 20px; }
      .so-content { flex-direction: column; gap: 22px; }
      .so-left { flex: none; }
      .so-right { max-width: none; }
    }
  `;

  const navItems = [
    { value: REPORT_TYPES.CONSOLIDATE, label: "SaleOrder Consolidate" },
    { value: REPORT_TYPES.DETAILS,     label: "SaleOrder Details" },
    { value: REPORT_TYPES.ITEMWISE,    label: "SaleOrder Itemwise" },
  ];

  if (!pageAccess.ready) {
    return (
      <>
        <style>{styles}</style>
        <div className="so-shell">
          <Topbar/>
          <div className="so-layout">
            <div className="so-card">
              <div className="so-card-body">
                {msg && (
                  <div className={`so-msg ${msg.isErr ? "err" : "ok"}`}>{msg.text}</div>
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
        <div className="so-shell">
          <Topbar/>
          <div className="so-layout">
            <div className="so-card">
              <div className="so-card-body">
                <div className="so-msg err">Page Access Permission Denied !!!.</div>
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
      <div className="so-shell">
        <Topbar/>
        <div className="so-layout">
          <div className="so-card">
            <div className="so-card-header">
              <div className="so-card-header-title">Sale Order Reports</div>
              <button type="button" className="so-close-x" aria-label="Close" onClick={() => navigate(-1)}>✕</button>
            </div>

            <div className="so-card-body">
              <div className="so-report-title">All Type Of SaleOrder Report - I</div>

              <div className="so-content">
                {/* ── Left: report type selection ── */}
                <div className="so-left">
                  {navItems.map((item) => (
                    <label key={item.value} className="so-radio-row">
                      <input
                        type="radio"
                        name="so-report-type"
                        checked={reportType === item.value}
                        onChange={() => handleReportTypeChange(item.value)}
                      />
                      {item.label}
                    </label>
                  ))}
                </div>

                {/* ── Right: dates + toggles ── */}
                <div className="so-right">
                  <div className="so-field">
                    <label className="so-label" htmlFor="so-from-date">From Date</label>
                    <DateFieldDDMMYYYY id="pri-from-date" value={fromDate} onChange={setFromDate} />
                  </div>

                  <div className="so-field">
                    <label className="so-label" htmlFor="so-to-date">To Date</label>
                    <DateFieldDDMMYYYY id="pri-to-date" value={toDate} onChange={setToDate} />
                  </div>

                  <div className="so-field">
                    <label className="so-label">Daily</label>
                    <label className="so-toggle-row">
                      <input
                        type="checkbox"
                        checked={daily}
                        onChange={(e) => setDaily(e.target.checked)}
                      />
                      {daily ? "Enabled" : "Disabled"}
                    </label>
                  </div>

                  {showItemwiseExtras && (
                    <div className="so-field">
                      <label className="so-label">MRP</label>
                      <label className="so-toggle-row">
                        <input
                          type="checkbox"
                          checked={chkMrp}
                          onChange={(e) => setChkMrp(e.target.checked)}
                        />
                        {chkMrp ? "Enabled" : "Disabled"}
                      </label>
                    </div>
                  )}
                </div>
              </div>

              <div className="so-actions">
                <button
                  type="button"
                  className="so-btn so-btn-primary"
                  disabled={loading || pageAccess.pageview === 0}
                  onClick={handleView}
                >
                  <Save size={16} className="so-icon-save" />
                  {loading ? "Loading…" : "View"}
                </button>
                <button
                  type="button"
                  className="so-btn so-btn-secondary"
                  onClick={handleRefresh}
                  disabled={loading}
                >
                  <XCircle size={16} className="so-icon-cancel" />
                  Refresh
                </button>
              </div>

              {msg && (
                <div className={`so-msg ${msg.isErr ? "err" : "ok"}`}>
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