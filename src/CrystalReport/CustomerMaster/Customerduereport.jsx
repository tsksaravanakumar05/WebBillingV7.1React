// ─────────────────────────────────────────────────────────────────────────────
//  CustomerDueReport.jsx
//  React conversion of the legacy jQuery / jqxWidgets "Customer Due Report" page
//  Built on the same skeleton as ClosingStock.jsx / SaleOrder.jsx:
//    - CC.api / CC.getLocal / CC.getStr from Common.jsx
//    - same permission/session bootstrap pattern
//    - same openReportViewer(BASE_URL + /Reports/ReportViewer.aspx) pattern
//    - layout variant: no Group-By nav sidebar (like ItemwiseStockDetails.jsx) —
//      a single centered panel with two mutually-exclusive linked pickers
//      (Customer Name / Mobile No), since the source page has no grouping choice.
//  Styling: MasterPage.css tokens only, scoped under a new "cd-" prefix
//  (not used by any other converted page yet).
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import * as CC from "../../components/Common";
import Topbar from "../../components/Topbar";

const BASE_URL = "http://localhost:64215";

// ── API endpoints ───────────────────────────────────────────────────────────
// Original ASMX-style path was "/SalesReport/CustomerDuePaymentReport". Mapped
// to this app's Web API convention: first path segment ("SalesReport") becomes
// the module name. Please verify this against the real API layer.
const CustomerDuePaymentReportUrl = "/api/SalesReportApp/CustomerDuePaymentReport";

// NOTE: the original jQuery file loads these two combos via local helper
// functions (CustomerComboListSingle / CustomerComboListSingleMobileNo) whose
// actual API URLs were not provided in the source file. These are best-guess
// endpoint names following the SupplierApp/AccountType convention used in
// ClosingStock.jsx — please replace with the real endpoints from your
// Common.jsx / master API layer.
const CustomerListUrl = "/api/SupplierApp/SelectSupplierAll";
const CustomerMobileListUrl ="/api/SupplierApp/SelectSupplierAll";

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

export default function CustomerDueReport() {
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
    CName: "",
    CAddress: "",
    CPhone: "",
  });

  // ── Linked picker selections { value, label } ───────────────────────────
  // Only one of these is ever populated at a time — selecting one clears the
  // other, mirroring the cmbcustomer / cmbmobileno "change" handlers.
  const [customerSel, setCustomerSel] = useState(null);
  const [mobileSel, setMobileSel] = useState(null);

  // ── Date ─────────────────────────────────────────────────────────────────
  const [fromDate, setFromDate] = useState(todayStr());

  // ── UI feedback state ────────────────────────────────────────────────────
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

    const menudata = menulist.filter((obj) => obj.PageName === "Customer Due Report");
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
  }, [navigate]);

  // ── Esc key — "Do you want to quit page?" (preserved from SaleOrder.jsx) ──
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

  // ── Linked picker handlers ──────────────────────────────────────────────
  // Selecting a customer clears the mobile-no picker, and vice versa —
  // mirrors the cmbcustomer/cmbmobileno 'change' handlers clearing each other.
  const handleCustomerChange = useCallback((val) => {
    setCustomerSel(val);
    setMobileSel(null);
  }, []);

  const handleMobileChange = useCallback((val) => {
    setMobileSel(val);
    setCustomerSel(null);
  }, []);

  // ── Refresh button ───────────────────────────────────────────────────────
  const handleRefresh = useCallback(() => {
    setCustomerSel(null);
    setMobileSel(null);
    setFromDate(todayStr());
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
          w.document.title = "Customer Due-Report";
        },
        false
      );
    }
    return w;
  }, []);

  // ── View button — replicates the legacy $.ajax logic exactly ───────────
  const handleView = useCallback(async () => {
    // Resolve GroupByText / custname, mirroring the sequential if-blocks:
    // prefer the Customer Name picker; fall back to Mobile No if empty.
    let GroupByText = "";
    let custname = "";

    if (customerSel) {
      GroupByText = customerSel.value;
      custname = customerSel.label;
      if (GroupByText == null) {
        setMsg({ text: "Please Select Valid Customer Name !!!.", isErr: true });
        setCustomerSel(null);
        return;
      }
    }

    if (custname === "" || GroupByText == null) {
      if (mobileSel) {
        GroupByText = mobileSel.value;
        custname = mobileSel.label;
      }
      if (custname === "" || GroupByText == null) {
        setMsg({ text: "Please Select Valid Customer Name !!!.", isErr: true });
        setCustomerSel(null);
        return;
      }
    }

    const ReportTypenew = "";
    const ReportTitle = "Customer Due Bill Report";
    const Fromdate = toMMDDYYYY(fromDate);
    const Comid = session.Comid;
    const MComid = session.MComid;

    setLoading(true);
    setMsg(null);

    try {
      const res = await CC.api(
        CustomerDuePaymentReportUrl,
        null,
        { CacheKeyType: "CustomerDuePaymentReport", React: 1 },
        {
          GroupBy: GroupByText,
          Fromdate,
          Comid,
          MComid,
        }
      );

      if (res?.ok || res?.IsSuccess) {
        const cacheKey = res.Data15 || res.CacheKey || "";
        openReportViewer({
          ReportName: "CustomerDuePaymentReport",
          CacheKey: cacheKey,
          GroupByText,
          Fromdate,
          ReportType: ReportTypenew,
          ReportTitle,
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
      // Clear both picker selections after view, matching the jQuery file's
      // clearSelection calls that run right after the (synchronous) ajax call.
      setCustomerSel(null);
      setMobileSel(null);
    }
  }, [customerSel, mobileSel, fromDate, session, openReportViewer]);

  // ── Linked API-backed select (same pattern as ClosingStock's ApiSelect) ──
  const ApiSelect = ({ url, payload, headers = {}, labelKey, valueKey, value, onChange, placeholder }) => {
    const [list, setList] = useState([]);
    const [listLoading, setListLoading] = useState(false);

    useEffect(() => {
      let active = true;
      (async () => {
        setListLoading(true);
        try {
          const res = await CC.api(url, null, headers, payload);
          if (!active) return;
          const raw = Array.isArray(res?.data) ? res.data : Array.isArray(res?.Data1) ? res.Data1 : Array.isArray(res) ? res : [];
          // Drop rows with no usable value for this picker (blank/null) — the
          // source data can repeat the same AccountName/MobileNo across rows
          // and include blanks, which is fine for filtering but not for keys.
          setList(raw.filter((o) => o[valueKey] != null && String(o[valueKey]).trim() !== ""));
        } catch (err) {
          console.error(err);
        } finally {
          if (active) setListLoading(false);
        }
      })();
      return () => {
        active = false;
      };
    }, [url, JSON.stringify(payload), JSON.stringify(headers)]);

    return (
      <div className="cd-field">
        <label className="cd-label">{placeholder.replace("Select ", "")}</label>
        <select
          className="cd-input"
          value={value?.value ?? ""}
          disabled={listLoading}
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
          <option value="">{listLoading ? "Loading..." : placeholder}</option>
          {list.map((o, idx) => (
            <option key={`${idx}-${o[valueKey]}`} value={o[valueKey]}>
              {o[labelKey]}
            </option>
          ))}
        </select>
      </div>
    );
  };

  // ── Scoped styles injected once ("cd-" prefix, token-identical to cs-/iw-) ──
  const styles = `
    .cd-shell {
      min-height: 100vh;
      background: #f0f2f5;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      flex-direction: column;
    }
    .cd-layout {
      display: flex;
      flex: 1;
      justify-content: center;
      padding: 24px;
      width: 100%;
      box-sizing: border-box;
    }
    .cd-panel {
      width: 100%;
      max-width: 560px;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 2px 12px rgba(0,0,0,.08);
      padding: 28px 32px;
      display: flex;
      flex-direction: column;
      align-self: flex-start;
    }
    .cd-panel-header {
      border-bottom: 1px solid #e8ecf0;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .cd-panel-eyebrow {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .8px;
      color: var(--clr-primary, #1a56db);
      margin-bottom: 6px;
    }
    .cd-panel-title {
      font-size: 20px;
      font-weight: 700;
      color: #1e2d3d;
      line-height: 1.2;
    }
    .cd-form-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 16px 20px;
      align-items: start;
      max-width: 100%;
      margin-top: 10px;
      margin-bottom: 8px;
    }
    .cd-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .cd-label {
      font-size: 13px;
      font-weight: 600;
      color: #4a5568;
    }
    .cd-input {
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
    .cd-input:focus {
      border-color: var(--clr-primary, #1a56db);
      box-shadow: 0 0 0 3px rgba(26,86,219,.1);
    }
    .cd-divider-row {
      display: flex;
      align-items: center;
      gap: 10px;
      margin: 2px 0 4px;
    }
    .cd-divider-line {
      flex: 1;
      height: 1px;
      background: #e8ecf0;
    }
    .cd-divider-text {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .6px;
      color: #8a94a6;
    }
    .cd-actions {
      display: flex;
      gap: 12px;
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid #e8ecf0;
    }
    .cd-btn {
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
    .cd-btn:disabled { opacity: .5; cursor: not-allowed; }
    .cd-btn-primary {
      background: var(--clr-primary, #1a56db);
      color: #fff;
      box-shadow: 0 2px 8px rgba(26,86,219,.3);
    }
    .cd-btn-primary:not(:disabled):hover {
      opacity: .9;
      box-shadow: 0 4px 14px rgba(26,86,219,.4);
    }
    .cd-btn-secondary {
      background: #f0f2f5;
      color: #4a5568;
      border: 1.5px solid #d1d9e6;
    }
    .cd-btn-secondary:not(:disabled):hover {
      background: #e8ecf0;
    }
    .cd-msg {
      margin-top: 18px;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
    }
    .cd-msg.err { background: #fff0f0; color: #c53030; border: 1px solid #fed7d7; }
    .cd-msg.ok  { background: #f0fff4; color: #276749; border: 1px solid #c6f6d5; }
    @media (max-width: 760px) {
      .cd-layout { padding: 16px; }
      .cd-panel { padding: 20px 16px; }
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
      <div className="cd-shell">
        <Topbar />

        <div className="cd-layout">
          <main className="cd-panel">
            <div className="cd-panel-header">
              <div className="cd-panel-eyebrow">Sales</div>
              <div className="cd-panel-title">Customer Due Bill Report</div>
            </div>

            <div className="cd-form-grid">
              <ApiSelect
                url={CustomerListUrl}
                payload={{ Comid: session.Comid, AccountType: "CUSTOMER" }}
                labelKey="AccountName"
                valueKey="Id"
                value={customerSel}
                onChange={handleCustomerChange}
                placeholder="Select Customer Name"
              />

              <div className="cd-divider-row">
                <div className="cd-divider-line" />
                <div className="cd-divider-text">Or</div>
                <div className="cd-divider-line" />
              </div>

              <ApiSelect
                url={CustomerMobileListUrl}
                payload={{ Comid: session.Comid, AccountType: "CUSTOMER" }}
                labelKey="MobileNo"
                valueKey="MobileNo"
                value={mobileSel}
                onChange={handleMobileChange}
                placeholder="Select Mobile No"
              />

              <div className="cd-field">
                <label className="cd-label" htmlFor="cd-from-date">From Date</label>
                <input
                  id="cd-from-date"
                  type="date"
                  className="cd-input"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>
            </div>

            <div className="cd-actions">
              <button
                type="button"
                className="cd-btn cd-btn-primary"
                disabled={loading || pageAccess.pageview === 0}
                onClick={handleView}
              >
                {loading ? "Loading…" : "▶ View"}
              </button>
              <button
                type="button"
                className="cd-btn cd-btn-secondary"
                onClick={handleRefresh}
                disabled={loading}
              >
                ↺ Refresh
              </button>
            </div>

            {msg && <div className={`cd-msg ${msg.isErr ? "err" : "ok"}`}>{msg.text}</div>}
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