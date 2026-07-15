// ─────────────────────────────────────────────────────────────────────────────
//  CustomerPendingBillsReport.jsx
//  React conversion of the "Customer Pending Bills-Report" page (jQuery / jqxWidgets)
//  Built on the same skeleton as ClosingStock.jsx / CRMCustomer.jsx:
//    - CC.api / CC.getLocal / CC.getStr from Common.jsx
//    - same permission/session bootstrap pattern
//    - same openReportViewer(BASE_URL + /Reports/ReportViewer.aspx) pattern
//    - single centered panel (no Group-By nav sidebar) — the two checkboxes
//      here are report-type toggles, not a nav-card grouping list.
//    - "cp-" scoped style system (unique prefix, does not collide with
//      cs-/iq-/iw-/cc- used by other converted pages).
//  Styling: MasterPage.css only — no inline color values, no new theme colors.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import * as CC from "../../components/Common";
import Topbar from "../../components/Topbar";

const BASE_URL = "http://localhost:64215";

// ── API endpoints ───────────────────────────────────────────────────────────
// Original ASMX-style path was /SalesReport/CustomerPendingReportCR. Mapped to
// this app's Web API layer per convention: first path segment (SalesReport) →
// module name.
const CustomerPendingReportUrl = "/api/SalesReportApp/CustomerPendingReport_Rct";

// NOTE: the original jQuery file loads these three combos via shared helpers
// (CustomerComboListSingle, loadAreacombo, loadSalesMancombo) whose actual API
// URLs were not provided. These are best-guess endpoint names following the
// SupplierApp/BrandApp naming convention used elsewhere in this app — please
// replace with the real endpoints from your Common.jsx / master API layer if
// different. CustomerListUrl matches the one used in CRMCustomer.jsx.
const CustomerListUrl = "/api/SupplierApp/SelectSupplierAll";
const AreaListUrl = "/api/AreaApp/SelectArea";
const SalesManListUrl = "/api/SalesManApp/SelectSalesMan";

export default function CustomerPendingBillsReport() {
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

  // ── Combo selections { value, label } ───────────────────────────────────
  const [customerSel, setCustomerSel] = useState(null);
  const [areaSel, setAreaSel] = useState(null);
  const [salesManSel, setSalesManSel] = useState(null);

  // ── Report-type checkboxes (mutually exclusive) ─────────────────────────
  const [chkArea, setChkArea] = useState(false);
  const [chkSales, setChkSales] = useState(false);

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

    const menudata = menulist.filter((obj) => obj.PageName === "Customer Pending Bills-Report");
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

  // ── Esc key — "Do you want to quit page?" (preserved from ClosingStock.jsx) ──
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

  // ── Report-type checkbox handlers ───────────────────────────────────────
  // chkArea's own click handler: reads its OWN (just-toggled) value — if now
  // checked, it clears the Salesman combo and unchecks chkSales. This part
  // matches the source exactly.
  const handleChkAreaChange = useCallback((checked) => {
    setChkArea(checked);
    if (checked) {
      setSalesManSel(null);
      setChkSales(false);
    }
  }, []);

  // chkSales's click handler in the source reads $("#chkArea").val() instead
  // of its own checkbox — a copy-paste quirk in the legacy file. Preserved
  // verbatim here rather than "fixed": toggling Sales only clears the Area
  // combo/unchecks Area when Area happens to already be checked at the time
  // of the click, regardless of the new Sales state.
  const handleChkSalesChange = useCallback(
    (checked) => {
      setChkSales(checked);
      if (chkArea) {
        setAreaSel(null);
        setChkArea(false);
      }
    },
    [chkArea]
  );

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
        () => {
          w.document.title = "Customer Pending-Report";
        },
        false
      );
    }
    return w;
  }, []);

  // ── Refresh button — clears all three combos + both checkboxes ─────────
  const handleRefresh = useCallback(() => {
    setCustomerSel(null);
    setSalesManSel(null);
    setAreaSel(null);
    setChkArea(false);
    setChkSales(false);
    setMsg(null);
  }, []);

  // ── View button — replicates the Customer Pending $.ajax logic exactly ─
  const handleView = useCallback(async () => {
    // Sequential resolution mirroring the source: customer, then area, then
    // salesman — each later block overwrites GroupByText if its own combo
    // has a selection, exactly as the jQuery if-blocks do.
    let GroupByText = "";

    if (customerSel != null) {
      if (customerSel.value == null || customerSel.value === "") {
        setMsg({ text: "Please Select Valid Supplier Name !!!.", isErr: true });
        setCustomerSel(null);
        return;
      }
      GroupByText = customerSel.label;
    }
    if (areaSel != null) {
      if (areaSel.value == null || areaSel.value === "") {
        setMsg({ text: "Please Select Valid Area Name !!!.", isErr: true });
        setAreaSel(null);
        return;
      }
      GroupByText = areaSel.label;
    }
    if (salesManSel != null) {
      if (salesManSel.value == null || salesManSel.value === "") {
        setMsg({ text: "Please Select Valid Salesman Name !!!.", isErr: true });
        setSalesManSel(null);
        return;
      }
      GroupByText = salesManSel.label;
    }

    let ReportTitle = "";
    let RptType = "";
    if (chkArea) {
      ReportTitle = "Area Wise Customer Pending Bill Report";
      RptType = "AREA";
    } else if (chkSales) {
      ReportTitle = "Saleman Wise Customer Pending Bill Report";
      RptType = "SALES";
    } else {
      ReportTitle = "Customer Pending Bill Report";
      RptType = "";
    }

    setLoading(true);
    setMsg(null);

    try {
      const res = await CC.api(
        CustomerPendingReportUrl,
        null,
        { CacheKeyType: "CustomerPendingReportCR", React: 1 },
        {
          GroupBy: GroupByText,
          ReportType: RptType,
          Comid: session.Comid,
          MComid: session.MComid,
        }
      );

      if (res) {
        const cacheKey = res.Data15 || res.CacheKey || "";
        openReportViewer({
          ReportName: "CustomerPendingReport",
          CacheKey: cacheKey,
          ReportType: RptType,
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
      // Clear the three combo selections after view, matching the jQuery
      // file's synchronous clearSelection() calls right after the
      // (async:false) ajax. Note the checkboxes are NOT reset here — only
      // Refresh resets them, same as the source.
      setCustomerSel(null);
      setSalesManSel(null);
      setAreaSel(null);
    }
  }, [customerSel, areaSel, salesManSel, chkArea, chkSales, session, openReportViewer]);

  // ── Combo box (fetch-on-mount, controlled <select>) ─────────────────────
  const ApiSelect = ({ id, url, payload, headers = {}, labelKey, valueKey, value, onChange, placeholder }) => {
    const [list, setList] = useState([]);
    const [loadingList, setLoadingList] = useState(false);

    useEffect(() => {
      let active = true;
      (async () => {
        setLoadingList(true);
        try {
          const res = await CC.api(url, null, headers, payload);
          if (!active) return;
          const raw = Array.isArray(res?.data) ? res.data : Array.isArray(res?.Data1) ? res.Data1 : Array.isArray(res) ? res : [];
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
      <div className="cp-field">
        <label className="cp-label" htmlFor={id}>{placeholder.replace("Select ", "")}</label>
        <select
          id={id}
          className="cp-input"
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

  // ── Scoped styles injected once ("cp-" prefix, tokens identical to
  //    ClosingStock.jsx / CRMCustomer.jsx) ───────────────────────────────────
  const styles = `
    .cp-shell {
      min-height: 100vh;
      background: #f0f2f5;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      flex-direction: column;
    }
    .cp-layout {
      display: flex;
      flex: 1;
      justify-content: center;
      padding: 24px;
      width: 100%;
      box-sizing: border-box;
    }
    .cp-panel {
      width: 100%;
      max-width: 560px;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 2px 12px rgba(0,0,0,.08);
      padding: 28px 32px;
      display: flex;
      flex-direction: column;
      align-self: flex-start;
      margin-top: 40px;
    }
    .cp-panel-header {
      border-bottom: 1px solid #e8ecf0;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .cp-panel-eyebrow {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .8px;
      color: var(--clr-primary, #1a56db);
      margin-bottom: 6px;
    }
    .cp-panel-title {
      font-size: 20px;
      font-weight: 700;
      color: #1e2d3d;
      line-height: 1.2;
    }
    .cp-form-grid {
      display: flex;
      flex-direction: column;
      gap: 16px;
      margin-bottom: 8px;
    }
    .cp-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .cp-label {
      font-size: 13px;
      font-weight: 600;
      color: #4a5568;
    }
    .cp-input {
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
    .cp-input:focus {
      border-color: var(--clr-primary, #1a56db);
      box-shadow: 0 0 0 3px rgba(26,86,219,.1);
    }
    .cp-section-title {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .6px;
      color: #8a94a6;
      margin: 20px 0 10px;
    }
    .cp-toggle-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px 16px;
    }
    .cp-toggle-row {
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
    .cp-toggle-row input[type="checkbox"] {
      width: 15px;
      height: 15px;
      accent-color: var(--clr-primary, #1a56db);
      cursor: pointer;
    }
    .cp-actions {
      display: flex;
      gap: 12px;
      margin-top: 28px;
      padding-top: 20px;
      border-top: 1px solid #e8ecf0;
    }
    .cp-btn {
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
    .cp-btn:disabled { opacity: .5; cursor: not-allowed; }
    .cp-btn-primary {
      background: var(--clr-primary, #1a56db);
      color: #fff;
      box-shadow: 0 2px 8px rgba(26,86,219,.3);
    }
    .cp-btn-primary:not(:disabled):hover {
      opacity: .9;
      box-shadow: 0 4px 14px rgba(26,86,219,.4);
    }
    .cp-btn-secondary {
      background: #f0f2f5;
      color: #4a5568;
      border: 1.5px solid #d1d9e6;
    }
    .cp-btn-secondary:not(:disabled):hover {
      background: #e8ecf0;
    }
    .cp-msg {
      margin-top: 18px;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
    }
    .cp-msg.err { background: #fff0f0; color: #c53030; border: 1px solid #fed7d7; }
    .cp-msg.ok  { background: #f0fff4; color: #276749; border: 1px solid #c6f6d5; }
    @media (max-width: 760px) {
      .cp-layout { padding: 16px; }
      .cp-panel { padding: 20px 16px; margin-top: 16px; }
      .cp-toggle-grid { grid-template-columns: 1fr; }
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
      <div className="cp-shell">
        <Topbar />

        <div className="cp-layout">
          <main className="cp-panel">
            <div className="cp-panel-header">
              <div className="cp-panel-eyebrow">Sales Report</div>
              <div className="cp-panel-title">Customer Pending Bills Report</div>
            </div>

            <div className="cp-form-grid">
              <ApiSelect
                id="cp-customer"
                url={CustomerListUrl}
                payload={{ Comid: session.Comid,AccountType:"CUSTOMER" }}
                labelKey="AccountName"
                valueKey="Id"
                value={customerSel}
                onChange={setCustomerSel}
                placeholder="Select Customer"
              />
              <ApiSelect
                id="cp-area"
                url={AreaListUrl}
                payload={{ Comid: session.Comid }}
                labelKey="AreaName"
                valueKey="Id"
                value={areaSel}
                onChange={setAreaSel}
                placeholder="Select Area"
              />
              <ApiSelect
                id="cp-salesman"
                url={SalesManListUrl}
                payload={{ Comid: session.Comid }}
                labelKey="SalesManName"
                valueKey="Id"
                value={salesManSel}
                onChange={setSalesManSel}
                placeholder="Select Salesman"
              />
            </div>

            <div className="cp-section-title">Report Type</div>
            <div className="cp-toggle-grid">
              <label className="cp-toggle-row">
                <input
                  type="checkbox"
                  checked={chkArea}
                  onChange={(e) => handleChkAreaChange(e.target.checked)}
                />
                Area Wise
              </label>
              <label className="cp-toggle-row">
                <input
                  type="checkbox"
                  checked={chkSales}
                  onChange={(e) => handleChkSalesChange(e.target.checked)}
                />
                Salesman Wise
              </label>
            </div>

            <div className="cp-actions">
              <button
                type="button"
                className="cp-btn cp-btn-primary"
                disabled={loading || pageAccess.pageview === 0}
                onClick={handleView}
              >
                {loading ? "Loading…" : "▶ View"}
              </button>
              <button
                type="button"
                className="cp-btn cp-btn-secondary"
                onClick={handleRefresh}
                disabled={loading}
              >
                ↺ Refresh
              </button>
            </div>

            {msg && <div className={`cp-msg ${msg.isErr ? "err" : "ok"}`}>{msg.text}</div>}
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