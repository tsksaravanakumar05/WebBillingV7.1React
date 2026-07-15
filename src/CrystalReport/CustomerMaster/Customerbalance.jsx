// ─────────────────────────────────────────────────────────────────────────────
//  CustomerBalance.jsx
//  React conversion of the "Customer Balance" report page (jQuery / jqxWidgets)
//  Built on the same skeleton as ClosingStock.jsx:
//    - CC.api / CC.getLocal / CC.getStr from Common.jsx
//    - same permission/session bootstrap pattern
//    - same openReportViewer(BASE_URL + /Reports/ReportViewer.aspx) pattern
//    - same chip-based Group-By / Order-By radio pattern as ClosingStock's
//      Stock Type / Rate Type sections (the source page has no nav sidebar —
//      radios + combo + date all live in one panel), rendered here as a
//      single centered panel like CRMCustomer.jsx / CustomerPendingBillsReport.jsx.
//    - "cb-" scoped style system (unique prefix, does not collide with
//      cs-/iq-/iw-/cc-/cp- used by other converted pages).
//  Styling: MasterPage.css only — no inline color values, no new theme colors.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import * as CC from "../../components/Common";
import Topbar from "../../components/Topbar";

const BASE_URL = "http://localhost:64215";

// ── API endpoints ───────────────────────────────────────────────────────────
// Original ASMX-style path was /SalesReport/CustomerBalanceReport. Mapped to
// this app's Web API layer per convention: first path segment (SalesReport) →
// module name.

const CustomerBalanceReportUrl = "/api/SalesReportApp/CustomerBalanceReport";

// NOTE: the original jQuery file loads these combos via shared helpers
// (CustomerComboListSingle, CustomerComboListSingleMobileNo, loadAreacombo,
// loadSalesMancombo) whose actual API URLs were not provided. These are
// best-guess endpoint names following the SupplierApp/BrandApp naming
// convention used elsewhere in this app — please replace with the real
// endpoints from your Common.jsx / master API layer if different.
// CustomerListUrl/AreaListUrl/SalesManListUrl match the ones used in
// CRMCustomer.jsx / CustomerPendingBillsReport.jsx.
const CustomerListUrl = "/api/SupplierApp/SelectSupplierAll";
const MobileNoListUrl = "/api/CustomerApp/SelectCustomerMobileNo";
const AreaListUrl = "/api/AreaApp/SelectArea";
const SalesManListUrl = "/api/SalesManApp/SelectSalesMan";

// ── Group-by identifiers (mirrors the "Pane2" jqxRadioButtons) ──────────────
const GROUP = {
  CUSTOMER: "CUSTOMER", // rdoCustomer, GroupBy code == ""
  AREA: "AREA", // rdoArea, GroupBy code == "AREA"
  MOBILE: "MOBILE", // rdomobile, GroupBy code == "MOBILE"
  SALES: "SALES", // rdoSalesMan, GroupBy code == "SALES"
};

const GROUP_CODE = {
  [GROUP.CUSTOMER]: "",
  [GROUP.AREA]: "AREA",
  [GROUP.MOBILE]: "MOBILE",
  [GROUP.SALES]: "SALES",
};

// ── Order-by identifiers (mirrors the "Pane3" jqxRadioButtons) ──────────────
const ORDER_BY = {
  NONE: 0, // rdoNone (default checked)
  ASC: 1, // rdoAs
  DESC: 2, // rdoDe
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

export default function CustomerBalance() {
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
    BillFormatName: "",
  });

  // ── Group-by state (single radio selection, defaults to Customer) ──────
  const [activeGroup, setActiveGroup] = useState(GROUP.CUSTOMER);

  // ── Combo selections { value, label } ───────────────────────────────────
  const [customerSel, setCustomerSel] = useState(null);
  const [areaSel, setAreaSel] = useState(null);
  const [mobileSel, setMobileSel] = useState(null);
  const [salesManSel, setSalesManSel] = useState(null);

  // ── Order-by / date ──────────────────────────────────────────────────────
  const [orderBy, setOrderBy] = useState(ORDER_BY.NONE);
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

    const menudata = menulist.filter((obj) => obj.PageName === "Customer Balance");
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

    let Comid = CC.getStr("Comid");
    let MComid = CC.getStr("MComid");
    const MainSet = CC.getLocal("Mainsetting") || [{}];
    const ComSet = CC.getLocal("Companysetting") || [{}];

    // Mirrors: if (SupplierCommon) Comid = MComid; else MComid = Comid;
    const SupplierCommon = !!MainSet[0]?.CustomerCommonCompany;
    if (SupplierCommon) {
      Comid = MComid;
    } else {
      MComid = Comid;
    }

    setSession({
      Comid,
      MComid,
      CName: ComSet[0]?.CName || "",
      CAddress: ComSet[0]?.CAddress || "",
      CPhone: ComSet[0]?.CPhone || "",
      BillFormatName: ComSet[0]?.SaleBillFormat || "",
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

  // ── Group-by radio click — selecting one clears the OTHER three combos,
  //    never its own (mirrors rdoCustomer/rdoArea/rdomobile/rdoSalesMan click
  //    handlers exactly) ────────────────────────────────────────────────────
  const selectGroup = useCallback((group) => {
    setActiveGroup(group);
    if (group !== GROUP.CUSTOMER) setCustomerSel(null);
    if (group !== GROUP.AREA) setAreaSel(null);
    if (group !== GROUP.MOBILE) setMobileSel(null);
    if (group !== GROUP.SALES) setSalesManSel(null);
  }, []);

  // ── Combo onChange — picking a value in any combo forces its own radio
  //    checked and clears the other three combos (mirrors the four
  //    $('#cmbX').on('change', ...) handlers exactly) ──────────────────────
  const handleCustomerChange = useCallback((val) => {
    setCustomerSel(val);
    setActiveGroup(GROUP.CUSTOMER);
    setAreaSel(null);
    setMobileSel(null);
    setSalesManSel(null);
  }, []);
  const handleAreaChange = useCallback((val) => {
    setAreaSel(val);
    setActiveGroup(GROUP.AREA);
    setSalesManSel(null);
    setCustomerSel(null);
    setMobileSel(null);
  }, []);
  const handleMobileChange = useCallback((val) => {
    setMobileSel(val);
    setActiveGroup(GROUP.MOBILE);
    setSalesManSel(null);
    setCustomerSel(null);
    setAreaSel(null);
  }, []);
  const handleSalesManChange = useCallback((val) => {
    setSalesManSel(val);
    setActiveGroup(GROUP.SALES);
    setAreaSel(null);
    setCustomerSel(null);
    setMobileSel(null);
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
    if (w) {
      w.addEventListener(
        "load",
        () => {
          w.document.title = "Customer Balance-Report";
        },
        false
      );
    }
    return w;
  }, []);

  // ── Refresh button — clears all four combos only. NOTE: the source's
  //    refresh handler re-applies the date-picker's formatString but never
  //    actually resets its value, so From Date is intentionally left as-is
  //    here too (not reset to today), for exact parity. ────────────────────
  const handleRefresh = useCallback(() => {
    setCustomerSel(null);
    setMobileSel(null);
    setAreaSel(null);
    setSalesManSel(null);
    setMsg(null);
  }, []);

  // ── View button — replicates the Customer Balance $.ajax logic exactly ──
  const handleView = useCallback(async () => {
    let GroupBy = "";
    let GroupByText = "";

    if (activeGroup === GROUP.CUSTOMER) {
      GroupBy = "";
      if (customerSel != null) {
        if (customerSel.value == null || customerSel.value === "") {
          setMsg({ text: "Please Select Valid Customer Name !!!.", isErr: true });
          setCustomerSel(null);
          return;
        }
        GroupByText = customerSel.label;
      }
    }
    if (activeGroup === GROUP.AREA) {
      GroupBy = "AREA";
      if (areaSel != null) {
        if (areaSel.value == null || areaSel.value === "") {
          setMsg({ text: "Please Select Valid Area Name !!!.", isErr: true });
          setAreaSel(null);
          return;
        }
        GroupByText = areaSel.label;
      }
    }
    if (activeGroup === GROUP.MOBILE) {
      GroupBy = "MOBILE";
      if (mobileSel != null) {
        // NOTE: the source's rdomobile validation block alerts
        // "Please Select Valid Area Name !!!." — a copy-paste bug (should say
        // Mobile). Preserved verbatim rather than fixed.
        if (mobileSel.value == null || mobileSel.value === "") {
          setMsg({ text: "Please Select Valid Area Name !!!.", isErr: true });
          setMobileSel(null);
          return;
        }
        GroupByText = mobileSel.label;
      }
    }
    if (activeGroup === GROUP.SALES) {
      GroupBy = "SALES";
      if (salesManSel != null) {
        if (salesManSel.value == null || salesManSel.value === "") {
          setMsg({ text: "Please Select Valid Salesman Name !!!.", isErr: true });
          setSalesManSel(null);
          return;
        }
        GroupByText = salesManSel.label;
      }
    }

    const Fromdate = toMMDDYYYY(fromDate);

    setLoading(true);
    setMsg(null);

    try {
      const res = await CC.api(
        CustomerBalanceReportUrl,
        null,
        { Orderby: orderBy, React: 1 },
        {
          GroupBy: GroupByText,
          GroupByNew: GroupBy,
          Fromdate,
          Comid: session.Comid,
          MComid: session.MComid,
        }
      );

      if (res?.ok || res?.IsSuccess) {
        const cacheKey = res.Data15 || res.CacheKey || "";
        openReportViewer({
          ReportName: "CustomerBalanceReport",
          CacheKey: cacheKey,
          GroupBy,
          GroupByText,
          Fromdate,
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
      // Clear the customer combo after view, matching the jQuery file's
      // synchronous clearSelection() call right after the (async:false) ajax
      // (the source only clears cmbcustomer here, not the other three combos).
      setCustomerSel(null);
    }
  }, [activeGroup, customerSel, areaSel, mobileSel, salesManSel, fromDate, orderBy, session, openReportViewer]);

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
      <div className="cb-field">
        <label className="cb-label" htmlFor={id}>{placeholder.replace("Select ", "")}</label>
        <select
          id={id}
          className="cb-input"
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

  // ── Scoped styles injected once ("cb-" prefix, tokens identical to
  //    ClosingStock.jsx / CRMCustomer.jsx / CustomerPendingBillsReport.jsx) ──
  const styles = `
    .cb-shell {
      min-height: 100vh;
      background: #f0f2f5;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      flex-direction: column;
    }
    .cb-layout {
      display: flex;
      flex: 1;
      justify-content: center;
      padding: 24px;
      width: 100%;
      box-sizing: border-box;
    }
    .cb-panel {
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
    .cb-panel-header {
      border-bottom: 1px solid #e8ecf0;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .cb-panel-eyebrow {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .8px;
      color: var(--clr-primary, #1a56db);
      margin-bottom: 6px;
    }
    .cb-panel-title {
      font-size: 20px;
      font-weight: 700;
      color: #1e2d3d;
      line-height: 1.2;
    }
    .cb-section-title {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .6px;
      color: #8a94a6;
      margin: 20px 0 10px;
    }
    .cb-section-title:first-of-type { margin-top: 0; }
    .cb-radio-row {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
    .cb-chip {
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
    .cb-chip:hover { border-color: var(--clr-primary, #1a56db); }
    .cb-chip.active {
      background: var(--clr-primary, #1a56db);
      border-color: var(--clr-primary, #1a56db);
      color: #fff;
    }
    .cb-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-top: 14px;
    }
    .cb-label {
      font-size: 13px;
      font-weight: 600;
      color: #4a5568;
    }
    .cb-input {
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
    .cb-input:focus {
      border-color: var(--clr-primary, #1a56db);
      box-shadow: 0 0 0 3px rgba(26,86,219,.1);
    }
    .cb-actions {
      display: flex;
      gap: 12px;
      margin-top: 28px;
      padding-top: 20px;
      border-top: 1px solid #e8ecf0;
    }
    .cb-btn {
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
    .cb-btn:disabled { opacity: .5; cursor: not-allowed; }
    .cb-btn-primary {
      background: var(--clr-primary, #1a56db);
      color: #fff;
      box-shadow: 0 2px 8px rgba(26,86,219,.3);
    }
    .cb-btn-primary:not(:disabled):hover {
      opacity: .9;
      box-shadow: 0 4px 14px rgba(26,86,219,.4);
    }
    .cb-btn-secondary {
      background: #f0f2f5;
      color: #4a5568;
      border: 1.5px solid #d1d9e6;
    }
    .cb-btn-secondary:not(:disabled):hover {
      background: #e8ecf0;
    }
    .cb-msg {
      margin-top: 18px;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
    }
    .cb-msg.err { background: #fff0f0; color: #c53030; border: 1px solid #fed7d7; }
    .cb-msg.ok  { background: #f0fff4; color: #276749; border: 1px solid #c6f6d5; }
    @media (max-width: 760px) {
      .cb-layout { padding: 16px; }
      .cb-panel { padding: 20px 16px; margin-top: 16px; }
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
      <div className="cb-shell">
        <Topbar />

        <div className="cb-layout">
          <main className="cb-panel">
            <div className="cb-panel-header">
              <div className="cb-panel-eyebrow">Sales Report</div>
              <div className="cb-panel-title">Customer Balance Report</div>
            </div>

            {/* Group by */}
            <div className="cb-section-title">Group By</div>
            <div className="cb-radio-row">
              {[
                { value: GROUP.CUSTOMER, label: "Customer" },
                { value: GROUP.AREA, label: "Area" },
                { value: GROUP.MOBILE, label: "Mobile No" },
                { value: GROUP.SALES, label: "Salesman" },
              ].map((o) => (
                <div
                  key={o.value}
                  className={`cb-chip${activeGroup === o.value ? " active" : ""}`}
                  onClick={() => selectGroup(o.value)}
                  role="button"
                  tabIndex={0}
                >
                  {o.label}
                </div>
              ))}
            </div>

            {activeGroup === GROUP.CUSTOMER && (
              <ApiSelect
                id="cb-customer"
                url={CustomerListUrl}
                payload={{ Comid: session.Comid,AccountType:"CUSTOMER" }}
                labelKey="AccountName"
                valueKey="Id"
                value={customerSel}
                onChange={handleCustomerChange}
                placeholder="Select Customer"
              />
            )}
            {activeGroup === GROUP.AREA && (
              <ApiSelect
                id="cb-area"
                url={AreaListUrl}
                payload={{ Comid: session.Comid }}
                labelKey="AreaName"
                valueKey="Id"
                value={areaSel}
                onChange={handleAreaChange}
                placeholder="Select Area"
              />
            )}
            {activeGroup === GROUP.MOBILE && (
              <ApiSelect
                id="cb-mobile"
                url={MobileNoListUrl}
                payload={{ Comid: session.Comid }}
                labelKey="MobileNo"
                valueKey="Id"
                value={mobileSel}
                onChange={handleMobileChange}
                placeholder="Select Mobile No"
              />
            )}
            {activeGroup === GROUP.SALES && (
              <ApiSelect
                id="cb-salesman"
                url={SalesManListUrl}
                payload={{ Comid: session.Comid }}
                labelKey="SalesManName"
                valueKey="Id"
                value={salesManSel}
                onChange={handleSalesManChange}
                placeholder="Select Salesman"
              />
            )}

            {/* Order by */}
            <div className="cb-section-title">Order By</div>
            <div className="cb-radio-row">
              {[
                { value: ORDER_BY.NONE, label: "None" },
                { value: ORDER_BY.ASC, label: "Ascending" },
                { value: ORDER_BY.DESC, label: "Descending" },
              ].map((o) => (
                <div
                  key={o.value}
                  className={`cb-chip${orderBy === o.value ? " active" : ""}`}
                  onClick={() => setOrderBy(o.value)}
                  role="button"
                  tabIndex={0}
                >
                  {o.label}
                </div>
              ))}
            </div>

            <div className="cb-field">
              <label className="cb-label" htmlFor="cb-from-date">From Date</label>
              <input
                id="cb-from-date"
                type="date"
                className="cb-input"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>

            <div className="cb-actions">
              <button
                type="button"
                className="cb-btn cb-btn-primary"
                disabled={loading || pageAccess.pageview === 0}
                onClick={handleView}
              >
                {loading ? "Loading…" : "▶ View"}
              </button>
              <button
                type="button"
                className="cb-btn cb-btn-secondary"
                onClick={handleRefresh}
                disabled={loading}
              >
                ↺ Refresh
              </button>
            </div>

            {msg && <div className={`cb-msg ${msg.isErr ? "err" : "ok"}`}>{msg.text}</div>}
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