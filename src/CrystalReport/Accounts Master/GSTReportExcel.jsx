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
import { Save, XCircle, X } from "lucide-react";
import * as CC from "../../components/Common";
import Topbar from "../../components/Topbar";
import   DateFieldDDMMYYYY from "../../Commondatetime";

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
    .so-topbar { background: linear-gradient(135deg, #3b6fe0, #1a4fd1); color: #fff; display: flex; align-items: center; justify-content: space-between; padding: 0 24px; height: 52px; box-shadow: 0 2px 8px rgba(0,0,0,.18); flex-shrink: 0; }
    .so-topbar-title { font-size: 15px; font-weight: 600; letter-spacing: .3px; }
    .so-close-btn { background: rgba(255,255,255,.15); border: none; color: #fff; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; transition: background .15s; }
    .so-close-btn:hover { background: rgba(255,255,255,.28); }

    .so-layout { flex: 1; display: flex; align-items: flex-start; justify-content: center; padding: 24px; box-sizing: border-box; }
    .so-card { width: 100%; max-width: 620px; background: #fff; border: 2px solid #1a56db; border-radius: 10px; box-shadow: 0 4px 16px rgba(26,86,219,.18); overflow: hidden; }
    .so-card-header { background: linear-gradient(135deg, #3b6fe0, #1a4fd1); border-bottom: 1px solid #1a4fd1; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; }
    .so-card-header-title { font-size: 14px; font-weight: 700; color: #fff; letter-spacing: .2px; }
    .so-card-close-btn { display: flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 6px; border: none; background: rgba(255,255,255,.16); color: #fff; cursor: pointer; padding: 0; transition: background .15s; }
    .so-card-close-btn:hover { background: rgba(255,255,255,.3); }
    .so-card-body { padding: 24px 32px 30px; }
    .so-report-title { text-align: center; font-size: 22px; font-weight: 800; color: #1a3fd6; margin: 0 0 26px; }

    .so-form-grid { display: grid; grid-template-columns: 120px 1fr; gap: 14px 14px; align-items: center; max-width: 480px; }
    .so-label { font-size: 13px; font-weight: 600; color: #1e293b; }
    .so-input { height: 34px; border: 1px solid #c7cdd6; border-radius: 4px; padding: 0 10px; font-size: 13px; color: #1e2d3d; background: #fff; width: 100%; box-sizing: border-box; transition: border-color .15s, box-shadow .15s; outline: none; }
    .so-input:focus { border-color: #1a56db; box-shadow: 0 0 0 3px rgba(26,86,219,.15); }

    .so-fieldset { border: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
    .so-radio-group { display: flex; flex-wrap: wrap; gap: 10px 20px; align-items: center; }
    .so-radio-option { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #1e293b; cursor: pointer; user-select: none; }
    .so-radio-option input[type="radio"] { accent-color: #1a56db; width: 15px; height: 15px; cursor: pointer; }
    .so-check-option { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: #1e293b; cursor: pointer; user-select: none; }
    .so-check-option input[type="checkbox"] { accent-color: #1a56db; width: 16px; height: 16px; cursor: pointer; }

    .so-actions { display: flex; gap: 12px; justify-content: center; margin-top: 28px; padding-top: 22px; border-top: 1px solid #e8ecf0; }
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
      .so-form-grid { grid-template-columns: 1fr; }
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
              <div className="so-card-header-title">GST Report Excel</div>
              <button
                type="button"
                className="so-card-close-btn"
                onClick={() => navigate(-1)}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <div className="so-card-body">
              <div className="so-report-title">GST Report Excel</div>

            <div className="so-form-grid">
              <label className="so-label" htmlFor="gst-from-date">From Date</label>
              <DateFieldDDMMYYYY id="pri-from-date" value={fromDate} onChange={setFromDate} />

              <label className="so-label" htmlFor="gst-to-date">To Date</label>
              <DateFieldDDMMYYYY id="pri-to-date" value={toDate} onChange={setToDate} />

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