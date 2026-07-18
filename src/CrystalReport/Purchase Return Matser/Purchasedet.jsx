// ─────────────────────────────────────────────────────────────────────────────
//  PurchaseReturnDetailed.jsx
//  React conversion of the "Purchase Return Detailed" jQuery screen
//  Uses API helpers from Common.jsx (CC.api / CC.mkUrl / CC.authHeaders etc.)
//  Layout / card styling: shared "so-" design system (BranchWise.jsx /
//  PurchaseDet.jsx / PurReturnConsolidated.jsx palette — blue header,
//  green Save, red Cancel)
//
//  NOTES — preserved exactly from the source jQuery file:
//  1) Permission gate: redirect to /Login/Index if no session (menulist ==
//     null). If "Purchase Return Detailed" isn't in the menulist ->
//     Permission Denied + redirect after 3s. If found but View == 0 -> same
//     Permission Denied + redirect after 3s. NOTE: unlike PurchaseDet.js,
//     this source redirects to "/Login/Home" in BOTH denial branches (not
//     "/Home") — reproduced literally below.
//  2) Supplier combo (GroupBy) is OPTIONAL — the source only validates when
//     `jqxComboBox('getSelectedItem')` is non-null. If picked but its value
//     resolves to null, an alert fires ("Please Select Valid Supplier Name
//     !!!." — note the wording differs from PurchaseDet.js's "...Item
//     Name...") and the combo is cleared + focused. GroupBy stays "" unless
//     a supplier is actually selected.
//  3) Report Type is a single 3-way radio (Cash / Credit / Both) whose
//     values are literally "CASH" / "CREDIT" / "BOTH" (unlike PurchaseDet.js
//     which uses "CA"/"CR" — kept exactly as this source sends them).
//  4) Dates: source reads the widget's Date object, formats it to
//     MM/dd/yyyy via `$.jqx.dataFormat.formatdate(date, 'MM/dd/yyyy')` for
//     both the validation comparison AND the AJAX payload / query string.
//     Reproduced below with `toMMDDYYYY`.
//  5) From/To date validation: `new Date(Fromdate) > new Date(Todate)` ->
//     alert "From Date Is Greater Than To Date!!", focus fromdate, return.
//  6) `SupplierWise` and `Daily` are checkboxes forwarded only to the
//     ReportViewer query string, NOT to the AJAX report-generation call
//     (source AJAX body only sends GroupBy / ReportType / Fromdate /
//     Todate / Comid / MComid).
//  7) `MComid` is a page-global in the source (not declared in the snippet
//     itself — set elsewhere on the page, same convention as CName /
//     CAddress / CPhone). Sourced here from local storage alongside Comid.
//  8) AJAX call is a POST returning JSON; on `data.ok == true` a new window
//     is opened at
//     "../Reports/ReportViewer.aspx?ReportName=PurchaseReturnDetailed&Repor
//     tType=...&SupplierWise=...&Daily=...&Fromdate=...&Todate=...&CName=..
//     .&CAddress=...&CPhone=..." with the exact window feature string from
//     source, and its title is set to 'Purchase Return Detail-Report' once
//     loaded. On `data.ok == false` -> "No Record !!!." message.
//  9) Supplier combo selection is cleared after every View click,
//     success or not (source calls this unconditionally right after the
//     synchronous $.ajax call).
//  10) Refresh button: clears supplier selection, unchecks both checkboxes,
//      resets the date pickers (re-init defaults to today, reproduced as
//      todayStr()), and resets the radio group back to its default —
//      "Both" checked, Cash/Credit unchecked.
//  11) Loader shows for the duration of the (source: synchronous) AJAX
//      call; reproduced as a standard async call with a loading flag,
//      since real synchronous XHR is not available/desirable in React.
//
//  ASSUMPTIONS (please confirm / adjust):
//  - PageName string kept as "Purchase Return Detailed" (from source).
//  - Endpoint ported from the source's MVC action
//    "/PurchaseReport/PurchaseReturnDetailsReport" to the Web API
//    convention used elsewhere in this app:
//    "/api/PurchaseReportApp/PurchaseReturnDetailsReport". Swap the
//    constant below if your backend route differs.
//  - Supplier combo data source assumed as GetSupplier (same convention as
//    PurchaseDet.jsx / PurReturnConsolidated.jsx) — adjust the URL / field
//    names in loadLists() if your API differs.
//  - res.Data15 used as the ReportViewer CacheKey, per house convention
//    (the original jQuery didn't use a cache key at all, it just checked
//    data.ok === true).
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Save, XCircle } from "lucide-react";
import * as CC from "../../components/Common";
import Topbar from "../../components/Topbar";

// Report-type identifiers (mirrors rbtcash / rbtcredit / rbtboth — values
// kept literally "CASH" / "CREDIT" / "BOTH" as sent by the source jQuery)
const REPORT_TYPES = {
  CASH: "CASH",
  CREDIT: "CREDIT",
  BOTH: "BOTH",
};

const BASE_URL = "http://localhost:64215";

// API endpoint used by this screen (ported from source MVC action
// "/PurchaseReport/PurchaseReturnDetailsReport")
const PurchaseReturnDetailsReportUrl = "/api/PurchaseReportApp/PurchaseReturnDetailsReport";

// Supplier combo data source — matches the real backend action:
// public class SupplierAppController : ApiController
// public HttpResponseMessage GetSupplier(Int32 Comid, string AccountType)
const SupplierListUrl = "/api/SupplierApp/GetSupplier";

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

export default function PurchaseReturnDetailed() {
  const navigate = useNavigate();

  // ── Session / permission state ─────────────────────────────────────────
  const [pageAccess, setPageAccess] = useState({
    ready: false,
    allowed: false,
    pageview: 0,
  });

  // ── Company / settings state ────────────────────────────────────────────
  const [session, setSession] = useState({
    Comid: "",
    MComid: "",
    CName: "",
    CAddress: "",
    CPhone: "",
  });

  // ── Form state (controlled inputs replacing jqx widgets) ───────────────
  const [reportType, setReportType] = useState(REPORT_TYPES.BOTH);
  const [fromDate, setFromDate] = useState(todayStr());
  const [toDate, setToDate] = useState(todayStr());
  const [supplierWise, setSupplierWise] = useState(false); // chksupplier
  const [daily, setDaily] = useState(false);               // chkdaily
  const [selectedSupplier, setSelectedSupplier] = useState(""); // cmbsupplier

  // ── Combo data ───────────────────────────────────────────────────────────
  const [suppliers, setSuppliers] = useState([]);

  // ── UI feedback state ───────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null); // { text, isErr }

  // Bootstrap: permission gate + session + supplier combo.
  useEffect(() => {
    const menulist = CC.getLocal("menulist");
    if (menulist == null) {
      setMsg({ text: "Session Close Please Login !!!.", isErr: true });
      navigate("/Login/Index");
      return;
    }

    const menudata = menulist.filter((obj) => obj.PageName === "Purchase Return Detailed");
    if (!menudata || menudata.length === 0) {
      setMsg({ text: "Page Access Permission Denied !!!.", isErr: true });
      // Source redirects to /Login/Home here (not /Home) — kept literal.
      setTimeout(() => navigate("/Login/Home"), 3000);
      return;
    }

    if (menudata[0].View === 0) {
      setMsg({ text: "Page Access Permission Denied !!!.", isErr: true });
      // Source redirects to /Login/Home here too — kept literal.
      setTimeout(() => navigate("/Login/Home"), 3000);
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

    const loadLists = async () => {
      try {
        // Backend requires AccountType too — "" / "ALL" fetches every
        // supplier regardless of Cash/Credit type. Adjust if your service
        // expects a specific non-empty value when nothing is filtered.
        const supRes = await CC.api(SupplierListUrl, null, {}, { Comid, AccountType: "SUPPLIER" });
        const supList = supRes?.Data1 || supRes?.data || [];

        setSuppliers(Array.isArray(supList) ? supList : []);
      } catch (err) {
        // Combo load failure shouldn't block the page — same as jQuery,
        // where loadsuppliercombo() failures just leave the combobox empty.
        console.error("PurchaseReturnDetailed supplier combo load error:", err);
      }
    };
    loadLists();
  }, [navigate]);

  const handleReportTypeChange = useCallback((type) => {
    setReportType(type);
  }, []);

  const handleRefresh = useCallback(() => {
    setSelectedSupplier("");
    setSupplierWise(false);
    setDaily(false);
    setFromDate(todayStr());
    setToDate(todayStr());
    setReportType(REPORT_TYPES.BOTH);
  }, []);

  const openReportViewer = useCallback((params) => {
    const qs = new URLSearchParams(params).toString();
    const url = `${BASE_URL}/Reports/ReportViewer.aspx?${qs}`;

    const w = window.open(
      url,
      "_blank",
      `directories=0,titlebar=0,toolbar=0,location=0,status=0,` +
      `menubar=0,scrollbars=yes,resizable=no,` +
      `width=${screen.width},height=${screen.height - 100}`
    );

    if (w) {
      w.addEventListener(
        "load",
        function () {
          w.document.title = "Purchase Return Detail-Report";
        },
        false
      );
    }
  }, []);

  const handleView = useCallback(async () => {
    // ── Supplier validation (only validated when something is selected — as in source) ──
    let GroupBy = "";
    if (selectedSupplier !== "") {
      GroupBy = selectedSupplier;
      if (GroupBy == null || GroupBy === "") {
        setMsg({ text: "Please Select Valid Supplier Name !!!.", isErr: true });
        setSelectedSupplier("");
        return;
      }
    }

    const RptType = reportType; // "CASH" / "CREDIT" / "BOTH"

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

    const SupplierWise = supplierWise;
    const Daily = daily;

    setLoading(true);
    setMsg(null);

    try {
      const Comid = session.Comid;
      const MComid = session.MComid;

      const res = await CC.api(PurchaseReturnDetailsReportUrl, null, {React:1}, {
        GroupBy,
        ReportType: RptType,
        Fromdate,
        Todate,
        Comid,
        MComid,
      });

      if (res.ok === true || res.IsSuccess) {
        const cacheKey = res.Data15 || "";
        openReportViewer({
          ReportName: "PurchaseReturnDetailed",
          CacheKey: cacheKey,
          ReportType: RptType,
          SupplierWise,
          Daily,
          Fromdate,
          Todate,
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
      // Source clears the supplier combobox after every View click
      setSelectedSupplier("");
    }
  }, [reportType, fromDate, toDate, supplierWise, daily, selectedSupplier, session, openReportViewer]);

  // ── Shared "so-" design system — identical to PurchaseDet.jsx /
  //   PurReturnConsolidated.jsx ──
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

    .so-toggle-row { display: flex; align-items: center; gap: 10px; height: 34px; background: #f7f9fc; border: 1px solid #c7cdd6; border-radius: 4px; padding: 0 12px; cursor: pointer; font-size: 13px; color: #1e293b; font-weight: 500; user-select: none; transition: border-color .15s; }
    .so-toggle-row:hover { border-color: #1a56db; }
    .so-toggle-row input[type="checkbox"] { width: 15px; height: 15px; accent-color: #1a56db; cursor: pointer; }

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

    .mp-wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f0f2f5; }
    .mp-body { padding: 24px; }
    .mp-msg { padding: 10px 14px; border-radius: 8px; font-size: 13px; font-weight: 500; text-align: center; }
    .mp-msg.err { background: #fff0f0; color: #c53030; border: 1px solid #fed7d7; }
    .mp-msg.ok  { background: #f0fff4; color: #276749; border: 1px solid #c6f6d5; }

    .mp-loader-ov { position: fixed; inset: 0; background: rgba(15,23,42,.35); display: flex; align-items: center; justify-content: center; z-index: 999; }
    .mp-ldr-box { background: #fff; padding: 22px 30px; border-radius: 10px; display: flex; flex-direction: column; align-items: center; gap: 12px; box-shadow: 0 8px 28px rgba(0,0,0,.25); }
    .mp-spin { width: 30px; height: 30px; border: 3px solid #dbe4f5; border-top-color: #1a56db; border-radius: 50%; animation: mp-spin-anim .8s linear infinite; }
    .mp-ldr-msg { font-size: 13px; color: #334155; font-weight: 600; }
    @keyframes mp-spin-anim { to { transform: rotate(360deg); } }

    @media (max-width: 620px) {
      .so-card-body { padding: 20px; }
      .so-content { flex-direction: column; gap: 22px; }
      .so-left { flex: none; }
      .so-right { max-width: none; }
    }
  `;

  const navItems = [
    { value: REPORT_TYPES.CASH,   label: "Cash" },
    { value: REPORT_TYPES.CREDIT, label: "Credit" },
    { value: REPORT_TYPES.BOTH,   label: "Both" },
  ];

  if (!pageAccess.ready) {
    return (
      <div className="mp-wrap">
        <style>{styles}</style>
        <div className="mp-body">
          {msg && <div className={`mp-msg ${msg.isErr ? "err" : "ok"}`}>{msg.text}</div>}
        </div>
      </div>
    );
  }

  if (!pageAccess.allowed) {
    return (
      <div className="mp-wrap">
        <style>{styles}</style>
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
              <div className="so-card-header-title">Purchase Return Detailed</div>
              <button type="button" className="so-close-x" aria-label="Close" onClick={() => navigate(-1)}>✕</button>
            </div>

            <div className="so-card-body">
              <div className="so-report-title">Purchase Return Detailed - Report</div>

              <div className="so-content">
                {/* ── Left: report type (Cash / Credit / Both) ── */}
                <div className="so-left">
                  {navItems.map((item) => (
                    <label key={item.value} className="so-radio-row">
                      <input
                        type="radio"
                        name="prd-report-type"
                        checked={reportType === item.value}
                        onChange={() => handleReportTypeChange(item.value)}
                      />
                      {item.label}
                    </label>
                  ))}
                </div>

                {/* ── Right: supplier + dates + toggles ── */}
                <div className="so-right">
                  <div className="so-field">
                    <label className="so-label" htmlFor="prd-supplier">Supplier</label>
                    <select
                      id="prd-supplier"
                      className="so-input"
                      value={selectedSupplier}
                      onChange={(e) => setSelectedSupplier(e.target.value)}
                    >
                      <option value="">-- Select Supplier --</option>
                      {suppliers.map((s, idx) => (
                        <option key={s.Id ?? s.SupplierId ?? idx} value={s.Id ?? s.SupplierId ?? s.value ?? ""}>
                          {s.AccountName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="so-field">
                    <label className="so-label" htmlFor="prd-from-date">From Date</label>
                    <input id="prd-from-date" type="date" className="so-input" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                  </div>

                  <div className="so-field">
                    <label className="so-label" htmlFor="prd-to-date">To Date</label>
                    <input id="prd-to-date" type="date" className="so-input" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                  </div>

                  <label className="so-toggle-row">
                    <input type="checkbox" checked={supplierWise} onChange={(e) => setSupplierWise(e.target.checked)} />
                    Supplier Wise
                  </label>

                  <label className="so-toggle-row">
                    <input type="checkbox" checked={daily} onChange={(e) => setDaily(e.target.checked)} />
                    Daily
                  </label>
                </div>
              </div>

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