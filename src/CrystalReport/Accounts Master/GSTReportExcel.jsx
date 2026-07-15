// ─────────────────────────────────────────────────────────────────────────────
//  GSTReportExcel.jsx
//  React conversion of GSTReportExcel.js (jQuery) — "GST Report Excel"
//  Uses API helpers from Common.jsx (CC.api / CC.mkUrl / CC.authHeaders etc.)
//  Styling: matches BankBook.jsx's layout, spacing, typography, colors,
//  border radius and shadows — no inline color values, no new theme colors.
//
//  NOTE: unlike BankBook.jsx (a single fixed report), this legacy screen has
//  two report-selection radio groups:
//    - "Panel1"  -> which report/format to run (Sale / Purchase / Branch Wise,
//                   across 3 legacy "Format1/Format2/Format3" layouts)
//    - "Panel"   -> GST type filter (All / With Tax / Without Tax)
//  plus a JSON-vs-Excel output checkbox. These are preserved exactly as they
//  behaved in the jQuery version — only the widgets (jqxRadioButton /
//  jqxCheckBox / jqxDateTimeInput) were swapped for native controls.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import * as CC from "../../components/Common";
import Topbar from "../../components/Topbar";

// API endpoint used by this screen.
// NOTE: the legacy jQuery file (GSTReportExcel.js) posted to the MVC action
// "/Stock/GSTExcelReport" — that was fine back then because the jQuery page
// was served from the SAME ASP.NET app (same origin), so no CORS was needed.
// Now that this is a standalone React app on a different origin
// (localhost:5173 -> localhost:64215), we must call the WebAPI action
// instead ("/api/StockReportApp/GSTExcelReport", see the [HttpPost]
// controller), which is the CORS-enabled route — same convention BankBook.jsx
// uses for its report call. Hitting the old MVC route directly will always
// fail with a CORS preflight error since that route has no CORS headers.
const GSTExcelReportUrl = "/api/StockReportApp/GSTExcelReport";

// Maps the legacy "Panel1" radio group (rdosale / rdopurchase / rdoBranchWise /
// rdosale3 / rdopurchase3 / rdosale4 / rdopurchase4) to the Format + ReportType
// pair the API expects. Preserved 1:1 from the original click handler.
const REPORT_OPTIONS = [
  { key: "sale", label: "Sale", format: "Format1", reportType: "Sale" },
  { key: "purchase", label: "Purchase", format: "Format1", reportType: "Purchase" },
  { key: "branchWise", label: "Branch Wise (All)", format: "Format1", reportType: "BranchSaleAll" },
  { key: "sale3", label: "Sale (Format 2)", format: "Format2", reportType: "Sale" },
  { key: "purchase3", label: "Purchase (Format 2)", format: "Format2", reportType: "Purchase" },
  { key: "sale4", label: "Sale (Format 3)", format: "Format3", reportType: "Sale" },
  { key: "purchase4", label: "Purchase (Format 3)", format: "Format3", reportType: "Purchase" },
];

// Maps the legacy "Panel" radio group (rdoall / rdowithtax / rdowithouttax)
// to the GSTType value the API expects.
const GST_TYPE_OPTIONS = [
  { key: "ALL", label: "All" },
  { key: "WGST", label: "With Tax" },
  { key: "WOGST", label: "Without Tax" },
];

const DEFAULT_REPORT_OPTION = "sale"; // rdosale checked:true in legacy init
const DEFAULT_GST_TYPE = "ALL"; // rdoall checked:true in legacy init

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

export default function GSTReportExcel() {
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
    CompanyName: "",
    GSTNo: "",
  });

  // ── Form state (controlled inputs replacing jqx widgets) ───────────────
  const [fromDate, setFromDate] = useState(todayStr());
  const [toDate, setToDate] = useState(todayStr());
  const [reportOption, setReportOption] = useState(DEFAULT_REPORT_OPTION); // Panel1
  const [gstType, setGstType] = useState(DEFAULT_GST_TYPE); // Panel
  const [jsonFormat, setJsonFormat] = useState(false); // chkjson
  const fromDateRef = useRef(null);

  // ── UI feedback state ───────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null); // { text, isErr }

  useEffect(() => {
    const menulist = CC.getLocal("menulist");
    if (menulist == null) {
      setMsg({ text: "Session Close Please Login !!!.", isErr: true });
      navigate("/Login/Index");
      return;
    }

    const menudata = menulist.filter((obj) => obj.PageName === "GSTReport Excel");
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
    const CompanyName = CC.getStr("CompanyName");
    const ComSet = CC.getLocal("Companysetting") || [{}];

    setSession({
      Comid,
      CompanyName,
      GSTNo: ComSet[0]?.GSTNo || "",
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
      if (e.keyCode === 27) {
        e.preventDefault();
        if (window.confirm("Do You Want To Quit Page?")) {
          navigate("/Home");
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [navigate]);

  const handleRefresh = useCallback(() => {
    // Matches the legacy #btnrefresh handler: date pickers were merely
    // re-initialised (kept at their current values) while the report-type
    // and GST-type radios were reset back to their defaults.
    setReportOption(DEFAULT_REPORT_OPTION);
    setGstType(DEFAULT_GST_TYPE);
  }, []);

  const handleView = useCallback(async () => {
    const Fromdate = toMMDDYYYY(fromDate);
    const Todate = toMMDDYYYY(toDate);

    if (new Date(Fromdate) > new Date(Todate)) {
      setMsg({ text: "From Date Is Greater Than To Date!!", isErr: true });
      fromDateRef.current?.focus();
      return;
    }

    const selected = REPORT_OPTIONS.find((opt) => opt.key === reportOption);
    if (!selected) {
      setMsg({ text: "Please Select A Report Type !!!.", isErr: true });
      return;
    }
    const { format: Format, reportType: ReportType } = selected;

    const JsonNew = jsonFormat ? 1 : 0;
    const GSTType = gstType;

    setLoading(true);
    setMsg(null);

    try {
      const res = await CC.api(GSTExcelReportUrl, null, {}, {
        Fromdate,
        Todate,
        Format,
        ReportType,
        GSTType,
        CompanyName: session.CompanyName,
        GSTIN: session.GSTNo,
        JsonNew,
        Comid: session.Comid,
      });

      // NOTE: the WebAPI controller (StockReportApp/GSTExcelReport) returns a
      // ResponseViewModel — { IsSuccess, StatusCode, Message, Data1 } — not the
      // { ok, datat } shape the old MVC-action jQuery version used. Checking
      // the wrong field names here silently breaks the download: res.ok /
      // res.datat come back undefined, so `get` ends up undefined and
      // `window.location.href = undefined` sends the browser into a stuck
      // "loading" navigation instead of downloading the file.
      const get = res?.Data1;
      if (res?.IsSuccess === true && get) {
        if (jsonFormat) {
          window.open(get, "_blank");
          setMsg({ text: "Json Open Sucessfully !!!.", isErr: false });
        } else {
          window.location.href = get;
          setMsg({ text: "Excel Open Sucessfully !!!.", isErr: false });
        }
      } else {
        setMsg({ text: res?.Message || "No Record !!!.", isErr: true });
      }
    } catch (err) {
      setMsg({ text: err.message || "Something went wrong.", isErr: true });
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, reportOption, gstType, jsonFormat, session]);

  const styles = `
    .so-shell { min-height: 100vh; background: #f0f2f5; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; flex-direction: column; }
    .so-topbar { background: var(--clr-primary, #1a56db); color: #fff; display: flex; align-items: center; justify-content: space-between; padding: 0 24px; height: 52px; box-shadow: 0 2px 8px rgba(0,0,0,.18); flex-shrink: 0; }
    .so-topbar-title { font-size: 15px; font-weight: 600; letter-spacing: .3px; }
    .so-close-btn { background: rgba(255,255,255,.15); border: none; color: #fff; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; transition: background .15s; }
    .so-close-btn:hover { background: rgba(255,255,255,.28); }
    .so-layout { display: flex; flex: 1; gap: 20px; padding: 24px; max-width: 1100px; width: 100%; margin: 0 auto; box-sizing: border-box; }
    .so-panel { flex: 1; background: #fff; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,.08); padding: 28px 32px; display: flex; flex-direction: column; }
    .so-panel-header { border-bottom: 1px solid #e8ecf0; padding-bottom: 16px; margin-bottom: 28px; }
    .so-panel-eyebrow { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; color: var(--clr-primary, #1a56db); margin-bottom: 6px; }
    .so-panel-title { font-size: 20px; font-weight: 700; color: #1e2d3d; line-height: 1.2; }
    .so-form-grid { display: grid; grid-template-columns: 120px 1fr; gap: 20px 16px; align-items: center; max-width: 460px; }
    .so-label { font-size: 13px; font-weight: 600; color: #4a5568; }
    .so-input { height: 38px; border: 1.5px solid #d1d9e6; border-radius: 8px; padding: 0 12px; font-size: 13px; color: #1e2d3d; background: #fff; width: 100%; box-sizing: border-box; transition: border-color .15s, box-shadow .15s; outline: none; }
    .so-input:focus { border-color: var(--clr-primary, #1a56db); box-shadow: 0 0 0 3px rgba(26,86,219,.1); }
    .so-fieldset { border: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
    .so-radio-group { display: flex; flex-wrap: wrap; gap: 10px 20px; align-items: center; }
    .so-radio-option { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #1e2d3d; cursor: pointer; user-select: none; }
    .so-radio-option input[type="radio"] { accent-color: var(--clr-primary, #1a56db); width: 15px; height: 15px; cursor: pointer; }
    .so-check-option { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: #4a5568; cursor: pointer; user-select: none; }
    .so-check-option input[type="checkbox"] { accent-color: var(--clr-primary, #1a56db); width: 16px; height: 16px; cursor: pointer; }
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
    @media (max-width: 700px) {
      .so-layout { flex-direction: column; padding: 16px; }
      .so-panel { padding: 20px 16px; }
      .so-form-grid { grid-template-columns: 100px 1fr; }
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
          <main className="so-panel">
            <div className="so-panel-header">
              <div className="so-panel-eyebrow">GST Report</div>
              <div className="so-panel-title">GST Report Excel</div>
            </div>

            <div className="so-form-grid">
              <label className="so-label" htmlFor="gst-from-date">From Date</label>
              <input
                id="gst-from-date"
                ref={fromDateRef}
                type="date"
                className="so-input"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />

              <label className="so-label" htmlFor="gst-to-date">To Date</label>
              <input
                id="gst-to-date"
                type="date"
                className="so-input"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />

              <span className="so-label">Report Type</span>
              <fieldset className="so-fieldset">
                <div className="so-radio-group">
                  {REPORT_OPTIONS.map((opt) => (
                    <label key={opt.key} className="so-radio-option">
                      <input
                        type="radio"
                        name="reportOption"
                        value={opt.key}
                        checked={reportOption === opt.key}
                        onChange={() => setReportOption(opt.key)}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </fieldset>

              <span className="so-label">GST Type</span>
              <fieldset className="so-fieldset">
                <div className="so-radio-group">
                  {GST_TYPE_OPTIONS.map((opt) => (
                    <label key={opt.key} className="so-radio-option">
                      <input
                        type="radio"
                        name="gstType"
                        value={opt.key}
                        checked={gstType === opt.key}
                        onChange={() => setGstType(opt.key)}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </fieldset>

              <span className="so-label">Output</span>
              <label className="so-check-option">
                <input
                  type="checkbox"
                  checked={jsonFormat}
                  onChange={(e) => setJsonFormat(e.target.checked)}
                />
                Open As JSON (instead of Excel)
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
              <button
                type="button"
                className="so-btn so-btn-secondary"
                onClick={handleRefresh}
                disabled={loading}
              >
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