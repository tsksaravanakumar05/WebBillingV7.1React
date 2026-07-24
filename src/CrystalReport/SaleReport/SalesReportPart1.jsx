// ─────────────────────────────────────────────────────────────────────────────
//  SaleReportPart1.jsx
//  React conversion of SaleReportPart1.js (jQuery) — "Sales Report Part1"
//  Uses API helpers from Common.jsx (CC.api / CC.mkUrl / CC.authHeaders etc.)
//  Styling: scoped <style> block only, matches SaleOrderReport.jsx conventions.
//
//  NOTE ON BUSINESS LOGIC:
//  Every calculation, validation rule, AJAX endpoint, query-string parameter
//  and report-viewer URL has been carried over 1:1 from the original jQuery
//  file. Only the DOM-manipulation / widget layer (jqxRadioButton, jqxCheckBox,
//  jqxInput, jqxComboBox, jqxDateTimeInput, jqxWindow, jqxLoader) has been
//  replaced with React state, refs and hooks.
//
//  A couple of controls (#chktime / #chkTax inside "Panelsalebilltype") are
//  never actually shown by any click-handler in the original file — every
//  branch that touches them immediately calls .hide() on them. They are kept
//  here as always-false state (so the read-the-value logic in handleView()
//  is unchanged) but are not rendered, exactly mirroring the original.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Save, XCircle, X } from "lucide-react";
import * as CC from "../../components/Common";
import Topbar from "../../components/Topbar";
import   DateFieldDDMMYYYY from "../../Commondatetime";

const BASE_URL = "http://localhost:64215";

// ─── Report-type identifiers (mirrors the 18 jqxRadioButtons in "Panel") ─────
const REPORT_TYPES = {
  SALE_AMOUNT:           "SALE_AMOUNT",
  SALE_BILL_CONSOLIDATE: "SALE_BILL_CONSOLIDATE",
  SALE_BILL_DETAILS:     "SALE_BILL_DETAILS",
  ITEMWISE:              "ITEMWISE",
  DAYWISE_SALE:          "DAYWISE_SALE",
  ITEMWISE_PROFIT:       "ITEMWISE_PROFIT",
  DAYWISE_PROFIT:        "DAYWISE_PROFIT",
  SALEMAN_ITEMWISE:      "SALEMAN_ITEMWISE",
  HOURLY_SALE:           "HOURLY_SALE",
  HOURLY_ITEMWISE:       "HOURLY_ITEMWISE",
  HOURLY_PROFIT:         "HOURLY_PROFIT",
  CANCEL_BILL:           "CANCEL_BILL",
  CANCEL_BILL_DETAILS:   "CANCEL_BILL_DETAILS",
  CUSTOMER_BILL_SUMMARY: "CUSTOMER_BILL_SUMMARY",
  TYPE_REPORT:           "TYPE_REPORT",
  MODIFIED_REPORT:       "MODIFIED_REPORT",
  BILLWISE_PROFIT:       "BILLWISE_PROFIT",
  SALESMAN_BILLWISE:     "SALESMAN_BILLWISE",
};

const NAV_ITEMS = [
  { value: REPORT_TYPES.SALE_AMOUNT,           label: "Sales Amount Report",          icon: "💰" },
  { value: REPORT_TYPES.SALE_BILL_CONSOLIDATE, label: "Sale Bills Consolidate Report", icon: "🧾" },
  { value: REPORT_TYPES.SALE_BILL_DETAILS,     label: "Sale Bills Details Report",     icon: "📄" },
  { value: REPORT_TYPES.ITEMWISE,              label: "Item Wise Report",              icon: "📦" },
  { value: REPORT_TYPES.DAYWISE_SALE,          label: "Day Wise Sale Report",          icon: "📅" },
  { value: REPORT_TYPES.ITEMWISE_PROFIT,       label: "Item Wise Profit Report",       icon: "📈" },
  { value: REPORT_TYPES.DAYWISE_PROFIT,        label: "Day Wise Profit Report",        icon: "📊" },
  { value: REPORT_TYPES.SALEMAN_ITEMWISE,      label: "Salesman Itemwise Report",      icon: "🧑‍💼" },
  { value: REPORT_TYPES.HOURLY_SALE,           label: "Hourly Sale Amount Report",     icon: "⏱️" },
  { value: REPORT_TYPES.HOURLY_ITEMWISE,       label: "Hourly Itemwise Qty Report",    icon: "⏲️" },
  { value: REPORT_TYPES.HOURLY_PROFIT,         label: "Hourly Sale Amount Report",          icon: "⌛" },
  { value: REPORT_TYPES.CANCEL_BILL,           label: "Cancel Bill Summary Report",    icon: "🚫" },
  { value: REPORT_TYPES.CANCEL_BILL_DETAILS,   label: "Cancel Sale Bill Details",      icon: "🗑️" },
  { value: REPORT_TYPES.CUSTOMER_BILL_SUMMARY, label: "Customer Bill Summary Report",  icon: "👤" },
  { value: REPORT_TYPES.TYPE_REPORT,           label: "All Type Report",               icon: "🗂️" },
  { value: REPORT_TYPES.MODIFIED_REPORT,       label: "Modified Bill Report",          icon: "✏️" },
  { value: REPORT_TYPES.BILLWISE_PROFIT,       label: "Billwise Profit Report",        icon: "🧮" },
  { value: REPORT_TYPES.SALESMAN_BILLWISE,     label: "Salesman Bill Wise Report",     icon: "🧑‍💻" },
];

// ─── Pane2 "Group By" modes (rdbCustomerName / rptsalemanreport / rpt_cashier / rpt_counter / rpt_saletype) ──
const GROUP_BY = {
  CUSTOMER: "Customer",
  SALESMAN: "Salesman",
  CASHIER:  "Cashier",
  COUNTER:  "Counter",
  SALETYPE: "SaleType",
};

// ─── API endpoints (relative controller paths — unchanged from the jQuery file) ──
const EP = {
  SalesAmountReport:          "/api/SalesReportApp/SalesAmountReport",
  SaleBillConsolidateReport:  "/api/SalesReportApp/SaleBillConsolidateReport",
  SalesManConsolidateReport:  "/api/SalesReportApp/SalesManConsolidateReport",
  SaleBillDetailsReport:      "/api/SalesReportApp/SaleBillDetailsReport",
  ItemWiseReport:             "/api/SalesReportApp/ItemWiseReport",
  ItemWiseProfitReport:       "/api/SalesReportApp/ItemWiseProfitReport",
  DayWiseProfitReport:        "/api/SalesReportApp/DayWiseProfitReport",
  SalesManItemwiseReport:     "/api/SalesReportApp/SalesManItemwiseReport",
  DayWiseSaleReport:          "/api/SalesReportApp/DayWiseSaleReport",
  HourlyItemwiseAmountReport: "/api/SalesReportApp/HourlyItemwiseAmountReport",
  HourlyItemwiseSaleAmountReport: "/api/SalesReportApp/HourlyItemwiseSaleAmountReport",
  CancelBillLogReport:        "/api/SalesReportApp/CancelBillLogReport",
  ModifiedBillReport:         "/api/SalesReportApp/ModifiedBillReport",
  ModifiedBillDetailsReport:  "/api/SalesReportApp/ModifiedBillDetailsReport",
  BillWiseProfitReport:       "/api/SalesReportApp/BillWiseProfitReport",
  AllTypeOfTotalReport:       "/api/SalesReportApp/AllTypeOfTotalReport",
  CustomerBillSummaryReport:  "/api/SalesReportApp/CustomerBillSummaryReport",
};

// ─── Date helpers ─────────────────────────────────────────────────────────────
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

// ─── Generic combo-list normaliser (same contract as CC.loadSalesmanData) ────
const extractList = (data) =>
  Array.isArray(data)       ? data
  : Array.isArray(data?.data)  ? data.data
  : Array.isArray(data?.Data1) ? data.Data1
  : [];

// idx is passed in so that rows with NO usable id field (value/Code/Id/code/id)
// still get a unique, non-empty value instead of every one of them collapsing to
// "" — which is what produced "Encountered two children with the same key, ``".
const toOption = (row, idx = 0) => {
  const rawValue = row.value ?? row.Code ?? row.Id ?? row.code ?? row.id
    ?? row.CounterId ?? row.CashierId ?? row.SaleTypeId ?? row.CardId
    ?? row.SalesManId ?? row.AccountId ?? "";
  const value = rawValue === "" || rawValue === null || rawValue === undefined
    ? `__row_${idx}`
    : String(rawValue);
  const label = row.label ?? row.Name ?? row.name ?? row.Description
    ?? row.CountName ?? row.Cashier_Name ?? row.salesmanname ?? row.AccountName
    ?? row.CardName ?? String(rawValue || `Item ${idx + 1}`);
  return { value, label };
};

// Backend joins occasionally return the same row twice (e.g. duplicate Ids from
// a LEFT JOIN) — drop exact duplicate values so <option key={o.value}> is always
// unique, on top of the per-row fallback above.
const dedupeOptions = (opts) => {
  const seen = new Set();
  return opts.filter((o) => {
    if (seen.has(o.value)) return false;
    seen.add(o.value);
    return true;
  });
};

// ─── F11 per-master option builders ──────────────────────────────────────────
// toOption()'s fallback chain above was written for Customer/Salesman/Cashier/
// Counter/SaleType field names (AccountName, salesmanname, Cashier_Name, ...).
// It has no idea "BrandName", "CategoryName", "DepartmentName", "UOMName" or
// "LocationName" exist, so run through it, Brand/Category/Department/UOM/Location
// would silently fall back to showing the raw Id (or "Item N") as the label —
// meaning typing the actual Brand/Category/... name would never match anything,
// even though the filtering logic itself is correct. Each of these tries the
// field name ItemGroup.js actually binds as displayMember, then reasonable
// fallbacks, so every mode's search box is guaranteed to search its own name field.
const buildBrandOption = (row, i) => {
  const value = row.Id ?? row.id ?? row.BrandId ?? row.value ?? String(i);
  const label = row.BrandName ?? row.Name ?? row.name ?? row.label ?? String(value);
  return { value: String(value), label: String(label) };
};
const buildCategoryOption = (row, i) => {
  const value = row.Id ?? row.id ?? row.CategoryId ?? row.value ?? String(i);
  const label = row.CategoryName ?? row.Name ?? row.name ?? row.label ?? String(value);
  return { value: String(value), label: String(label) };
};
const buildDepartmentOption = (row, i) => {
  const value = row.Id ?? row.id ?? row.DepartmentId ?? row.value ?? String(i);
  const label = row.DepartmentName ?? row.Name ?? row.name ?? row.label ?? String(value);
  return { value: String(value), label: String(label) };
};
const buildUomOption = (row, i) => {
  const value = row.Id ?? row.id ?? row.UOMId ?? row.value ?? String(i);
  const label = row.UOMName ?? row.UOM ?? row.Name ?? row.name ?? row.label ?? String(value);
  return { value: String(value), label: String(label) };
};
const buildLocationOption = (row, i) => {
  const value = row.Id ?? row.id ?? row.LocationId ?? row.value ?? String(i);
  const label = row.LocationName ?? row.Name ?? row.name ?? row.label ?? String(value);
  return { value: String(value), label: String(label) };
};

// ─── Per-report-type UI configuration ────────────────────────────────────────
// Mirrors every $(...).show()/.hide()/.jqxRadioButton({disabled}) call inside
// each "#rpt_xxx".on('click', ...) handler in the original file.
function getUIConfig(type, univercell) {
  const base = {
    groupByDisabled: { Customer: true, Salesman: true, Cashier: true, Counter: true, SaleType: true },
    showDaily: false,
    showHourlyUpto: false,
    showMrp: false,
    showF11: false,
    showSaleBillTypePanel: false, // "Panelsalebilltype" + checkBillno
    showPanelBillFrom: false,     // depends on checkBillno being checked (computed separately)
    showPanelSaleReportType: false, // Pane3 (rdbConsolidate / rdbDetail) — Modified Bill Report only
    showItemwisePane: false,      // Pane22 (chkItemwise/chkPackageQty/chkcommission/chkall) — needs univercell too
    showChkProfit: false,         // Day Wise Sale profit toggle — needs univercell too
  };

  switch (type) {
    case REPORT_TYPES.SALE_AMOUNT:
      return { ...base, groupByDisabled: { Customer: true, Salesman: false, Cashier: false, Counter: false, SaleType: false }, showDaily: true };

    case REPORT_TYPES.SALE_BILL_CONSOLIDATE:
      return { ...base, groupByDisabled: { Customer: false, Salesman: false, Cashier: false, Counter: false, SaleType: false }, showDaily: true, showSaleBillTypePanel: true };

    case REPORT_TYPES.SALESMAN_BILLWISE:
      return { ...base, groupByDisabled: { Customer: true, Salesman: false, Cashier: true, Counter: true, SaleType: true }, showDaily: true, showSaleBillTypePanel: true };

    case REPORT_TYPES.SALE_BILL_DETAILS:
      return { ...base, groupByDisabled: { Customer: false, Salesman: false, Cashier: false, Counter: false, SaleType: false }, showDaily: true, showSaleBillTypePanel: true };

    case REPORT_TYPES.ITEMWISE:
      return { ...base, groupByDisabled: { Customer: false, Salesman: false, Cashier: false, Counter: false, SaleType: false }, showDaily: true, showMrp: true, showF11: true };

    case REPORT_TYPES.DAYWISE_SALE:
      return { ...base, showChkProfit: univercell === true };

    case REPORT_TYPES.ITEMWISE_PROFIT:
      return { ...base, groupByDisabled: { Customer: true, Salesman: true, Cashier: false, Counter: false, SaleType: false }, showDaily: true, showF11: true };

    case REPORT_TYPES.DAYWISE_PROFIT:
      return { ...base };

    case REPORT_TYPES.SALEMAN_ITEMWISE:
      return { ...base, groupByDisabled: { Customer: true, Salesman: false, Cashier: true, Counter: true, SaleType: true }, showItemwisePane: univercell === true };

    case REPORT_TYPES.HOURLY_SALE:
    case REPORT_TYPES.HOURLY_ITEMWISE:
    case REPORT_TYPES.HOURLY_PROFIT:
      return { ...base };

    case REPORT_TYPES.CANCEL_BILL:
      return { ...base };

    case REPORT_TYPES.CANCEL_BILL_DETAILS:
      return { ...base, groupByDisabled: { Customer: true, Salesman: true, Cashier: false, Counter: false, SaleType: false }, showDaily: true };

    case REPORT_TYPES.CUSTOMER_BILL_SUMMARY:
      return { ...base, groupByDisabled: { Customer: false, Salesman: true, Cashier: false, Counter: false, SaleType: false } };

    case REPORT_TYPES.TYPE_REPORT:
      return { ...base, groupByDisabled: { Customer: true, Salesman: true, Cashier: false, Counter: false, SaleType: false }, showF11: true };

    case REPORT_TYPES.MODIFIED_REPORT:
      return { ...base, groupByDisabled: { Customer: true, Salesman: true, Cashier: false, Counter: false, SaleType: false }, showPanelSaleReportType: true };

    case REPORT_TYPES.BILLWISE_PROFIT:
      return { ...base, groupByDisabled: { Customer: true, Salesman: true, Cashier: false, Counter: false, SaleType: false } };

    default:
      return base;
  }
}

export default function SaleReportPart1() {
  const navigate = useNavigate();

  // ── Session / permission state ─────────────────────────────────────────
  const [pageAccess, setPageAccess] = useState({ ready: false, allowed: false, pageview: 0 });

  // ── Company / settings state (loaded once from localStorage, same as jQuery) ──
  const [session, setSession] = useState({
    Comid: "",
    MComid: "",
    taxInclusiveDontShow: 1,
    MUOM: false,
    ProfitMarkDown: 0,
    univercell: false,
    CName: "",
    CAddress: "",
    CPhone: "",
  });

  // ── Report-type selection ───────────────────────────────────────────────
  const [reportType, setReportType] = useState(REPORT_TYPES.SALE_AMOUNT);
  const uiConfig = useMemo(() => getUIConfig(reportType, session.univercell), [reportType, session.univercell]);

  // ── Date / Daily / Hourly-upto / MRP ────────────────────────────────────
  const [fromDate, setFromDate] = useState(todayStr());
  const [toDate, setToDate]     = useState(todayStr());
  const [daily, setDaily]           = useState(false);
  const [hourlyUpto, setHourlyUpto] = useState(false);
  const [chkMrp, setChkMrp]         = useState(false);

  // ── "Panelsalebilltype" — checkBillno / (chktime & chkTax kept for logic parity, never rendered) ──
  const [checkBillno, setCheckBillno] = useState(false);
  const [chktime]  = useState(false); // never toggled in the UI — mirrors the original (always hidden)
  const [chkTax]   = useState(false); // never toggled in the UI — mirrors the original (always hidden)
  const [billNoFrom, setBillNoFrom] = useState("");
  const [billNoTo, setBillNoTo]     = useState("");
  const [timeFrom, setTimeFrom]     = useState(""); // retained for logic parity (ReportType="TIME" branch is unreachable, same as source)
  const [timeTo, setTimeTo]         = useState("");

  // ── Pane2 GroupBy selector + combos ─────────────────────────────────────
  const [groupByMode, setGroupByMode] = useState("");
  const [customer, setCustomer] = useState(null);
  const [salesman, setSalesman] = useState(null);
  const [cashier, setCashier]   = useState(null);
  const [counter, setCounter]   = useState(null);
  const [saleType, setSaleType] = useState(null);

  const [customerList, setCustomerList] = useState([]);
  const [salesmanList, setSalesmanList] = useState([]);
  const [cashierList, setCashierList]   = useState([]);
  const [counterList, setCounterList]   = useState([]);
  const [saleTypeList, setSaleTypeList] = useState([]);

  // ── Pane2 Group-By combo — searchable dropdown UI state ─────────────────
  // Same client-side-filter pattern as the F11 combobox below: typing never
  // triggers a network call, it only narrows the already-loaded list for
  // whichever mode (Customer/Salesman/Cashier/Counter/SaleType) is active.
  const [groupComboSearchText, setGroupComboSearchText]   = useState("");
  const [groupComboDropdownOpen, setGroupComboDropdownOpen] = useState(false);
  const [groupComboHighlightIndex, setGroupComboHighlightIndex] = useState(0);

  // ── Pane22 — Salesman Itemwise sub-type (only shown when univercell) ────
  const [itemwiseSubType, setItemwiseSubType] = useState("all"); // "ItemWise" | "PackageQty" | "commission" | "all"

  // ── Day Wise Sale — profit toggle (only shown when univercell) ──────────
  const [chkProfit, setChkProfit] = useState(false);

  // ── Pane3 — Modified Bill Report Consolidate/Detail ─────────────────────
  const [consolidateOrDetail, setConsolidateOrDetail] = useState("CONS"); // "CONS" | "DETAIL"

  // ── F11 "ItemGroup" popup — used by ItemWise / ItemWiseProfit / TypeReport ──
  const [groupBy, setGroupBy]         = useState("");
  const [groupByText, setGroupByText] = useState("");
  const [groupByName, setGroupByName] = useState("");
  const [showGroupPopup, setShowGroupPopup] = useState(false);

  // ── F11 picker internals — mirrors ItemGroup.js radio + combobox panel ──
  // (Brand / Category / Department / Supplier / UOM / Location / Description / Code)
  const F11_MODES = [
    { value: "Brand",       label: "Brand" },
    { value: "Category",    label: "Category" },
    { value: "Department",  label: "Department" },
    { value: "Supplier",    label: "Supplier" },
    { value: "UOM",         label: "UOM" },
    { value: "Location",    label: "Location" },
    { value: "Description", label: "Description" },
    { value: "Code",        label: "Code" },
  ];
  const [f11Mode, setF11Mode]         = useState("Brand");
  const [f11Selected, setF11Selected] = useState(null); // { value, label }
  const [f11Lists, setF11Lists]       = useState({});   // cache: { Brand: [...], Category: [...], ... }
  const [f11ProductRaw, setF11ProductRaw] = useState([]); // raw rows, shared by Description & Code (like loadproductcombo)
  const [f11Loading, setF11Loading]   = useState(false);
  // Combobox UI state — filtering is 100% client-side against already-loaded
  // f11Options; typing never triggers a network call.
  const [f11SearchText, setF11SearchText]         = useState("");
  const [f11DropdownOpen, setF11DropdownOpen]     = useState(false);
  const [f11HighlightIndex, setF11HighlightIndex] = useState(0);

  // ── UI feedback ──────────────────────────────────────────────────────────
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

    const menudata = menulist.filter((obj) => obj.PageName === "Sales Report Part1");
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

    const Comid  = CC.getStr("Comid");
    const MComid = CC.getStr("MComid");
    const MainSet = CC.getLocal("Mainsetting") || [{}];
    const ComSet  = CC.getLocal("Companysetting") || [{}];
    const taxInclusiveDontShow = ComSet[0]?.POSTax !== "Inclusive Don't Show Tax" ? 0 : 1;

    setSession({
      Comid,
      MComid,
      taxInclusiveDontShow,
      MUOM: MainSet[0]?.MultipleUOMBilling ?? false,
      ProfitMarkDown: MainSet[0]?.ProfitMarkDown ?? 0,
      univercell: MainSet[0]?.univercell === true,
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

  // ── Load combo sources once page access is confirmed ───────────────────
  // useEffect(() => {
  //   if (!pageAccess.ready || !pageAccess.allowed) return;
  //   const MComid = session.MComid;

  //   (async () => {
  //     try {
  //       const [cRes, smRes, cshRes, cntRes, stRes] = await Promise.all([
  //         CC.api(CC.GetSupplierAll, null, {}, { AccountType: "CUSTOMER", Comid: MComid }),
  //         CC.api(CC.SalesManSelectV7, null, {}, { Comid: MComid }),
  //         CC.api(CC.CashierSelect, null, {}, { Comid: MComid }),
  //         CC.api(CC.SelectCounter, null, {}, { Comid: MComid }),
  //         CC.api(CC.SelectSaleType, null, {}, { Comid: MComid }),
  //       ]);
  //       setCustomerList(extractList(cRes).map(toOption));
  //       setSalesmanList(extractList(smRes).map(toOption));
  //       setCashierList(extractList(cshRes).map(toOption));
  //       setCounterList(extractList(cntRes).map(toOption));
  //       setSaleTypeList(extractList(stRes).map(toOption));
  //     } catch (e) {
  //       console.error("Combo load error:", e);
  //     }
  //   })();
  // }, [pageAccess.ready, pageAccess.allowed, session.MComid]);
  useEffect(() => {
    if (!pageAccess.ready || !pageAccess.allowed) return;
  
    const MComid = session.MComid;
  
    (async () => {
      try {
        const results = await Promise.allSettled([
          CC.api(CC.GetSupplierAll, null, {}, { AccountType: "CUSTOMER", Comid: MComid }),
          CC.api(CC.SalesManSelectV7, null, {}, { Comid: MComid }),
          CC.api(CC.CashierSelect, null, {}, { Comid: MComid }),
          CC.api(CC.SelectCounter, null, {}, { Comid: MComid }),
          CC.api(CC.SelectSaleType, null, {}, { Comid: MComid }),
        ]);
  
        console.log(results);
  
        const [customerRes, salesmanRes, cashierRes, counterRes, saleTypeRes] = results;
  
        if (customerRes.status === "fulfilled") {
          setCustomerList(dedupeOptions(extractList(customerRes.value).map(toOption)));
        }
  
        if (salesmanRes.status === "fulfilled") {
          setSalesmanList(dedupeOptions(extractList(salesmanRes.value).map(toOption)));
        }
  
        if (cashierRes.status === "fulfilled") {
          setCashierList(dedupeOptions(extractList(cashierRes.value).map(toOption)));
        }
  
        if (counterRes.status === "fulfilled") {
          setCounterList(dedupeOptions(extractList(counterRes.value).map(toOption)));
        }
  
        if (saleTypeRes.status === "fulfilled") {
          setSaleTypeList(dedupeOptions(extractList(saleTypeRes.value).map(toOption)));
        }
      } catch (e) {
        console.error("Combo load error:", e);
      }
    })();
  }, [pageAccess.ready, pageAccess.allowed, session.MComid]);

  // ── Keydown: F11 (ItemGroup popup) + Esc (quit confirm) ─────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.keyCode === 122) {
        e.preventDefault();
        if (
          reportType === REPORT_TYPES.ITEMWISE ||
          reportType === REPORT_TYPES.ITEMWISE_PROFIT ||
          reportType === REPORT_TYPES.TYPE_REPORT
        ) {
          setShowGroupPopup(true);
        }
      }
      if (e.keyCode === 27) {
        e.preventDefault();
        if (window.confirm("Do You Want To Quit Page?")) {
          navigate("/Home");
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [reportType, navigate]);

  // ── Report-type change — replicates every #rpt_xxx.on('click') reset block ──
  const handleReportTypeChange = useCallback((type) => {
    setReportType(type);
    setMsg(null);

    // Common resets performed by (almost) every click handler in the original
    setGroupByMode("");
    setCustomer(null);
    setSalesman(null);
    setCashier(null);
    setCounter(null);
    setSaleType(null);
    setGroupComboSearchText("");
    setGroupComboDropdownOpen(false);
    setGroupComboHighlightIndex(0);
    setCheckBillno(false);
    setDaily(false);
    setHourlyUpto(false);
    setChkMrp(false);
    setBillNoFrom("");
    setBillNoTo("");
    setTimeFrom("");
    setTimeTo("");
    setChkProfit(false);

    if (type === REPORT_TYPES.SALEMAN_ITEMWISE) {
      setItemwiseSubType("all"); // $("#chkall").jqxRadioButton({ checked: true }) when univercell
    }
    if (type === REPORT_TYPES.MODIFIED_REPORT) {
      setConsolidateOrDetail("CONS"); // rdbConsolidate checked:true, rdbDetail checked:false
    }

    setGroupBy("");
    setGroupByText("");
    setGroupByName("");
  }, []);

  // ── Pane2 radio / combo selection (mutually exclusive, mirrors jQuery) ──
  const selectGroupByMode = useCallback((mode) => {
    setGroupByMode(mode);
    setCustomer(null);
    setSalesman(null);
    setCashier(null);
    setCounter(null);
    setSaleType(null);
    setGroupComboSearchText("");
    setGroupComboDropdownOpen(false);
    setGroupComboHighlightIndex(0);
  }, []);

  const handleComboChange = useCallback((mode, option) => {
    setGroupByMode(mode);
    setCustomer(mode === GROUP_BY.CUSTOMER ? option : null);
    setSalesman(mode === GROUP_BY.SALESMAN ? option : null);
    setCashier(mode === GROUP_BY.CASHIER ? option : null);
    setCounter(mode === GROUP_BY.COUNTER ? option : null);
    setSaleType(mode === GROUP_BY.SALETYPE ? option : null);
    setGroupComboSearchText(option?.label || "");
    setGroupComboDropdownOpen(false);
  }, []);

  // ── checkBillno toggle ("Panelsalebilltype") ────────────────────────────
  const handleCheckBillnoToggle = useCallback((checked) => {
    setCheckBillno(checked);
    if (!checked) {
      setBillNoFrom("");
      setBillNoTo("");
    }
  }, []);

  // ── Refresh button ───────────────────────────────────────────────────────
  const handleRefresh = useCallback(() => {
    setFromDate(todayStr());
    setToDate(todayStr());
    setGroupByMode("");
    setCustomer(null);
    setSalesman(null);
    setCashier(null);
    setCounter(null);
    setSaleType(null);
    setGroupComboSearchText("");
    setGroupComboDropdownOpen(false);
    setGroupComboHighlightIndex(0);
    setCheckBillno(false);
    setDaily(false);
    setHourlyUpto(false);
    setChkMrp(false);
    setConsolidateOrDetail("CONS");
    setBillNoFrom("");
    setBillNoTo("");
    setTimeFrom("");
    setTimeTo("");
    setMsg(null);
  }, []);

  // ── ItemGroup (F11) popup close handler — captures GroupBy / GroupByText ──
  const handleGroupPopupClose = useCallback((selectedGroup, selectedGroupText) => {
    setGroupBy(selectedGroup || "");
    setGroupByText(selectedGroupText || "");
    setShowGroupPopup(false);
  }, []);

  // ── F11 combo loader — mirrors loadbrand/loadcategorycombo/loaddepartmentcombo/
  // loadsuppliercombo/loaduomcombo/loadlocationcombo/loadproductcombo from ItemGroup.js.
  // Endpoints below are the real ones from Common.jsx:
  //   Brand      -> CC.BW_Brand         ("/api/BrandApp/SelectBrandAll" — the dropdown-shaped
  //                 "...All" endpoint, NOT CC.BrandSelect which is the CRUD-grid endpoint)
  //   Department -> CC.DepartmentSelect ("/api/DepartmentApp/SelectDepartment")
  //   UOM        -> CC.UOMSelect        ("/api/UOMApp/SelectUOM")
  //   Supplier   -> CC.GetSupplierAll   (already working)
  //   Description/Code -> CC.GetProductListV7 ("/api/ItemMasterApp/GetProductListV7")
  // Category and Location have NO corresponding endpoint anywhere in Common.jsx —
  // there is no SelectCategory.../SelectLocation... export at all. Those two modes
  // are handled separately below so they show an honest "not configured" message
  // instead of silently calling something that doesn't exist.
  const F11_UNSUPPORTED_MODES = ["Category", "Location"];

  const loadF11Combo = useCallback(async (mode) => {
    const MComid = session.MComid;

    if (F11_UNSUPPORTED_MODES.includes(mode)) {
      console.warn(`F11: no ${mode} endpoint found in Common.jsx — add one (e.g. Select${mode}All) to enable this filter.`);
      setF11Lists((prev) => ({ ...prev, [mode]: [] }));
      return;
    }

    if (mode === "Description" || mode === "Code") {
      if (f11ProductRaw.length) return; // already loaded — shared by both modes
      setF11Loading(true);
      try {
        const res = await CC.api(CC.GetProductListV7, null, {}, { Comid: MComid });
        setF11ProductRaw(extractList(res));
      } catch (e) {
        console.error("F11 product combo load error:", e);
      } finally {
        setF11Loading(false);
      }
      return;
    }

    if (f11Lists[mode]) return; // already loaded for this mode
    setF11Loading(true);
    try {
      let res;
      let builder = toOption;
      switch (mode) {
        case "Brand":
          res = await CC.api(CC.BrandSelect, null, {}, { Comid: MComid });
          builder = buildBrandOption;
          break;
        case "Department":
          res = await CC.api(CC.DepartmentSelect, null, {}, { Comid: MComid });
          builder = buildDepartmentOption;
          break;
        case "Supplier":
          res = await CC.api(CC.GetSupplierAll, null, {}, { AccountType: "SUPPLIER", Comid: MComid });
          builder = toOption; // GetSupplierAll already matches toOption's field names — leave as-is
          break;
        case "UOM":
          res = await CC.api(CC.UOMSelect, null, {}, { Comid: MComid });
          builder = buildUomOption;
          break;
        // Category/Location are short-circuited by the F11_UNSUPPORTED_MODES guard
        // above and never reach here today — these cases are wired up so nothing
        // else needs to change the moment a real endpoint is added to Common.jsx.
        //    const res = await CC.api(
    //   CC.CategorySelect,
    //   null,
    //   {},
    //   { Comid: sess.Comid }
    // );
        case "Category":
          res = await CC.api(CC.CategorySelect, null, {}, { Comid: sess.Comid});
          builder = buildCategoryOption;
          break;
        case "Location":
          res = await CC.api(CC.LocationSelectAll, null, {}, { Comid: MComid });
          builder = buildLocationOption;
          break;
        default:
          return;
      }
      setF11Lists((prev) => ({ ...prev, [mode]: dedupeOptions(extractList(res).map(builder)) }));
    } catch (e) {
      console.error(`F11 ${mode} combo load error:`, e);
    } finally {
      setF11Loading(false);
    }
  }, [session.MComid, f11Lists, f11ProductRaw]);

  // Load the default ("Brand") combo the moment the picker opens — matches
  // methods.load() -> loadbrandcombo("#cmbbrand") at ItemGroup.js init time.
  useEffect(() => {
    if (showGroupPopup) {
      loadF11Combo(f11Mode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showGroupPopup]);

  // Options for whichever radio is currently selected. Description/Code share the
  // same raw product rows but differ in which field becomes value vs label —
  // exactly like loadproductcombo() feeding both #cmbdescription and #cmbcode.
  const f11Options = useMemo(() => {
    if (f11Mode === "Description" || f11Mode === "Code") {
      return dedupeOptions(
        f11ProductRaw.map((row, i) => {
          const code = String(row.Code ?? row.code ?? row.ItemCode ?? i);
          const desc = row.Description ?? row.description ?? row.ItemName ?? code;
          return f11Mode === "Code" ? { value: code, label: code } : { value: code, label: desc };
        })
      );
    }
    return f11Lists[f11Mode] || [];
  }, [f11Mode, f11ProductRaw, f11Lists]);

  // Client-side filter of f11Options against the typed search text — no network
  // call is ever made here, this only narrows down what's already been fetched.
  const f11FilteredOptions = useMemo(() => {
    const q = f11SearchText.trim().toLowerCase();
    if (!q) return f11Options;
    return f11Options.filter((o) => o.label.toLowerCase().includes(q));
  }, [f11Options, f11SearchText]);

  // value comes from item.value for Brand/Department/Supplier/UOM, and from
  // item.label for Description/Code — matches ItemGroup.js's two branches.
  const f11ValueFor = useCallback((opt, mode = f11Mode) => (
    (mode === "Description" || mode === "Code") ? opt.label : opt.value
  ), [f11Mode]);

  const f11SelectOption = useCallback((opt) => {
    setF11Selected(opt);
    setF11SearchText(opt.label);
    setF11DropdownOpen(false);
  }, []);

  // Radio change — mirrors each #rbtxxx.on('click') handler: switch mode, clear
  // the previous selection, enable/load only the relevant combo.
  const handleF11ModeChange = useCallback((mode) => {
    setF11Mode(mode);
    setF11Selected(null);
    setF11SearchText("");
    setF11DropdownOpen(false);
    setF11HighlightIndex(0);
    loadF11Combo(mode);
  }, [loadF11Combo]);

  // Confirm — mirrors both the per-combo Enter-keydown handlers and #btnviewF11
  // click in ItemGroup.js: value comes from item.value for Brand/Category/
  // Department/Supplier/UOM/Location, and from item.label for Description/Code.
  const confirmF11Selection = useCallback(() => {
    if (!f11Selected) {
      alert(`Please Select Valid ${f11Mode} Name !!!.`);
      return;
    }
    handleGroupPopupClose(f11Mode, f11ValueFor(f11Selected));
  }, [f11Selected, f11Mode, f11ValueFor, handleGroupPopupClose]);

  // Refresh — mirrors #btnrefreshF11: clear every combo selection, reset back to Brand.
  const handleF11Refresh = useCallback(() => {
    setF11Mode("Brand");
    setF11Selected(null);
    setF11SearchText("");
    setF11DropdownOpen(false);
    setF11HighlightIndex(0);
    loadF11Combo("Brand");
  }, [loadF11Combo]);

  // ── Report-viewer launcher (same window.open pattern as SaleOrderReport.jsx) ──
  const openReportViewer = useCallback((reportName, params) => {
    const qs = new URLSearchParams({ ReportName: reportName, ...params }).toString();
    const url = `${CC.BASE_URL}/Reports/ReportViewer.aspx?${qs}`;
    console.log(url);
    const w = window.open(
      url,
      "_blank",
      "directories=0,titlebar=0,toolbar=0,location=0,status=0,menubar=0,scrollbars=yes,resizable=no," +
        `width=${screen.width},height=${screen.height - 100}`
    );
    if (w) w.addEventListener("load", () => { w.document.title = params.ReportTitle || reportName; }, false);
  }, []);

  // ── View button — replicates every $.ajax branch from #btnview click ────
  const handleView = useCallback(async () => {
    // ── Date validation ──
    if (!fromDate || !toDate) {
      CC?.MsgBox ? CC.MsgBox("Please select From Date and To Date.") : alert("Please select From Date and To Date.");
      return;
    }
    const Fromdate = toMMDDYYYY(fromDate);
    const Todate   = toMMDDYYYY(toDate);
    if (new Date(Fromdate) > new Date(Todate)) {
      alert("From Date Is Greater Than To Date!!");
      return;
    }

    // ── ReportType / ReportTypenew (chktime & chkTax are always false — mirrors hidden controls) ──
    let ReportTypenew = daily ? "D" : "";
    if (chkTax) ReportTypenew = "T";
    let ReportType = "";
    if (chkTax) ReportType = "TAX";
    else if (chktime) ReportType = "TIME";
    else if (checkBillno) ReportType = "BILL";

    const TaxSuppressId = session.taxInclusiveDontShow === 1 ? 1 : 0;

    // ── Bill-no validation — Consolidate / SalesmanBillwise / Details ──
    let txtBillnoFrm = "";
    let txtBillnoTo = "";
    const needsBillNoValidation =
      (reportType === REPORT_TYPES.SALE_BILL_CONSOLIDATE && checkBillno) ||
      (reportType === REPORT_TYPES.SALESMAN_BILLWISE && checkBillno) ||
      (reportType === REPORT_TYPES.SALE_BILL_DETAILS && !chktime && !chkTax && checkBillno);

    if (needsBillNoValidation) {
      if (CC.ValNum(billNoFrom) === 0 && CC.ValNum(billNoTo) === 0) {
        alert("Enter The Bill No");
        return;
      }
      if (CC.ValNum(billNoFrom) > CC.ValNum(billNoTo)) {
        alert("From Bill No Is Greater Than To Bill no");
        return;
      }
      txtBillnoFrm = CC.ValNum(billNoFrom);
      txtBillnoTo  = CC.ValNum(billNoTo);
    }

    // ── GroupBy resolution (Pane2) ──
    let GroupBy = "";
    let GroupByText = "";
    let GroupByName = "";
    let SalesManLabel = "";

    if (groupByMode === GROUP_BY.CUSTOMER) {
      GroupBy = "Customer";
      if (customer) {
        GroupByText = customer.value;
        if (GroupByText == null) { alert("Please Select Valid Customer Name !!!."); return; }
      }
    }
    if (groupByMode === GROUP_BY.SALESMAN) {
      GroupBy = "Salesman";
      if (salesman) {
        GroupByText = salesman.value;
        SalesManLabel = salesman.label;
        if (GroupByText == null) { alert("Please Select Valid Salesman Name !!!."); return; }
      }
    }
    if (groupByMode === GROUP_BY.CASHIER) {
      GroupBy = "Cashier";
      if (cashier) {
        GroupByText = cashier.value;
        if (GroupByText == null) { alert("Please Select Valid Cashier Name !!!."); return; }
      }
    }
    if (groupByMode === GROUP_BY.COUNTER) {
      GroupBy = "Counter";
      if (counter) {
        GroupByText = counter.value;
        if (GroupByText == null) { alert("Please Select Valid Counter Name !!!."); return; }
      }
    }
    if (groupByMode === GROUP_BY.SALETYPE) {
      GroupBy = "SaleType";
      if (saleType) {
        GroupByText = saleType.value;
        GroupByName = saleType.label;
        if (GroupByText == null) { alert("Please Select Valid SaleType Name !!!."); return; }
      } else {
        alert("Select SaleType !!!.");
        return;
      }
    }

    const Comid  = parseInt(session.Comid, 10);
    const MComid = parseInt(session.MComid, 10);
    const CName = session.CName, CAddress = session.CAddress, CPhone = session.CPhone;

    CName= session?.CName || localStorage.getItem("CompanyName") || "",
    CAddress=session?.CAddress || localStorage.getItem("Address") || "",
    CPhone= session?.CPhone || localStorage.getItem("Phone") || "",


    setLoading(true);
    setMsg(null);

    try {
      // ═══ Sale Amount Report ═══
      if (reportType === REPORT_TYPES.SALE_AMOUNT) {
        const ReportTitle = "Sales Amount";
        const res = await CC.api(
          EP.SalesAmountReport,
          null,
          {},
          {
            Daily: daily,
            GroupBy,
            GroupByText,
            Fromdate,
            Todate,
            Comid
          }
        );
        
        if (res.ok) {
          const cacheKey = res.Data15 ?? res.data15 ?? res.data?.Data15 ?? res.data?.data15;
          if (!cacheKey) {
            console.warn("CacheKey missing in API response — check backend JSON casing.", res);
          }
          openReportViewer("SalesAmountReport", {
            CacheKey: cacheKey,
            Daily: daily,
            GroupBy, 
            Fromdate,
            Todate,
            ReportTitle,
            CName: session?.CName || localStorage.getItem("CompanyName") || "",
            CAddress: session?.CAddress || localStorage.getItem("Address") || "",
            CPhone: session?.CPhone || localStorage.getItem("Phone") || "",

          });
        } else {
          setMsg({ text: "No Record !!!.", isErr: true });
        }
      }

      // ═══ Sale Bill Consolidate Report ═══
// ═══ Sale Bill Consolidate Report ═══
else if (reportType === REPORT_TYPES.SALE_BILL_CONSOLIDATE) {
  const ReportTitle = "Sales Bill Consolidate";
  const res = await CC.api(EP.SaleBillConsolidateReport, null, {}, {
    ReportType, GroupBy, GroupByText, GroupByName, Fromdate, Todate, txtBillnoFrm, txtBillnoTo, Comid,
  });
  if (res.ok) {
    const cacheKey = res.Data15;

    openReportViewer("SaleBillConsolidateReport", {
        CacheKey: cacheKey,
        ReportType,
        GroupBy,
        GroupByText,
        GroupByName,
        Fromdate,
        Todate,
        txtBillnoFrm,
        txtBillnoTo,
        ReportTitle,        // ✅ இது missing-ஆ இருந்துச்சு — சேர்த்தேன்
        CName: session?.CName || localStorage.getItem("CompanyName") || "",
        CAddress: session?.CAddress || localStorage.getItem("Address") || "",
        CPhone: session?.CPhone || localStorage.getItem("Phone") || "",

    });
  } else {
    setMsg({ text: "No Record !!!.", isErr: true });
  }
}

      // ═══ Salesman Bill Wise (Consolidate) Report ═══
      else if (reportType === REPORT_TYPES.SALESMAN_BILLWISE) {
        if (!salesman) {
          alert("Please Select Valid Salesman Name !!!.");
          setLoading(false);
          return;
        }
      
        const ReportTitle = `${salesman.label} SalesMan Bill Wise Report`;
      
        const res = await CC.api(
          EP.SalesManConsolidateReport,
          null,
          {},
          {
            ReportType,
            GroupBy,
            GroupByText,
            GroupByName,
            Fromdate,
            Todate,
            txtBillnoFrm,
            txtBillnoTo,
            Comid,
          }
        );
      
        if (res.ok) {
      
          const cacheKey = res.Data15;   // <-- முக்கியம்
      
          console.log("CacheKey =", cacheKey);
      
          openReportViewer("SalesManConsolidateReport", {
            CacheKey: cacheKey,          // <-- இதை add பண்ண வேண்டும்
            Daily: daily,
            GroupBy,
            Fromdate,
            Todate,
            ReportType: ReportTypenew,
            ReportTitle,
            CName: session?.CName || localStorage.getItem("CompanyName") || "",
            CAddress: session?.CAddress || localStorage.getItem("Address") || "",
            CPhone: session?.CPhone || localStorage.getItem("Phone") || "",

          });
      
        } else {
          setMsg({ text: "No Record !!!.", isErr: true });
        }
      }

// ═══ Sale Bill Details Report / Cancel Sale Bill Details ═══
else if (reportType === REPORT_TYPES.SALE_BILL_DETAILS || reportType === REPORT_TYPES.CANCEL_BILL_DETAILS) {
  const isCancel = reportType === REPORT_TYPES.CANCEL_BILL_DETAILS;
  const ReportTitle = isCancel ? "Cancel Sale Bill Details" : "Sales Bill Details";
  const Deletestatus = isCancel ? 0 : 1;
  const res = await CC.api(EP.SaleBillDetailsReport, null, {React :1}, {
    ReportType, GroupBy, GroupByText, GroupByName, Fromdate, Todate, txtBillnoFrm, txtBillnoTo,
    Comid, MComid, Deletestatus,
  });
  if (res.ok) {
    const cacheKey = res.Data15;   // ✅ Controller cache-ல insert பண்ணி தர்ற key-ஐ எடுக்கணும்

    openReportViewer("SaleBillDetailsReport", {
      CacheKey: cacheKey,          // ✅ இதை பாஸ் பண்ணணும்
      Daily: daily, GroupBy, Fromdate, Todate, ReportType: ReportTypenew, ReportTitle,
      taxinclusivedontshow: session.taxInclusiveDontShow, CName, CAddress, CPhone,
    });
  } else {
    setMsg({ text: "No Record !!!.", isErr: true });
  }
}

      // ═══ Item Wise Report ═══
      else if (reportType === REPORT_TYPES.ITEMWISE) {
        let gb = "", gbt = "";
        if (groupBy) gb = groupBy.toLocaleUpperCase();
        if (groupByText) gbt = groupByText;

        const ReportTitle = "Item Wise Report";
        const res = await CC.api(EP.ItemWiseReport, null, {
          React: 1
        }, {
          Daily: daily, MRP: chkMrp, GroupBy: gb, GroupByText: gbt, GroupByName, Fromdate, Todate,
          MUOM: session.MUOM, Comid, MComid,
        });
        if (res.ok) {
          // was missing — "cacheKey" was referenced below without being declared,
          // which threw "cacheKey is not defined" and silently killed handleView()
          // (swallowed by the outer catch as an error message, report never opened).
          const cacheKey = res.Data15 ?? res.data15 ?? res.data?.Data15 ?? res.data?.data15;
          if (!cacheKey) {
            console.warn("CacheKey missing in ItemWiseReport API response.", res);
          }
          openReportViewer("ItemWiseReport", { CacheKey: cacheKey,
            Daily: daily, MRP: chkMrp, GroupBy: gb, GroupText: gbt, Fromdate, Todate, TaxSuppressId,
            ReportType: ReportTypenew, ReportTitle, taxinclusivedontshow: session.taxInclusiveDontShow, CName, CAddress, CPhone,
          });
        } else {
          setMsg({ text: "No Record !!!.", isErr: true });
        }
        setGroupBy(""); setGroupByText("");
      }

      // ═══ Item Wise Profit Report ═══
      // else if (reportType === REPORT_TYPES.ITEMWISE_PROFIT) {
      //   let gb = GroupBy, gbt = GroupByText;
      //   if (groupBy) gb = groupBy.toLocaleUpperCase();
      //   if (groupByText) gbt = groupByText;

      //   const ReportTitle = "Item Wise Profit";
      //   const res = await CC.api(EP.ItemWiseProfitReport, null, { React:1}, {
      //     Daily: daily, GroupBy: gb, GroupByText: gbt, Fromdate, Todate, Comid, MComid,
      //   });
      //   if (res.ok) {
      //     const cacheKey = res.data?.data15 ?? res.data?.Data15;
      //     openReportViewer("ItemWiseProfitReport", { CacheKey: cacheKey,
      //        Daily: daily, GroupBy: gb, Fromdate, Todate, ReportType: ReportTypenew, ReportTitle, CName, CAddress, CPhone });
      //   } else {
      //     setMsg({ text: "No Record !!!.", isErr: true });
      //   }
      //   setGroupBy(""); setGroupByText("");
      // }
      else if (reportType === REPORT_TYPES.ITEMWISE_PROFIT) {
        let gb = "", gbt = "";
        if (groupBy) gb = groupBy.toLocaleUpperCase();
        if (groupByText) gbt = groupByText;
      
        const ReportTitle = "Item Wise Profit";
        const res = await CC.api(EP.ItemWiseProfitReport, null, { React:1}, {
          Daily: daily, GroupBy: gb, GroupByText: gbt, Fromdate, Todate, Comid, MComid,
        });
        if (res.ok) {
          const cacheKey = res.Data15 ?? res.data15 ?? res.data?.Data15 ?? res.data?.data15;
          openReportViewer("ItemWiseProfitReport", { CacheKey: cacheKey,
             Daily: daily, GroupBy: gb, Fromdate, Todate, ReportType: ReportTypenew, ReportTitle, CName, CAddress, CPhone });
        } else {
          setMsg({ text: "No Record !!!.", isErr: true });
        }
        setGroupBy(""); setGroupByText("");
      }

// ═══ Day Wise Profit Report ═══
else if (reportType === REPORT_TYPES.DAYWISE_PROFIT) {
  const ReportTitle = "Day Wise Profit";

  const res = await CC.api(
    EP.DayWiseProfitReport,
    null,
    { React: 1 },
    {
      Fromdate,
      Todate,
      Comid,
      MComid,
    }
  );

  if (res.ok) {
    const cacheKey =
      res.Data15 ??
      res.data15 ??
      res.data?.Data15 ??
      res.data?.data15;

    openReportViewer("DayWiseProfitReport", {
      CacheKey: cacheKey,
      Fromdate,
      Todate,
      ReportType: ReportTypenew,
      ReportTitle,
      CName,
      CAddress,
      CPhone,
    });
  } else {
    setMsg({ text: "No Record !!!.", isErr: true });
  }
}

// ═══ Salesman Itemwise Report ═══
else if (reportType === REPORT_TYPES.SALEMAN_ITEMWISE) {
  let gbt = GroupByText;
  if (groupByText) gbt = groupByText;

  let SubReportType = "BillWise";
  if (itemwiseSubType === "ItemWise") SubReportType = "ItemWise";
  else if (itemwiseSubType === "PackageQty") SubReportType = "PackageWise";
  else if (itemwiseSubType === "commission") SubReportType = "commission";

  const ReportTitle = "Salesman Itemwise Report";
  const res = await CC.api(EP.SalesManItemwiseReport, null, {React:1}, {
    GroupByText: gbt, Fromdate, Todate, Comid, MComid, ReportType: SubReportType,
  });
  if (res.ok) {
    const cacheKey = res.Data15 ?? res.data15 ?? res.data?.Data15 ?? res.data?.data15;
    if (!cacheKey) {
      console.warn("CacheKey missing in SalesManItemwiseReport API response.", res);
    }
    openReportViewer("SalesManItemwiseReport", {CacheKey: cacheKey,
      Daily: daily, GroupBy, Fromdate, Todate, ReportType: ReportTypenew, ReportTitle,
      ReportTT: SubReportType, CName, CAddress, CPhone,
    });
  } else {
    setMsg({ text: "No Record !!!.", isErr: true });
  }
  setGroupBy(""); setGroupByText("");
}
      // ═══ Day Wise Sale Report ═══
      else if (reportType === REPORT_TYPES.DAYWISE_SALE) {
        const SubReportType = chkProfit ? "Profit" : "";
        const ReportTitle = "Day Wise Profit";
        const res = await CC.api(EP.DayWiseSaleReport, null, {React:1}, { Fromdate, Todate, Comid, ReportType: SubReportType });
        console.log('DayWiseSaleReport response:', res);
        if (res.ok) {
          const cacheKey = res.data15 ?? res.Data15 ?? res.data?.Data15;
          console.log('resolved cacheKey:', cacheKey);
          openReportViewer("DayWiseSaleReport", { CacheKey: cacheKey,
            Fromdate, Todate, ReportType: SubReportType, GroupBy: "", ReportTitle,
            ProfitMarkDown: session.ProfitMarkDown, CName, CAddress, CPhone,
          });
        } else {
          setMsg({ text: "No Record !!!.", isErr: true });
        }
      }

// ═══ Hourly Sale / Hourly Itemwise Report ═══
else if (reportType === REPORT_TYPES.HOURLY_SALE || reportType === REPORT_TYPES.HOURLY_ITEMWISE) {
  const isAmount = reportType === REPORT_TYPES.HOURLY_SALE;
  const ReportTitle = isAmount ? "Hourly Itemwise Amount Report" : "Hourly Itemwise Quantity Report";
  const Amount = isAmount ? 1 : 0;
  const res = await CC.api(EP.HourlyItemwiseAmountReport, null, {React:1}, { Amount, Fromdate, Todate, Comid, MComid });
  if (res.ok) {
    const cacheKey = res.Data15 ?? res.data15 ?? res.data?.Data15 ?? res.data?.data15;
    if (!cacheKey) {
      console.warn("CacheKey missing in HourlyItemwiseAmountReport API response.", res);
    }
    openReportViewer("HourlyItemwiseAmountReport", {
      CacheKey: cacheKey,
      Amount,                          // ✅ இப்போ சேர்த்தேன் — ASPX branch இதை நம்பி இருக்கு
      Daily: daily, GroupBy, Fromdate, Todate, TaxSuppressId, ReportType: ReportTypenew, ReportTitle,
      taxinclusivedontshow: session.taxInclusiveDontShow, CName, CAddress, CPhone,
    });
  } else {
    setMsg({ text: "No Record !!!.", isErr: true });
  }
}
      // ═══ Hourly Profit Report ═══
// ═══ Hourly Profit Report ═══ Hourly Sale Amount Report
else if (reportType === REPORT_TYPES.HOURLY_PROFIT) {
  const ReportTitle = "Hourly Sale Amount Report";

  const res = await CC.api(
    EP.HourlyItemwiseSaleAmountReport,
    null,
    { React: 1 },
    { Fromdate, Todate, Comid, MComid }
  );
  console.log("FULL API RESPONSE:", JSON.stringify(res, null, 2));  
  if (res.ok) {

    const cacheKey =
      res.Data15 ??
      res.data15 ??
      res.data?.Data15 ??
      res.data?.data15;

      console.log("Resolved cacheKey:", cacheKey); 

    openReportViewer("HourlywiseProfitReport", {
      CacheKey: cacheKey,
      rdbHourlyUpto: hourlyUpto,
      Daily: daily,
      GroupBy,
      Fromdate,
      Todate,
      ReportType: ReportTypenew,
      ReportTitle,
      CName,
      CAddress,
      CPhone,
    });

  } else {
    setMsg({ text: "No Record !!!.", isErr: true });
  }
}

      // ═══ Cancel Bill Summary Report ═══
      else if (reportType === REPORT_TYPES.CANCEL_BILL) {
        const ReportTitle = "Cancel Bill Summary Report";
        const res = await CC.api(EP.CancelBillLogReport, null, {React: 1}, { Fromdate, Todate, Comid });
      
        if (res.ok) {
          const cacheKey =
            res.Data15 ?? res.data15 ?? res.data?.Data15 ?? res.data?.data15;
      
          if (!cacheKey) {
            console.warn("CacheKey missing in CancelBillLogReport response.", res);
          }
      
          openReportViewer("CancelBillLogSummaryReport", {
            CacheKey: cacheKey,          // ✅ இதை add பண்ணணும்
            Daily: daily,
            Fromdate,
            Todate,
            ReportType: ReportTypenew,
            ReportTitle,
            CName,
            CAddress,
            CPhone,
          });
        } else {
          setMsg({ text: "No Record !!!.", isErr: true });
        }
      }

      // ═══ Modified Bill Report (Consolidate / Detail) ═══
      else if (reportType === REPORT_TYPES.MODIFIED_REPORT) {
        if (consolidateOrDetail === "CONS") {
          const ReportTitle = "Modified Bill Consolidate Report";
          const res = await CC.api(EP.ModifiedBillReport, null, { React: 1 }, { Fromdate, Todate, Comid });
      
          if (res.ok) {
            const cacheKey =
              res.Data15 ?? res.data15 ?? res.data?.Data15 ?? res.data?.data15;
      
            if (!cacheKey) {
              console.warn("CacheKey missing in ModifiedBillReport response.", res);
            }
      
            openReportViewer("ModifiedBillReport", {
              CacheKey: cacheKey,          // ✅ இதை add பண்ணணும்
              Daily: daily,
              GroupBy,
              Fromdate,
              Todate,
              ReportType: ReportTypenew,
              ReportTitle,
              CName,
              CAddress,
              CPhone,
            });
          } else {
            setMsg({ text: "No Record !!!.", isErr: true });
          }
        } else {
          const ReportTitle = "Modified Bill Detail Report";
          const res = await CC.api(EP.ModifiedBillDetailsReport, null, { React: 1 }, { Fromdate, Todate, Comid, MComid });
      
          if (res.ok) {
            const cacheKey =
              res.Data15 ?? res.data15 ?? res.data?.Data15 ?? res.data?.data15;
      
            if (!cacheKey) {
              console.warn("CacheKey missing in ModifiedBillDetailsReport response.", res);
            }
      
            openReportViewer("ModifiedBillDetailReport", {
              CacheKey: cacheKey,          // ✅ இதை add பண்ணணும்
              Daily: daily,
              GroupBy,
              Fromdate,
              Todate,
              ReportType: ReportTypenew,
              ReportTitle,
              taxinclusivedontshow: session.taxInclusiveDontShow,
              CName,
              CAddress,
              CPhone,
            });
          } else {
            setMsg({ text: "No Record !!!.", isErr: true });
          }
        }
      }

      // ═══ Billwise Profit Report ═══
      else if (reportType === REPORT_TYPES.BILLWISE_PROFIT) {
        const ReportTitle = "Billwise Profit Report";
        const res = await CC.api(EP.BillWiseProfitReport, null, { React: 1 }, { GroupByText, Fromdate, Todate, Comid, MComid });
      
        if (res.ok) {
          const cacheKey =
            res.Data15 ?? res.data15 ?? res.data?.Data15 ?? res.data?.data15;
      
          if (!cacheKey) {
            console.warn("CacheKey missing in BillWiseProfitReport response.", res);
          }
      
          openReportViewer("BillWiseProfitReport", {
            CacheKey: cacheKey,          // ✅ இதை add பண்ணணும்
            Daily: daily,
            GroupBy,
            Fromdate,
            Todate,
            ReportType: ReportTypenew,
            ReportTitle,
            TaxSuppressId,
            CName,
            CAddress,
            CPhone,
          });
        } else {
          setMsg({ text: "No Record !!!.", isErr: true });
        }
      }

      // ═══ All Type Report (requires F11 Group selection) ═══
      // else if (reportType === REPORT_TYPES.TYPE_REPORT) {
      //   let gb = "";
      //   if (groupBy) gb = groupBy.toLocaleUpperCase();

      //   if (!gb) {
      //     setLoading(false);
      //     alert("Press F11 Select Group Name !!!.");
      //     return;
      //   }
      //   const ReportTitle = "ALL TYPE Report";
      //   const res = await CC.api(EP.AllTypeOfTotalReport, null, {React: 1}, { GroupBy: gb, Fromdate, Todate, Comid, MComid });
      //   if (res.ok) {
      //     openReportViewer("AllTypeOfTotalReport", { Daily: daily, GroupBy: gb, Fromdate, Todate, ReportType: ReportTypenew, ReportTitle, CName, CAddress, CPhone });
      //   } else {
      //     setMsg({ text: "No Record !!!.", isErr: true });
      //   }
      //   setGroupBy("");
      // }
      else if (reportType === REPORT_TYPES.TYPE_REPORT) {
        let gb = "";
        if (groupBy) gb = groupBy.toLocaleUpperCase();
      
        if (!gb) {
          setLoading(false);
          alert("Press F11 Select Group Name !!!.");
          return;
        }
      
        const ReportTitle = "ALL TYPE Report";
      
        try {
          const res = await CC.api(
            EP.AllTypeOfTotalReport,
            null,
            { React: 1 },
            { GroupBy: gb, Fromdate, Todate, Comid, MComid }
          );
      
          if (res?.ok) {
            const cacheKey =
              res.data15 ?? res.Data15 ?? res.data?.data15 ?? res.data?.Data15;
      
            if (!cacheKey) {
              console.warn("CacheKey missing in AllTypeOfTotalReport response.", res);
              setMsg({ text: "No Record !!!.", isErr: true });
            } else {
              openReportViewer("AllTypeOfTotalReport", {
                CacheKey: cacheKey,
                Daily: daily,
                GroupBy: gb,
                Fromdate,
                Todate,
                ReportType: ReportTypenew,
                ReportTitle,
                CName,
                CAddress,
                CPhone,
              });
            }
          } else {
            setMsg({ text: "No Record !!!.", isErr: true });
          }
        } catch (err) {
          setMsg({ text: `Error: ${err?.message ?? String(err)}`, isErr: true });
        } finally {
          setLoading(false);
          setGroupBy("");
        }
      }

      // ═══ Customer Bill Summary Report ═══
      else if (reportType === REPORT_TYPES.CUSTOMER_BILL_SUMMARY) {
        const ReportTitle = "Customer Bill Summary Report";
        const res = await CC.api(EP.CustomerBillSummaryReport, null, {React: 1}, { GroupByText, Fromdate, Todate, Comid });
        if (res.ok) {
          const cacheKey =
          res.Data15 ?? res.data15 ?? res.data?.Data15 ?? res.data?.data15;
    
        if (!cacheKey) {
          console.warn("CacheKey missing in CustomerBillSummaryReport response.", res);
        }
          openReportViewer("CustomerBillSummaryReport", {CacheKey: cacheKey,  Daily: daily, GroupBy, Fromdate, Todate, ReportType: ReportTypenew, ReportTitle, CName, CAddress, CPhone });
        } else {
          setMsg({ text: "No Record !!!.", isErr: true });
        }
      }
    } catch (err) {
      setMsg({ text: err.message || "Something went wrong.", isErr: true });
    } finally {
      setLoading(false);
    }
  }, [
    reportType, fromDate, toDate, daily, hourlyUpto, chkMrp, checkBillno, chktime, chkTax,
    billNoFrom, billNoTo, groupByMode, customer, salesman, cashier, counter, saleType,
    itemwiseSubType, chkProfit, consolidateOrDetail, groupBy, groupByText, session, openReportViewer,
  ]);

  // ── Scoped styles (same naming convention family as SaleOrderReport.jsx, "sr-" prefix) ──
  const styles = `
    .sr-shell { min-height: 100vh; background: #f0f2f5; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; flex-direction: column; }
    .sr-layout { display: flex; flex: 1; justify-content: center; padding: 24px; max-width: 900px; width: 100%; margin: 0 auto; box-sizing: border-box; }

    .sr-card { width: 100%; background: #fff; border: 2px solid #1a56db; border-radius: 10px; box-shadow: 0 4px 16px rgba(26,86,219,.18); overflow: hidden; display: flex; flex-direction: column; }
    .sr-card-header { background: linear-gradient(135deg, #3b6fe0, #1a4fd1); border-bottom: 1px solid #1a4fd1; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; }
    .sr-card-header-title { font-size: 14px; font-weight: 700; color: #fff; letter-spacing: .2px; }
    .sr-card-close-btn { display: flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 6px; border: none; background: rgba(255,255,255,.16); color: #fff; cursor: pointer; padding: 0; transition: background .15s; }
    .sr-card-close-btn:hover { background: rgba(255,255,255,.3); }
    .sr-card-body { padding: 24px 32px 30px; }
    .sr-report-title { text-align: center; font-size: 22px; font-weight: 800; color: #1a3fd6; margin: 0 0 22px; }

    .sr-content { display: flex; gap: 20px; align-items: flex-start; }

    .sr-nav { width: 260px; flex-shrink: 0; display: flex; flex-direction: column; gap: 8px; max-height: calc(100vh - 220px); overflow-y: auto; }
    .sr-nav-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; color: #8a94a6; padding: 0 4px; margin-bottom: 2px; }
    .sr-nav-card { background: #fff; border: 1.5px solid #d1d9e6; border-radius: 8px; padding: 10px 12px; cursor: pointer; transition: border-color .15s, box-shadow .15s, background .15s; display: flex; align-items: center; gap: 10px; }
    .sr-nav-card:hover { border-color: #1a56db; box-shadow: 0 3px 12px rgba(26,86,219,.12); }
    .sr-nav-card.active { background: #eef3ff; border-color: #1a56db; box-shadow: 0 3px 12px rgba(26,86,219,.15); }
    .sr-nav-icon { width: 28px; height: 28px; border-radius: 8px; background: #e8edfc; display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; }
    .sr-nav-card.active .sr-nav-icon { background: #1a56db; }
    .sr-nav-card-name { font-size: 12.5px; font-weight: 600; color: #1e2d3d; line-height: 1.3; }
    .sr-nav-card.active .sr-nav-card-name { color: #1a56db; }

    .sr-panel { flex: 1; display: flex; flex-direction: column; min-width: 0; }
    .sr-panel-header { border-bottom: 1px solid #e8ecf0; padding-bottom: 16px; margin-bottom: 24px; }
    .sr-panel-eyebrow { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; color: #1a56db; margin-bottom: 6px; }
    .sr-panel-title { font-size: 20px; font-weight: 700; color: #1e2d3d; line-height: 1.2; }

    .sr-section { margin-bottom: 22px; }
    .sr-section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .6px; color: #8a94a6; margin-bottom: 10px; }

    .sr-form-grid { display: grid; grid-template-columns: 130px 1fr; gap: 14px 14px; align-items: center; max-width: 520px; }
    .sr-label { font-size: 13px; font-weight: 600; color: #1e293b; }
    .sr-input, .sr-select { height: 34px; border: 1px solid #c7cdd6; border-radius: 4px; padding: 0 10px; font-size: 13px; color: #1e2d3d; background: #fff; width: 100%; box-sizing: border-box; outline: none; transition: border-color .15s, box-shadow .15s; }
    .sr-input:focus, .sr-select:focus { border-color: #1a56db; box-shadow: 0 0 0 3px rgba(26,86,219,.15); }
    .sr-input:disabled, .sr-select:disabled { background: #f4f6f9; color: #9aa5b1; cursor: not-allowed; }
    select.sr-select, select.sr-input { appearance: auto; cursor: pointer; }

    .sr-combobox { position: relative; width: 100%; }
    .sr-combobox-list { position: absolute; z-index: 20; top: calc(100% + 4px); left: 0; right: 0; max-height: 220px; overflow-y: auto; background: #fff; border: 1px solid #c7cdd6; border-radius: 6px; box-shadow: 0 8px 24px rgba(20,30,50,.12); margin: 0; padding: 4px; list-style: none; }
    .sr-combobox-item { padding: 8px 10px; font-size: 13px; color: #1e2d3d; border-radius: 6px; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .sr-combobox-item:hover, .sr-combobox-item.active { background: #eef3ff; color: #1a56db; }
    .sr-combobox-empty { padding: 8px 10px; font-size: 13px; color: #9aa5b1; }

    .sr-toggle-row { display: flex; align-items: center; gap: 10px; height: 34px; background: #f7f9fc; border: 1px solid #c7cdd6; border-radius: 4px; padding: 0 12px; cursor: pointer; font-size: 13px; color: #1e293b; font-weight: 500; user-select: none; }
    .sr-toggle-row input[type="checkbox"] { width: 15px; height: 15px; accent-color: #1a56db; cursor: pointer; }
    .sr-toggle-row.disabled { opacity: .5; cursor: not-allowed; }

    .sr-radio-group { display: flex; flex-wrap: wrap; gap: 8px; }
    .sr-radio-pill { display: flex; align-items: center; gap: 6px; padding: 7px 12px; border-radius: 20px; border: 1px solid #c7cdd6; font-size: 12.5px; font-weight: 600; color: #1e293b; cursor: pointer; background: #fff; }
    .sr-radio-pill.checked { border-color: #1a56db; background: #eef3ff; color: #1a56db; }
    .sr-radio-pill.disabled { opacity: .45; cursor: not-allowed; }
    .sr-radio-pill input { accent-color: #1a56db; cursor: pointer; }

    .sr-actions { display: flex; gap: 12px; margin-top: 8px; padding-top: 20px; border-top: 1px solid #e8ecf0; }
    .sr-btn { height: 38px; padding: 0 30px; border-radius: 6px; border: 1px solid #1a56db; font-size: 14px; font-weight: 700; cursor: pointer; transition: opacity .15s, box-shadow .15s, background .15s; display: flex; align-items: center; gap: 8px; background: #fff; color: #1a56db; }
    .sr-btn:disabled { opacity: .5; cursor: not-allowed; }
    .sr-btn:not(:disabled):hover { background: #eef3ff; }
    .sr-btn-primary { border-color: #1e7e34; color: #1e7e34; }
    .sr-btn-primary .sr-icon-save { color: #1e7e34; }
    .sr-btn-secondary { border-color: #dc3545; color: #dc3545; }
    .sr-btn-secondary .sr-icon-cancel { color: #dc3545; }

    .sr-msg { margin-top: 18px; padding: 10px 14px; border-radius: 8px; font-size: 13px; font-weight: 500; }
    .sr-msg.err { background: #fff0f0; color: #c53030; border: 1px solid #fed7d7; }
    .sr-msg.ok  { background: #f0fff4; color: #276749; border: 1px solid #c6f6d5; }

    .sr-f11-hint { font-size: 12px; color: #8a94a6; background: #f7f9fc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 8px 12px; margin-top: 4px; }

    @media (max-width: 900px) {
      .sr-layout { padding: 16px; }
      .sr-card-body { padding: 20px; }
      .sr-content { flex-direction: column; }
      .sr-nav { width: 100%; flex-direction: row; flex-wrap: wrap; max-height: none; }
      .sr-nav-card { flex: 1 1 calc(50% - 4px); }
      .sr-form-grid { grid-template-columns: 110px 1fr; }
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

  const groupByPills = [
    { mode: GROUP_BY.CUSTOMER, label: "Customer", combo: customer, list: customerList, setCombo: setCustomer, disabled: uiConfig.groupByDisabled.Customer },
    { mode: GROUP_BY.SALESMAN, label: "Salesman", combo: salesman, list: salesmanList, setCombo: setSalesman, disabled: uiConfig.groupByDisabled.Salesman },
    { mode: GROUP_BY.CASHIER,  label: "Cashier",  combo: cashier,  list: cashierList,  setCombo: setCashier,  disabled: uiConfig.groupByDisabled.Cashier },
    { mode: GROUP_BY.COUNTER,  label: "Counter",  combo: counter,  list: counterList,  setCombo: setCounter,  disabled: uiConfig.groupByDisabled.Counter },
    { mode: GROUP_BY.SALETYPE, label: "SaleType", combo: saleType, list: saleTypeList, setCombo: setSaleType, disabled: uiConfig.groupByDisabled.SaleType },
  ];
  const anyGroupByEnabled = groupByPills.some((p) => !p.disabled);

  // Whichever Group-By pill is currently active (Customer/Salesman/Cashier/
  // Counter/SaleType) — same lookup used in three places below, kept in one
  // spot so the combo, its list and its label all stay in sync.
  const activeGroupByPill = groupByPills.find((p) => p.mode === groupByMode) || null;

  // Client-side filter of the active pill's list against the typed search
  // text — mirrors f11FilteredOptions: no network call, just narrows down
  // whatever was already loaded for this mode. Plain computation (not
  // useMemo) since this sits after the pageAccess early-returns above, where
  // a hook here would violate the rules of hooks — the list is small enough
  // that recomputing on every render is cheap regardless.
  const groupComboAllOptions = activeGroupByPill?.list || [];
  const groupComboQuery = groupComboSearchText.trim().toLowerCase();
  const groupComboFilteredOptions = !groupComboQuery
    ? groupComboAllOptions
    : groupComboAllOptions.filter((o) => o.label.toLowerCase().includes(groupComboQuery));

  return (
    <>
      <style>{styles}</style>
      <div className="sr-shell">
        <Topbar />

        <div className="sr-layout">
          <div className="sr-card">
            <div className="sr-card-header">
              <div className="sr-card-header-title">Sales Report</div>
              <button
                type="button"
                className="sr-card-close-btn"
                onClick={() => navigate(-1)}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <div className="sr-card-body">
              <div className="sr-report-title">
                {NAV_ITEMS.find((n) => n.value === reportType)?.label || "Sales Report"}
              </div>

              <div className="sr-content">
              {/* ── LEFT: Navigation panel ── */}
              <nav className="sr-nav" aria-label="Report types">
                <div className="sr-nav-label">Report Types</div>
                {NAV_ITEMS.map((item) => (
                  <div
                    key={item.value}
                    className={`sr-nav-card${reportType === item.value ? " active" : ""}`}
                    onClick={() => handleReportTypeChange(item.value)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && handleReportTypeChange(item.value)}
                    aria-pressed={reportType === item.value}
                  >
                    <div className="sr-nav-icon">{item.icon}</div>
                    <div className="sr-nav-card-name">{item.label}</div>
                  </div>
                ))}
              </nav>

              {/* ── RIGHT: Filter panel ── */}
              <main className="sr-panel">
            {/* ── Date / Daily / Hourly-upto / MRP ── */}
            <div className="sr-section">
              <div className="sr-form-grid">
                <label className="sr-label" htmlFor="sr-from-date">From Date</label>
                <DateFieldDDMMYYYY id="pri-from-date" value={fromDate} onChange={setFromDate} />

                <label className="sr-label" htmlFor="sr-to-date">To Date</label>
                <DateFieldDDMMYYYY id="pri-to-date" value={toDate} onChange={setToDate} />
                {uiConfig.showDaily && (
                  <>
                    <label className="sr-label">Daily</label>
                    <label className="sr-toggle-row">
                      <input type="checkbox" checked={daily} onChange={(e) => setDaily(e.target.checked)} />
                      {daily ? "Enabled" : "Disabled"}
                    </label>
                  </>
                )}

                {uiConfig.showHourlyUpto && (
                  <>
                    <label className="sr-label">Hourly Upto</label>
                    <label className="sr-toggle-row">
                      <input type="checkbox" checked={hourlyUpto} onChange={(e) => setHourlyUpto(e.target.checked)} />
                      {hourlyUpto ? "Enabled" : "Disabled"}
                    </label>
                  </>
                )}

                {uiConfig.showMrp && (
                  <>
                    <label className="sr-label">MRP</label>
                    <label className="sr-toggle-row">
                      <input type="checkbox" checked={chkMrp} onChange={(e) => setChkMrp(e.target.checked)} />
                      {chkMrp ? "Enabled" : "Disabled"}
                    </label>
                  </>
                )}

                {reportType === REPORT_TYPES.DAYWISE_SALE && uiConfig.showChkProfit && (
                  <>
                    <label className="sr-label">Profit</label>
                    <label className="sr-toggle-row">
                      <input type="checkbox" checked={chkProfit} onChange={(e) => setChkProfit(e.target.checked)} />
                      {chkProfit ? "Enabled" : "Disabled"}
                    </label>
                  </>
                )}
              </div>
            </div>

            {/* ── Bill No panel (checkBillno) ── */}
            {uiConfig.showSaleBillTypePanel && (
              <div className="sr-section">
                <div className="sr-section-title">Bill No Range</div>
                <label className="sr-toggle-row" style={{ maxWidth: 220, marginBottom: 12 }}>
                  <input type="checkbox" checked={checkBillno} onChange={(e) => handleCheckBillnoToggle(e.target.checked)} />
                  Filter By Bill No
                </label>
                {checkBillno && (
                  <div className="sr-form-grid">
                    <label className="sr-label" htmlFor="sr-billno-from">Bill No From</label>
                    <input id="sr-billno-from" type="text" className="sr-input" value={billNoFrom} onChange={(e) => setBillNoFrom(e.target.value)} />
                    <label className="sr-label" htmlFor="sr-billno-to">Bill No To</label>
                    <input id="sr-billno-to" type="text" className="sr-input" value={billNoTo} onChange={(e) => setBillNoTo(e.target.value)} />
                  </div>
                )}
              </div>
            )}

            {/* ── Pane3: Consolidate / Detail (Modified Bill Report) ── */}
            {uiConfig.showPanelSaleReportType && (
              <div className="sr-section">
                <div className="sr-section-title">Report Mode</div>
                <div className="sr-radio-group">
                  <label className={`sr-radio-pill${consolidateOrDetail === "CONS" ? " checked" : ""}`}>
                    <input type="radio" name="sr-pane3" checked={consolidateOrDetail === "CONS"} onChange={() => setConsolidateOrDetail("CONS")} />
                    Consolidate
                  </label>
                  <label className={`sr-radio-pill${consolidateOrDetail === "DETAIL" ? " checked" : ""}`}>
                    <input type="radio" name="sr-pane3" checked={consolidateOrDetail === "DETAIL"} onChange={() => setConsolidateOrDetail("DETAIL")} />
                    Detail
                  </label>
                </div>
              </div>
            )}

            {/* ── Pane22: Salesman Itemwise sub-type (univercell only) ── */}
            {uiConfig.showItemwisePane && (
              <div className="sr-section">
                <div className="sr-section-title">Report Sub-Type</div>
                <div className="sr-radio-group">
                  {[
                    { value: "ItemWise", label: "Item Wise" },
                    { value: "PackageQty", label: "Package Qty" },
                    { value: "commission", label: "Commission" },
                    { value: "all", label: "All (Bill Wise)" },
                  ].map((opt) => (
                    <label key={opt.value} className={`sr-radio-pill${itemwiseSubType === opt.value ? " checked" : ""}`}>
                      <input type="radio" name="sr-pane22" checked={itemwiseSubType === opt.value} onChange={() => setItemwiseSubType(opt.value)} />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* ── Pane2: Group By (Customer / Salesman / Cashier / Counter / SaleType) ── */}
            {anyGroupByEnabled && (
              <div className="sr-section">
                <div className="sr-section-title">Group By</div>
                <div className="sr-radio-group" style={{ marginBottom: 12 }}>
                  {groupByPills.map((p) => (
                    <label key={p.mode} className={`sr-radio-pill${groupByMode === p.mode ? " checked" : ""}${p.disabled ? " disabled" : ""}`}>
                      <input
                        type="radio"
                        name="sr-pane2"
                        disabled={p.disabled}
                        checked={groupByMode === p.mode}
                        onChange={() => selectGroupByMode(p.mode)}
                      />
                      {p.label}
                    </label>
                  ))}
                </div>

                {groupByMode && (
                  <div className="sr-form-grid">
                    <label className="sr-label" htmlFor="sr-groupby-select">{activeGroupByPill?.label} Name</label>
                    <div className="sr-combobox">
                      <input
                        id="sr-groupby-select"
                        type="text"
                        className="sr-input"
                        autoComplete="off"
                        placeholder="Type to search…"
                        value={groupComboSearchText}
                        onChange={(e) => {
                          setGroupComboSearchText(e.target.value);
                          handleComboChange(groupByMode, null); // typing invalidates the previous pick
                          setGroupComboDropdownOpen(true);
                          setGroupComboHighlightIndex(0);
                        }}
                        onFocus={() => setGroupComboDropdownOpen(true)}
                        onBlur={() => {
                          // small delay so a click on an option registers before the list closes
                          setTimeout(() => setGroupComboDropdownOpen(false), 150);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "ArrowDown") {
                            e.preventDefault();
                            setGroupComboDropdownOpen(true);
                            setGroupComboHighlightIndex((i) => Math.min(i + 1, groupComboFilteredOptions.length - 1));
                          } else if (e.key === "ArrowUp") {
                            e.preventDefault();
                            setGroupComboHighlightIndex((i) => Math.max(i - 1, 0));
                          } else if (e.key === "Enter") {
                            e.preventDefault();
                            const opt = groupComboDropdownOpen ? groupComboFilteredOptions[groupComboHighlightIndex] : null;
                            if (opt) handleComboChange(groupByMode, opt);
                          } else if (e.key === "Escape") {
                            setGroupComboDropdownOpen(false);
                          }
                        }}
                      />
                      {groupComboDropdownOpen && (
                        <ul className="sr-combobox-list">
                          {groupComboFilteredOptions.length === 0 ? (
                            <li className="sr-combobox-empty">No matches</li>
                          ) : (
                            groupComboFilteredOptions.map((o, i) => (
                              <li
                                key={o.value}
                                className={`sr-combobox-item${i === groupComboHighlightIndex ? " active" : ""}`}
                                onMouseDown={(e) => {
                                  e.preventDefault(); // fire before the input's onBlur closes the list
                                  handleComboChange(groupByMode, o);
                                }}
                                onMouseEnter={() => setGroupComboHighlightIndex(i)}
                              >
                                {o.label}
                              </li>
                            ))
                          )}
                        </ul>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── F11 hint (ItemWise / ItemWiseProfit / TypeReport) ── */}
            {uiConfig.showF11 && (
              <div className="sr-section">
                <div className="sr-f11-hint">
                  Press <strong>F11</strong> to select a Group Name{groupByText ? ` — Selected: ${groupByText}` : ""}.
                </div>
              </div>
            )}

            <div className="sr-actions">
              <button type="button" className="sr-btn sr-btn-primary" disabled={loading || pageAccess.pageview === 0} onClick={handleView}>
                <Save size={16} className="sr-icon-save" />
                {loading ? "Loading…" : "View"}
              </button>
              <button type="button" className="sr-btn sr-btn-secondary" onClick={handleRefresh} disabled={loading}>
                <XCircle size={16} className="sr-icon-cancel" />
                Refresh
              </button>
            </div>

            {msg && <div className={`sr-msg ${msg.isErr ? "err" : "ok"}`}>{msg.text}</div>}
          </main>
              </div>
            </div>
          </div>
        </div>

        {/* ── Loader overlay ── */}
        {loading && (
          <div className="mp-loader-ov">
            <div className="mp-ldr-box">
              <div className="mp-spin" />
              <div className="mp-ldr-msg">Loading...</div>
            </div>
          </div>
        )}

        {/* ── ItemGroup picker dialog (F11) — inline panel, ported from ItemGroup.js ── */}
        {showGroupPopup && (
          <div className="mp-picker-ov" onClick={() => setShowGroupPopup(false)}>
            <div className="mp-picker" style={{ width: 560, height: "auto" }} onClick={(e) => e.stopPropagation()}>
              <header>
                <h3>ProductGroup</h3>
                <button className="mp-picker-close" onClick={() => setShowGroupPopup(false)}>✕</button>
              </header>
              <div style={{ padding: 16 }}>
                <div className="sr-radio-group" style={{ marginBottom: 16, flexWrap: "wrap" }}>
                  {F11_MODES.map((m) => (
                    <label key={m.value} className={`sr-radio-pill${f11Mode === m.value ? " checked" : ""}`}>
                      <input
                        type="radio"
                        name="f11-mode"
                        checked={f11Mode === m.value}
                        onChange={() => handleF11ModeChange(m.value)}
                      />
                      {m.label}
                    </label>
                  ))}
                </div>

                <div className="sr-form-grid" style={{ marginBottom: 16 }}>
                  <label className="sr-label" htmlFor="sr-f11-select">{f11Mode} Name</label>
                  <div className="sr-combobox">
                    <input
                      id="sr-f11-select"
                      type="text"
                      className="sr-input"
                      autoComplete="off"
                      disabled={F11_UNSUPPORTED_MODES.includes(f11Mode)}
                      placeholder={f11Loading ? "Loading…" : "Type to search…"}
                      value={f11SearchText}
                      onChange={(e) => {
                        setF11SearchText(e.target.value);
                        setF11Selected(null);       // typing invalidates the previous pick
                        setF11DropdownOpen(true);
                        setF11HighlightIndex(0);
                      }}
                      onFocus={() => setF11DropdownOpen(true)}
                      onBlur={() => {
                        // small delay so a click on an option registers before the list closes
                        setTimeout(() => setF11DropdownOpen(false), 150);
                      }}
                      onKeyDown={(e) => {
                        if (F11_UNSUPPORTED_MODES.includes(f11Mode)) return;
                        if (e.key === "ArrowDown") {
                          e.preventDefault();
                          setF11DropdownOpen(true);
                          setF11HighlightIndex((i) => Math.min(i + 1, f11FilteredOptions.length - 1));
                        } else if (e.key === "ArrowUp") {
                          e.preventDefault();
                          setF11HighlightIndex((i) => Math.max(i - 1, 0));
                        } else if (e.key === "Enter") {
                          e.preventDefault();
                          const opt = f11DropdownOpen ? f11FilteredOptions[f11HighlightIndex] : null;
                          if (opt) {
                            f11SelectOption(opt);
                            handleGroupPopupClose(f11Mode, f11ValueFor(opt));
                          } else {
                            confirmF11Selection();
                          }
                        } else if (e.key === "Escape") {
                          setF11DropdownOpen(false);
                        }
                      }}
                    />
                    {f11DropdownOpen && !F11_UNSUPPORTED_MODES.includes(f11Mode) && (
                      <ul className="sr-combobox-list">
                        {f11FilteredOptions.length === 0 ? (
                          <li className="sr-combobox-empty">
                            {f11Loading ? "Loading…" : "No matches"}
                          </li>
                        ) : (
                          f11FilteredOptions.map((o, i) => (
                            <li
                              key={o.value}
                              className={`sr-combobox-item${i === f11HighlightIndex ? " active" : ""}`}
                              onMouseDown={(e) => {
                                e.preventDefault(); // fire before the input's onBlur closes the list
                                f11SelectOption(o);
                              }}
                              onMouseEnter={() => setF11HighlightIndex(i)}
                            >
                              {o.label}
                            </li>
                          ))
                        )}
                      </ul>
                    )}
                  </div>
                  {F11_UNSUPPORTED_MODES.includes(f11Mode) && (
                    <div className="sr-msg err" style={{ marginTop: 8 }}>
                      No {f11Mode} endpoint exists in Common.jsx yet — add a Select{f11Mode}All-style
                      export (matching BW_Brand / GetSupplierAll) to enable this filter.
                    </div>
                  )}
                </div>

                <div className="sr-actions">
                  <button type="button" className="sr-btn sr-btn-primary" onClick={confirmF11Selection}>
                    <Save size={16} className="sr-icon-save" />
                    View
                  </button>
                  <button type="button" className="sr-btn sr-btn-secondary" onClick={handleF11Refresh}>
                    <XCircle size={16} className="sr-icon-cancel" />
                    Refresh
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}