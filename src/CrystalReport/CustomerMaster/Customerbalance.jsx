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
//  Styling: matches BranchWise.jsx design system exactly (card, header,
//  radio rows, field rows, buttons, palette). Only visuals/layout were
//  changed here — all business logic, state, handlers, and API calls are
//  100% unchanged from the original. The source page's chip-style Group-By
//  / Order-By selectors are now rendered as BranchWise's plain radio rows,
//  and the whole form lives in a single centered field column (no left nav)
//  since there's no report-type sidebar here.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Save, XCircle } from "lucide-react";
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

  // ── Scoped styles injected once ─────────────────────────────────────────
  // Design system copied 1:1 from BranchWise.jsx (card, header, radio rows,
  // field rows, buttons, palette), "cb-" prefix preserved. The source's
  // chip-style Group-By / Order-By selectors are now BranchWise's plain
  // radio rows; the whole form uses a single centered field column since
  // this page has no report-type sidebar.
  //   Border / header / heading : blue  #1a56db
  //   Save accent                : green #1e7e34
  //   Cancel / link accent       : red   #dc3545
  const styles = `
    .cb-shell { min-height: 100vh; background: #f0f2f5; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; flex-direction: column; }
    .cb-layout { flex: 1; display: flex; align-items: flex-start; justify-content: center; padding: 24px; box-sizing: border-box; }
    .cb-panel { width: 100%; max-width: 560px; background: #fff; border: 2px solid #1a56db; border-radius: 10px; box-shadow: 0 4px 16px rgba(26,86,219,.18); overflow: hidden; }

    .cb-card-header { background: linear-gradient(135deg, #3b6fe0, #1a4fd1); border-bottom: 1px solid #1a4fd1; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; }
    .cb-card-header-title { font-size: 14px; font-weight: 700; color: #fff; letter-spacing: .2px; }
    .cb-close-x { background: rgba(255,255,255,.15); border: none; font-size: 14px; color: #fff; cursor: pointer; line-height: 1; padding: 6px 8px; border-radius: 6px; transition: background .15s; }
    .cb-close-x:hover { background: rgba(255,255,255,.28); }

    .cb-panel-body { padding: 24px 32px 30px; }
    .cb-panel-title { text-align: center; font-size: 22px; font-weight: 800; color: #1a3fd6; margin: 0 0 26px; }

    .cb-section-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .6px; color: #8a94a6; margin: 20px 0 10px; }
    .cb-section-title:first-of-type { margin-top: 0; }

    .cb-radio-row { display: flex; flex-wrap: wrap; gap: 10px 20px; }
    .cb-chip { display: flex; align-items: center; gap: 8px; cursor: pointer; user-select: none; font-size: 13px; color: #2b2b2b; font-weight: 500; }
    .cb-chip input[type="radio"] { width: 16px; height: 16px; accent-color: #1a56db; cursor: pointer; flex-shrink: 0; }

    .cb-field { display: flex; align-items: center; gap: 14px; margin-top: 16px; }
    .cb-label { font-size: 13px; font-weight: 600; color: #1e293b; width: 96px; flex-shrink: 0; }
    .cb-input { height: 34px; border: 1px solid #c7cdd6; border-radius: 4px; padding: 0 10px; font-size: 13px; color: #1e2d3d; background: #fff; width: 100%; box-sizing: border-box; transition: border-color .15s, box-shadow .15s; outline: none; }
    .cb-input:focus { border-color: #1a56db; box-shadow: 0 0 0 3px rgba(26,86,219,.15); }
    select.cb-input { appearance: auto; cursor: pointer; }

    .cb-actions { display: flex; gap: 12px; justify-content: center; margin-top: 32px; padding-top: 22px; border-top: 1px solid #e8ecf0; }
    .cb-btn { height: 38px; padding: 0 30px; border-radius: 6px; border: 1px solid #1a56db; font-size: 14px; font-weight: 700; cursor: pointer; transition: opacity .15s, box-shadow .15s, background .15s; display: flex; align-items: center; gap: 8px; background: #fff; color: #1a56db; }
    .cb-btn:disabled { opacity: .5; cursor: not-allowed; }
    .cb-btn:not(:disabled):hover { background: #eef3ff; }
    .cb-btn-primary { border-color: #1e7e34; color: #1e7e34; }
    .cb-btn-primary .cb-icon-save { color: #1e7e34; }
    .cb-btn-secondary { border-color: #dc3545; color: #dc3545; }
    .cb-btn-secondary .cb-icon-cancel { color: #dc3545; }

    .cb-msg { margin-top: 18px; padding: 10px 14px; border-radius: 8px; font-size: 13px; font-weight: 500; text-align: center; }
    .cb-msg.err { background: #fff0f0; color: #c53030; border: 1px solid #fed7d7; }
    .cb-msg.ok  { background: #f0fff4; color: #276749; border: 1px solid #c6f6d5; }

    @media (max-width: 620px) {
      .cb-panel-body { padding: 20px; }
      .cb-field { flex-direction: column; align-items: stretch; gap: 6px; }
      .cb-label { width: auto; }
    }
  `;

  if (!pageAccess.ready) {
    return (
      <>
        <style>{styles}</style>
        <div className="cb-shell">
          <Topbar />
          <div className="cb-layout">
            <div className="cb-panel">
              <div className="cb-panel-body">
                {msg && <div className={`cb-msg ${msg.isErr ? "err" : "ok"}`}>{msg.text}</div>}
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (!pageAccess.allowed) {
    return (
      <>
        <style>{styles}</style>
        <div className="cb-shell">
          <Topbar />
          <div className="cb-layout">
            <div className="cb-panel">
              <div className="cb-panel-body">
                <div className="cb-msg err">Page Access Permission Denied !!!.</div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{styles}</style>
      <div className="cb-shell">
        <Topbar />

        <div className="cb-layout">
          <div className="cb-panel">
            <div className="cb-card-header">
              <div className="cb-card-header-title">Sales Report</div>
              <button type="button" className="cb-close-x" aria-label="Close" onClick={() => navigate(-1)}>✕</button>
            </div>

            <div className="cb-panel-body">
              <div className="cb-panel-title">Customer Balance Report</div>

              {/* Group by */}
              <div className="cb-section-title">Group By</div>
              <div className="cb-radio-row">
                {[
                  { value: GROUP.CUSTOMER, label: "Customer" },
                  { value: GROUP.AREA, label: "Area" },
                  { value: GROUP.MOBILE, label: "Mobile No" },
                  { value: GROUP.SALES, label: "Salesman" },
                ].map((o) => (
                  <label key={o.value} className="cb-chip">
                    <input
                      type="radio"
                      name="cb-group-by"
                      checked={activeGroup === o.value}
                      onChange={() => selectGroup(o.value)}
                    />
                    {o.label}
                  </label>
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
                  <label key={o.value} className="cb-chip">
                    <input
                      type="radio"
                      name="cb-order-by"
                      checked={orderBy === o.value}
                      onChange={() => setOrderBy(o.value)}
                    />
                    {o.label}
                  </label>
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
                  <Save size={16} className="cb-icon-save" />
                  {loading ? "Loading…" : "View"}
                </button>
                <button
                  type="button"
                  className="cb-btn cb-btn-secondary"
                  onClick={handleRefresh}
                  disabled={loading}
                >
                  <XCircle size={16} className="cb-icon-cancel" />
                  Refresh
                </button>
              </div>

              {msg && <div className={`cb-msg ${msg.isErr ? "err" : "ok"}`}>{msg.text}</div>}
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