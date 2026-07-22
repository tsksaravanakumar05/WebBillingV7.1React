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

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Save, XCircle } from "lucide-react";
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

  // ── Shared combo renderer over the customer master list — same searchable
  //    dropdown pattern as CustomerList.jsx's ApiSelect, adapted to read off
  //    the already-loaded `customerList`/`customerListLoading` state instead
  //    of fetching its own list per-instance (this page's three combos —
  //    CRM No / Mobile Number / Customer Name — are all label-views over the
  //    same shared list, mirroring the original's `objClist` lookup). Native
  //    <select> replaced with a searchable popup so the user can instant-
  //    filter the list; results render through a portal into document.body,
  //    positioned with `fixed` coordinates from the trigger button's rect so
  //    they float fully visible above the card. The onChange({ value, label })
  //    contract is unchanged — only the selection UI changed.
  const CustomerSelect = ({ id, label, labelKey, value, onChange, placeholder }) => {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [popRect, setPopRect] = useState(null); // { top, left, width } for portal placement
    const wrapRef = useRef(null);
    const btnRef = useRef(null);
    const popRef = useRef(null);
    const searchRef = useRef(null);

    // Compute/refresh the popup's fixed-position coordinates from the button.
    const updatePopRect = useCallback(() => {
      if (!btnRef.current) return;
      const r = btnRef.current.getBoundingClientRect();
      setPopRect({ top: r.bottom + 6, left: r.left, width: r.width });
    }, []);

    // Close the popup on outside click — checks both the trigger wrap AND
    // the portal popup itself, since the popup no longer lives inside
    // wrapRef in the DOM tree.
    useEffect(() => {
      if (!open) return;
      const handleClick = (e) => {
        const insideTrigger = wrapRef.current && wrapRef.current.contains(e.target);
        const insidePopup = popRef.current && popRef.current.contains(e.target);
        if (!insideTrigger && !insidePopup) {
          setOpen(false);
          setQuery("");
        }
      };
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }, [open]);

    // Keep the popup glued to the button on scroll/resize while open, and
    // close it if the trigger scrolls out of the viewport entirely.
    useEffect(() => {
      if (!open) return;
      updatePopRect();
      const handleReposition = () => updatePopRect();
      window.addEventListener("scroll", handleReposition, true);
      window.addEventListener("resize", handleReposition);
      return () => {
        window.removeEventListener("scroll", handleReposition, true);
        window.removeEventListener("resize", handleReposition);
      };
    }, [open, updatePopRect]);

    // Autofocus the search box the moment the popup opens.
    useEffect(() => {
      if (open && searchRef.current) searchRef.current.focus();
    }, [open]);

    const filtered = query.trim()
      ? customerList.filter((o) =>
          String(o[labelKey] ?? "")
            .toLowerCase()
            .includes(query.trim().toLowerCase())
        )
      : customerList;

    const handleToggle = () => {
      if (customerListLoading) return;
      if (!open) updatePopRect();
      setOpen((o) => !o);
    };

    const handleSelect = (opt) => {
      onChange({ value: String(opt.Id), label: opt[labelKey] });
      setOpen(false);
      setQuery("");
    };

    const handleClear = (e) => {
      e.stopPropagation();
      onChange(null);
      setQuery("");
    };

    const popup =
      open && !customerListLoading && popRect ? (
        <div
          ref={popRef}
          className="so-select-pop so-select-pop-portal"
          style={{ top: popRect.top, left: popRect.left, width: popRect.width }}
        >
          <div className="so-select-search-wrap">
            <input
              ref={searchRef}
              type="text"
              className="so-select-search"
              placeholder={`Search ${label}...`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setOpen(false);
                  setQuery("");
                } else if (e.key === "Enter" && filtered.length === 1) {
                  handleSelect(filtered[0]);
                }
              }}
            />
          </div>
          <div className="so-select-list">
            {filtered.length === 0 ? (
              <div className="so-select-empty">No matches found</div>
            ) : (
              filtered.map((o) => (
                <div
                  key={o.Id}
                  className={`so-select-opt${
                    String(value?.value ?? "") === String(o.Id) ? " is-selected" : ""
                  }`}
                  onClick={() => handleSelect(o)}
                >
                  {o[labelKey]}
                </div>
              ))
            )}
          </div>
        </div>
      ) : null;

    return (
      <div className="so-field">
        <label className="so-label" htmlFor={id}>{label}</label>
        <div className="so-select-wrap" ref={wrapRef}>
          <button
            type="button"
            id={id}
            ref={btnRef}
            className="so-input so-select-btn"
            disabled={customerListLoading}
            onClick={handleToggle}
          >
            <span className={`so-select-btn-text${!value ? " is-placeholder" : ""}`}>
              {customerListLoading ? "Loading..." : value?.label || placeholder}
            </span>
            {value && !customerListLoading && (
              <span
                className="so-select-clear"
                onClick={handleClear}
                role="button"
                aria-label="Clear selection"
                title="Clear"
              >
                ✕
              </span>
            )}
            <span className="so-select-caret" aria-hidden="true">▾</span>
          </button>

          {popup && createPortal(popup, document.body)}
        </div>
      </div>
    );
  };

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

  // ── Recolored/restyled to match BranchWise.jsx's card design system ──────
  //   Border / header / heading : blue  #1a56db
  //   Save accent                : green #1e7e34
  //   Cancel / link accent       : red   #dc3545
  const styles = `
    .so-shell { min-height: 100vh; background: #f0f2f5; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; flex-direction: column; }
    .so-topbar { background: linear-gradient(135deg, #3b6fe0, #1a4fd1); color: #fff; display: flex; align-items: center; justify-content: space-between; padding: 0 24px; height: 52px; box-shadow: 0 2px 8px rgba(0,0,0,.18); flex-shrink: 0; }
    .so-topbar-title { font-size: 15px; font-weight: 600; letter-spacing: .3px; }
    .so-close-btn { background: rgba(255,255,255,.15); border: none; color: #fff; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; transition: background .15s; }
    .so-close-btn:hover { background: rgba(255,255,255,.28); }

    .so-layout { flex: 1; display: flex; align-items: flex-start; justify-content: center; padding: 24px; box-sizing: border-box; }
    .so-card { width: 100%; max-width: 760px; background: #fff; border: 2px solid #1a56db; border-radius: 10px; box-shadow: 0 4px 16px rgba(26,86,219,.18); overflow: hidden; }

    .so-card-header { background: linear-gradient(135deg, #3b6fe0, #1a4fd1); border-bottom: 1px solid #1a4fd1; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; }
    .so-card-header-title { font-size: 14px; font-weight: 700; color: #fff; letter-spacing: .2px; }
    .so-close-x { background: rgba(255,255,255,.15); border: none; font-size: 14px; color: #fff; cursor: pointer; line-height: 1; padding: 6px 8px; border-radius: 6px; transition: background .15s; }
    .so-close-x:hover { background: rgba(255,255,255,.28); }

    .so-card-body { padding: 24px 32px 30px; }
    .so-report-title { text-align: center; font-size: 22px; font-weight: 800; color: #1a3fd6; margin: 0 0 26px; }

    .so-section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; color: #8492a6; margin: 22px 0 10px; }
    .so-section-title:first-of-type { margin-top: 0; }

    .so-radio-row { display: flex; flex-wrap: wrap; gap: 18px; }
    .so-radio-chip { display: flex; align-items: center; gap: 8px; cursor: pointer; user-select: none; font-size: 13px; color: #2b2b2b; font-weight: 500; }
    .so-radio-dot { width: 16px; height: 16px; flex-shrink: 0; border-radius: 50%; border: 1.5px solid #c7cdd6; display: flex; align-items: center; justify-content: center; transition: border-color .15s; }
    .so-radio-chip.active .so-radio-dot { border-color: #1a56db; }
    .so-radio-chip.active .so-radio-dot::after { content: ""; width: 8px; height: 8px; border-radius: 50%; background: #1a56db; }

    .so-form-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px 18px; align-items: start; margin-top: 4px; }
    .so-field { display: flex; flex-direction: column; gap: 6px; }
    .so-label { font-size: 13px; font-weight: 600; color: #1e293b; }
    .so-input { height: 34px; border: 1px solid #c7cdd6; border-radius: 4px; padding: 0 10px; font-size: 13px; color: #1e2d3d; background: #fff; width: 100%; box-sizing: border-box; transition: border-color .15s, box-shadow .15s; outline: none; }
    .so-input:focus { border-color: #1a56db; box-shadow: 0 0 0 3px rgba(26,86,219,.15); }
    select.so-input { appearance: auto; cursor: pointer; }
    .so-input:disabled { background: #f5f6f8; cursor: not-allowed; }

    /* Searchable select (CRM No / Mobile Number / Customer Name) */
    .so-select-wrap { position: relative; width: 100%; }
    .so-select-btn { display: flex; align-items: center; gap: 8px; cursor: pointer; text-align: left; font-family: inherit; }
    .so-select-btn:disabled { cursor: not-allowed; }
    .so-select-btn-text { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .so-select-btn-text.is-placeholder { color: #8a94a3; }
    .so-select-clear { flex-shrink: 0; width: 16px; height: 16px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #8a94a3; transition: background .15s, color .15s; }
    .so-select-clear:hover { background: #fff0f0; color: #dc3545; }
    .so-select-caret { flex-shrink: 0; font-size: 10px; color: #8a94a3; }

    /* Base popup look. Positioning differs for the portal variant below. */
    .so-select-pop { position: absolute; top: calc(100% + 6px); left: 0; right: 0; z-index: 40; background: #fff; border: 1px solid #c7cdd6; border-radius: 8px; box-shadow: 0 8px 24px rgba(26,43,80,.16); overflow: hidden; }

    /* Portal variant: rendered into document.body, so it's positioned with
       fixed viewport coordinates (set inline via popRect) instead of being
       anchored relative to a parent. This is what lets the full result list
       float above the card instead of being clipped/squeezed inside it. */
    .so-select-pop-portal { position: fixed; right: auto; z-index: 3000; max-height: min(320px, calc(100vh - 24px)); display: flex; flex-direction: column; }

    .so-select-search-wrap { padding: 8px; border-bottom: 1px solid #e8ecf0; flex-shrink: 0; }
    .so-select-search { width: 100%; height: 32px; border: 1px solid #c7cdd6; border-radius: 4px; padding: 0 10px; font-size: 13px; color: #1e2d3d; box-sizing: border-box; outline: none; transition: border-color .15s, box-shadow .15s; }
    .so-select-search:focus { border-color: #1a56db; box-shadow: 0 0 0 3px rgba(26,86,219,.15); }
    .so-select-list { max-height: 260px; overflow-y: auto; }
    .so-select-pop-portal .so-select-list { max-height: none; overflow-y: auto; flex: 1; }
    .so-select-opt { padding: 8px 12px; font-size: 13px; color: #1e2d3d; cursor: pointer; transition: background .12s; }
    .so-select-opt:hover { background: #eef3ff; }
    .so-select-opt.is-selected { background: #e3ecff; color: #1a4fd1; font-weight: 600; }
    .so-select-empty { padding: 14px 12px; font-size: 13px; color: #8a94a3; text-align: center; }

    .so-actions { display: flex; gap: 12px; justify-content: center; margin-top: 32px; padding-top: 22px; border-top: 1px solid #e8ecf0; }
    .so-btn { height: 38px; padding: 0 30px; border-radius: 6px; border: 1px solid #1a56db; font-size: 14px; font-weight: 700; cursor: pointer; transition: opacity .15s, box-shadow .15s, background .15s; display: flex; align-items: center; gap: 8px; background: #fff; color: #1a56db; }
    .so-btn:disabled { opacity: .5; cursor: not-allowed; }
    .so-btn:not(:disabled):hover { background: #eef3ff; }
    .so-btn-primary { border-color: #1e7e34; color: #1e7e34; }
    .so-btn-primary .so-icon-save { color: #1e7e34; }
    .so-btn-secondary { border-color: #dc3545; color: #dc3545; }
    .so-btn-secondary .so-icon-cancel { color: #dc3545; }

    .so-msg { margin-top: 18px; padding: 10px 14px; border-radius: 8px; font-size: 13px; font-weight: 500; text-align: center; }
    .so-msg.err { background: #fff0f0; color: #c53030; border: 1px solid #fed7d7; }
    .so-msg.ok  { background: #f0fff4; color: #276749; border: 1px solid #c6f6d5; }

    @media (max-width: 620px) {
      .so-card-body { padding: 20px; }
      .so-form-grid { grid-template-columns: 1fr; }
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
      <div className="so-shell">
        <Topbar />

        <div className="so-layout">
          <div className="so-card">
            <div className="so-card-header">
              <div className="so-card-header-title">CRM Customer</div>
              <button type="button" className="so-close-x" aria-label="Close" onClick={() => navigate(-1)}>✕</button>
            </div>

            <div className="so-card-body">
              <div className="so-report-title">CRM Customer</div>

              {/* Report type (Pane1) */}
              <div className="so-section-title">Report Type</div>
              <div className="so-radio-row">
                {reportTypeChips.map((o) => (
                  <div
                    key={o.value}
                    className={`so-radio-chip${reportType === o.value ? " active" : ""}`}
                    onClick={() => handleReportTypeClick(o.value)}
                    role="button"
                    tabIndex={0}
                  >
                    <span className="so-radio-dot" aria-hidden="true" />
                    {o.label}
                  </div>
                ))}
              </div>

              {/* Lookup by (Pane2) */}
              <div className="so-section-title">Lookup By</div>
              <div className="so-radio-row">
                {lookupByChips.map((o) => (
                  <div
                    key={o.value}
                    className={`so-radio-chip${lookupBy === o.value ? " active" : ""}`}
                    onClick={() => handleLookupByClick(o.value)}
                    role="button"
                    tabIndex={0}
                  >
                    <span className="so-radio-dot" aria-hidden="true" />
                    {o.label}
                  </div>
                ))}
              </div>

              {/* Combo bound to the active Lookup By selection */}
              <div className="so-form-grid">
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
                    <div className="so-field">
                      <label className="so-label" htmlFor="cc-from-date">From Date</label>
                      <input id="cc-from-date" type="date" className="so-input" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                    </div>
                    <div className="so-field">
                      <label className="so-label" htmlFor="cc-to-date">To Date</label>
                      <input id="cc-to-date" type="date" className="so-input" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                    </div>
                  </>
                )}
                {panelMode === "TILL" && (
                  <div className="so-field">
                    <label className="so-label" htmlFor="cc-till-date">Till Date</label>
                    <input id="cc-till-date" type="date" className="so-input" value={tillDate} onChange={(e) => setTillDate(e.target.value)} />
                  </div>
                )}
              </div>

              <div className="so-actions">
                <button
                  type="button"
                  className="so-btn so-btn-primary"
                  disabled={loading || pageAccess.pageview === 0}
                  onClick={handleView}
                >
                  <Save size={16} className="so-icon-save" />
                  {loading ? "Loading…" : "View"}
                </button>
                <button
                  type="button"
                  className="so-btn so-btn-secondary"
                  onClick={handleRefresh}
                  disabled={loading}
                >
                  <XCircle size={16} className="so-icon-cancel" />
                  Refresh
                </button>
              </div>

              {msg && <div className={`so-msg ${msg.isErr ? "err" : "ok"}`}>{msg.text}</div>}
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