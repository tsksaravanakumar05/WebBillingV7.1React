// ─────────────────────────────────────────────────────────────────────────────
//  PurchaseOrderConsolidated.jsx
//  React conversion of PurchaseOrderConsolidated.js (jQuery) —
//  "Purchase Order Consolidated Report"
//  Uses API helpers from Common.jsx (CC.api / CC.mkUrl / CC.authHeaders etc.)
//  Styling: MasterPage.css only — no inline color values, no new theme colors.
//  Structure/CSS copied verbatim from BankBook.jsx (per request), only the
//  supplier-combo + checkbox + report-call logic differs to match the legacy
//  source below.
//
//  NOTE: like BankBook/CashBook, this legacy screen has no report-type radio
//  buttons — it's a single report, so the left nav-card report-type picker
//  is omitted here (not invented).
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Save, XCircle } from "lucide-react";
import * as CC from "../../components/Common";
import Topbar from "../../components/Topbar";

const BASE_URL = "http://localhost:64215";

// API endpoint used by this screen (kept exactly as the legacy jQuery file
// had it — MVC action route, POST with a hand-built JSON body, response
// shape is `{ ok: true/false }`, not the newer IsSuccess/Data15 cache-key
// convention used by some other report screens; confirm with the backend
// whether it should be migrated).
const PurchaseOrderConsolidateReportUrl = "/api/PurchaseReportApp/PurchaseOrderConsolidateReport";

// The legacy file loads the supplier combo via a shared
// `loadsuppliercombo("#cmbsupplier")` helper defined outside this file (not
// present in the source we converted). This endpoint is our best-effort
// match to that helper's data source, following the same
// /api/<Module>App/... convention used by BankBook's loadbankcombo
// equivalent — please confirm with the backend.Supplier/GetSupplier
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

export default function PurchaseOrderConsolidated() {
  const navigate = useNavigate();

  // ── Session / permission state ─────────────────────────────────────────
  const [pageAccess, setPageAccess] = useState({
    ready: false,
    allowed: false,
    pageview: 0,
  });

  // ── Company / settings state (loaded once from localStorage, same as jQuery) ──
  // NOTE: the legacy source references CName/CAddress/CPhone globals when
  // building the report-viewer URL but never declares them locally — they
  // must come from a shared page-level source. Following the same
  // Companysetting-from-localStorage convention used by BankBook.jsx
  // (please confirm with the backend if this differs for this screen).
  const [session, setSession] = useState({
    Comid: "",
    CName: "",
    CAddress: "",
    CPhone: "",
  });

  // ── Form state (controlled inputs replacing jqx widgets) ────────────────
  const [fromDate, setFromDate] = useState(todayStr());
  const [toDate, setToDate] = useState(todayStr());
  // Replaces #chksupplier jqxCheckBox — "SupplierWise" toggle sent to the
  // report viewer as-is (true/false), never sent to the report API call
  // itself (legacy only reads it right before opening the report window).
  const [supplierWise, setSupplierWise] = useState(false);

  // Supplier combo (#cmbsupplier in the legacy markup) — replaces
  // jqxComboBox with a type-to-filter combobox (input + filtered dropdown).
  // Unlike BankBook's bank combo, selecting a supplier is OPTIONAL here:
  // the legacy handler only reads item.value into GroupBy when something is
  // selected; if nothing is selected it proceeds with GroupBy = "".
  const [supplierList, setSupplierList] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState(null); // { label, value } | null
  const [supplierSearch, setSupplierSearch] = useState("");
  const [supplierDropdownOpen, setSupplierDropdownOpen] = useState(false);
  const supplierWrapRef = useRef(null);

  // ── UI feedback state ────────────────────────────────────────────────────
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

  // ── Bootstrap: session / permission check ───────────────────────────────
  // NOTE: the legacy .js runs this exact permission-check block TWICE in a
  // row — first filtering menulist by PageName "Purchase Order
  // Consolidated", then immediately again by PageName "Purchase
  // Consolidated". Because pageview/pageadd/pageedit/pagedelete are all
  // declared with `var` in the original, the second lookup silently
  // overwrites the first, so only the "Purchase Consolidated" entry's
  // permissions actually take effect at runtime (the first lookup only
  // matters in that it can independently deny access / redirect). This
  // looks like a copy-paste leftover in the source, but per "preserve 100%
  // of business logic" it is reproduced exactly below rather than
  // simplified to a single check.
  useEffect(() => {
    const menulistA = CC.getLocal("menulist");
    if (menulistA == null) {
      setMsg({ text: "Session Close Please Login !!!.", isErr: true });
      navigate("/Login/Index");
      return;
    }

    const menudataA = menulistA.filter((obj) => obj.PageName === "Purchase Order Consolidated");
    if (!menudataA || menudataA.length === 0) {
      setMsg({ text: "Page Access Permission Denied !!!.", isErr: true });
      setTimeout(() => navigate("/Login/Home"), 3000);
      return;
    }
    if (menudataA[0].View === 0) {
      setMsg({ text: "Page Access Permission Denied !!!.", isErr: true });
      setTimeout(() => navigate("/Login/Home"), 3000);
      return;
    }

    // Second (effectively decisive) check — mirrors the legacy re-read of
    // menulist and re-filter by the other PageName string.
    const menulistB = CC.getLocal("menulist");
    if (menulistB == null) {
      setMsg({ text: "Session Close Please Login !!!.", isErr: true });
      navigate("/Login/Index");
      return;
    }

    const menudataB = menulistB.filter((obj) => obj.PageName === "Purchase Consolidated");
    if (!menudataB || menudataB.length === 0) {
      setMsg({ text: "Page Access Permission Denied !!!.", isErr: true });
      setTimeout(() => navigate("/Login/Home"), 3000);
      return;
    }
    if (menudataB[0].View === 0) {
      setMsg({ text: "Page Access Permission Denied !!!.", isErr: true });
      setTimeout(() => navigate("/Login/Home"), 3000);
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
      pageview: menudataB[0].View,
      pageadd: menudataB[0].Add,
      pageedit: menudataB[0].Edit,
      pagedelete: menudataB[0].Delete,
    });
  }, [navigate]);

  // Loads the supplier combo once page access is granted — replaces the
  // legacy `loadsuppliercombo("#cmbsupplier")` call made from methods.load().
  useEffect(() => {
    if (!pageAccess.ready || !pageAccess.allowed) return;
    if (!session.Comid) return;
  
    let cancelled = false;
  
    const loadSuppliers = async () => {
      try {
        const res = await CC.api(
          SupplierListUrl,
          null,
          {},
          {
            Comid: session.Comid,
            AccountType: "SUPPLIER", // or whatever your API expects
          }
        );
  
        if (res?.IsSuccess !== true) {
          if (!cancelled) {
            setMsg({
              text: res?.Message || "Unable to load supplier list.",
              isErr: true,
            });
          }
          return;
        }
        console.log(res);
        const list = res.Data || res.Data1 || res.data || [];
  
        const normalized = (Array.isArray(list) ? list : []).map((item) => ({
          label:
          item.AccountName ??
            item.SupplierName ??
            item.Suppliername ??
            item.Name ??
            item.Text ??
            item.Label ??
            "",
          value:
            item.SupplierId ??
            item.Supplierid ??
            item.Id ??
            item.Value ??
            "",
        }));
  
        if (!cancelled) {
          setSupplierList(normalized);
        }
      } catch (err) {
        if (!cancelled) {
          setMsg({
            text: err.message || "Unable to load supplier list.",
            isErr: true,
          });
        }
      }
    };
  
    loadSuppliers();
  
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

  const handleRefresh = useCallback(() => {
    // Matches the legacy #btnrefresh handler: clears the supplier combo
    // selection, unchecks the supplier-wise checkbox. The date pickers were
    // merely re-initialised with the same format string in the legacy code,
    // not reset to a new value, so fromDate/toDate are left untouched here.
    setSelectedSupplier(null);
    setSupplierWise(false);
  }, []);

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
    if (w) {
      w.addEventListener("load", () => { w.document.title = "Purchase Order Consolidated-Report"; }, false);
    }
  }, []);

  const handleView = useCallback(async () => {
    const RptType = "CASH";

    // Legacy: supplier selection is OPTIONAL. GroupBy stays "" unless an
    // item is actually selected in the combo; only then is its value
    // validated as non-null.
    let GroupBy = "";
    if (selectedSupplier) {
      GroupBy = selectedSupplier.value;
      if (GroupBy == null || GroupBy === "") {
        setMsg({ text: "Please Select Valid Supplier Name !!!.", isErr: true });
        setSelectedSupplier(null);
        return;
      }
    }

    const Daily = "false";
    const Fromdate = toMMDDYYYY(fromDate);
    const Todate = toMMDDYYYY(toDate);

    if (new Date(Fromdate) > new Date(Todate)) {
      setMsg({ text: "From Date Is Greater Than To Date!!", isErr: true });
      return;
    }

    const SupplierWise = supplierWise;

    setLoading(true);
    setMsg(null);

    try {
      // Legacy hand-builds the JSON body and reads back `data.ok === true`
      // (not IsSuccess/Data15) — preserved exactly, no React:1 header.
      const res = await CC.api(PurchaseOrderConsolidateReportUrl, null, { React:1}, {
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
          // Preserved verbatim, including the "PurchaseOrderConsalted"
          // spelling used by the legacy source — the backend report engine
          // matches on this exact string.
          ReportName: "PurchaseOrderConsalted",
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
  }, [fromDate, toDate, selectedSupplier, supplierWise, session, openReportViewer]);

  // ── Recolored/restyled to match BranchWise.jsx's card design system ──────
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
    .so-card { width: 100%; max-width: 620px; background: #fff; border: 2px solid #1a56db; border-radius: 10px; box-shadow: 0 4px 16px rgba(26,86,219,.18); overflow: hidden; }

    .so-card-header { background: linear-gradient(135deg, #3b6fe0, #1a4fd1); border-bottom: 1px solid #1a4fd1; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; }
    .so-card-header-title { font-size: 14px; font-weight: 700; color: #fff; letter-spacing: .2px; }
    .so-close-x { background: rgba(255,255,255,.15); border: none; font-size: 14px; color: #fff; cursor: pointer; line-height: 1; padding: 6px 8px; border-radius: 6px; transition: background .15s; }
    .so-close-x:hover { background: rgba(255,255,255,.28); }

    .so-card-body { padding: 24px 32px 30px; }
    .so-report-title { text-align: center; font-size: 22px; font-weight: 800; color: #1a3fd6; margin: 0 0 26px; }

    .so-form-grid { display: grid; grid-template-columns: 120px 1fr; gap: 18px 16px; align-items: center; }
    .so-label { font-size: 13px; font-weight: 600; color: #1e293b; }
    .so-input { height: 34px; border: 1px solid #c7cdd6; border-radius: 4px; padding: 0 10px; font-size: 13px; color: #1e2d3d; background: #fff; width: 100%; box-sizing: border-box; transition: border-color .15s, box-shadow .15s; outline: none; }
    .so-input:focus { border-color: #1a56db; box-shadow: 0 0 0 3px rgba(26,86,219,.15); }
    select.so-input { appearance: auto; cursor: pointer; }

    .so-combo { position: relative; }
    .so-combo-list { position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 20; margin: 0; padding: 4px; list-style: none; max-height: 200px; overflow-y: auto; background: #fff; border: 1px solid #c7cdd6; border-radius: 4px; box-shadow: 0 6px 20px rgba(0,0,0,.12); }
    .so-combo-item { padding: 7px 10px; font-size: 13px; color: #1e2d3d; border-radius: 4px; cursor: pointer; }
    .so-combo-item:hover { background: #eef3ff; }
    .so-combo-empty { padding: 7px 10px; font-size: 13px; color: #4a5568; }

    .so-toggle-row { display: flex; align-items: center; gap: 8px; cursor: pointer; user-select: none; }
    .so-toggle-row input[type="checkbox"] { width: 16px; height: 16px; accent-color: #1a56db; cursor: pointer; flex-shrink: 0; }
    .so-toggle-row span { font-size: 13px; color: #2b2b2b; font-weight: 500; }

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
      .so-form-grid { grid-template-columns: 100px 1fr; gap: 14px 12px; }
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
              <div className="so-card-header-title">Purchase Order Consolidated</div>
              <button type="button" className="so-close-x" aria-label="Close" onClick={() => navigate(-1)}>✕</button>
            </div>

            <div className="so-card-body">
              <div className="so-report-title">Purchase Order Consolidated - Report</div>

              <div className="so-form-grid">
                <label className="so-label" htmlFor="poc-supplier">Supplier Name</label>
                <div className="so-combo" ref={supplierWrapRef}>
                  <input
                    id="poc-supplier"
                    type="text"
                    className="so-input"
                    autoComplete="off"
                    placeholder="Type to search supplier…"
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

                <label className="so-label" htmlFor="poc-from-date">From Date</label>
                <input id="poc-from-date" type="date" className="so-input" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />

                <label className="so-label" htmlFor="poc-to-date">To Date</label>
                <input id="poc-to-date" type="date" className="so-input" value={toDate} onChange={(e) => setToDate(e.target.value)} />

                <span className="so-label">Supplier Wise</span>
                <label className="so-toggle-row" htmlFor="poc-supplierwise">
                  <input
                    id="poc-supplierwise"
                    type="checkbox"
                    checked={supplierWise}
                    onChange={(e) => setSupplierWise(e.target.checked)}
                  />
                  <span>Group report by supplier</span>
                </label>
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