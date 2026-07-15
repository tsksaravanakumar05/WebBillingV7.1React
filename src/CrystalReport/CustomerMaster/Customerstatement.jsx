// ─────────────────────────────────────────────────────────────────────────────
//  CustomerStatement.jsx
//  React conversion of the "Customer Statement" report jQuery/jqxWidgets page
//  Built on the exact same skeleton as ClosingStock.jsx / InventoryQtyWise.jsx:
//    - CC.api / CC.getLocal / CC.getStr from Common.jsx
//    - same permission/session bootstrap pattern
//    - same openReportViewer(BASE_URL + /Reports/ReportViewer.aspx) pattern
//  No Group-By nav in the original page (just a single customer picker), so
//  this uses the single-centered-panel layout variant, scoped "cst-" styles.
//  Styling: MasterPage.css tokens only — no new theme colors.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import * as CC from "../../components/Common";
import Topbar from "../../components/Topbar";

const BASE_URL = "http://localhost:64215";

// ── API endpoints ───────────────────────────────────────────────────────────
// Report endpoint — mirrors the original $.ajax url ("/SalesReport/CustomerStatementReport"),
// rewritten to the Web API layer (module inferred from the original path's first segment).
const CustomerStatementReportUrl = "/api/SalesReportApp/CustomerStatementReport";

// NOTE: the original jQuery file populates the two combos via
// CustomerComboListSingle(...) / CustomerComboListSingleMobileNo(...), whose
// actual API URLs were not provided. This is a best-guess endpoint name
// following the Brand/Category/... convention used across converted pages —
// please replace with the real endpoint from your Common.jsx / master API layer.
const CustomerListUrl = "/api/SupplierApp/SelectSupplierAll";

// Identifies this report's cache-key bucket on the backend (same convention
// as ClosingStockReport / InventoryQtyWiseReport).
const CACHE_KEY_TYPE = "CustomerStatementReport";

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

export default function CustomerStatement() {
  const navigate = useNavigate();

  // ── Session / permission state ─────────────────────────────────────────
  const [pageAccess, setPageAccess] = useState({
    ready: false,
    allowed: false,
    pageview: 0,
  });

  // ── Company / settings state (loaded once from localStorage) ────────────
  const [session, setSession] = useState({
    Comid: "",
    MComid: "",
    CName: "",
    CAddress: "",
    CPhone: "",
    BillFormatName: "",
    Taxtype: 1, // 0 = "Inclusive Don't Show Tax", 1 = otherwise
  });

  // ── Combo selections { value, label } — customer name / mobile no ──────
  const [customerSel, setCustomerSel] = useState(null);
  const [mobileSel, setMobileSel] = useState(null);

  // ── Extra checkboxes (ids preserved from legacy markup: chkiwdetails /
  // chkwtotal — labels are a best guess since the original .html was not
  // provided; please verify against the real page) ───────────────────────
  const [chkIwDetails, setChkIwDetails] = useState(false);
  const [chkWTotal, setChkWTotal] = useState(false);

  // ── Date range ───────────────────────────────────────────────────────────
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

    const menudata = menulist.filter((obj) => obj.PageName === "Customer Statement");
    if (!menudata || menudata.length === 0) {
      setMsg({ text: "Page Access Permission Denied !!!.", isErr: true });
      setTimeout(() => navigate("/Home"), 3000);
      return;
    }

    const Comid = CC.getStr("Comid");
    const MComid = CC.getStr("MComid");
    const ComSet = CC.getLocal("Companysetting") || [{}];

    const taxName = ComSet[0]?.POSTax;
    const Taxtype = taxName === "Inclusive Don't Show Tax" ? 0 : 1;

    setSession({
      Comid,
      MComid,
      CName: ComSet[0]?.CName || "",
      CAddress: ComSet[0]?.CAddress || "",
      CPhone: ComSet[0]?.CPhone || "",
      BillFormatName: ComSet[0]?.SaleBillFormat || "",
      Taxtype,
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

  // ── Refresh button — mirrors #btnrefresh click handler ─────────────────
  const handleRefresh = useCallback(() => {
    setCustomerSel(null);
    setMobileSel(null);
    setChkIwDetails(false);
    setChkWTotal(false);
    setFromDate(todayStr());
    setToDate(todayStr());
    setMsg(null);
  }, []);

  // ── Report viewer opener — same pattern as ClosingStock.jsx ─────────────
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
    return w;
  }, []);

  // ── View button — replicates the legacy $.ajax logic exactly ───────────
  const handleView = useCallback(async () => {
    // Resolve custname / GroupByText: prefer the customer-name combo, then
    // fall back to the mobile-number combo, mirroring the sequential
    // if-blocks in the original .js.
    let GroupByText = "";
    let custname = "";

    if (customerSel) {
      GroupByText = customerSel.value;
      custname = customerSel.label;
    }

    if (custname === "" || GroupByText == null || GroupByText === "") {
      if (mobileSel) {
        GroupByText = mobileSel.value;
        custname = mobileSel.label;
      }
      if (custname === "" || GroupByText == null || GroupByText === "") {
        setMsg({ text: "Please Select Valid Customer Name !!!.", isErr: true });
        setCustomerSel(null);
        return;
      }
    }

    const startdate = new Date(fromDate);
    const enddate = new Date(toDate);
    if (startdate > enddate) {
      setMsg({ text: "From Date Is Greater Than To Date!!", isErr: true });
      return;
    }

    // CustomerWise / Narration resolution — mirrors the checkbox logic in
    // the original .js verbatim (chkwtotal, when checked, overrides
    // CustomerWise with its own value).
    let CustomerWise = chkIwDetails;
    const Narration = chkWTotal;
    if (chkWTotal === true) {
      CustomerWise = chkWTotal;
    }

    const Fromdate = toMMDDYYYY(fromDate);
    const Todate = toMMDDYYYY(toDate);

    setLoading(true);
    setMsg(null);

    try {
      const res = await CC.api(
        CustomerStatementReportUrl,
        null,
        { CacheKeyType: CACHE_KEY_TYPE, React: 1 },
        {
          TaxType: session.Taxtype,
          GroupBy: GroupByText,
          Fromdate,
          Todate,
          Comid: session.Comid,
          MComid: session.MComid,
          BillFormatName: session.BillFormatName,
        }
      );

      if (res?.ok || res?.IsSuccess) {
        const cacheKey = res.Data15 || res.CacheKey || "";
        const w = openReportViewer({
          ReportName: "CustomerStatementReport",
          CacheKey: cacheKey,
          custname,
          CustomerWise,
          Narration,
          Fromdate,
          Todate,
          CName: session.CName,
          CAddress: session.CAddress,
          CPhone: session.CPhone,
          BillFormatName: session.BillFormatName,
        });
        if (w) {
          w.addEventListener(
            "load",
            () => {
              w.document.title = "Customer Payment - Report";
            },
            false
          );
        }
      } else {
        setMsg({ text: "No Record !!!.", isErr: true });
      }
    } catch (err) {
      setMsg({ text: err.message || "Something went wrong.", isErr: true });
    } finally {
      setLoading(false);
      // Clear combo selections after view, matching clearSelection() calls
      // at the end of the jQuery #btnview click handler.
      setCustomerSel(null);
      setMobileSel(null);
    }
  }, [
    customerSel,
    mobileSel,
    fromDate,
    toDate,
    chkIwDetails,
    chkWTotal,
    session,
    openReportViewer,
  ]);

  const ApiSelect = ({ url, payload, headers = {}, labelKey, valueKey, value, onChange, placeholder }) => {
    const [list, setList] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
      let active = true;
      (async () => {
        setLoading(true);
        try {
          const res = await CC.api(url, null, headers, payload);
          if (!active) return;
          const raw = Array.isArray(res?.data) ? res.data : Array.isArray(res?.Data1) ? res.Data1 : Array.isArray(res) ? res : [];
          setList(raw);
        } catch (err) {
          console.error(err);
        } finally {
          if (active) setLoading(false);
        }
      })();
      return () => { active = false; };
    }, [url, JSON.stringify(payload), JSON.stringify(headers)]);

    return (
      <div className="cst-field">
        <label className="cst-label">{placeholder.replace("Select ", "")}</label>
        <select
          className="cst-input"
          value={value?.value ?? ""}
          disabled={loading}
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
          <option value="">{loading ? "Loading..." : placeholder}</option>
          {list.map((o) => (
            <option key={o[valueKey]} value={o[valueKey]}>
              {o[labelKey]}
            </option>
          ))}
        </select>
      </div>
    );
  };

  // ── Scoped styles injected once (same tokens as ClosingStock.jsx, "cst-" prefix) ──
  const styles = `
    .cst-shell {
      min-height: 100vh;
      background: #f0f2f5;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      flex-direction: column;
    }
    .cst-layout {
      display: flex;
      justify-content: center;
      flex: 1;
      padding: 24px;
      width: 100%;
      box-sizing: border-box;
    }
    .cst-panel {
      width: 100%;
      max-width: 640px;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 2px 12px rgba(0,0,0,.08);
      padding: 28px 32px;
      display: flex;
      flex-direction: column;
    }
    .cst-panel-header {
      border-bottom: 1px solid #e8ecf0;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .cst-panel-eyebrow {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .8px;
      color: var(--clr-primary, #1a56db);
      margin-bottom: 6px;
    }
    .cst-panel-title {
      font-size: 20px;
      font-weight: 700;
      color: #1e2d3d;
      line-height: 1.2;
    }
    .cst-section-title {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .6px;
      color: #8a94a6;
      margin: 20px 0 10px;
    }
    .cst-section-title:first-of-type { margin-top: 0; }
    .cst-form-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 16px 20px;
      align-items: start;
      max-width: 100%;
      margin-top: 10px;
      margin-bottom: 8px;
    }
    .cst-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .cst-label {
      font-size: 13px;
      font-weight: 600;
      color: #4a5568;
    }
    .cst-input {
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
    .cst-input:focus {
      border-color: var(--clr-primary, #1a56db);
      box-shadow: 0 0 0 3px rgba(26,86,219,.1);
    }
    .cst-toggle-row {
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
    .cst-toggle-row input[type="checkbox"] {
      width: 15px;
      height: 15px;
      accent-color: var(--clr-primary, #1a56db);
      cursor: pointer;
    }
    .cst-toggle-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px 16px;
      max-width: 460px;
      margin-top: 10px;
    }
    .cst-actions {
      display: flex;
      gap: 12px;
      margin-top: 28px;
      padding-top: 20px;
      border-top: 1px solid #e8ecf0;
    }
    .cst-btn {
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
    .cst-btn:disabled { opacity: .5; cursor: not-allowed; }
    .cst-btn-primary {
      background: var(--clr-primary, #1a56db);
      color: #fff;
      box-shadow: 0 2px 8px rgba(26,86,219,.3);
    }
    .cst-btn-primary:not(:disabled):hover {
      opacity: .9;
      box-shadow: 0 4px 14px rgba(26,86,219,.4);
    }
    .cst-btn-secondary {
      background: #f0f2f5;
      color: #4a5568;
      border: 1.5px solid #d1d9e6;
    }
    .cst-btn-secondary:not(:disabled):hover {
      background: #e8ecf0;
    }
    .cst-msg {
      margin-top: 18px;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
    }
    .cst-msg.err { background: #fff0f0; color: #c53030; border: 1px solid #fed7d7; }
    .cst-msg.ok  { background: #f0fff4; color: #276749; border: 1px solid #c6f6d5; }
    @media (max-width: 760px) {
      .cst-layout { padding: 16px; }
      .cst-panel { padding: 20px 16px; }
      .cst-form-grid, .cst-toggle-grid { grid-template-columns: 1fr; }
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
      <div className="cst-shell">
        <Topbar />

        <div className="cst-layout">
          <main className="cst-panel">
            <div className="cst-panel-header">
              <div className="cst-panel-eyebrow">Sales</div>
              <div className="cst-panel-title">Customer Statement Report</div>
            </div>

            {/* Customer / Mobile No pickers — either one identifies the customer,
                mirroring the cmbcustomer / cmbmobileno fallback in the original .js */}
            <div className="cst-form-grid">
              <ApiSelect
                url={CustomerListUrl}
                payload={{ Comid: session.Comid, AccountType: "CUSTOMER" }}
                labelKey="AccountName"
                valueKey="Id"
                value={customerSel}
                onChange={(v) => {
                  setCustomerSel(v);
                  if (v) setMobileSel(null);
                }}
                placeholder="Select Customer"
              />
              <ApiSelect
                url={CustomerListUrl}
                payload={{ Comid: session.Comid, Type: "CUSTOMER" }}
                labelKey="MobileNo"
                valueKey="Id"
                value={mobileSel}
                onChange={(v) => {
                  setMobileSel(v);
                  if (v) setCustomerSel(null);
                }}
                placeholder="Select Mobile No"
              />

              <div className="cst-field">
                <label className="cst-label" htmlFor="cst-from-date">From Date</label>
                <input
                  id="cst-from-date"
                  type="date"
                  className="cst-input"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>
              <div className="cst-field">
                <label className="cst-label" htmlFor="cst-to-date">To Date</label>
                <input
                  id="cst-to-date"
                  type="date"
                  className="cst-input"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>
            </div>

            {/* Extra options — ids preserved from legacy markup (chkiwdetails /
                chkwtotal); labels are a best guess, please verify against the
                real page copy */}
            <div className="cst-section-title">Options</div>
            <div className="cst-toggle-grid">
              <label className="cst-toggle-row">
                <input
                  type="checkbox"
                  checked={chkIwDetails}
                  onChange={(e) => setChkIwDetails(e.target.checked)}
                />
                Item Wise Details
              </label>
              <label className="cst-toggle-row">
                <input
                  type="checkbox"
                  checked={chkWTotal}
                  onChange={(e) => setChkWTotal(e.target.checked)}
                />
                With Total
              </label>
            </div>

            <div className="cst-actions">
              <button
                type="button"
                className="cst-btn cst-btn-primary"
                disabled={loading || pageAccess.pageview === 0}
                onClick={handleView}
              >
                {loading ? "Loading…" : "▶ View"}
              </button>
              <button
                type="button"
                className="cst-btn cst-btn-secondary"
                onClick={handleRefresh}
                disabled={loading}
              >
                ↺ Refresh
              </button>
            </div>

            {msg && <div className={`cst-msg ${msg.isErr ? "err" : "ok"}`}>{msg.text}</div>}
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