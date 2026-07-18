// ─────────────────────────────────────────────────────────────────────────────
//  CRMCustomer.jsx
//  React conversion of the "CRM Customer" jQuery/jqxWidgets page.
//  Built on the same skeleton as ClosingStock.jsx / CustomerAgingReport.jsx:
//    - CC.api / CC.getLocal / CC.getStr from Common.jsx
//    - same permission/session bootstrap pattern
//    - same openReportViewer(BASE_URL + /Reports/ReportViewer.aspx) pattern
//  Layout: single panel with two chip-groups (Report Type / Lookup By),
//  same tokens as ClosingStock's Stock Type / Rate Type chip rows — scoped
//  "cc-" (unused by any other converted page: cs-/iq-/iw-/ca- are taken).
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import * as CC from "../../components/Common";
import Topbar from "../../components/Topbar";

const BASE_URL = "http://localhost:64215";

// ── API endpoints ───────────────────────────────────────────────────────────
// NOTE: original ASMX-style paths were all under "/SalesReport/...". Following
// the same module-inference convention used for CustomerAgingReport.jsx
// ("/SalesReport/CustomerAgingReport" -> "/api/SalesReportApp/CustomerAgingReport"),
// these become:
const CrmStmtReportUrl = "/api/SalesReportApp/CRMStmtReport";
const CrmBalanceReportUrl = "/api/SalesReportApp/CRMBalanceReport";
const TopCustomerSaleAmountUrl = "/api/SalesReportApp/TopCustomerSaleAmount";

// NOTE: the original file loads three separate combos — CustomerComboListSingle,
// CustomerComboListSingleMobileNo, CRMNoCombo — all against "CUSTOMER" type, and
// then looks records up by shared "Id" in a global `objClist` array (see the
// CRM Statement branch: `objClist.filter(obj => obj.Id == GroupByText)`). This
// strongly suggests all three combos are just different label-views over the
// same underlying customer master list. This conversion fetches that list once
// (reusing the CustomerAgingReport.jsx endpoint guess) and renders three
// <select>s off of it with different label fields — please verify against the
// real endpoint(s) behind those three helpers.
const CustomerListUrl = "/api/SupplierApp/SelectSupplierAll";

// ── Report-type identifiers (Pane1) ─────────────────────────────────────────
const REPORT_TYPE = {
  CRM_STATEMENT: "CRM_STATEMENT",
  CRM_BALANCE: "CRM_BALANCE",
  TOP_CUSTOMER: "TOP_CUSTOMER",
};

// ── Lookup-by identifiers (Pane2) ───────────────────────────────────────────
const LOOKUP_BY = {
  CRMNO: "CRMNO",
  MOBILE: "MOBILE",
  CUSTOMER: "CUSTOMER",
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

export default function CRMCustomer() {
  const navigate = useNavigate();

  // ── Session / permission state ─────────────────────────────────────────
  const [pageAccess, setPageAccess] = useState({
    ready: false,
    allowed: false,
    pageview: 0,
  });

  // ── Company / settings state ────────────────────────────────────────────
  const [session, setSession] = useState({
    Comid: "",
    MComid: "",
    CName: "",
    CAddress: "",
    CPhone: "",
    CustomerCommon: 0,
  });

  // ── Shared customer master list (backs all three combos + the CRM
  //    Statement Id -> CustName/CRMNo lookup, mirrors global `objClist`) ──
  const [customerList, setCustomerList] = useState([]);
  const [customerListLoading, setCustomerListLoading] = useState(false);

  // ── Report type (Pane1) — default matches the original's initial state:
  //    rdbCRMStatement is set checked at load, PanelTill hidden. ───────────
  const [reportType, setReportType] = useState(REPORT_TYPE.CRM_STATEMENT);
  // Which date panel is visible. Only the CRM Statement / CRM Balance radio
  // clicks toggle this in the original file — clicking Top Customer leaves
  // it exactly as it was, so this is tracked separately from reportType.
  const [panelMode, setPanelMode] = useState("DATE"); // "DATE" | "TILL"

  // ── Lookup-by (Pane2) ────────────────────────────────────────────────────
  // NOTE: the original file initializes BOTH #rdbCRMNo and #rdbmobileNumber
  // with `checked: true` in the same "Pane2" radio group (likely a copy-paste
  // bug), so the true initial default is ambiguous from the source alone.
  // Every reset path in the file (refresh, and clicking CRM Statement / CRM
  // Balance) explicitly re-checks #rdbCRMNo, so CRMNO is used here as the
  // canonical default — please confirm against the live page's actual
  // on-load behavior.
  const [lookupBy, setLookupBy] = useState(LOOKUP_BY.CRMNO);

  // ── Combo selections { value, label } — value is the shared customer Id ─
  const [customerSel, setCustomerSel] = useState(null);
  const [crmNoSel, setCrmNoSel] = useState(null);
  const [mobileSel, setMobileSel] = useState(null);

  // ── Dates ─────────────────────────────────────────────────────────────
  const [fromDate, setFromDate] = useState(todayStr());
  const [toDate, setToDate] = useState(todayStr());
  const [tillDate, setTillDate] = useState(todayStr());

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

    const menudata = menulist.filter((obj) => obj.PageName === "CRM Customer");
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
    const SupplierCommon = !!MainSet[0]?.CustomerCommonCompany;
    let CustomerCommon = 0;

    // Mirrors: if (MComid != 62) { if (SupplierCommon) {...} else {...} }
    if (Number(MComid) !== 62) {
      if (SupplierCommon) {
        Comid = MComid;
        CustomerCommon = 1;
      } else {
        MComid = Comid;
      }
    }

    setSession({
      Comid,
      MComid,
      CName: ComSet[0]?.CName || "",
      CAddress: ComSet[0]?.CAddress || "",
      CPhone: ComSet[0]?.CPhone || "",
      CustomerCommon,
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

  // ── Load the shared customer master list once access is granted ────────
  useEffect(() => {
    if (!pageAccess.ready || !pageAccess.allowed) return;
    let active = true;
    (async () => {
      setCustomerListLoading(true);
      try {
        const res = await CC.api(CustomerListUrl, null, {}, { Comid: session.Comid, AccountType: "CUSTOMER" });
        if (!active) return;
        const raw = Array.isArray(res?.data) ? res.data : Array.isArray(res?.Data1) ? res.Data1 : Array.isArray(res) ? res : [];
        setCustomerList(raw);
      } catch (err) {
        console.error(err);
      } finally {
        if (active) setCustomerListLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [pageAccess.ready, pageAccess.allowed, session.Comid]);

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

  // ── Clear all three combo selections — mirrors the repeated jQuery calls ─
  const clearAllCombos = useCallback(() => {
    setCustomerSel(null);
    setCrmNoSel(null);
    setMobileSel(null);
  }, []);

  // ── Pane1 (report type) chip clicks ─────────────────────────────────────
  // Mirrors: rdbCRMStatement / rdbcrmcustomerbalance click handlers (clear all
  // combos, force Lookup-By back to CRMNO, toggle the date/till panel).
  // rdbtopcustomer has NO click handler in the original — selecting it leaves
  // combos, lookupBy, and panelMode completely untouched.
  const handleReportTypeClick = useCallback((value) => {
    setReportType(value);
    if (value === REPORT_TYPE.CRM_STATEMENT) {
      clearAllCombos();
      setLookupBy(LOOKUP_BY.CRMNO);
      setPanelMode("DATE");
    } else if (value === REPORT_TYPE.CRM_BALANCE) {
      clearAllCombos();
      setLookupBy(LOOKUP_BY.CRMNO);
      setPanelMode("TILL");
    }
    // TOP_CUSTOMER: no side effects, matching the source.
  }, [clearAllCombos]);

  // ── Pane2 (lookup by) chip clicks ───────────────────────────────────────
  // Mirrors: rdbCRMNo / rdbCustomerName click handlers clear all combos.
  // rdbmobileNumber has NO click handler in the original — selecting Mobile
  // does not clear the combos.
  const handleLookupByClick = useCallback((value) => {
    setLookupBy(value);
    if (value === LOOKUP_BY.CRMNO || value === LOOKUP_BY.CUSTOMER) {
      clearAllCombos();
    }
  }, [clearAllCombos]);

  // ── Refresh button ───────────────────────────────────────────────────────
  const handleRefresh = useCallback(() => {
    clearAllCombos();
    setFromDate(todayStr());
    setToDate(todayStr());
    setTillDate(todayStr());
    setLookupBy(LOOKUP_BY.CRMNO);
    setMsg(null);
  }, [clearAllCombos]);

  // ── View button — replicates the CRM Customer $.ajax logic exactly ─────
  const handleView = useCallback(async () => {
    let GroupBy = "";
    let GroupByText = "0";

    if (lookupBy === LOOKUP_BY.CUSTOMER) {
      GroupBy = "CUSTOMER";
      if (customerSel != null) {
        if (customerSel.value == null || customerSel.value === "") {
          setMsg({ text: "Please Select Valid Customer Name !!!.", isErr: true });
          setCustomerSel(null);
          return;
        }
        GroupByText = customerSel.value;
      } else if (reportType === REPORT_TYPE.CRM_STATEMENT) {
        setMsg({ text: "Please Select  Customer Name !!!.", isErr: true });
        setCustomerSel(null);
        return;
      }
    }

    if (lookupBy === LOOKUP_BY.CRMNO) {
      GroupBy = "CRMNO";
      if (crmNoSel != null) {
        if (crmNoSel.value == null || crmNoSel.value === "") {
          setMsg({ text: "Please Select Valid CRMNO Name !!!.", isErr: true });
          setCrmNoSel(null);
          return;
        }
        GroupByText = crmNoSel.value;
      } else if (reportType === REPORT_TYPE.CRM_STATEMENT) {
        setMsg({ text: "Please Select  CRMNO Name !!!.", isErr: true });
        setCrmNoSel(null);
        return;
      }
    }

    if (lookupBy === LOOKUP_BY.MOBILE) {
      GroupBy = "MOBILE";
      if (mobileSel != null) {
        if (mobileSel.value == null || mobileSel.value === "") {
          setMsg({ text: "Please Select Valid Mobile Number !!!.", isErr: true });
          setMobileSel(null);
          return;
        }
        GroupByText = mobileSel.value;
      } else if (reportType === REPORT_TYPE.CRM_STATEMENT) {
        setMsg({ text: "Please Select  MOBILE Number !!!.", isErr: true });
        setMobileSel(null);
        return;
      }
    }

    const Fromdate = toMMDDYYYY(fromDate);
    const Todate = toMMDDYYYY(toDate);
    const Tilldate = toMMDDYYYY(tillDate);
    const { Comid, MComid, CustomerCommon, CName, CAddress, CPhone } = session;

    setLoading(true);
    setMsg(null);

    try {
      if (reportType === REPORT_TYPE.CRM_STATEMENT) {
        const match = customerList.find((o) => String(o.Id) === String(GroupByText));
        const CustName = match?.AccountName || "";
        const CRMNo = match?.CRMNO || "";
        const ReportTitle = "CRM Statement Report";

        const res = await CC.api(
          CrmStmtReportUrl,
          null,
          { CommonBalance: CustomerCommon, CacheKeyType: "CRMStmtReport", React: 1 },
          { Id: GroupByText, Fromdate, Todate, Comid, MComid }
        );

        if (res?.ok || res?.IsSuccess) {
          const cacheKey = res.Data15 || res.CacheKey || "";
          openReportViewer(
            {
              ReportName: "CRMStateMentReport",
              ReportTitle,
              ReportType: "",
              Fromdate,
              Todate,
              CustName,
              CRMNo,
              CacheKey: cacheKey,
              CName,
              CAddress,
              CPhone,
            },
            "CRM Statement Report"
          );
        } else {
          setMsg({ text: "No Record !!!.", isErr: true });
        }
      } else if (reportType === REPORT_TYPE.CRM_BALANCE) {
        const ReportTitle = "CRM Customer Balance Report";

        const res = await CC.api(
          CrmBalanceReportUrl,
          null,
          { CommonBalance: CustomerCommon, CacheKeyType: "CRMBalanceReport", React: 1 },
          { Id: GroupByText, Fromdate: Tilldate, Comid, MComid }
        );

        if (res?.ok || res?.IsSuccess) {
          const cacheKey = res.Data15 || res.CacheKey || "";
          openReportViewer(
            {
              ReportName: "CRMCustomerBalanceConsolidatedReport",
              ReportTitle,
              ReportType: "",
              Fromdate: Tilldate,
              CacheKey: cacheKey,
              CName,
              CAddress,
              CPhone,
            },
            "CRM Customer Balance Report"
          );
        } else {
          setMsg({ text: "No Record !!!.", isErr: true });
        }
      } else if (reportType === REPORT_TYPE.TOP_CUSTOMER) {
        const ReportTitle = "Top Customer Sales Report";

        const res = await CC.api(
          TopCustomerSaleAmountUrl,
          null,
          { CacheKeyType: "TopCustomerSaleAmount", React: 1 },
          { Fromdate, Todate, Comid, MComid }
        );

        if (res?.ok || res?.IsSuccess) {
          const cacheKey = res.Data15 || res.CacheKey || "";
          openReportViewer(
            {
              // NOTE: the original file sends Fromdate=Tilldate for this
              // report's query string (likely a copy-paste bug from the
              // Balance branch above it) — preserved as-is.
              ReportName: "TopCustomerSaleAmount",
              ReportTitle,
              ReportType: "",
              Fromdate: Tilldate,
              CacheKey: cacheKey,
              CName,
              CAddress,
              CPhone,
            },
            "Top Customer Sales Report"
          );
        } else {
          setMsg({ text: "No Record !!!.", isErr: true });
        }
      }
    } catch (err) {
      setMsg({ text: err.message || "Something went wrong.", isErr: true });
    } finally {
      setLoading(false);
      // Matches the original: only customer & CRMNo combos are cleared after
      // View — the mobile combo is left as-is.
      setCustomerSel(null);
      setCrmNoSel(null);
    }
  }, [lookupBy, reportType, customerSel, crmNoSel, mobileSel, fromDate, toDate, tillDate, session, customerList, openReportViewer]);

  // ── Shared <select> renderer over the customer master list ─────────────
  const CustomerSelect = ({ id, label, labelKey, value, onChange, placeholder }) => (
    <div className="cc-field">
      <label className="cc-label" htmlFor={id}>{label}</label>
      <select
        id={id}
        className="cc-input"
        value={value?.value ?? ""}
        disabled={customerListLoading}
        onChange={(e) => {
          const selectedVal = e.target.value;
          const opt = customerList.find((o) => String(o.Id) === selectedVal);
          if (opt) {
            onChange({ value: String(opt.Id), label: opt[labelKey] });
          } else {
            onChange(null);
          }
        }}
      >
        <option value="">{customerListLoading ? "Loading..." : placeholder}</option>
        {customerList.map((o) => (
          <option key={o.Id} value={o.Id}>
            {o[labelKey]}
          </option>
        ))}
      </select>
    </div>
  );

  const reportTypeChips = useMemo(
    () => [
      { value: REPORT_TYPE.CRM_STATEMENT, label: "CRM Statement" },
      { value: REPORT_TYPE.CRM_BALANCE, label: "CRM Customer Balance" },
      { value: REPORT_TYPE.TOP_CUSTOMER, label: "Top Customer" },
    ],
    []
  );

  const lookupByChips = useMemo(
    () => [
      { value: LOOKUP_BY.CRMNO, label: "CRM No" },
      { value: LOOKUP_BY.MOBILE, label: "Mobile Number" },
      { value: LOOKUP_BY.CUSTOMER, label: "Customer Name" },
    ],
    []
  );

  // ── Scoped styles injected once (same tokens as ClosingStock.jsx, "cc-" prefix) ──
  const styles = `
    .cc-shell {
      min-height: 100vh;
      background: #f0f2f5;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      flex-direction: column;
    }
    .cc-layout {
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
    .cc-panel {
      width: 100%;
      max-width: 720px;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 2px 12px rgba(0,0,0,.08);
      padding: 28px 32px;
      display: flex;
      flex-direction: column;
    }
    .cc-panel-header {
      border-bottom: 1px solid #e8ecf0;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .cc-panel-eyebrow {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .8px;
      color: var(--clr-primary, #1a56db);
      margin-bottom: 6px;
    }
    .cc-panel-title {
      font-size: 20px;
      font-weight: 700;
      color: #1e2d3d;
      line-height: 1.2;
    }
    .cc-section-title {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .6px;
      color: #8a94a6;
      margin: 20px 0 10px;
    }
    .cc-section-title:first-of-type { margin-top: 0; }
    .cc-radio-row {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
    .cc-chip {
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
    .cc-chip:hover { border-color: var(--clr-primary, #1a56db); }
    .cc-chip.active {
      background: var(--clr-primary, #1a56db);
      border-color: var(--clr-primary, #1a56db);
      color: #fff;
    }
    .cc-form-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 16px 20px;
      align-items: start;
      max-width: 100%;
      margin-top: 10px;
      margin-bottom: 8px;
    }
    .cc-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .cc-label {
      font-size: 13px;
      font-weight: 600;
      color: #4a5568;
    }
    .cc-input {
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
    .cc-input:focus {
      border-color: var(--clr-primary, #1a56db);
      box-shadow: 0 0 0 3px rgba(26,86,219,.1);
    }
    .cc-actions {
      display: flex;
      gap: 12px;
      margin-top: 28px;
      padding-top: 20px;
      border-top: 1px solid #e8ecf0;
    }
    .cc-btn {
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
    .cc-btn:disabled { opacity: .5; cursor: not-allowed; }
    .cc-btn-primary {
      background: var(--clr-primary, #1a56db);
      color: #fff;
      box-shadow: 0 2px 8px rgba(26,86,219,.3);
    }
    .cc-btn-primary:not(:disabled):hover {
      opacity: .9;
      box-shadow: 0 4px 14px rgba(26,86,219,.4);
    }
    .cc-btn-secondary {
      background: #f0f2f5;
      color: #4a5568;
      border: 1.5px solid #d1d9e6;
    }
    .cc-btn-secondary:not(:disabled):hover {
      background: #e8ecf0;
    }
    .cc-msg {
      margin-top: 18px;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
    }
    .cc-msg.err { background: #fff0f0; color: #c53030; border: 1px solid #fed7d7; }
    .cc-msg.ok  { background: #f0fff4; color: #276749; border: 1px solid #c6f6d5; }
    @media (max-width: 760px) {
      .cc-layout { padding: 16px; }
      .cc-panel { padding: 20px 16px; }
      .cc-form-grid { grid-template-columns: 1fr; }
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
      <div className="cc-shell">
        <Topbar />

        <div className="cc-layout">
          <main className="cc-panel">
            <div className="cc-panel-header">
              <div className="cc-panel-eyebrow">Sales</div>
              <div className="cc-panel-title">CRM Customer</div>
            </div>

            {/* Report type (Pane1) */}
            <div className="cc-section-title">Report Type</div>
            <div className="cc-radio-row">
              {reportTypeChips.map((o) => (
                <div
                  key={o.value}
                  className={`cc-chip${reportType === o.value ? " active" : ""}`}
                  onClick={() => handleReportTypeClick(o.value)}
                  role="button"
                  tabIndex={0}
                >
                  {o.label}
                </div>
              ))}
            </div>

            {/* Lookup by (Pane2) */}
            <div className="cc-section-title">Lookup By</div>
            <div className="cc-radio-row">
              {lookupByChips.map((o) => (
                <div
                  key={o.value}
                  className={`cc-chip${lookupBy === o.value ? " active" : ""}`}
                  onClick={() => handleLookupByClick(o.value)}
                  role="button"
                  tabIndex={0}
                >
                  {o.label}
                </div>
              ))}
            </div>

            {/* Combo bound to the active Lookup By selection */}
            <div className="cc-form-grid">
              {lookupBy === LOOKUP_BY.CRMNO && (
                <CustomerSelect id="cc-crmno" label="CRM No" labelKey="CRMNO" value={crmNoSel} onChange={setCrmNoSel} placeholder="Select CRM No" />
              )}
              {lookupBy === LOOKUP_BY.MOBILE && (
                <CustomerSelect id="cc-mobile" label="Mobile Number" labelKey="MobileNo" value={mobileSel} onChange={(v) => { setMobileSel(v); setCrmNoSel(null); }} placeholder="Select Mobile Number" />
              )}
              {lookupBy === LOOKUP_BY.CUSTOMER && (
                <CustomerSelect id="cc-customer" label="Customer Name" labelKey="AccountName" value={customerSel} onChange={setCustomerSel} placeholder="Select Customer Name" />
              )}

              {panelMode === "DATE" && (
                <>
                  <div className="cc-field">
                    <label className="cc-label" htmlFor="cc-from-date">From Date</label>
                    <input id="cc-from-date" type="date" className="cc-input" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                  </div>
                  <div className="cc-field">
                    <label className="cc-label" htmlFor="cc-to-date">To Date</label>
                    <input id="cc-to-date" type="date" className="cc-input" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                  </div>
                </>
              )}
              {panelMode === "TILL" && (
                <div className="cc-field">
                  <label className="cc-label" htmlFor="cc-till-date">Till Date</label>
                  <input id="cc-till-date" type="date" className="cc-input" value={tillDate} onChange={(e) => setTillDate(e.target.value)} />
                </div>
              )}
            </div>

            <div className="cc-actions">
              <button
                type="button"
                className="cc-btn cc-btn-primary"
                disabled={loading || pageAccess.pageview === 0}
                onClick={handleView}
              >
                {loading ? "Loading…" : "▶ View"}
              </button>
              <button
                type="button"
                className="cc-btn cc-btn-secondary"
                onClick={handleRefresh}
                disabled={loading}
              >
                ↺ Refresh
              </button>
            </div>

            {msg && <div className={`cc-msg ${msg.isErr ? "err" : "ok"}`}>{msg.text}</div>}
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