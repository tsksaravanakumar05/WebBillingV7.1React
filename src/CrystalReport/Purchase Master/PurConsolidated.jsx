// ─────────────────────────────────────────────────────────────────────────────
//  PurConsolidated.jsx
//  React conversion of PurConsolidated.js (jQuery) — "Purchase Consolidated Report"
//  Uses API helpers from Common.jsx (CC.api / CC.mkUrl / CC.authHeaders etc.)
//  Styling: same "so-*" design system introduced in BankBook.jsx — no inline
//  color values, no new theme colors, same card / form-grid / button language.
//
//  NOTE: unlike BankBook, this legacy screen has a Report-Type radio group
//  (Cash / Credit / Both), a Supplier combo that is OPTIONAL (not required
//  to run the report), and two extra flags — SupplierWise / Daily — carried
//  as checkboxes. Supplier selection is preserved exactly as optional, same
//  as the legacy jqxComboBox behaviour (GroupBy stays "" when nothing is
//  picked; only an item with a null/empty value is treated as an error).
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import * as CC from "../../components/Common";
import Topbar from "../../components/Topbar";

const BASE_URL = "http://localhost:64215";

// API endpoint used by this screen (kept exactly as the legacy jQuery file had it —
// MVC action route, not the /api/... convention used by newer report screens;
// confirm with the backend whether it should be migrated).
const PurchaseConsolidatedReportUrl = "/api/PurchaseReportApp/PurchaseBillConsolidateReport";

// The legacy file loads the supplier combo via a shared `loadsuppliercombo("#cmbsupplier")`
// helper defined outside PurConsolidated.js itself (not present in the source file
// we converted). This endpoint is our best-effort match to that helper's data
// source, following the same /api/...App/... convention as BankListUrl in
// BankBook.jsx — please confirm with the backend.
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

export default function PurConsolidated() {
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
    CommonCompany: "",
    CName: "",
    CAddress: "",
    CPhone: "",
  });

  // ── Form state (controlled inputs replacing jqx widgets) ───────────────
  const [fromDate, setFromDate] = useState(todayStr());
  const [toDate, setToDate] = useState(todayStr());

  // Report type (#rbtcash / #rbtcredit / #rbtboth) — legacy defaults to
  // "both" checked on load (methods.load()), preserved here as initial state.
  const [reportType, setReportType] = useState("BOTH"); // "CA" | "CR" | "BOTH"

  // Supplier-wise / Daily flags (#chksupplier / #chkdaily).
  const [supplierWise, setSupplierWise] = useState(false);
  const [daily, setDaily] = useState(false);

  // Supplier combo (#cmbsupplier in the legacy markup) — replaces jqxComboBox
  // with a type-to-filter combobox (input + filtered dropdown), same pattern
  // as the bank combo in BankBook.jsx. Unlike BankBook, selecting a supplier
  // is OPTIONAL — GroupBy is simply "" when nothing is chosen.
  const [supplierList, setSupplierList] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState(null); // { label, value } | null
  const [supplierSearch, setSupplierSearch] = useState("");
  const [supplierDropdownOpen, setSupplierDropdownOpen] = useState(false);
  const supplierWrapRef = useRef(null);

  // ── UI feedback state ───────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null); // { text, isErr }

  // Filtered options as the user types — matches on label (supplier name).
  const filteredSuppliers = useMemo(() => {
    const q = (supplierSearch || "").trim().toLowerCase();
    if (!q) return supplierList;
    return supplierList.filter((s) => String(s.label ?? "").toLowerCase().includes(q));
  }, [supplierList, supplierSearch]);

  // Keep the visible text in sync with the confirmed selection — covers both
  // a user picking an option and selectedSupplier being cleared elsewhere
  // (handleRefresh, handleView's finally block).
  useEffect(() => {
    setSupplierSearch(selectedSupplier?.label ?? "");
  }, [selectedSupplier]);

  // Close the supplier combobox dropdown when clicking outside it.
  useEffect(() => {
    const onDocMouseDown = (e) => {
      if (supplierWrapRef.current && !supplierWrapRef.current.contains(e.target)) {
        setSupplierDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  useEffect(() => {
    const menulist = CC.getLocal("menulist");
    if (menulist == null) {
      setMsg({ text: "Session Close Please Login !!!.", isErr: true });
      navigate("/Login/Index");
      return;
    }

    const menudata = menulist.filter((obj) => obj.PageName === "Purchase Consolidated");
    if (!menudata || menudata.length === 0) {
      setMsg({ text: "Page Access Permission Denied !!!.", isErr: true });
      setTimeout(() => navigate("/Login/Home"), 3000);
      return;
    }

    if (menudata[0].View === 0) {
      setMsg({ text: "Page Access Permission Denied !!!.", isErr: true });
      setTimeout(() => navigate("/Login/Home"), 3000);
      return;
    }

    const Comid = CC.getStr("Comid");
    const MComid = CC.getStr("MComid");
    const CommonCompany = CC.getStr("CommonCompany");
    const ComSet = CC.getLocal("Companysetting") || [{}];

    setSession({
      Comid,
      MComid,
      CommonCompany,
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

  // Loads the supplier combo once page access is granted — replaces the
  // legacy `loadsuppliercombo("#cmbsupplier")` call made from methods.load().
  useEffect(() => {
    if (!pageAccess.ready || !pageAccess.allowed) return;
    if (!session.Comid) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await CC.api(SupplierListUrl, null, {}, { Comid: session.Comid,
            AccountType: "SUPPLIER", });

        if (res?.IsSuccess === false) {
          if (!cancelled) setMsg({ text: res.Message || "Unable to load supplier list.", isErr: true });
          return;
        }
console.log(res)
        const rawList = res?.Data || res?.data || res?.Data1 || [];

        // Normalize whatever shape the backend actually sends into the
        // { label, value } shape this component uses everywhere else.
        const normalized = (Array.isArray(rawList) ? rawList : []).map((s) => ({
            label:
            s.AccountName ??
            s.AccountType ??
            s.SupplierName ??
            s.label ??
            s.Label ??
            s.Name ??
            s.Text ??
            "",
          value: s.value ?? s.Value ?? s.SupplierId ?? s.Supplierid ?? s.Id ?? s.SupplierCode ?? "",
        }));

        if (!cancelled) setSupplierList(normalized);
      } catch (err) {
        if (!cancelled) setMsg({ text: err.message || "Unable to load supplier list.", isErr: true });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pageAccess.ready, pageAccess.allowed, session.Comid]);

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

  // Matches the legacy #btnrefresh handler: clears the supplier combo
  // selection, unchecks Daily / Supplier-wise, and resets the report-type
  // radios back to "Both" (the date pickers were merely re-initialised with
  // the same format string in the legacy code, not reset to a new value).
  const handleRefresh = useCallback(() => {
    setSelectedSupplier(null);
    setDaily(false);
    setSupplierWise(false);
    setReportType("BOTH");
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
      w.addEventListener("load", () => { w.document.title = "Purchase Consolidated-Report"; }, false);
    }
  }, []);

  const handleView = useCallback(async () => {
    // Legacy: GroupBy stays "" when no supplier is selected — the combo is
    // optional here, unlike BankBook. If a selection exists but its value is
    // somehow null/empty, that's treated as an error, same as the jQuery.
    let GroupBy = "";
    if (selectedSupplier) {
      GroupBy = selectedSupplier.value;
      if (GroupBy == null || GroupBy === "") {
        setMsg({ text: "Please Select Valid Supplier Name !!!.", isErr: true });
        setSelectedSupplier(null);
        return;
      }
    }

    const RptType = reportType; // "CA" | "CR" | "BOTH"

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
      const res = await CC.api(PurchaseConsolidatedReportUrl, null, {React:1}, {
        GroupBy,
        ReportType: RptType,
        Fromdate,
        Todate,
        Comid: session.Comid,
      });

      if (res?.ok === true) {
        const cacheKey =
        res.data15 ??
        res.Data15 ??
        res.data?.Data15 ??
        "";
        openReportViewer({
          ReportName: "PurchaseConsalted",
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
      // Legacy clears the combo selection unconditionally right after the
      // (synchronous, async:false) $.ajax call returns, win or lose.
      setSelectedSupplier(null);
    }
  }, [fromDate, toDate, reportType, supplierWise, daily, selectedSupplier, session, openReportViewer]);

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
    .so-select { height: 38px; border: 1.5px solid #d1d9e6; border-radius: 8px; padding: 0 12px; font-size: 13px; color: #1e2d3d; background: #fff; width: 100%; box-sizing: border-box; transition: border-color .15s, box-shadow .15s; outline: none; cursor: pointer; }
    .so-select:focus { border-color: var(--clr-primary, #1a56db); box-shadow: 0 0 0 3px rgba(26,86,219,.1); }
    .so-combo { position: relative; }
    .so-combo-list { position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 20; margin: 0; padding: 4px; list-style: none; max-height: 220px; overflow-y: auto; background: #fff; border: 1.5px solid #d1d9e6; border-radius: 8px; box-shadow: 0 6px 20px rgba(0,0,0,.12); }
    .so-combo-item { padding: 8px 10px; font-size: 13px; color: #1e2d3d; border-radius: 6px; cursor: pointer; }
    .so-combo-item:hover { background: #f0f2f5; }
    .so-combo-empty { padding: 8px 10px; font-size: 13px; color: #4a5568; }
    .so-radio-group { display: flex; gap: 8px; flex-wrap: wrap; }
    .so-radio-pill { display: flex; align-items: center; gap: 6px; height: 38px; padding: 0 16px; border: 1.5px solid #d1d9e6; border-radius: 8px; font-size: 13px; font-weight: 600; color: #4a5568; cursor: pointer; background: #fff; transition: border-color .15s, background .15s, color .15s, box-shadow .15s; user-select: none; }
    .so-radio-pill:hover { border-color: #b7c2d6; }
    .so-radio-pill input { position: absolute; opacity: 0; width: 0; height: 0; }
    .so-radio-pill.is-checked { border-color: var(--clr-primary, #1a56db); background: rgba(26,86,219,.08); color: var(--clr-primary, #1a56db); box-shadow: 0 0 0 3px rgba(26,86,219,.1); }
    .so-checkbox-group { display: flex; flex-direction: column; gap: 12px; }
    .so-checkbox { display: flex; align-items: center; gap: 10px; font-size: 13px; font-weight: 600; color: #4a5568; cursor: pointer; user-select: none; }
    .so-checkbox input { position: absolute; opacity: 0; width: 0; height: 0; }
    .so-checkbox-box { width: 20px; height: 20px; flex-shrink: 0; border: 1.5px solid #d1d9e6; border-radius: 6px; background: #fff; display: flex; align-items: center; justify-content: center; transition: border-color .15s, background .15s, box-shadow .15s; }
    .so-checkbox input:checked ~ .so-checkbox-box { background: var(--clr-primary, #1a56db); border-color: var(--clr-primary, #1a56db); }
    .so-checkbox input:focus-visible ~ .so-checkbox-box { box-shadow: 0 0 0 3px rgba(26,86,219,.2); }
    .so-checkbox-box svg { width: 12px; height: 12px; opacity: 0; transform: scale(.6); transition: opacity .12s, transform .12s; }
    .so-checkbox input:checked ~ .so-checkbox-box svg { opacity: 1; transform: scale(1); }
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
              <div className="so-panel-eyebrow">Purchase Consolidated</div>
              <div className="so-panel-title">Purchase Bill Consolidated Report</div>
            </div>

            <div className="so-form-grid">
              <label className="so-label" htmlFor="pc-supplier">Supplier Name</label>
              <div className="so-combo" ref={supplierWrapRef}>
                <input
                  id="pc-supplier"
                  type="text"
                  className="so-input"
                  autoComplete="off"
                  placeholder="Type to search supplier… (optional)"
                  value={supplierSearch}
                  onFocus={() => setSupplierDropdownOpen(true)}
                  onChange={(e) => {
                    setSupplierSearch(e.target.value);
                    setSupplierDropdownOpen(true);
                    // Typing invalidates any previously confirmed selection.
                    if (selectedSupplier) setSelectedSupplier(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setSupplierDropdownOpen(false);
                    } else if (e.key === "Enter" && filteredSuppliers.length === 1) {
                      e.preventDefault();
                      const only = filteredSuppliers[0];
                      setSelectedSupplier({ label: only.label, value: only.value });
                      setSupplierDropdownOpen(false);
                    }
                  }}
                />
                {supplierDropdownOpen && (
                  <ul className="so-combo-list">
                    {filteredSuppliers.length === 0 ? (
                      <li className="so-combo-empty">No matching suppliers</li>
                    ) : (
                      filteredSuppliers.map((s, idx) => (
                        <li
                          key={s.value ?? `supplier-${idx}`}
                          className="so-combo-item"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setSelectedSupplier({ label: s.label, value: s.value });
                            setSupplierDropdownOpen(false);
                          }}
                        >
                          {s.label}
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </div>

              <label className="so-label">Report Type</label>
              <div className="so-radio-group" role="radiogroup" aria-label="Report Type">
                <label className={`so-radio-pill${reportType === "CA" ? " is-checked" : ""}`}>
                  <input
                    type="radio"
                    name="pc-report-type"
                    checked={reportType === "CA"}
                    onChange={() => setReportType("CA")}
                  />
                  Cash
                </label>
                <label className={`so-radio-pill${reportType === "CR" ? " is-checked" : ""}`}>
                  <input
                    type="radio"
                    name="pc-report-type"
                    checked={reportType === "CR"}
                    onChange={() => setReportType("CR")}
                  />
                  Credit
                </label>
                <label className={`so-radio-pill${reportType === "BOTH" ? " is-checked" : ""}`}>
                  <input
                    type="radio"
                    name="pc-report-type"
                    checked={reportType === "BOTH"}
                    onChange={() => setReportType("BOTH")}
                  />
                  Both
                </label>
              </div>

              <label className="so-label" htmlFor="pc-from-date">From Date</label>
              <input id="pc-from-date" type="date" className="so-input" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />

              <label className="so-label" htmlFor="pc-to-date">To Date</label>
              <input id="pc-to-date" type="date" className="so-input" value={toDate} onChange={(e) => setToDate(e.target.value)} />

              <label className="so-label">Options</label>
              <div className="so-checkbox-group">
                <label className="so-checkbox">
                  <input
                    type="checkbox"
                    checked={supplierWise}
                    onChange={(e) => setSupplierWise(e.target.checked)}
                  />
                  <span className="so-checkbox-box">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                  Supplier Wise
                </label>
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
              <button type="button" className="so-btn so-btn-primary" disabled={loading || pageAccess.pageview === 0} onClick={handleView}>
                {loading ? "Loading…" : "▶ View"}
              </button>
              <button type="button" className="so-btn so-btn-secondary" onClick={handleRefresh} disabled={loading}>
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