// ─────────────────────────────────────────────────────────────────────────────
//  SupplierPayments.jsx
//  React conversion of the legacy jQuery/jqxWidgets "Supplier Payments" report page
//  Built on the same skeleton as ClosingStock.jsx / SaleOrder.jsx:
//    - CC.api / CC.getLocal / CC.getStr from Common.jsx
//    - same permission/session bootstrap pattern
//    - same openReportViewer(BASE_URL + /Reports/ReportViewer.aspx) pattern
//    - "sp-" scoped style system (new prefix — no collision with cs-/iq-/iw-/db-/sl-/sb-)
//
//  ── Assumptions / call-outs (please verify) ─────────────────────────────────
//  1. `CName`/`CAddress`/`CPhone` aren't read in this file — assumed sourced
//     from `Companysetting`, as in the other converted pages.
//  2. Endpoint mapping: `/PurchaseReport/SupplierPaymentReport` → assumed
//     `/api/PurchaseReportApp/SupplierPaymentReport` (PurchaseReport →
//     PurchaseReportApp convention, matching Supplier List/Balance). Please
//     verify.
//  3. QUIRK PRESERVED: the selected supplier item's `.value` (not `.label`)
//     is used as `GroupBy`, same as Supplier List/Balance.
//  4. QUIRK PRESERVED: `GroupBy` and `ReportType` are sent in the AJAX
//     payload but never appear in the report-viewer URL — only
//     SupplierWise/Daily/Narration/Fromdate/Todate/CName/CAddress/CPhone do.
//     Reproduced exactly.
//  5. QUIRK PRESERVED: the window title is set to `"Supplier Payment -
//     Report"` (singular "Payment", spaced hyphen) rather than matching the
//     page name "Supplier Payments" — reproduced verbatim.
//  6. The three `rbtcash`/`rbtcredit`/`rbtboth` radio buttons are never given
//     an explicit jqxRadioButton `groupName` in this file, but are clearly
//     meant to be mutually exclusive (only one is ever checked — see
//     load()/refresh handler explicitly setting exactly one to true).
//     Modeled here as a single `rptType` state, defaulting to `"BOTH"`
//     exactly as `load()` does.
//  7. The original's XHR-title-scraping error handler (relying on a shared
//     `formatErrorMessage(xhr, err)` helper not defined in this file) is
//     approximated here with a generic technical-fault fallback — wire in
//     the real helper from Common.jsx if one exists.
//  8. The "From Date Is Greater Than To Date!!" validation text is
//     reproduced verbatim, including its different punctuation from this
//     app's other validation messages (no period after "!!").
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import * as CC from "../../components/Common";
import Topbar from "../../components/Topbar";

const BASE_URL = "http://localhost:64215";

// ── API endpoints ───────────────────────────────────────────────────────────
// Report endpoint — see assumption #2 above.
const SupplierPaymentReportUrl = "/api/PurchaseReportApp/SupplierPaymentReport";

// Supplier combo endpoint, reused from the established convention.
const SupplierListUrl = "/api/SupplierApp/SelectSupplier";

// ── Report-type identifiers (mirrors rbtcash/rbtcredit/rbtboth) ────────────
const REPORT_TYPE = {
  CASH: "CA",
  CREDIT: "CR",
  BOTH: "BOTH",
};

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

export default function SupplierPayments() {
  const navigate = useNavigate();
  const fromDateRef = useRef(null);

  // ── Session / permission state ──────────────────────────────────────────
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

  // ── Supplier combo selection { value, label } ───────────────────────────
  const [supplierSel, setSupplierSel] = useState(null);

  // ── Report type (rbtcash / rbtcredit / rbtboth) — "BOTH" checked by default ──
  const [rptType, setRptType] = useState(REPORT_TYPE.BOTH);

  // ── Checkboxes — all unchecked by default ───────────────────────────────
  const [chkSupplierWise, setChkSupplierWise] = useState(false);
  const [chkDaily, setChkDaily] = useState(false);
  const [chkNarration, setChkNarration] = useState(false);

  // ── Dates ────────────────────────────────────────────────────────────────
  const [fromDate, setFromDate] = useState(todayStr());
  const [toDate, setToDate] = useState(todayStr());

  // ── UI feedback state ────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null); // { text, isErr }

  // ── Bootstrap: permission + session, mirrors top of $(document).ready ──
  useEffect(() => {
    const menulist = CC.getLocal("menulist");
    if (menulist == null) {
      setMsg({ text: "Session Close Please Login !!!.", isErr: true });
      navigate("/");
      return;
    }

    const menudata = menulist.filter((obj) => obj.PageName === "Supplier Payments");
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
  }, [navigate]);

  // ── Esc key — "Do you want to quit page?" (app-wide convention) ─────────
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

  // ── Refresh button — resets exactly what the legacy refresh handler did ──
  const handleRefresh = useCallback(() => {
    setSupplierSel(null);
    setChkSupplierWise(false);
    setChkDaily(false);
    setChkNarration(false);
    setFromDate(todayStr());
    setToDate(todayStr());
    setRptType(REPORT_TYPE.BOTH);
    setMsg(null);
  }, []);

  // ── Report viewer opener — same pattern used across converted pages ─────
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
      // Preserved verbatim from the original — see assumption #5.
      w.addEventListener(
        "load",
        function () {
          w.document.title = "Supplier Payment - Report";
        },
        false
      );
    }
    return w;
  }, []);

  // ── View button — replicates the SupplierPaymentReport $.ajax logic exactly ──
  const handleView = useCallback(async () => {
    // QUIRK PRESERVED (assumption #3): uses the selected item's `value`,
    // not its `label`.
    let GroupByText = "";
    if (supplierSel) {
      GroupByText = supplierSel.value;
      if (!GroupByText) {
        setMsg({ text: "Please Select Valid Supplier Name !!!.", isErr: true });
        setSupplierSel(null);
        return;
      }
    }

    const RptType = rptType;

    const Fromdate = toMMDDYYYY(fromDate);
    const Todate = toMMDDYYYY(toDate);

    if (new Date(Fromdate) > new Date(Todate)) {
      setMsg({ text: "From Date Is Greater Than To Date!!", isErr: true });
      fromDateRef.current?.focus();
      return;
    }

    setLoading(true);
    setMsg(null);

    try {
      const res = await CC.api(
        SupplierPaymentReportUrl,
        null,
        { CacheKeyType: "SupplierPaymentReport", React: 1 },
        {
          GroupBy: GroupByText,
          ReportType: RptType,
          Fromdate,
          Todate,
          Comid: session.Comid,
        }
      );

      if (res?.ok || res?.IsSuccess) {
        const cacheKey = res.Data15 || res.CacheKey || "";
        // Note: GroupBy/ReportType are never passed to the report-viewer URL
        // in the original — only the AJAX payload carries them. Preserved.
        openReportViewer({
          ReportName: "SupplierPaymentReport",
          CacheKey: cacheKey,
          SupplierWise: chkSupplierWise,
          Daily: chkDaily,
          Narration: chkNarration,
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
      setMsg({ text: err?.message || "Technical Fault Contact Software Vendor  !!!.", isErr: true });
    } finally {
      setLoading(false);
      setSupplierSel(null);
    }
  }, [supplierSel, rptType, fromDate, toDate, chkSupplierWise, chkDaily, chkNarration, session, openReportViewer]);

  // ── Reusable combo component (same pattern as other converted pages) ───
  const ApiSelect = ({ url, payload, headers = {}, labelKey, valueKey, value, onChange, placeholder }) => {
    const [list, setList] = useState([]);
    const [loadingList, setLoadingList] = useState(false);

    useEffect(() => {
      let active = true;
      (async () => {
        setLoadingList(true);
        try {
          const res = await CC.api(url, null, headers, payload);
          if (!active) return;
          const raw = Array.isArray(res?.data)
            ? res.data
            : Array.isArray(res?.Data1)
            ? res.Data1
            : Array.isArray(res)
            ? res
            : [];
          setList(raw);
        } catch (err) {
          console.error(err);
        } finally {
          if (active) setLoadingList(false);
        }
      })();
      return () => {
        active = false;
      };
    }, [url, JSON.stringify(payload), JSON.stringify(headers)]);

    return (
      <div className="sp-field">
        <label className="sp-label">{placeholder.replace("Select ", "")}</label>
        <select
          className="sp-input"
          value={value?.value ?? ""}
          disabled={loadingList}
          onChange={(e) => {
            const selectedVal = e.target.value;
            const opt = list.find((o) => String(o[valueKey]) === selectedVal);
            if (opt) {
              onChange({ value: String(opt[valueKey]), label: opt[labelKey] });
            } else {
              onChange(null);
            }
          }}
        >
          <option value="">{loadingList ? "Loading..." : placeholder}</option>
          {list.map((o) => (
            <option key={o[valueKey]} value={o[valueKey]}>
              {o[labelKey]}
            </option>
          ))}
        </select>
      </div>
    );
  };

  // ── Scoped styles injected once ("sp-" prefix — new, non-colliding) ────
  const styles = `
    .sp-shell {
      min-height: 100vh;
      background: #f0f2f5;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      flex-direction: column;
    }
    .sp-layout {
      display: flex;
      flex: 1;
      justify-content: center;
      padding: 24px;
      box-sizing: border-box;
    }
    .sp-panel {
      width: 100%;
      max-width: 560px;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 2px 12px rgba(0,0,0,.08);
      padding: 28px 32px;
      display: flex;
      flex-direction: column;
      height: fit-content;
    }
    .sp-panel-header {
      border-bottom: 1px solid #e8ecf0;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .sp-panel-eyebrow {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .8px;
      color: var(--clr-primary, #1a56db);
      margin-bottom: 6px;
    }
    .sp-panel-title {
      font-size: 20px;
      font-weight: 700;
      color: #1e2d3d;
      line-height: 1.2;
    }
    .sp-section-title {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .6px;
      color: #8a94a6;
      margin: 20px 0 10px;
    }
    .sp-section-title:first-of-type { margin-top: 0; }
    .sp-radio-row {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
    .sp-chip {
      display: flex;
      align-items: center;
      gap: 8px;
      height: 36px;
      padding: 0 14px;
      border-radius: 20px;
      border: 1.5px solid #d1d9e6;
      background: #f7f9fc;
      font-size: 13px;
      font-weight: 500;
      color: #4a5568;
      cursor: pointer;
      user-select: none;
      transition: border-color .15s, background .15s, color .15s;
    }
    .sp-chip:hover { border-color: var(--clr-primary, #1a56db); }
    .sp-chip.active {
      background: var(--clr-primary, #1a56db);
      border-color: var(--clr-primary, #1a56db);
      color: #fff;
    }
    .sp-form-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 16px 20px;
      align-items: start;
      margin-top: 10px;
    }
    .sp-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .sp-label {
      font-size: 13px;
      font-weight: 600;
      color: #4a5568;
    }
    .sp-input {
      height: 36px;
      border: 1.5px solid #d1d9e6;
      border-radius: 8px;
      padding: 0 12px;
      font-size: 13px;
      color: #1e2d3d;
      background: #fff;
      width: 100%;
      box-sizing: border-box;
      transition: border-color .15s, box-shadow .15s;
      outline: none;
    }
    .sp-input:focus {
      border-color: var(--clr-primary, #1a56db);
      box-shadow: 0 0 0 3px rgba(26,86,219,.1);
    }
    .sp-toggle-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px 16px;
      margin-top: 10px;
    }
    .sp-toggle-row {
      display: flex;
      align-items: center;
      gap: 8px;
      height: 36px;
      background: #f7f9fc;
      border: 1.5px solid #d1d9e6;
      border-radius: 8px;
      padding: 0 12px;
      cursor: pointer;
      font-size: 13px;
      color: #4a5568;
      font-weight: 500;
      user-select: none;
    }
    .sp-toggle-row input[type="checkbox"] {
      width: 15px;
      height: 15px;
      accent-color: var(--clr-primary, #1a56db);
      cursor: pointer;
    }
    .sp-actions {
      display: flex;
      gap: 12px;
      margin-top: 24px;
      padding-top: 20px;
      border-top: 1px solid #e8ecf0;
    }
    .sp-btn {
      height: 40px;
      padding: 0 28px;
      border-radius: 8px;
      border: none;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity .15s, box-shadow .15s;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .sp-btn:disabled { opacity: .5; cursor: not-allowed; }
    .sp-btn-primary {
      background: var(--clr-primary, #1a56db);
      color: #fff;
      box-shadow: 0 2px 8px rgba(26,86,219,.3);
    }
    .sp-btn-primary:not(:disabled):hover {
      opacity: .9;
      box-shadow: 0 4px 14px rgba(26,86,219,.4);
    }
    .sp-btn-secondary {
      background: #f0f2f5;
      color: #4a5568;
      border: 1.5px solid #d1d9e6;
    }
    .sp-btn-secondary:not(:disabled):hover {
      background: #e8ecf0;
    }
    .sp-msg {
      margin-top: 18px;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
    }
    .sp-msg.err { background: #fff0f0; color: #c53030; border: 1px solid #fed7d7; }
    .sp-msg.ok  { background: #f0fff4; color: #276749; border: 1px solid #c6f6d5; }
    @media (max-width: 760px) {
      .sp-layout { padding: 16px; }
      .sp-panel { padding: 20px 16px; }
      .sp-form-grid, .sp-toggle-grid { grid-template-columns: 1fr; }
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
      <div className="sp-shell">
        <Topbar />

        <div className="sp-layout">
          <main className="sp-panel">
            <div className="sp-panel-header">
              <div className="sp-panel-eyebrow">Purchase</div>
              <div className="sp-panel-title">Supplier Payments Report</div>
            </div>

            <ApiSelect
              url={SupplierListUrl}
              payload={{ Comid: Number(session.Comid), Startindex: -1, PageCount: 99999, AccountType: "SUPPLIER", Keyword: "", Column: "" }}
              labelKey="AccountName"
              valueKey="Id"
              value={supplierSel}
              onChange={setSupplierSel}
              placeholder="Select Supplier"
            />

            <div className="sp-section-title">Report Type</div>
            <div className="sp-radio-row">
              {[
                { value: REPORT_TYPE.CASH, label: "Cash" },
                { value: REPORT_TYPE.CREDIT, label: "Credit" },
                { value: REPORT_TYPE.BOTH, label: "Both" },
              ].map((o) => (
                <div
                  key={o.value}
                  className={`sp-chip${rptType === o.value ? " active" : ""}`}
                  onClick={() => setRptType(o.value)}
                  role="button"
                  tabIndex={0}
                >
                  {o.label}
                </div>
              ))}
            </div>

            <div className="sp-form-grid">
              <div className="sp-field">
                <label className="sp-label" htmlFor="sp-from-date">From Date</label>
                <input
                  id="sp-from-date"
                  ref={fromDateRef}
                  type="date"
                  className="sp-input"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>
              <div className="sp-field">
                <label className="sp-label" htmlFor="sp-to-date">To Date</label>
                <input
                  id="sp-to-date"
                  type="date"
                  className="sp-input"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>
            </div>

            <div className="sp-toggle-grid">
              <label className="sp-toggle-row">
                <input
                  type="checkbox"
                  checked={chkSupplierWise}
                  onChange={(e) => setChkSupplierWise(e.target.checked)}
                />
                Supplier Wise
              </label>
              <label className="sp-toggle-row">
                <input
                  type="checkbox"
                  checked={chkDaily}
                  onChange={(e) => setChkDaily(e.target.checked)}
                />
                Daily
              </label>
              <label className="sp-toggle-row">
                <input
                  type="checkbox"
                  checked={chkNarration}
                  onChange={(e) => setChkNarration(e.target.checked)}
                />
                Narration
              </label>
            </div>

            <div className="sp-actions">
              <button
                type="button"
                className="sp-btn sp-btn-primary"
                disabled={loading || pageAccess.pageview === 0}
                onClick={handleView}
              >
                {loading ? "Loading…" : "▶ View"}
              </button>
              <button
                type="button"
                className="sp-btn sp-btn-secondary"
                onClick={handleRefresh}
                disabled={loading}
              >
                ↺ Refresh
              </button>
            </div>

            {msg && <div className={`sp-msg ${msg.isErr ? "err" : "ok"}`}>{msg.text}</div>}
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