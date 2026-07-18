// ─────────────────────────────────────────────────────────────────────────────
//  PurchaseConsolidated.jsx
//  React conversion of the "Purchase Consolidated" jQuery/jqxWidgets page.
//  Built on the same skeleton as ClosingStock.jsx / CustomerAgingReport.jsx:
//    - CC.api / CC.getLocal / CC.getStr from Common.jsx
//    - same permission/session bootstrap pattern
//    - same openReportViewer(BASE_URL + /Reports/ReportViewer.aspx) pattern
//  Layout: single centered panel (one optional Supplier combo, no Group-By
//  nav needed), with a Report Type chip row, a date range, and two option
//  checkboxes — scoped "pc-" (unused by any other converted page).
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import * as CC from "../../components/Common";
import Topbar from "../../components/Topbar";

const BASE_URL = "http://localhost:64215";

// ── API endpoints ───────────────────────────────────────────────────────────
// Supplier combo reuses the same endpoint established for ClosingStock.jsx.
const SupplierListUrl = "/api/SupplierApp/SelectSupplier";

// NOTE: original ASMX-style path "/PurchaseReport/PurchaseBillConsolidateReport"
// mapped following the same module-inference convention used elsewhere
// ("/SalesReport/..." -> "/api/SalesReportApp/...") — please verify.
const PurchaseBillConsolidateReportUrl = "/api/PurchaseReportApp/PurchaseBillConsolidateReport";

// ── Report-type identifiers ─────────────────────────────────────────────────
const RPT_TYPE = {
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

export default function PurchaseConsolidated() {
  const navigate = useNavigate();

  // ── Session / permission state ─────────────────────────────────────────
  const [pageAccess, setPageAccess] = useState({
    ready: false,
    allowed: false,
    pageview: 0,
  });

  // ── Company / settings state ────────────────────────────────────────────
  // NOTE: the original file only reads "Comid" from localStorage (no MComid
  // is used anywhere in this page), unlike the other converted report pages.
  const [session, setSession] = useState({
    Comid: "",
    CName: "",
    CAddress: "",
    CPhone: "",
  });

  // ── Supplier combo selection { value, label } — optional, like the
  //    Customer combo in CustomerAgingReport.jsx ─────────────────────────
  const [supplierSel, setSupplierSel] = useState(null);

  // ── Report type — defaults to BOTH, matching methods.load()'s
  //    `$("#rbtboth").jqxRadioButton({ checked: true })` ─────────────────
  const [rptType, setRptType] = useState(RPT_TYPE.BOTH);

  // ── Option checkboxes ────────────────────────────────────────────────────
  const [chkSupplierWise, setChkSupplierWise] = useState(false);
  const [chkDaily, setChkDaily] = useState(false);

  // ── Dates ─────────────────────────────────────────────────────────────
  const [fromDate, setFromDate] = useState(todayStr());
  const [toDate, setToDate] = useState(todayStr());

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

    const menudata = menulist.filter((obj) => obj.PageName === "Purchase Consolidated");
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

  // ── Esc key — "Do you want to quit page?" (preserved convention) ───────
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

  // ── Report viewer opener — same pattern as ClosingStock.jsx ─────────────
  const openReportViewer = useCallback((params, title) => {
    const qs = new URLSearchParams(params).toString();
    const url = `${CC.BASE_URL}/Reports/ReportViewer.aspx?${qs}`;

    const w = window.open(
      url,
      "_blank",
      `directories=0,titlebar=0,toolbar=0,location=0,status=0,` +
        `menubar=0,scrollbars=yes,resizable=no,` +
        `width=${screen.width},height=${screen.height - 100}`
    );
    if (w && title) {
      w.addEventListener("load", function () { w.document.title = title; }, false);
    }
    return w;
  }, []);

  // ── Refresh button ───────────────────────────────────────────────────────
  const handleRefresh = useCallback(() => {
    setSupplierSel(null);
    setChkDaily(false);
    setChkSupplierWise(false);
    setFromDate(todayStr());
    setToDate(todayStr());
    setRptType(RPT_TYPE.BOTH);
    setMsg(null);
  }, []);

  // ── View button — replicates the purchaseconsolidated.js $.ajax logic ──
  const handleView = useCallback(async () => {
    // Mirrors: GroupBy = ""; if a supplier item is selected, validate it.
    let GroupBy = "";
    if (supplierSel != null) {
      if (supplierSel.value == null || supplierSel.value === "") {
        setMsg({ text: "Please Select Valid Supplier Name !!!.", isErr: true });
        setSupplierSel(null);
        return;
      }
      GroupBy = supplierSel.value;
    }

    const Fromdate = toMMDDYYYY(fromDate);
    const Todate = toMMDDYYYY(toDate);

    // Mirrors: if (new Date(Fromdate) > new Date(Todate)) alert + focus + return
    if (new Date(Fromdate) > new Date(Todate)) {
      setMsg({ text: "From Date Is Greater Than To Date!!", isErr: true });
      return;
    }

    const SupplierWise = chkSupplierWise;
    const Daily = chkDaily;
    const { Comid, CName, CAddress, CPhone } = session;

    setLoading(true);
    setMsg(null);

    try {
      const res = await CC.api(
        PurchaseBillConsolidateReportUrl,
        null,
        { CacheKeyType: "PurchaseBillConsolidateReport", React: 1 },
        {
          GroupBy,
          ReportType: rptType,
          Fromdate,
          Todate,
          Comid,
        }
      );

      if (res?.ok || res?.IsSuccess) {
        const cacheKey = res.Data15 || res.CacheKey || "";
        openReportViewer(
          {
            ReportName: "PurchaseConsalted",
            ReportType: rptType,
            SupplierWise,
            Daily,
            Fromdate,
            Todate,
            CacheKey: cacheKey,
            CName,
            CAddress,
            CPhone,
          },
          "Purchase Consolidated-Report"
        );
      } else {
        setMsg({ text: "No Record !!!.", isErr: true });
      }
    } catch (err) {
      setMsg({ text: err.message || "Something went wrong.", isErr: true });
    } finally {
      setLoading(false);
      // Matches the original: clear the supplier selection after the
      // request completes, whether it succeeded or not.
      setSupplierSel(null);
    }
  }, [supplierSel, fromDate, toDate, chkSupplierWise, chkDaily, rptType, session, openReportViewer]);

  // ── Reusable API-backed <select>, same pattern as ClosingStock.jsx ──────
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
      <div className="pc-field">
        <label className="pc-label" htmlFor="pc-supplier">
          Supplier Name
        </label>
        <select
          id="pc-supplier"
          className="pc-input"
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

  const rptTypeChips = useMemo(
    () => [
      { value: RPT_TYPE.CASH, label: "Cash" },
      { value: RPT_TYPE.CREDIT, label: "Credit" },
      { value: RPT_TYPE.BOTH, label: "Both" },
    ],
    []
  );

  // ── Scoped styles injected once (same tokens as ClosingStock.jsx, "pc-" prefix) ──
  const styles = `
    .pc-shell {
      min-height: 100vh;
      background: #f0f2f5;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      flex-direction: column;
    }
    .pc-layout {
      display: flex;
      flex: 1;
      justify-content: center;
      align-items: flex-start;
      padding: 24px;
      max-width: 1200px;
      width: 100%;
      margin: 0 auto;
      box-sizing: border-box;
    }
    .pc-panel {
      width: 100%;
      max-width: 560px;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 2px 12px rgba(0,0,0,.08);
      padding: 28px 32px;
      display: flex;
      flex-direction: column;
    }
    .pc-panel-header {
      border-bottom: 1px solid #e8ecf0;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .pc-panel-eyebrow {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .8px;
      color: var(--clr-primary, #1a56db);
      margin-bottom: 6px;
    }
    .pc-panel-title {
      font-size: 20px;
      font-weight: 700;
      color: #1e2d3d;
      line-height: 1.2;
    }
    .pc-section-title {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .6px;
      color: #8a94a6;
      margin: 20px 0 10px;
    }
    .pc-section-title:first-of-type { margin-top: 0; }
    .pc-radio-row {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
    .pc-chip {
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
    .pc-chip:hover { border-color: var(--clr-primary, #1a56db); }
    .pc-chip.active {
      background: var(--clr-primary, #1a56db);
      border-color: var(--clr-primary, #1a56db);
      color: #fff;
    }
    .pc-form-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 16px 20px;
      align-items: start;
      max-width: 100%;
      margin-top: 10px;
      margin-bottom: 8px;
    }
    .pc-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .pc-label {
      font-size: 13px;
      font-weight: 600;
      color: #4a5568;
    }
    .pc-input {
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
    .pc-input:focus {
      border-color: var(--clr-primary, #1a56db);
      box-shadow: 0 0 0 3px rgba(26,86,219,.1);
    }
    .pc-toggle-row {
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
    .pc-toggle-row input[type="checkbox"] {
      width: 15px;
      height: 15px;
      accent-color: var(--clr-primary, #1a56db);
      cursor: pointer;
    }
    .pc-toggle-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px 16px;
      max-width: 400px;
      margin-top: 10px;
    }
    .pc-actions {
      display: flex;
      gap: 12px;
      margin-top: 28px;
      padding-top: 20px;
      border-top: 1px solid #e8ecf0;
    }
    .pc-btn {
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
    .pc-btn:disabled { opacity: .5; cursor: not-allowed; }
    .pc-btn-primary {
      background: var(--clr-primary, #1a56db);
      color: #fff;
      box-shadow: 0 2px 8px rgba(26,86,219,.3);
    }
    .pc-btn-primary:not(:disabled):hover {
      opacity: .9;
      box-shadow: 0 4px 14px rgba(26,86,219,.4);
    }
    .pc-btn-secondary {
      background: #f0f2f5;
      color: #4a5568;
      border: 1.5px solid #d1d9e6;
    }
    .pc-btn-secondary:not(:disabled):hover {
      background: #e8ecf0;
    }
    .pc-msg {
      margin-top: 18px;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
    }
    .pc-msg.err { background: #fff0f0; color: #c53030; border: 1px solid #fed7d7; }
    .pc-msg.ok  { background: #f0fff4; color: #276749; border: 1px solid #c6f6d5; }
    @media (max-width: 760px) {
      .pc-layout { padding: 16px; }
      .pc-panel { padding: 20px 16px; }
      .pc-form-grid, .pc-toggle-grid { grid-template-columns: 1fr; }
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
      <div className="pc-shell">
        <Topbar />

        <div className="pc-layout">
          <main className="pc-panel">
            <div className="pc-panel-header">
              <div className="pc-panel-eyebrow">Purchase</div>
              <div className="pc-panel-title">Purchase Consolidated</div>
            </div>

            <div className="pc-form-grid">
              <ApiSelect
                url={SupplierListUrl}
                payload={{ Comid: Number(session.Comid), Startindex: -1, PageCount: 99999, AccountType: "SUPPLIER", Keyword: "", Column: "" }}
                labelKey="AccountName"
                valueKey="Id"
                value={supplierSel}
                onChange={setSupplierSel}
                placeholder="Select Supplier"
              />

              <div className="pc-field">
                <label className="pc-label" htmlFor="pc-from-date">From Date</label>
                <input id="pc-from-date" type="date" className="pc-input" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              </div>
              <div className="pc-field">
                <label className="pc-label" htmlFor="pc-to-date">To Date</label>
                <input id="pc-to-date" type="date" className="pc-input" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </div>
            </div>

            {/* Report type */}
            <div className="pc-section-title">Report Type</div>
            <div className="pc-radio-row">
              {rptTypeChips.map((o) => (
                <div
                  key={o.value}
                  className={`pc-chip${rptType === o.value ? " active" : ""}`}
                  onClick={() => setRptType(o.value)}
                  role="button"
                  tabIndex={0}
                >
                  {o.label}
                </div>
              ))}
            </div>

            {/* Extra options */}
            <div className="pc-section-title">Options</div>
            <div className="pc-toggle-grid">
              <label className="pc-toggle-row">
                <input type="checkbox" checked={chkSupplierWise} onChange={(e) => setChkSupplierWise(e.target.checked)} />
                Supplier Wise
              </label>
              <label className="pc-toggle-row">
                <input type="checkbox" checked={chkDaily} onChange={(e) => setChkDaily(e.target.checked)} />
                Daily
              </label>
            </div>

            <div className="pc-actions">
              <button
                type="button"
                className="pc-btn pc-btn-primary"
                disabled={loading || pageAccess.pageview === 0}
                onClick={handleView}
              >
                {loading ? "Loading…" : "▶ View"}
              </button>
              <button
                type="button"
                className="pc-btn pc-btn-secondary"
                onClick={handleRefresh}
                disabled={loading}
              >
                ↺ Refresh
              </button>
            </div>

            {msg && <div className={`pc-msg ${msg.isErr ? "err" : "ok"}`}>{msg.text}</div>}
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