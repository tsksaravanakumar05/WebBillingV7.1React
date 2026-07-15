// ─────────────────────────────────────────────────────────────────────────────
//  CustomerAgingReport.jsx
//  React conversion of customeragingreport.js (jQuery / jqxWidgets) — "Customer Aging Report"
//  Built on the same skeleton as ClosingStock.jsx / ItemwiseStockDetails.jsx:
//    - CC.api / CC.getLocal / CC.getStr from Common.jsx
//    - same permission/session bootstrap pattern
//    - same openReportViewer(BASE_URL + /Reports/ReportViewer.aspx) pattern
//    - no Group-By nav needed here (single customer picker only) — single
//      centered panel layout, like ItemwiseStockDetails.jsx, scoped "ca-"
//  Styling: token-for-token identical values to ClosingStock/ItemwiseStockDetails
//  — only the class prefix changes ("ca-" — unused by any other converted page).
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import * as CC from "../../components/Common";
import Topbar from "../../components/Topbar";

const BASE_URL = "http://localhost:64215";

// ── API endpoints ───────────────────────────────────────────────────────────
// NOTE: the original jQuery file posts to "/SalesReport/CustomerAgingReport"
// (ASMX-style path). Following the same module-inference convention used for
// the other converted pages ("/Stock/..." -> "/api/StockReportApp/..."),
// this becomes "/api/SalesReportApp/CustomerAgingReport" — please verify
// against the real Web API route.
const CustomerAgingReportUrl = "/api/SalesReportApp/CustomerAgingReport";

// NOTE: the original file loads the customer combo via a shared helper,
// CustomerComboListSingle("#cmbcustomer", true, "CUSTOMER"), whose actual API
// URL was not provided. This mirrors the naming convention used for
// SupplierListUrl ("/api/SupplierApp/SelectSupplier" + AccountType filter) —
// best-guess endpoint, please replace with the real one from Common.jsx.
const CustomerListUrl = "/api/SupplierApp/SelectSupplierAll";

export default function CustomerAgingReport() {
  const navigate = useNavigate();

  // ── Session / permission state ─────────────────────────────────────────
  const [pageAccess, setPageAccess] = useState({
    ready: false,
    allowed: false,
    pageview: 0,
  });

  // ── Company / settings state (loaded once from localStorage) ───────────
  const [session, setSession] = useState({
    Comid: "",
    MComid: "",
    CName: "",
    CAddress: "",
    CPhone: "",
  });

  // ── Customer combo selection { value, label } ───────────────────────────
  const [customerSel, setCustomerSel] = useState(null);

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

    const menudata = menulist.filter((obj) => obj.PageName === "Customer Aging Report");
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
          w.document.title = "Customer Aging-Report";
        },
        false
      );
    }
    return w;
  }, []);

  // ── Refresh button — clears the customer selection only ────────────────
  const handleRefresh = useCallback(() => {
    setCustomerSel(null);
    setMsg(null);
  }, []);

  // ── View button — replicates the customeragingreport.js $.ajax logic ───
  const handleView = useCallback(async () => {
    // Mirrors: GroupByText = ""; if a customer item is selected, validate it.
    let GroupByText = "";
    if (customerSel != null) {
      if (customerSel.value == null || customerSel.value === "") {
        setMsg({ text: "Please Select Valid Customer Name !!!.", isErr: true });
        setCustomerSel(null);
        return;
      }
      GroupByText = customerSel.label;
    }

    const Comid = session.Comid;
    const MComid = session.MComid;

    setLoading(true);
    setMsg(null);

    try {
      const res = await CC.api(
        CustomerAgingReportUrl,
        null,
        { CacheKeyType: "CustomerAgingReport", React: 1 },
        {
          GroupBy: GroupByText,
          Comid,
          MComid,
        }
      );

      if (res?.ok || res?.IsSuccess) {
        const cacheKey = res.Data15 || res.CacheKey || "";
        openReportViewer({
          ReportName: "CustomerAgingReport",
          GroupByText,
          CacheKey: cacheKey,
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
      // Matches the original: clear the combo selection after the request
      // completes, whether it succeeded or not.
      setCustomerSel(null);
    }
  }, [customerSel, session, openReportViewer]);

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
      <div className="ca-field">
        <label className="ca-label" htmlFor="ca-customer">
          Customer Name
        </label>
        <select
          id="ca-customer"
          className="ca-input"
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

  // ── Scoped styles injected once (same tokens as ClosingStock.jsx, "ca-" prefix) ──
  const styles = `
    .ca-shell {
      min-height: 100vh;
      background: #f0f2f5;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      flex-direction: column;
    }
    .ca-layout {
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
    .ca-panel {
      width: 100%;
      max-width: 520px;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 2px 12px rgba(0,0,0,.08);
      padding: 28px 32px;
      display: flex;
      flex-direction: column;
    }
    .ca-panel-header {
      border-bottom: 1px solid #e8ecf0;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .ca-panel-eyebrow {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .8px;
      color: var(--clr-primary, #1a56db);
      margin-bottom: 6px;
    }
    .ca-panel-title {
      font-size: 20px;
      font-weight: 700;
      color: #1e2d3d;
      line-height: 1.2;
    }
    .ca-form-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 16px 20px;
      align-items: start;
      max-width: 100%;
      margin-top: 10px;
      margin-bottom: 8px;
    }
    .ca-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .ca-label {
      font-size: 13px;
      font-weight: 600;
      color: #4a5568;
    }
    .ca-input {
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
    .ca-input:focus {
      border-color: var(--clr-primary, #1a56db);
      box-shadow: 0 0 0 3px rgba(26,86,219,.1);
    }
    .ca-actions {
      display: flex;
      gap: 12px;
      margin-top: 28px;
      padding-top: 20px;
      border-top: 1px solid #e8ecf0;
    }
    .ca-btn {
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
    .ca-btn:disabled { opacity: .5; cursor: not-allowed; }
    .ca-btn-primary {
      background: var(--clr-primary, #1a56db);
      color: #fff;
      box-shadow: 0 2px 8px rgba(26,86,219,.3);
    }
    .ca-btn-primary:not(:disabled):hover {
      opacity: .9;
      box-shadow: 0 4px 14px rgba(26,86,219,.4);
    }
    .ca-btn-secondary {
      background: #f0f2f5;
      color: #4a5568;
      border: 1.5px solid #d1d9e6;
    }
    .ca-btn-secondary:not(:disabled):hover {
      background: #e8ecf0;
    }
    .ca-msg {
      margin-top: 18px;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
    }
    .ca-msg.err { background: #fff0f0; color: #c53030; border: 1px solid #fed7d7; }
    .ca-msg.ok  { background: #f0fff4; color: #276749; border: 1px solid #c6f6d5; }
    @media (max-width: 760px) {
      .ca-layout { padding: 16px; }
      .ca-panel { padding: 20px 16px; }
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
      <div className="ca-shell">
        <Topbar />

        <div className="ca-layout">
          <main className="ca-panel">
            <div className="ca-panel-header">
              <div className="ca-panel-eyebrow">Sales</div>
              <div className="ca-panel-title">Customer Aging Report</div>
            </div>

            <div className="ca-form-grid">
              <ApiSelect
                url={CustomerListUrl}
                payload={{ Comid: session.Comid, AccountType: "CUSTOMER" }}
                labelKey="AccountName"
                valueKey="Id"
                value={customerSel}
                onChange={setCustomerSel}
                placeholder="Select Customer"
              />
            </div>

            <div className="ca-actions">
              <button
                type="button"
                className="ca-btn ca-btn-primary"
                disabled={loading || pageAccess.pageview === 0}
                onClick={handleView}
              >
                {loading ? "Loading…" : "▶ View"}
              </button>
              <button
                type="button"
                className="ca-btn ca-btn-secondary"
                onClick={handleRefresh}
                disabled={loading}
              >
                ↺ Refresh
              </button>
            </div>

            {msg && <div className={`ca-msg ${msg.isErr ? "err" : "ok"}`}>{msg.text}</div>}
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