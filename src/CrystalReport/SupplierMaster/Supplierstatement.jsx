// ─────────────────────────────────────────────────────────────────────────────
//  SupplierStatement.jsx
//  React conversion of the legacy jQuery / jqxWidgets page — "Supplier
//  Statement" (PageName in menulist: "Supplier Statement").
//  Built on the exact same skeleton as ClosingStock.jsx / InventoryQtyWise.jsx /
//  SupplierPendingBillReport.jsx:
//    - CC.api / CC.getLocal / CC.getStr from Common.jsx
//    - same permission/session bootstrap pattern
//    - same openReportViewer(BASE_URL + /Reports/ReportViewer.aspx) pattern
//    - same CacheKeyType/CacheKey convention used across the converted pages
//      (the legacy .js predates it, but every report call in this app family
//      now sends it)
//  Layout: no Group-By nav sidebar — this page has one supplier combo, a
//  date range, and two option checkboxes, so it follows the "single centered
//  panel" variant (same as SupplierPendingBillReport.jsx), with a fresh
//  "ss-" scoped class prefix (unused elsewhere in the app).
//  Styling: MasterPage.css tokens only — no new theme colors.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import * as CC from "../../components/Common";
import Topbar from "../../components/Topbar";

const BASE_URL = "http://localhost:64215";

// ── API endpoints ───────────────────────────────────────────────────────────
// Original $.ajax url was "/PurchaseReport/SupplierStatementReport". Mapped to
// the app's Web API layer following the "<FirstSegment>App" convention used
// elsewhere (e.g. /PurchaseReport/SupplierPendingReportCR ->
// /api/PurchaseReportApp/SupplierPendingReportCR). Please verify this is the
// real route on the PurchaseReport module.
const SupplierStatementReportUrl = "/api/PurchaseReportApp/SupplierStatementReport";

// Same supplier dropdown endpoint used by ClosingStock.jsx / InventoryQtyWise.jsx /
// SupplierPendingBillReport.jsx (loadsuppliercombo in the legacy jQuery layer).
const SupplierListUrl = "/api/SupplierApp/SelectSupplier";

// Identifies this report's cache-key bucket on the backend (mirrors the
// Data15/CacheKey pattern established across the converted pages).
const CACHE_KEY_TYPE = "SupplierStatementReport";

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

export default function SupplierStatement() {
  const navigate = useNavigate();

  // ── Session / permission state ─────────────────────────────────────────
  const [pageAccess, setPageAccess] = useState({
    ready: false,
    allowed: false,
    pageview: 0,
  });

  // ── Company / settings state (loaded once from localStorage) ────────────
  // TaxType mirrors: Taxtype = (POSTax === "Inclusive Don't Show Tax") ? 0 : 1
  const [session, setSession] = useState({
    Comid: "",
    MComid: "",
    CName: "",
    CAddress: "",
    CPhone: "",
    BillFormatName: "",
    TaxType: 1,
  });

  // Supplier combo selection { value, label } — matches jqxComboBox getSelectedItem
  const [supplierSel, setSupplierSel] = useState(null);

  // ── Date range ───────────────────────────────────────────────────────────
  const [fromDate, setFromDate] = useState(todayStr());
  const [toDate, setToDate] = useState(todayStr());

  // ── Option checkboxes ────────────────────────────────────────────────────
  // chkiwdetails -> sent to report viewer as "SupplierWise"
  const [supplierWise, setSupplierWise] = useState(false);
  // chkwtotal -> sent to report viewer as "Narration"
  const [narration, setNarration] = useState(false);

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

    const menudata = menulist.filter((obj) => obj.PageName === "Supplier Statement");
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
    const TaxType = ComSet[0]?.POSTax === "Inclusive Don't Show Tax" ? 0 : 1;

    setSession({
      Comid,
      MComid,
      CName: ComSet[0]?.CName || "",
      CAddress: ComSet[0]?.CAddress || "",
      CPhone: ComSet[0]?.CPhone || "",
      BillFormatName: ComSet[0]?.SaleBillFormat || "",
      TaxType,
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

  // ── Esc key — "Do you want to quit page?" (same as ClosingStock.jsx) ────
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

  // ── Refresh button — mirrors #btnrefresh click handler ──────────────────
  const handleRefresh = useCallback(() => {
    setSupplierSel(null);
    setSupplierWise(false);
    setNarration(false);
    setFromDate(todayStr());
    setToDate(todayStr());
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
    if (w) {
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

  // ── View button — replicates the legacy $.ajax logic exactly ───────────
  // Legacy: Supplier selection is REQUIRED here (unlike SupplierPendingBillReport) —
  // custname == "" or GroupByText == null triggers the validation alert.
  const handleView = useCallback(async () => {
    const GroupByText = supplierSel ? supplierSel.value : "";
    const custname = supplierSel ? supplierSel.label : "";

    if (custname === "" || GroupByText == null) {
      setMsg({ text: "Please Select Valid Supplier Name !!!.", isErr: true });
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
      const res = await CC.api(
        SupplierStatementReportUrl,
        null,
        { CacheKeyType: CACHE_KEY_TYPE, React: 1 },
        {
          TaxType: session.TaxType,
          GroupBy: GroupByText,
          Fromdate,
          Todate,
          Comid: session.Comid,
          MComid: session.MComid,
          BillformatName: session.BillFormatName,
        }
      );

      if (res?.ok || res?.IsSuccess) {
        const cacheKey = res.Data15 || res.CacheKey || "";
        openReportViewer({
          ReportName: "SupplierStatementReport",
          CacheKey: cacheKey,
          custname,
          SupplierWise: supplierWise,
          Narration: narration,
          Fromdate,
          Todate,
          CName: session.CName,
          CAddress: session.CAddress,
          CPhone: session.CPhone,
          BillFormatName: session.BillFormatName,
        });
      } else {
        setMsg({ text: "No Record !!!.", isErr: true });
      }
    } catch (err) {
      setMsg({ text: err.message || "Something went wrong.", isErr: true });
    } finally {
      setLoading(false);
      // Clear the combo after the run, matching the clearSelection() call
      // that follows the (synchronous) $.ajax call in the legacy handler.
      setSupplierSel(null);
    }
  }, [supplierSel, fromDate, toDate, supplierWise, narration, session, openReportViewer]);

  // ── Supplier combo — same ApiSelect pattern used across converted pages ──
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
      <div className="ss-field">
        <label className="ss-label" htmlFor="ss-supplier">
          {placeholder.replace("Select ", "")}
        </label>
        <select
          id="ss-supplier"
          className="ss-input"
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

  // ── Scoped styles injected once ("ss-" prefix, single centered panel) ──
  const styles = `
    .ss-shell {
      min-height: 100vh;
      background: #f0f2f5;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      flex-direction: column;
    }
    .ss-layout {
      flex: 1;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      padding: 48px 24px;
    }
    .ss-panel {
      width: 100%;
      max-width: 520px;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 2px 12px rgba(0,0,0,.08);
      padding: 28px 32px;
      display: flex;
      flex-direction: column;
    }
    .ss-panel-header {
      border-bottom: 1px solid #e8ecf0;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .ss-panel-eyebrow {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .8px;
      color: var(--clr-primary, #1a56db);
      margin-bottom: 6px;
    }
    .ss-panel-title {
      font-size: 20px;
      font-weight: 700;
      color: #1e2d3d;
    }
    .ss-form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    .ss-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 20px;
    }
    .ss-field.ss-field-full {
      grid-column: 1 / -1;
    }
    .ss-label {
      font-size: 12px;
      font-weight: 600;
      color: #5a6472;
    }
    .ss-input {
      height: 40px;
      border-radius: 8px;
      border: 1.5px solid #d1d9e6;
      padding: 0 12px;
      font-size: 14px;
      color: #1e2d3d;
      background: #fff;
      outline: none;
    }
    .ss-input:focus {
      border-color: var(--clr-primary, #1a56db);
      box-shadow: 0 0 0 3px rgba(26,86,219,.1);
    }
    .ss-section-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .6px;
      color: #8a94a6;
      margin: 4px 0 10px;
    }
    .ss-toggle-grid {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-bottom: 20px;
    }
    .ss-toggle-row {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 13px;
      color: #1e2d3d;
      cursor: pointer;
    }
    .ss-actions {
      display: flex;
      gap: 12px;
      margin-top: 8px;
      padding-top: 20px;
      border-top: 1px solid #e8ecf0;
    }
    .ss-btn {
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
    .ss-btn:disabled { opacity: .5; cursor: not-allowed; }
    .ss-btn-primary {
      background: var(--clr-primary, #1a56db);
      color: #fff;
      box-shadow: 0 2px 8px rgba(26,86,219,.3);
    }
    .ss-btn-primary:not(:disabled):hover {
      opacity: .9;
      box-shadow: 0 4px 14px rgba(26,86,219,.4);
    }
    .ss-btn-secondary {
      background: #f0f2f5;
      color: #4a5568;
      border: 1.5px solid #d1d9e6;
    }
    .ss-btn-secondary:not(:disabled):hover {
      background: #e8ecf0;
    }
    .ss-msg {
      margin-top: 18px;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
    }
    .ss-msg.err { background: #fff0f0; color: #c53030; border: 1px solid #fed7d7; }
    .ss-msg.ok  { background: #f0fff4; color: #276749; border: 1px solid #c6f6d5; }
    @media (max-width: 760px) {
      .ss-layout { padding: 16px; }
      .ss-panel { padding: 20px 16px; }
      .ss-form-grid { grid-template-columns: 1fr; }
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
      <div className="ss-shell">
        <Topbar />

        <div className="ss-layout">
          <main className="ss-panel">
            <div className="ss-panel-header">
              <div className="ss-panel-eyebrow">Purchase</div>
              <div className="ss-panel-title">Supplier Statement</div>
            </div>

            <div className="ss-form-grid">
              <div className="ss-field ss-field-full">
                <ApiSelect
                  url={SupplierListUrl}
                  payload={{
                    Comid: Number(session.Comid),
                    Startindex: -1,
                    PageCount: 99999,
                    AccountType: "SUPPLIER",
                    Keyword: "",
                    Column: "",
                  }}
                  labelKey="AccountName"
                  valueKey="Id"
                  value={supplierSel}
                  onChange={setSupplierSel}
                  placeholder="Select Supplier"
                />
              </div>

              <div className="ss-field">
                <label className="ss-label" htmlFor="ss-from-date">From Date</label>
                <input
                  id="ss-from-date"
                  type="date"
                  className="ss-input"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>
              <div className="ss-field">
                <label className="ss-label" htmlFor="ss-to-date">To Date</label>
                <input
                  id="ss-to-date"
                  type="date"
                  className="ss-input"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>
            </div>

            <div className="ss-section-title">Options</div>
            <div className="ss-toggle-grid">
              <label className="ss-toggle-row">
                <input
                  type="checkbox"
                  checked={supplierWise}
                  onChange={(e) => setSupplierWise(e.target.checked)}
                />
                Supplier Wise
              </label>
              <label className="ss-toggle-row">
                <input
                  type="checkbox"
                  checked={narration}
                  onChange={(e) => setNarration(e.target.checked)}
                />
                Narration
              </label>
            </div>

            <div className="ss-actions">
              <button
                type="button"
                className="ss-btn ss-btn-primary"
                disabled={loading || pageAccess.pageview === 0}
                onClick={handleView}
              >
                {loading ? "Loading…" : "▶ View"}
              </button>
              <button
                type="button"
                className="ss-btn ss-btn-secondary"
                onClick={handleRefresh}
                disabled={loading}
              >
                ↺ Refresh
              </button>
            </div>

            {msg && <div className={`ss-msg ${msg.isErr ? "err" : "ok"}`}>{msg.text}</div>}
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