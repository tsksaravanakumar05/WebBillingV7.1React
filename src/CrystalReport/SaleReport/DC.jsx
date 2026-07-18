// ─────────────────────────────────────────────────────────────────────────────
//  DC.jsx
//  React conversion of DC.js (jQuery) — "All Type Of Delivery Challan Report"
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

// Report-type identifiers (mirrors the 3 jqxRadioButtons in the original markup)
const REPORT_TYPES = {
  CONSOLIDATE: "CONSOLIDATE",
  DETAILS: "DETAILS",
  ITEMWISE: "ITEMWISE",
};

const BASE_URL = "http://localhost:64215";

// API endpoints used by this screen (kept local since they are specific
// to the Delivery Challan report and are not yet defined in Common.jsx)
const DCConsolidateReportUrl = "/api/SalesReportApp/DCConsolidateReport";
const DCDetailsReportUrl     = "/api/SalesReportApp/DCDetailsReport";
const DCItemwiseReportUrl    = "/api/SalesReportApp/DCItemwiseReport";

const ItemGroupPopupUrl      = "/api/Report/ItemGroup";

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

// Backend query does: SaleDate between 'Fromdate' and 'Todate'
// Todate without a time part is treated as Todate 00:00:00 (midnight),
// which excludes every bill made later that same day.
// So for API calls only, we send Todate with end-of-day time (23:59:59).
const toMMDDYYYYEndOfDay = (isoDate) => {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.split("-");
  return `${m}/${d}/${y} 23:59:59`;
};

export default function DC() {
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
    MUOM: "",
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

  const showItemwiseExtras = reportType === REPORT_TYPES.ITEMWISE;

  useEffect(() => {
    const menulist = CC.getLocal("menulist");
    if (menulist == null) {
      setMsg({ text: "Session Close Please Login !!!.", isErr: true });
      navigate("/Login/Index");
      return;
    }

    const menudata = menulist.filter((obj) => obj.PageName === "Quotation Report"); //Delivery Challan Report
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
    const ComSet = CC.getLocal("Companysetting") || [{}];
    const taxInclusiveDontShow = ComSet[0]?.POSTax !== "Inclusive Don't Show Tax" ? 0 : 1;

    setSession({
      Comid,
      MComid,
      taxInclusiveDontShow,
      MUOM: MainSet[0]?.MultipleUOMBilling || "",
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

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.keyCode === 122) {
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

  const handleReportTypeChange = useCallback((type) => {
    setReportType(type);
    setDaily(false);
  }, []);

  const handleRefresh = useCallback(() => {
    setFromDate(todayStr());
    setToDate(todayStr());
    setDaily(false);
    setChkMrp(false);
  }, []);

  const handleGroupPopupClose = useCallback((selectedGroup, selectedGroupText) => {
    setGroupBy(selectedGroup || "");
    setGroupByText(selectedGroupText || "");
    setShowGroupPopup(false);
  }, []);

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

  const handleView = useCallback(async () => {
    if (!fromDate || !toDate) {
      setMsg({ text: "Please select From Date and To Date.", isErr: true });
      return;
    }

    const Fromdate = toMMDDYYYY(fromDate);
    const Todate = toMMDDYYYY(toDate);
    // Only for API calls (SQL BETWEEN needs end-of-day time, see helper above)
    const TodateForApi = toMMDDYYYYEndOfDay(toDate);

    if (new Date(Fromdate) > new Date(Todate)) {
      setMsg({ text: "From Date Is Greater Than To Date!!", isErr: true });
      return;
    }

    const ReportTypenew = daily ? "D" : "";
    const TaxSuppressId = session.taxInclusiveDontShow === 1 ? 1 : 0;

    setLoading(true);
    setMsg(null);

    try {
      const Comid = parseInt(session.Comid, 10);
      const MComid = parseInt(session.MComid, 10);

      if (reportType === REPORT_TYPES.CONSOLIDATE) {
        const ReportTitle = "Delivery Challan Consolidate";

        const res = await CC.api(DCConsolidateReportUrl, null, {React:1}, {
          Fromdate, Todate: TodateForApi, Comid,
        });

        if (res.ok || res.IsSuccess) {
          const cacheKey = res.Data15 || "";
          openReportViewer({
            ReportName  : "DCConsolidateReport",
            CacheKey    : cacheKey,
            Daily       : daily,
            GroupBy     : "",
            Fromdate,
            Todate,
            ReportType  : ReportTypenew,
            ReportTitle,
            CName       : session.CName,
            CAddress    : session.CAddress,
            CPhone      : session.CPhone,
          });
        } else {
          setMsg({ text: "No Record !!!.", isErr: true });
        }
      }
      else if (reportType === REPORT_TYPES.DETAILS) {
        const ReportTitle = "Delivery Challan Details";

        const res = await CC.api(DCDetailsReportUrl, null, {React:1}, {
          Fromdate, Todate: TodateForApi, Comid, MComid,
        });

        if (res.ok || res.IsSuccess) {
          const cacheKey = res.Data15 || "";
          openReportViewer({
            ReportName: "DCDetailsReport",
            CacheKey: cacheKey,
            Daily: daily,
            GroupBy: "",
            Fromdate,
            Todate,
            ReportType: ReportTypenew,
            ReportTitle,
            taxinclusivedontshow: session.taxInclusiveDontShow,
            CName: session.CName,
            CAddress: session.CAddress,
            CPhone: session.CPhone,
          });
        } else {
          setMsg({ text: "No Record !!!.", isErr: true });
        }
      }
      else if (reportType === REPORT_TYPES.ITEMWISE) {
        const ReportTitle = "Delivery Challan ItemWise Report";

        // NOTE: the original DC.js does NOT send MUOM to this endpoint
        // (unlike Estimate.js) — preserved exactly as-is.
        const res = await CC.api(DCItemwiseReportUrl, null, {React:1}, {
          Daily: daily,
          Fromdate,
          Todate: TodateForApi,
          Comid,
          MComid,
        });

        if (res.ok || res.IsSuccess) {
          const cacheKey = res.Data15 || "";
          openReportViewer({
            ReportName: "DCItemWiseReport",
            CacheKey    : cacheKey,
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
      { value: REPORT_TYPES.CONSOLIDATE, label: "Delivery Challan Consolidate" },
      { value: REPORT_TYPES.DETAILS, label: "Delivery Challan Details" },
      { value: REPORT_TYPES.ITEMWISE, label: "Delivery Challan Itemwise" },
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
    .dc-shell { min-height: 100vh; background: #f0f2f5; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; flex-direction: column; }
    .dc-topbar { background: linear-gradient(135deg, #3b6fe0, #1a4fd1); color: #fff; display: flex; align-items: center; justify-content: space-between; padding: 0 24px; height: 52px; box-shadow: 0 2px 8px rgba(0,0,0,.18); flex-shrink: 0; }
    .dc-topbar-title { font-size: 15px; font-weight: 600; letter-spacing: .3px; }
    .dc-close-btn { background: rgba(255,255,255,.15); border: none; color: #fff; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; transition: background .15s; }
    .dc-close-btn:hover { background: rgba(255,255,255,.28); }

    .dc-layout { flex: 1; display: flex; align-items: flex-start; justify-content: center; padding: 24px; box-sizing: border-box; }
    .dc-card { width: 100%; max-width: 740px; background: #fff; border: 2px solid #1a56db; border-radius: 10px; box-shadow: 0 4px 16px rgba(26,86,219,.18); overflow: hidden; }

    .dc-card-header { background: linear-gradient(135deg, #3b6fe0, #1a4fd1); border-bottom: 1px solid #1a4fd1; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; }
    .dc-card-header-title { font-size: 14px; font-weight: 700; color: #fff; letter-spacing: .2px; }
    .dc-close-x { background: rgba(255,255,255,.15); border: none; font-size: 14px; color: #fff; cursor: pointer; line-height: 1; padding: 6px 8px; border-radius: 6px; transition: background .15s; }
    .dc-close-x:hover { background: rgba(255,255,255,.28); }

    .dc-card-body { padding: 24px 32px 30px; }
    .dc-report-title { text-align: center; font-size: 22px; font-weight: 800; color: #1a3fd6; margin: 0 0 26px; }

    .dc-content { display: flex; gap: 32px; }

    .dc-left { flex: 0 0 190px; display: flex; flex-direction: column; gap: 14px; }
    .dc-right { flex: 1; display: flex; flex-direction: column; gap: 16px; max-width: 320px; }

    .dc-radio-row { display: flex; align-items: center; gap: 8px; cursor: pointer; user-select: none; font-size: 13px; color: #2b2b2b; font-weight: 500; }
    .dc-radio-row input[type="radio"] { width: 16px; height: 16px; accent-color: #1a56db; cursor: pointer; flex-shrink: 0; }

    .dc-field { display: flex; align-items: center; gap: 14px; }
    .dc-label { font-size: 13px; font-weight: 600; color: #1e293b; width: 96px; flex-shrink: 0; }
    .dc-input { height: 34px; border: 1px solid #c7cdd6; border-radius: 4px; padding: 0 10px; font-size: 13px; color: #1e2d3d; background: #fff; width: 100%; box-sizing: border-box; transition: border-color .15s, box-shadow .15s; outline: none; }
    .dc-input:focus { border-color: #1a56db; box-shadow: 0 0 0 3px rgba(26,86,219,.15); }

    .dc-toggle-row { display: flex; align-items: center; gap: 10px; height: 34px; background: #f7f9fc; border: 1px solid #c7cdd6; border-radius: 4px; padding: 0 10px; cursor: pointer; font-size: 13px; color: #1e2d3d; font-weight: 500; user-select: none; transition: border-color .15s; width: 100%; box-sizing: border-box; }
    .dc-toggle-row:hover { border-color: #1a56db; }
    .dc-toggle-row input[type="checkbox"] { width: 15px; height: 15px; accent-color: #1a56db; cursor: pointer; flex-shrink: 0; }

    /* ── F11 hint (ProductGroup shortcut, ItemWise only) ── */
    .dc-f11-hint { font-size: 12px; color: #6b7280; background: #f7f9fc; border: 1px dashed #c7cdd6; border-radius: 6px; padding: 8px 10px; line-height: 1.5; }
    .dc-f11-hint strong { color: #1e2d3d; }

    .dc-actions { display: flex; gap: 12px; justify-content: center; margin-top: 32px; padding-top: 22px; border-top: 1px solid #e8ecf0; }
    .dc-btn { height: 38px; padding: 0 30px; border-radius: 6px; border: 1px solid #1a56db; font-size: 14px; font-weight: 700; cursor: pointer; transition: opacity .15s, box-shadow .15s, background .15s; display: flex; align-items: center; gap: 8px; background: #fff; color: #1a56db; }
    .dc-btn:disabled { opacity: .5; cursor: not-allowed; }
    .dc-btn:not(:disabled):hover { background: #eef3ff; }
    .dc-btn-primary { border-color: #1e7e34; color: #1e7e34; }
    .dc-btn-primary .dc-icon-save { color: #1e7e34; }
    .dc-btn-secondary { border-color: #dc3545; color: #dc3545; }
    .dc-btn-secondary .dc-icon-cancel { color: #dc3545; }

    .dc-msg { margin-top: 18px; padding: 10px 14px; border-radius: 8px; font-size: 13px; font-weight: 500; text-align: center; }
    .dc-msg.err { background: #fff0f0; color: #c53030; border: 1px solid #fed7d7; }
    .dc-msg.ok  { background: #f0fff4; color: #276749; border: 1px solid #c6f6d5; }

    @media (max-width: 620px) {
      .dc-card-body { padding: 20px; }
      .dc-content { flex-direction: column; gap: 22px; }
      .dc-left { flex: none; }
      .dc-right { max-width: none; }
    }
  `;

  const navItems = [
    { value: REPORT_TYPES.CONSOLIDATE, label: "Delivery Challan Consolidate" },
    { value: REPORT_TYPES.DETAILS,     label: "Delivery Challan Details" },
    { value: REPORT_TYPES.ITEMWISE,    label: "Delivery Challan Itemwise" },
  ];

  if (!pageAccess.ready) {
    return (
      <>
        <style>{styles}</style>
        <div className="dc-shell">
          <Topbar/>
          <div className="dc-layout">
            <div className="dc-card">
              <div className="dc-card-body">
                {msg && <div className={`dc-msg ${msg.isErr ? "err" : "ok"}`}>{msg.text}</div>}
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
        <div className="dc-shell">
          <Topbar/>
          <div className="dc-layout">
            <div className="dc-card">
              <div className="dc-card-body">
                <div className="dc-msg err">Page Access Permission Denied !!!.</div>
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
      <div className="dc-shell">
        <Topbar/>
        <div className="dc-layout">
          <div className="dc-card">
            <div className="dc-card-header">
              <div className="dc-card-header-title">Delivery Challan Reports</div>
              <button type="button" className="dc-close-x" aria-label="Close" onClick={() => navigate(-1)}>✕</button>
            </div>

            <div className="dc-card-body">
              <div className="dc-report-title">All Type Of Delivery Challan Report</div>

              <div className="dc-content">
                {/* ── Left: report type selection ── */}
                <div className="dc-left">
                  {navItems.map((item) => (
                    <label key={item.value} className="dc-radio-row">
                      <input
                        type="radio"
                        name="dc-report-type"
                        checked={reportType === item.value}
                        onChange={() => handleReportTypeChange(item.value)}
                      />
                      {item.label}
                    </label>
                  ))}
                </div>

                {/* ── Right: dates + toggles ── */}
                <div className="dc-right">
                  <div className="dc-field">
                    <label className="dc-label" htmlFor="dc-from-date">From Date</label>
                    <input id="dc-from-date" type="date" className="dc-input" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                  </div>

                  <div className="dc-field">
                    <label className="dc-label" htmlFor="dc-to-date">To Date</label>
                    <input id="dc-to-date" type="date" className="dc-input" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                  </div>

                  <div className="dc-field">
                    <label className="dc-label">Daily</label>
                    <label className="dc-toggle-row">
                      <input type="checkbox" checked={daily} onChange={(e) => setDaily(e.target.checked)} />
                      {daily ? "Enabled" : "Disabled"}
                    </label>
                  </div>

                  {showItemwiseExtras && (
                    <>
                      <div className="dc-field">
                        <label className="dc-label">MRP</label>
                        <label className="dc-toggle-row">
                          <input type="checkbox" checked={chkMrp} onChange={(e) => setChkMrp(e.target.checked)} />
                          {chkMrp ? "Enabled" : "Disabled"}
                        </label>
                      </div>

                      <div className="dc-f11-hint">
                        Press <strong>F11</strong> to select a Product Group for this Itemwise report.
                        {groupByText ? ` (Selected: ${groupByText})` : ""}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="dc-actions">
                <button type="button" className="dc-btn dc-btn-primary" disabled={loading || pageAccess.pageview === 0} onClick={handleView}>
                  <Save size={16} className="dc-icon-save" />
                  {loading ? "Loading…" : "View"}
                </button>
                <button type="button" className="dc-btn dc-btn-secondary" onClick={handleRefresh} disabled={loading}>
                  <XCircle size={16} className="dc-icon-cancel" />
                  Refresh
                </button>
              </div>

              {msg && <div className={`dc-msg ${msg.isErr ? "err" : "ok"}`}>{msg.text}</div>}
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

        {showGroupPopup && (
          <div className="mp-picker-ov" onClick={() => setShowGroupPopup(false)}>
            <div className="mp-picker" style={{ width: 580, height: 460 }} onClick={(e) => e.stopPropagation()}>
              <header>
                <h3>ProductGroup</h3>
                <button className="mp-picker-close" onClick={() => setShowGroupPopup(false)}>✕</button>
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