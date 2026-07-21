// ─────────────────────────────────────────────────────────────────────────────
//  PurchaseRetunCons.jsx
//  React conversion of PurchaseReturnConsolidatedReport.js (jQuery)
//  — "Purchase Return Consolidated" Report
//  Uses API helpers from Common.jsx (CC.api / CC.mkUrl / CC.authHeaders etc.)
//  Layout / card styling: copied from BranchWise.jsx (so- prefix, blue/green/red palette)
//
//  NOTES — preserved exactly from the source jQuery file:
//  1) The menulist/permission-check block IS active in the source (unlike
//     BranchWise.js where it's commented out), so this screen DOES have a
//     page-access gate: redirect to /Login/Index if no session, redirect to
//     /Home after 3s if "Purchase Return Consolidated" isn't in the menulist.
//  2) The supplier combo (GroupBy) is OPTIONAL — if nothing is selected the
//     jQuery only validates when `getSelectedItem()` is non-null. Reproduced
//     below: GroupBy stays "" unless a supplier is actually picked.
//  3) Report Type is a single 3-way radio (Cash / Credit / Both), defaulting
//     to "Both" — mirrors rbtcash/rbtcredit/rbtboth, not a multi-report nav.
//  4) `SupplierWise` and `Daily` are checkboxes forwarded only to the
//     ReportViewer query string, not to the AJAX report-generation call
//     (matches source: the AJAX body only sends GroupBy/ReportType/
//     Fromdate/Todate/Comid).
//  5) Supplier selection is cleared after every View click, success or not
//     (source calls $("#cmbsupplier").jqxComboBox('clearSelection') right
//     after the (synchronous) $.ajax call, unconditionally).
//
//  ASSUMPTIONS (please confirm / adjust):
//  - PageName string kept as "Purchase Return Consolidated" (from source).
//  - Endpoint kept literally as the source's MVC action
//    "/PurchaseReport/PurchaseReturnConsolidateReport". If your other
//    screens have since moved to a Web API "/api/..." route for this report,
//    swap the constant below.
//  - Supplier combo data source assumed as GetSupplierListV7 (same naming
//    convention as ProductListUrl in BranchWise.jsx) — adjust the URL and
//    the field names read in loadLists() if your API differs.
//  - res.Data15 used as the ReportViewer CacheKey, per house convention
//    (the original jQuery didn't use a cache key at all, it just checked
//    data.ok === true).
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Save, XCircle } from "lucide-react";
import * as CC from "../../components/Common"
import Topbar from "../../components/Topbar";

// Report-type identifiers (mirrors rbtcash / rbtcredit / rbtboth)
const REPORT_TYPES = {
  CASH: "CASH",
  CREDIT: "CREDIT",
  BOTH: "BOTH",
};

const BASE_URL = "http://localhost:64215";

// API endpoint used by this screen (kept literal, matches source MVC action)
const PurchaseReturnConsolidateReportUrl = "/api/PurchaseReportApp/PurchaseReturnConsolidateReport";

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

// ─────────────────────────────────────────────────────────────────────────────
//  SearchableSelect
//  Drop-in replacement for a native <select> lookup field (Supplier, Customer,
//  Brand, Category, ...). Same visual footprint (uses the .so-input class)
//  but adds an instant-filter text popup so users can type to narrow long
//  master-data lists instead of scrolling. Selection/clear behaviour matches
//  the original <select onChange> exactly — it just calls onChange(value)
//  with "" for the placeholder row, same as before.
// ─────────────────────────────────────────────────────────────────────────────
function SearchableSelect({ id, options, labelKey = "label", value, onChange, disabled, placeholder = "-- Select --" }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef(null);

  const getLabel = useCallback(
    (opt) => String(opt?.[labelKey] ?? opt?.label ?? ""),
    [labelKey]
  );

  const selected = useMemo(
    () => options.find((o) => String(o.value) === String(value ?? "")) || null,
    [options, value]
  );

  // Keep the visible text in sync whenever the underlying value changes
  // (including external resets like the Refresh button).
  useEffect(() => {
    setQuery(selected ? getLabel(selected) : "");
  }, [selected, getLabel]);

  // Close + revert unsaved typed text on outside click.
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        setQuery(selected ? getLabel(selected) : "");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [selected, getLabel]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || (selected && q === getLabel(selected).toLowerCase())) return options;
    return options.filter((o) => getLabel(o).toLowerCase().includes(q));
  }, [options, query, selected, getLabel]);

  const handleSelect = (opt) => {
    onChange(String(opt.value));
    setQuery(getLabel(opt));
    setOpen(false);
  };

  const handleClear = () => {
    onChange("");
    setQuery("");
    setOpen(false);
  };

  return (
    <div className="so-combo-wrap" ref={wrapRef}>
      <input
        id={id}
        className="so-input"
        type="text"
        autoComplete="off"
        disabled={disabled}
        placeholder={placeholder}
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            setQuery(selected ? getLabel(selected) : "");
          }
        }}
      />
      {open && !disabled && (
        <div className="so-combo-list" role="listbox">
          <div
            className="so-combo-item so-combo-item-clear"
            onMouseDown={(e) => { e.preventDefault(); handleClear(); }}
          >
            {placeholder}
          </div>
          {filtered.length === 0 ? (
            <div className="so-combo-empty">No matches found</div>
          ) : (
            filtered.map((opt) => (
              <div
                key={opt.value}
                className={`so-combo-item${String(opt.value) === String(value ?? "") ? " active" : ""}`}
                role="option"
                aria-selected={String(opt.value) === String(value ?? "")}
                onMouseDown={(e) => { e.preventDefault(); handleSelect(opt); }}
              >
                {getLabel(opt)}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function PurchaseRetunCons() {
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

  // Normalized {value,label} list for the searchable Supplier combo —
  // same Id/Name resolution the native <select> used, just precomputed.
  const supplierOptions = useMemo(
    () =>
      suppliers.map((s, idx) => ({
        value: s.Id ?? s.SupplierId ?? s.value ?? idx,
        label: s.AccountName,
      })),
    [suppliers]
  );

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

    const menudata = menulist.filter((obj) => obj.PageName === "Purchase Return Consolidated");
    if (!menudata || menudata.length === 0) {
      setMsg({ text: "Page Access Permission Denied !!!.", isErr: true });
      setTimeout(() => navigate("/Home"), 3000);
      return;
    }

    const Comid = CC.getStr("Comid");
    const ComSet = CC.getLocal("Companysetting") || [{}];

    setSession({
      Comid,
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

        console.log(supList)
        console.log(supRes)
      } catch (err) {
        // Combo load failure shouldn't block the page — same as jQuery,
        // where loadsuppliercombo() failures just leave the combobox empty.
        console.error("PurchaseRetunCons supplier combo load error:", err);
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

    window.open(
      url,
      "_blank",
      `directories=0,titlebar=0,toolbar=0,location=0,status=0,` +
      `menubar=0,scrollbars=yes,resizable=no,` +
      `width=${screen.width},height=${screen.height - 100}`
    );
  }, []);

  const handleView = useCallback(async () => {
    // ── Supplier validation (only validated when something is selected — as in source) ──
    let GroupBy = "";
    if (selectedSupplier !== "") {
      GroupBy = selectedSupplier;
      if (GroupBy == null || GroupBy === "") {
        setMsg({ text: "Please Select Valid Supplier Name !!!.", isErr: true });
        return;
      }
    }

    const RptType = reportType; // CASH / CREDIT / BOTH

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

    setLoading(true);
    setMsg(null);

    try {
      const Comid = session.Comid;

      const res = await CC.api(PurchaseReturnConsolidateReportUrl, null, {React:1}, {
        GroupBy,
        ReportType: RptType,
        Fromdate,
        Todate,
        Comid,
      });

      if (res.ok || res.IsSuccess) {
        const cacheKey = res.Data15 || "";
        openReportViewer({
          ReportName: "PurchaseReturnConsalted",
          CacheKey: cacheKey,
          ReportType: RptType,
          SupplierWise: supplierWise,
          Daily: daily,
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

  // ── Recolored / laid out to match BranchWise.jsx (CompanyCreation.jsx palette) ──
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

    /* ── Searchable lookup dropdown (Supplier / Customer / Brand / Category ...) ── */
    .so-combo-wrap { position: relative; width: 100%; }
    .so-combo-list { position: absolute; top: calc(100% + 4px); left: 0; right: 0; max-height: 220px; overflow-y: auto; background: #fff; border: 1px solid #c7cdd6; border-radius: 6px; box-shadow: 0 8px 24px rgba(26,86,219,.15); z-index: 20; padding: 4px; box-sizing: border-box; }
    .so-combo-item { padding: 8px 10px; font-size: 13px; color: #1e2d3d; border-radius: 4px; cursor: pointer; line-height: 1.3; }
    .so-combo-item:hover, .so-combo-item.active { background: #eef3ff; color: #1a56db; }
    .so-combo-item-clear { color: #8a94a6; font-style: italic; border-bottom: 1px solid #ececec; margin-bottom: 2px; border-radius: 0; }
    .so-combo-empty { padding: 10px; font-size: 12px; color: #9aa5b1; text-align: center; }

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
              <div className="so-card-header-title">Purchase Return Consolidated</div>
              <button type="button" className="so-close-x" aria-label="Close" onClick={() => navigate(-1)}>✕</button>
            </div>

            <div className="so-card-body">
              <div className="so-report-title">Purchase Return Consolidated - Report</div>

              <div className="so-content">
                {/* ── Left: report type (Cash / Credit / Both) ── */}
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

                {/* ── Right: supplier + dates + toggles ── */}
                <div className="so-right">
                  <div className="so-field">
                    <label className="so-label" htmlFor="so-supplier">Supplier</label>
                    <SearchableSelect
                      id="so-supplier"
                      options={supplierOptions}
                      labelKey="label"
                      value={selectedSupplier}
                      onChange={(val) => setSelectedSupplier(val)}
                      placeholder="-- Select Supplier --"
                    />
                  </div>

                  <div className="so-field">
                    <label className="so-label" htmlFor="so-from-date">From Date</label>
                    <input id="so-from-date" type="date" className="so-input" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                  </div>

                  <div className="so-field">
                    <label className="so-label" htmlFor="so-to-date">To Date</label>
                    <input id="so-to-date" type="date" className="so-input" value={toDate} onChange={(e) => setToDate(e.target.value)} />
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