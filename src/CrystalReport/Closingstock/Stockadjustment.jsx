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
import { Save, XCircle } from "lucide-react";
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

  // ── Design system: recolored/restructured to match BranchWise.jsx exactly ──
  //   Border / header / heading -> blue (#1a56db)
  //   Save-style accents        -> green (#1e7e34)
  //   Cancel / link accents     -> red   (#dc3545)
  const styles = `
    .so-shell { min-height: 100vh; background: #f0f2f5; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; flex-direction: column; }
    .so-topbar { background: linear-gradient(135deg, #3b6fe0, #1a4fd1); color: #fff; display: flex; align-items: center; justify-content: space-between; padding: 0 24px; height: 52px; box-shadow: 0 2px 8px rgba(0,0,0,.18); flex-shrink: 0; }
    .so-topbar-title { font-size: 15px; font-weight: 600; letter-spacing: .3px; }
    .so-close-btn { background: rgba(255,255,255,.15); border: none; color: #fff; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; transition: background .15s; }
    .so-close-btn:hover { background: rgba(255,255,255,.28); }

    .so-layout { flex: 1; display: flex; align-items: flex-start; justify-content: center; padding: 24px; box-sizing: border-box; }
    .so-card { width: 100%; max-width: 560px; background: #fff; border: 2px solid #1a56db; border-radius: 10px; box-shadow: 0 4px 16px rgba(26,86,219,.18); overflow: hidden; }

    .so-card-header { background: linear-gradient(135deg, #3b6fe0, #1a4fd1); border-bottom: 1px solid #1a4fd1; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; }
    .so-card-header-title { font-size: 14px; font-weight: 700; color: #fff; letter-spacing: .2px; }
    .so-close-x { background: rgba(255,255,255,.15); border: none; font-size: 14px; color: #fff; cursor: pointer; line-height: 1; padding: 6px 8px; border-radius: 6px; transition: background .15s; }
    .so-close-x:hover { background: rgba(255,255,255,.28); }

    .so-card-body { padding: 24px 32px 30px; }
    .so-report-title { text-align: center; font-size: 22px; font-weight: 800; color: #1a3fd6; margin: 0 0 26px; }

    .so-content { display: flex; justify-content: center; }
    .so-right { flex: 1; display: flex; flex-direction: column; gap: 16px; max-width: 320px; margin: 0 auto; }

    .so-field { display: flex; align-items: center; gap: 14px; }
    .so-label { font-size: 13px; font-weight: 600; color: #1e293b; width: 96px; flex-shrink: 0; }
    .so-input { height: 34px; border: 1px solid #c7cdd6; border-radius: 4px; padding: 0 10px; font-size: 13px; color: #1e2d3d; background: #fff; width: 100%; box-sizing: border-box; transition: border-color .15s, box-shadow .15s; outline: none; }
    .so-input:focus { border-color: #1a56db; box-shadow: 0 0 0 3px rgba(26,86,219,.15); }
    .so-input:disabled { background: #f5f6f8; color: #a0aab5; cursor: not-allowed; }
    select.so-input { appearance: auto; cursor: pointer; }

    .so-checkbox { display: flex; align-items: center; gap: 8px; cursor: pointer; user-select: none; font-size: 13px; color: #2b2b2b; font-weight: 500; margin-top: 4px; }
    .so-checkbox input { position: absolute; opacity: 0; width: 0; height: 0; }
    .so-checkbox-box { width: 16px; height: 16px; flex-shrink: 0; border: 1px solid #c7cdd6; border-radius: 4px; background: #fff; display: flex; align-items: center; justify-content: center; transition: border-color .15s, background .15s, box-shadow .15s; }
    .so-checkbox input:checked ~ .so-checkbox-box { background: #1a56db; border-color: #1a56db; }
    .so-checkbox input:focus-visible ~ .so-checkbox-box { box-shadow: 0 0 0 3px rgba(26,86,219,.2); }
    .so-checkbox-box svg { width: 10px; height: 10px; opacity: 0; transform: scale(.6); transition: opacity .12s, transform .12s; }
    .so-checkbox input:checked ~ .so-checkbox-box svg { opacity: 1; transform: scale(1); }

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
      .so-right { max-width: none; }
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
        <Topbar />

        <div className="so-layout">
          <div className="so-card">
            <div className="so-card-header">
              <div className="so-card-header-title">Stock Adjustment Detail Report</div>
              <button type="button" className="so-close-x" aria-label="Close" onClick={() => navigate(-1)}>✕</button>
            </div>

            <div className="so-card-body">
              <div className="so-report-title">Stock Adjustment Detail Report</div>

              <div className="so-content">
                <div className="so-right">
                  <div className="so-field">
                    <label className="so-label" htmlFor="sa-stock-type">Stock Type</label>
                    <select
                      id="sa-stock-type"
                      className="so-input"
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

                  <div className="so-field">
                    <label className="so-label" htmlFor="sa-from-date">From Date</label>
                    <input
                      id="sa-from-date"
                      type="date"
                      className="so-input"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                    />
                  </div>

                  <div className="so-field">
                    <label className="so-label" htmlFor="sa-to-date">To Date</label>
                    <input
                      id="sa-to-date"
                      type="date"
                      className="so-input"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                    />
                  </div>

                  <label className="so-checkbox">
                    <input
                      type="checkbox"
                      checked={daily}
                      onChange={(e) => setDaily(e.target.checked)}
                    />
                    <span className="so-checkbox-box">
                      <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                    Daily
                  </label>
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

              {msg && <div className={`so-msg ${msg.isErr ? "err" : "ok"}`}>{msg.text}</div>}
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