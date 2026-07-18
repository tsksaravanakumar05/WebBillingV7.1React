// ─────────────────────────────────────────────────────────────────────────────
//  Estimate.jsx
//  React conversion of Estimate.js (jQuery) — "All Type Of Estimate Report"
//  Uses API helpers from Common.jsx (CC.api / CC.mkUrl / CC.authHeaders etc.)
//  Styling: MasterPage.css only — no inline color values, no new theme colors.
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
// to the Estimate report and are not yet defined in Common.jsx)
const EstimateConsolidateReportUrl = "/api/SalesReportApp/EstimateConsolidateReport";
const EstimateDetailsReportUrl     = "/api/SalesReportApp/EstimateDetailsReport";
const EstimateItemwiseReportUrl    = "/api/SalesReportApp/EstimateItemwiseReport";

const ItemGroupPopupUrl            = "/api/Report/ItemGroup";

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

export default function Estimate() {
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

    const menudata = menulist.filter((obj) => obj.PageName === "Quotation Report"); //Estimate Report
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

    console.log(menulist)
    console.log(menudata)
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
        const ReportTitle = "Estimate Consolidate";

        const res = await CC.api(EstimateConsolidateReportUrl, null, {React:1}, {
          Fromdate, Todate, Comid,
        });

        if (res.ok || res.IsSuccess) {
          const cacheKey = res.Data15 || "";
          openReportViewer({
            ReportName  : "EstimateConsolidateReport",
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
        const ReportTitle = "Estimate Details";

        const res = await CC.api(EstimateDetailsReportUrl, null, {React:1}, {
          Fromdate, Todate, Comid, MComid,
        });

        if (res.ok || res.IsSuccess) {
          const cacheKey = res.Data15 || "";
          openReportViewer({
            ReportName: "EstimateDetailsReport",
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
        const ReportTitle = "Estimate ItemWise Report";

        const res = await CC.api(EstimateItemwiseReportUrl, null, {React:1}, {
          Daily: daily,
          Fromdate,
          Todate,
          MUOM: session.MUOM,
          Comid,
          MComid,
        });

        if (res.ok || res.IsSuccess) {
          const cacheKey = res.Data15 || "";
          openReportViewer({
            ReportName: "EstimateItemWiseReport",
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
      { value: REPORT_TYPES.CONSOLIDATE, label: "Estimate Consolidate" },
      { value: REPORT_TYPES.DETAILS, label: "Estimate Details" },
      { value: REPORT_TYPES.ITEMWISE, label: "Estimate Itemwise" },
    ],
    []
  );

  const styles = `
    .so-shell { min-height: 100vh; background: #f0f2f5; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; flex-direction: column; }
    .so-topbar { background: linear-gradient(135deg, #3b6fe0, #1a4fd1); color: #fff; display: flex; align-items: center; justify-content: space-between; padding: 0 24px; height: 52px; box-shadow: 0 2px 8px rgba(0,0,0,.18); flex-shrink: 0; }
    .so-topbar-title { font-size: 15px; font-weight: 600; letter-spacing: .3px; }
    .so-close-btn { background: rgba(255,255,255,.15); border: none; color: #fff; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; transition: background .15s; }
    .so-close-btn:hover { background: rgba(255,255,255,.28); }

    .so-layout { flex: 1; display: flex; align-items: flex-start; justify-content: center; padding: 24px; box-sizing: border-box; }
    .so-card { width: 100%; max-width: 820px; background: #fff; border: 2px solid #1a56db; border-radius: 10px; box-shadow: 0 4px 16px rgba(26,86,219,.18); overflow: hidden; }
    .so-card-header { background: linear-gradient(135deg, #3b6fe0, #1a4fd1); border-bottom: 1px solid #1a4fd1; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; }
    .so-card-header-title { font-size: 14px; font-weight: 700; color: #fff; letter-spacing: .2px; }
    .so-card-body { padding: 24px 32px 30px; }
    .so-report-title { text-align: center; font-size: 22px; font-weight: 800; color: #1a3fd6; margin: 0 0 26px; }

    .so-content { display: flex; gap: 28px; }

    .so-nav { flex: 0 0 220px; display: flex; flex-direction: column; gap: 8px; }
    .so-nav-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; color: #8a94a6; padding: 0 4px; margin-bottom: 2px; }
    .so-nav-card { background: #fff; border: 1.5px solid #d1d9e6; border-radius: 8px; padding: 12px 14px; cursor: pointer; transition: border-color .15s, box-shadow .15s, background .15s; display: flex; align-items: center; gap: 10px; }
    .so-nav-card:hover { border-color: #1a56db; box-shadow: 0 3px 12px rgba(26,86,219,.12); }
    .so-nav-card.active { background: #eef3ff; border-color: #1a56db; box-shadow: 0 3px 12px rgba(26,86,219,.15); }
    .so-nav-icon { width: 30px; height: 30px; border-radius: 8px; background: #e8edfc; display: flex; align-items: center; justify-content: center; font-size: 15px; flex-shrink: 0; }
    .so-nav-card.active .so-nav-icon { background: #1a56db; }
    .so-nav-card-text { flex: 1; }
    .so-nav-card-name { font-size: 13px; font-weight: 600; color: #1e2d3d; line-height: 1.3; }
    .so-nav-card.active .so-nav-card-name { color: #1a56db; }

    .so-panel { flex: 1; display: flex; flex-direction: column; min-width: 0; }
    .so-panel-header { border-bottom: 1px solid #e8ecf0; padding-bottom: 14px; margin-bottom: 20px; }
    .so-panel-eyebrow { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; color: #1a56db; margin-bottom: 6px; }
    .so-panel-title { font-size: 16px; font-weight: 700; color: #1e2d3d; line-height: 1.2; }

    .so-form-grid { display: grid; grid-template-columns: 110px 1fr; gap: 14px 14px; align-items: center; max-width: 420px; }
    .so-label { font-size: 13px; font-weight: 600; color: #1e293b; }
    .so-input { height: 34px; border: 1px solid #c7cdd6; border-radius: 4px; padding: 0 10px; font-size: 13px; color: #1e2d3d; background: #fff; width: 100%; box-sizing: border-box; transition: border-color .15s, box-shadow .15s; outline: none; }
    .so-input:focus { border-color: #1a56db; box-shadow: 0 0 0 3px rgba(26,86,219,.15); }

    .so-toggle-row { display: flex; align-items: center; gap: 10px; height: 34px; background: #f7f9fc; border: 1px solid #c7cdd6; border-radius: 4px; padding: 0 12px; cursor: pointer; font-size: 13px; color: #1e293b; font-weight: 500; user-select: none; transition: border-color .15s; }
    .so-toggle-row:hover { border-color: #1a56db; }
    .so-toggle-row input[type="checkbox"] { width: 15px; height: 15px; accent-color: #1a56db; cursor: pointer; }

    .so-actions { display: flex; gap: 12px; margin-top: 28px; padding-top: 22px; border-top: 1px solid #e8ecf0; }
    .so-btn { height: 38px; padding: 0 30px; border-radius: 6px; border: 1px solid #1a56db; font-size: 14px; font-weight: 700; cursor: pointer; transition: opacity .15s, box-shadow .15s, background .15s; display: flex; align-items: center; gap: 8px; background: #fff; color: #1a56db; }
    .so-btn:disabled { opacity: .5; cursor: not-allowed; }
    .so-btn:not(:disabled):hover { background: #eef3ff; }
    .so-btn-primary { border-color: #1e7e34; color: #1e7e34; }
    .so-btn-primary .so-icon-save { color: #1e7e34; }
    .so-btn-secondary { border-color: #dc3545; color: #dc3545; }
    .so-btn-secondary .so-icon-cancel { color: #dc3545; }

    .so-msg { margin-top: 18px; padding: 10px 14px; border-radius: 8px; font-size: 13px; font-weight: 500; }
    .so-msg.err { background: #fff0f0; color: #c53030; border: 1px solid #fed7d7; }
    .so-msg.ok  { background: #f0fff4; color: #276749; border: 1px solid #c6f6d5; }

    @media (max-width: 700px) {
      .so-card-body { padding: 20px; }
      .so-content { flex-direction: column; gap: 22px; }
      .so-nav { flex: none; width: 100%; flex-direction: row; flex-wrap: wrap; }
      .so-nav-card { flex: 1 1 calc(50% - 5px); }
      .so-form-grid { grid-template-columns: 100px 1fr; }
    }
  `;

  const navItems = [
    { value: REPORT_TYPES.CONSOLIDATE, label: "Estimate Consolidate", icon: "📋" },
    { value: REPORT_TYPES.DETAILS,     label: "Estimate Details",     icon: "📄" },
    { value: REPORT_TYPES.ITEMWISE,    label: "Estimate Itemwise",    icon: "📦" },
  ];

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
          <div className="so-card">
            <div className="so-card-header">
              <div className="so-card-header-title">All Type Of Estimate Report</div>
            </div>

            <div className="so-card-body">
              <div className="so-report-title">Estimate - Report</div>

              <div className="so-content">
              <nav className="so-nav" aria-label="Report types">
                <div className="so-nav-label">Report Types</div>
                {navItems.map((item) => (
                  <div
                    key={item.value}
                    className={`so-nav-card${reportType === item.value ? " active" : ""}`}
                    onClick={() => handleReportTypeChange(item.value)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && handleReportTypeChange(item.value)}
                    aria-pressed={reportType === item.value}
                  >
                    <div className="so-nav-icon">{item.icon}</div>
                    <div className="so-nav-card-text">
                      <div className="so-nav-card-name">{item.label}</div>
                    </div>
                  </div>
                ))}
              </nav>

              <main className="so-panel">
                <div className="so-panel-header">
                  <div className="so-panel-eyebrow">Estimate</div>
                  <div className="so-panel-title">All Type Of Estimate Report</div>
                </div>

            <div className="so-form-grid">
              <label className="so-label" htmlFor="so-from-date">From Date</label>
              <input id="so-from-date" type="date" className="so-input" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />

              <label className="so-label" htmlFor="so-to-date">To Date</label>
              <input id="so-to-date" type="date" className="so-input" value={toDate} onChange={(e) => setToDate(e.target.value)} />

              <label className="so-label">Daily</label>
              <label className="so-toggle-row">
                <input type="checkbox" checked={daily} onChange={(e) => setDaily(e.target.checked)} />
                {daily ? "Enabled" : "Disabled"}
              </label>

              {showItemwiseExtras && (
                <>
                  <label className="so-label">MRP</label>
                  <label className="so-toggle-row">
                    <input type="checkbox" checked={chkMrp} onChange={(e) => setChkMrp(e.target.checked)} />
                    {chkMrp ? "Enabled" : "Disabled"}
                  </label>
                </>
              )}
            </div>

            {showItemwiseExtras && (
              <div style={{ marginTop: 8, fontSize: 12, color: "#8a94a6" }}>
                Press <strong>F11</strong> to select a Product Group for this Itemwise report.
                {groupByText ? ` (Selected: ${groupByText})` : ""}
              </div>
            )}

            <div className="so-actions">
              <button type="button" className="so-btn so-btn-primary" disabled={loading || pageAccess.pageview === 0} onClick={handleView}>
                <Save size={16} className="so-icon-save" />
                {loading ? "Loading…" : "View"}
              </button>
              <button type="button" className="so-btn so-btn-secondary" onClick={handleRefresh} disabled={loading}>
                <XCircle size={16} className="so-icon-cancel" />
                Refresh
              </button>
            </div>

            {msg && <div className={`so-msg ${msg.isErr ? "err" : "ok"}`}>{msg.text}</div>}
              </main>
              </div>
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