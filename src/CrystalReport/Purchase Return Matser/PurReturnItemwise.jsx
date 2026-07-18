// ─────────────────────────────────────────────────────────────────────────────
//  PurchaseReturnItemWise.jsx
//  React conversion of the "Purchase Return Itemwise" jQuery screen
//  Uses API helpers from Common.jsx (CC.api / CC.mkUrl / CC.authHeaders etc.)
//  Layout / card styling: shared "so-" design system (BranchWise.jsx /
//  PurchaseDet.jsx / PurReturnConsolidated.jsx / PurchaseReturnDetailed.jsx
//  palette — blue header, green Save, red Cancel)
//
//  NOTES — preserved exactly from the source jQuery file:
//  1) Permission gate: redirect to /Login/Index if no session (menulist ==
//     null). If "Purchase Return Itemwise" isn't in the menulist ->
//     Permission Denied + redirect to /Login/Home after 3s.
//     IMPORTANT: unlike PurchaseDet.js / the Return-Detailed screen, this
//     source does NOT have a second `menudata[0].View == 0` gate — that
//     check is simply absent here. Reproduced literally: no extra
//     view-permission redirect, and the View button is not disabled based
//     on `pageview` (source never does that here either).
//  2) Seven mutually-exclusive "group by" radios — Brand / Category /
//     Department / Supplier / UOM / Description / Code — each backed by
//     its own combo in the source (only the combo matching the checked
//     radio is enabled; all others are disabled and their selection is
//     cleared the moment their radio becomes unchecked). Reproduced here
//     as a single dynamic combo bound to whichever group-by radio is
//     active — functionally identical since only one combo can ever hold
//     a value at a time in the source, and switching radios clears the
//     previous one.
//  3) GroupBy is set to the literal group name ("Brand", "Category",
//     "Department", "Supplier", "UOM", "Description", "Code") the instant
//     its radio is checked — a combo selection is OPTIONAL. GroupByText
//     stays "" unless the user actually picks a combo value (matches
//     source: only assigned when `getSelectedItem() != null`).
//  4) GroupByText source field differs by type — Brand / Category /
//     Department / Supplier / UOM read `item.value`; Description / Code
//     read `item.label` instead (kept exactly as source).
//  5) Per-type validation message on an invalid/empty selection (only
//     fires if something was picked but resolved to nothing):
//       Brand      -> "Please Select Valid Brand Name !!!."
//       Category   -> "Please Select Valid Category Name !!!."
//       Department -> "Please Select Valid Department Name !!!."
//       Supplier   -> "Please Select Valid Supplier Name !!!."
//       UOM        -> "Please Select Valid UOM Name !!!."
//       Description-> "Please Select Valid Item Name !!!."
//       Code       -> "Please Select Valid Item Code !!!."
//  6) Dates: source reads the widget's Date object, formats it to
//     MM/dd/yyyy via `$.jqx.dataFormat.formatdate(date, 'MM/dd/yyyy')` for
//     both the validation comparison AND the AJAX payload / query string.
//     Reproduced below with `toMMDDYYYY`.
//  7) From/To date validation: `new Date(Fromdate) > new Date(Todate)` ->
//     alert "From Date Is Greater Than To Date!!", focus fromdate, return.
//  8) MRP flag is INVERTED: `mrp = "Pur.Rate"` by default; if the MRP
//     checkbox IS checked, `mrp` becomes `""` (blank). Reproduced exactly
//     — do NOT flip this logic.
//  9) Daily flag: `daily = ""` by default; if the Daily checkbox is
//     checked, `daily = "YES"`.
//  10) `RiceUOMSetting` is a fixed literal "0" forwarded to the
//      ReportViewer query string (source hard-codes it, never reads it
//      from settings) — reproduced as a constant.
//  11) `MComid` is a page-global in the source (not declared in the
//      snippet itself — set elsewhere on the page, same convention as
//      CName / CAddress / CPhone). Sourced here from local storage
//      alongside Comid.
//  12) AJAX body sends: Daily, MRP, GroupBy, GroupByText, Fromdate,
//      Todate, Comid, MComid. On `data.ok == true` a new window opens at
//      "../Reports/ReportViewer.aspx?ReportName=PurchaseReturnItemWise&Ri
//      ceUOMSetting=0&GroupBy=...&Fromdate=...&Todate=...&Daily=...&MRP=..
//      .&CName=...&CAddress=...&CPhone=..." — note GroupByText is sent to
//      the report AJAX call but is deliberately NOT forwarded to the
//      ReportViewer query string (kept exactly as source). Window title
//      is set to 'Purchase Return Itemwise-Report' once loaded. On
//      `data.ok == false` -> "No Record !!!." message.
//  13) After every View click (success or not) the source calls
//      `methods.Clear()`, clearing ALL combo selections unconditionally —
//      reproduced by resetting the dynamic combo's selected value.
//  14) Refresh button: clears every combo selection + disables every
//      combo, unchecks all 7 group-by radios, resets the date pickers
//      (re-init defaults to today, reproduced as todayStr()), and
//      unchecks Daily + MRP.
//
//  ASSUMPTIONS (please confirm / adjust):
//  - PageName string kept as "Purchase Return Itemwise" (from source).
//  - Endpoint ported from the source's MVC action
//    "/PurchaseReport/PurchaseReturnItemWiseReport" to the Web API
//    convention used elsewhere in this app:
//    "/api/PurchaseReportApp/PurchaseReturnItemWiseReport". Swap the
//    constant below if your backend route differs.
//  - Combo data sources assumed as GetBrand / GetCategory / GetDepartment
//    / GetSupplier / GetUOM / GetProduct, matching the naming convention
//    used in sibling screens (e.g. GetSupplier in PurchaseDet.jsx). The
//    Description and Code combos both read from the same product list
//    (mirrors source's single `loadproductcombo("#cmbdescription",
//    "#cmbcode")` call) but display ProductName vs ProductCode
//    respectively — adjust field names in `GROUP_OPTIONS` below if your
//    API differs.
//  - res.Data15 used nowhere here (source never used a cache key for this
//    screen either) — `data.ok === true` is the sole success signal, kept
//    literal.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Save, XCircle } from "lucide-react";
import * as CC from "../../components/Common";
import Topbar from "../../components/Topbar";

const BASE_URL = "http://localhost:64215";

// API endpoint used by this screen (ported from source MVC action
// "/PurchaseReport/PurchaseReturnItemWiseReport")
const PurchaseReturnItemWiseReportUrl = "/api/PurchaseReportApp/PurchaseReturnItemWiseReport";

// Combo data sources
const BrandListUrl = "/api/BrandApp/SelectBrand";
const CategoryListUrl = "/api/CategoryApp/SelectCategory";
const DepartmentListUrl = "/api/DepartmentApp/SelectDepartment";
const SupplierListUrl = "/api/SupplierApp/GetSupplier";
const UOMListUrl = "/api/UOMApp/SelectUOM";
const ProductListUrl = "/api/ItemMasterApp/GetProductList";

// Fixed literal forwarded to ReportViewer (source hard-codes this)
const RICE_UOM_SETTING = "0";

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

// Seven group-by options — order, keys and validation copy kept literal
// from source. `field` selects whether GroupByText is read from a
// value-style field (Brand/Category/Department/Supplier/UOM) or a
// label-style field (Description/Code), matching item.value vs
// item.label in the jQuery source.
const GROUP_OPTIONS = [
  { key: "Brand",       radioLabel: "Brand",       fieldLabel: "Brand",       validationLabel: "Brand Name",       listUrl: BrandListUrl,      field: "value" },
  { key: "Category",    radioLabel: "Category",    fieldLabel: "Category",    validationLabel: "Category Name",    listUrl: CategoryListUrl,   field: "value" },
  { key: "Department",  radioLabel: "Department",  fieldLabel: "Department",  validationLabel: "Department Name",  listUrl: DepartmentListUrl, field: "value" },
  { key: "Supplier",    radioLabel: "Supplier",    fieldLabel: "Supplier",    validationLabel: "Supplier Name",    listUrl: SupplierListUrl,   field: "value" },
  { key: "UOM",         radioLabel: "UOM",         fieldLabel: "UOM",         validationLabel: "UOM Name",         listUrl: UOMListUrl,        field: "value" },
  { key: "Description", radioLabel: "Description", fieldLabel: "Item Name",   validationLabel: "Item Name",        listUrl: ProductListUrl,    field: "label" },
  { key: "Code",        radioLabel: "Code",        fieldLabel: "Item Code",   validationLabel: "Item Code",        listUrl: ProductListUrl,    field: "label" },
];

// Extracts { value, label } pairs per combo type from raw API rows.
// Adjust the field-name fallback chains if your backend's payload differs.
const extractOption = (groupKey, row, idx) => {
  switch (groupKey) {
    case "Brand":
      return { id: row.Id ?? row.BrandId ?? idx, text: row.BrandName ?? row.Name ?? row.value ?? "" };
    case "Category":
      return { id: row.Id ?? row.CategoryId ?? idx, text: row.Cat_Name ?? row.Name ?? row.value ?? "" };
    case "Department":
      return { id: row.Id ?? row.DepartmentId ?? idx, text: row.DepartmentName ?? row.Name ?? row.value ?? "" };
    case "Supplier":
      return { id: row.Id ?? row.SupplierId ?? idx, text: row.AccountName ?? row.Name ?? row.value ?? "" };
    case "UOM":
      return { id: row.Id ?? row.UomId ?? idx, text: row.UOMName ?? row.Name ?? row.value ?? "" };
    case "Description":
      return { id: row.Id ?? row.ProductId ?? idx, text: row.ProductName ?? row.Name ?? row.label ?? "" };
    case "Code":
      return { id: row.Id ?? row.ProductId ?? idx, text: row.Productcode ?? row.Code ?? row.label ?? "" };
    default:
      return { id: idx, text: "" };
  }
};

export default function PurchaseReturnItemWise() {
  const navigate = useNavigate();
  const comboRef = useRef(null);

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
  });

  // ── Form state (controlled inputs replacing jqx widgets) ───────────────
  const [groupBy, setGroupBy] = useState("");          // "" | "Brand" | "Category" | ...
  const [groupByText, setGroupByText] = useState("");  // selected combo value/text
  const [fromDate, setFromDate] = useState(todayStr());
  const [toDate, setToDate] = useState(todayStr());
  const [daily, setDaily] = useState(false);   // chkdaily
  const [mrp, setMrp] = useState(false);       // chkmrp

  // ── Combo data, keyed by group option key ───────────────────────────────
  const [lists, setLists] = useState({
    Brand: [], Category: [], Department: [], Supplier: [], UOM: [], Description: [], Code: [],
  });

  // ── UI feedback state ───────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null); // { text, isErr }

  // Bootstrap: permission gate + session + all combo lists.
  useEffect(() => {
    const menulist = CC.getLocal("menulist");
    if (menulist == null) {
      setMsg({ text: "Session Close Please Login !!!.", isErr: true });
      navigate("/Login/Index");
      return;
    }

    const menudata = menulist.filter((obj) => obj.PageName === "Purchase Return Itemwise");
    if (!menudata || menudata.length === 0) {
      setMsg({ text: "Page Access Permission Denied !!!.", isErr: true });
      setTimeout(() => navigate("/Login/Home"), 3000);
      return;
    }
    // NOTE: source has no `menudata[0].View == 0` gate for this screen —
    // intentionally not reproduced here.

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

    const loadLists = async () => {
      try {
        const [brandRes, categoryRes, departmentRes, supplierRes, uomRes, productRes] = await Promise.all([
          CC.api(BrandListUrl, null, {}, { Comid }),
          CC.api(CategoryListUrl, null, {}, { Comid }),
          CC.api(DepartmentListUrl, null, {}, { Comid }),
          CC.api(SupplierListUrl, null, {}, { Comid, AccountType: "SUPPLIER" }),
          CC.api(UOMListUrl, null, {}, { Comid }),
          CC.api(ProductListUrl, null, {}, { Comid }),
        ]);

        const pick = (res) => res?.Data1 || res?.data || [];
        const brandList = pick(brandRes);
        const categoryList = pick(categoryRes);
        const departmentList = pick(departmentRes);
        const supplierList = pick(supplierRes);
        const uomList = pick(uomRes);
        const productList = pick(productRes);

        setLists({
          Brand: Array.isArray(brandList) ? brandList : [],
          Category: Array.isArray(categoryList) ? categoryList : [],
          Department: Array.isArray(departmentList) ? departmentList : [],
          Supplier: Array.isArray(supplierList) ? supplierList : [],
          UOM: Array.isArray(uomList) ? uomList : [],
          Description: Array.isArray(productList) ? productList : [],
          Code: Array.isArray(productList) ? productList : [],
        });
      } catch (err) {
        // Combo load failure shouldn't block the page — same as jQuery,
        // where the various loadXcombo() failures just leave the
        // combobox empty.
        console.error("PurchaseReturnItemWise combo load error:", err);
      }
    };
    loadLists();
  }, [navigate]);

  // Current active group option's config (or null if nothing checked yet)
  const activeOption = useMemo(
    () => GROUP_OPTIONS.find((o) => o.key === groupBy) || null,
    [groupBy]
  );

  const activeOptions = useMemo(() => {
    if (!activeOption) return [];
    const rows = lists[activeOption.key] || [];
    return rows.map((row, idx) => extractOption(activeOption.key, row, idx));
  }, [activeOption, lists]);

  const handleGroupByChange = useCallback((key) => {
    // Mirrors source: switching radios clears whatever combo value was
    // previously selected (the old radio's `change` handler resets its
    // combo's selectedIndex to -1 the instant it becomes unchecked).
    setGroupBy(key);
    setGroupByText("");
  }, []);

  const handleRefresh = useCallback(() => {
    setGroupBy("");
    setGroupByText("");
    setFromDate(todayStr());
    setToDate(todayStr());
    setDaily(false);
    setMrp(false);
  }, []);

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
          w.document.title = "Purchase Return Itemwise-Report";
        },
        false
      );
    }
  }, []);

  const handleView = useCallback(async () => {
    // ── Group-by combo validation (only fires if a value was picked but
    //    resolved to nothing — mirrors source's defensive null check) ──
    if (activeOption && groupByText !== "" && groupByText == null) {
      setMsg({ text: `Please Select Valid ${activeOption.validationLabel} !!!.`, isErr: true });
      setGroupByText("");
      if (comboRef.current) comboRef.current.focus();
      return;
    }

    const GroupBy = groupBy;
    const GroupByText = groupByText;

    if (!fromDate || !toDate) {
      setMsg({ text: "Please select From Date and To Date.", isErr: true });
      return;
    }

    const Fromdate = toMMDDYYYY(fromDate);
    const Todate = toMMDDYYYY(toDate);

    if (new Date(Fromdate) > new Date(Todate)) {
      setMsg({ text: "From Date Is Greater Than To Date!!", isErr: true });
      return;
    }

    // MRP flag is inverted: default "Pur.Rate", blank when checked.
    const MRP = mrp ? "" : "Pur.Rate";
    // Daily flag: blank by default, "YES" when checked.
    const Daily = daily ? "YES" : "";

    setLoading(true);
    setMsg(null);

    try {
      const Comid = session.Comid;
      const MComid = session.MComid;

      const res = await CC.api(PurchaseReturnItemWiseReportUrl, null, {React:1}, {
        Daily,
        MRP,
        GroupBy,
        GroupByText,
        Fromdate,
        Todate,
        Comid,
        MComid,
      });

      if (res.ok === true || res.IsSuccess) {
        const cacheKey = res.Data15 || "";
        // NOTE: GroupByText is deliberately NOT forwarded here — matches
        // source, which omits it from the ReportViewer query string.
        openReportViewer({
          ReportName: "PurchaseReturnItemWise",
          CacheKey: cacheKey,
          RiceUOMSetting: RICE_UOM_SETTING,
          GroupBy,
          Fromdate,
          Todate,
          Daily,
          MRP,
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
      // Source calls methods.Clear() after every View click, success or
      // not — clearing all combo selections unconditionally.
      setGroupByText("");
    }
  }, [activeOption, groupBy, groupByText, fromDate, toDate, daily, mrp, session, openReportViewer]);

  // ── Shared "so-" design system — identical to sibling Purchase* screens ──
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
    .so-card { width: 100%; max-width: 740px; background: #fff; border: 2px solid #1a56db; border-radius: 10px; box-shadow: 0 4px 16px rgba(26,86,219,.18); overflow: hidden; }

    .so-card-header { background: linear-gradient(135deg, #3b6fe0, #1a4fd1); border-bottom: 1px solid #1a4fd1; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; }
    .so-card-header-title { font-size: 14px; font-weight: 700; color: #fff; letter-spacing: .2px; }
    .so-close-x { background: rgba(255,255,255,.15); border: none; font-size: 14px; color: #fff; cursor: pointer; line-height: 1; padding: 6px 8px; border-radius: 6px; transition: background .15s; }
    .so-close-x:hover { background: rgba(255,255,255,.28); }

    .so-card-body { padding: 24px 32px 30px; }
    .so-report-title { text-align: center; font-size: 22px; font-weight: 800; color: #1a3fd6; margin: 0 0 26px; }

    .so-content { display: flex; gap: 32px; }

    .so-left { flex: 0 0 190px; display: flex; flex-direction: column; gap: 12px; }
    .so-right { flex: 1; display: flex; flex-direction: column; gap: 16px; max-width: 320px; }

    .so-radio-row { display: flex; align-items: center; gap: 8px; cursor: pointer; user-select: none; font-size: 13px; color: #2b2b2b; font-weight: 500; }
    .so-radio-row input[type="radio"] { width: 16px; height: 16px; accent-color: #1a56db; cursor: pointer; flex-shrink: 0; }

    .so-field { display: flex; align-items: center; gap: 14px; }
    .so-label { font-size: 13px; font-weight: 600; color: #1e293b; width: 96px; flex-shrink: 0; }
    .so-input { height: 34px; border: 1px solid #c7cdd6; border-radius: 4px; padding: 0 10px; font-size: 13px; color: #1e2d3d; background: #fff; width: 100%; box-sizing: border-box; transition: border-color .15s, box-shadow .15s; outline: none; }
    .so-input:focus { border-color: #1a56db; box-shadow: 0 0 0 3px rgba(26,86,219,.15); }
    .so-input:disabled { background: #f3f5f8; color: #94a3b8; cursor: not-allowed; }
    select.so-input { appearance: auto; cursor: pointer; }

    .so-toggle-row { display: flex; align-items: center; gap: 10px; height: 34px; background: #f7f9fc; border: 1px solid #c7cdd6; border-radius: 4px; padding: 0 12px; cursor: pointer; font-size: 13px; color: #1e293b; font-weight: 500; user-select: none; transition: border-color .15s; }
    .so-toggle-row:hover { border-color: #1a56db; }
    .so-toggle-row input[type="checkbox"] { width: 15px; height: 15px; accent-color: #1a56db; cursor: pointer; }

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

    .mp-wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f0f2f5; }
    .mp-body { padding: 24px; }
    .mp-msg { padding: 10px 14px; border-radius: 8px; font-size: 13px; font-weight: 500; text-align: center; }
    .mp-msg.err { background: #fff0f0; color: #c53030; border: 1px solid #fed7d7; }
    .mp-msg.ok  { background: #f0fff4; color: #276749; border: 1px solid #c6f6d5; }

    .mp-loader-ov { position: fixed; inset: 0; background: rgba(15,23,42,.35); display: flex; align-items: center; justify-content: center; z-index: 999; }
    .mp-ldr-box { background: #fff; padding: 22px 30px; border-radius: 10px; display: flex; flex-direction: column; align-items: center; gap: 12px; box-shadow: 0 8px 28px rgba(0,0,0,.25); }
    .mp-spin { width: 30px; height: 30px; border: 3px solid #dbe4f5; border-top-color: #1a56db; border-radius: 50%; animation: mp-spin-anim .8s linear infinite; }
    .mp-ldr-msg { font-size: 13px; color: #334155; font-weight: 600; }
    @keyframes mp-spin-anim { to { transform: rotate(360deg); } }

    @media (max-width: 620px) {
      .so-card-body { padding: 20px; }
      .so-content { flex-direction: column; gap: 22px; }
      .so-left { flex: none; }
      .so-right { max-width: none; }
    }
  `;

  if (!pageAccess.ready) {
    return (
      <div className="mp-wrap">
        <style>{styles}</style>
        <div className="mp-body">
          {msg && <div className={`mp-msg ${msg.isErr ? "err" : "ok"}`}>{msg.text}</div>}
        </div>
      </div>
    );
  }

  if (!pageAccess.allowed) {
    return (
      <div className="mp-wrap">
        <style>{styles}</style>
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
              <div className="so-card-header-title">Purchase Return Itemwise</div>
              <button type="button" className="so-close-x" aria-label="Close" onClick={() => navigate(-1)}>✕</button>
            </div>

            <div className="so-card-body">
              <div className="so-report-title">Purchase Return Itemwise - Report</div>

              <div className="so-content">
                {/* ── Left: group-by (Brand / Category / Department / Supplier / UOM / Description / Code) ── */}
                <div className="so-left">
                  {GROUP_OPTIONS.map((opt) => (
                    <label key={opt.key} className="so-radio-row">
                      <input
                        type="radio"
                        name="priw-group-by"
                        checked={groupBy === opt.key}
                        onChange={() => handleGroupByChange(opt.key)}
                      />
                      {opt.radioLabel}
                    </label>
                  ))}
                </div>

                {/* ── Right: dynamic combo (bound to active group-by) + dates + toggles ── */}
                <div className="so-right">
                  <div className="so-field">
                    <label className="so-label" htmlFor="priw-combo">
                      {activeOption ? activeOption.fieldLabel : "Group By"}
                    </label>
                    <select
                      id="priw-combo"
                      ref={comboRef}
                      className="so-input"
                      value={groupByText}
                      disabled={!activeOption}
                      onChange={(e) => setGroupByText(e.target.value)}
                    >
                      <option value="">
                        {activeOption ? `-- Select ${activeOption.fieldLabel} --` : "-- Select a group by option first --"}
                      </option>
                      {activeOptions.map((o) => (
                        <option key={o.id} value={o.text}>{o.text}</option>
                      ))}
                    </select>
                  </div>

                  <div className="so-field">
                    <label className="so-label" htmlFor="priw-from-date">From Date</label>
                    <input id="priw-from-date" type="date" className="so-input" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                  </div>

                  <div className="so-field">
                    <label className="so-label" htmlFor="priw-to-date">To Date</label>
                    <input id="priw-to-date" type="date" className="so-input" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                  </div>

                  <label className="so-toggle-row">
                    <input type="checkbox" checked={daily} onChange={(e) => setDaily(e.target.checked)} />
                    Daily
                  </label>

                  <label className="so-toggle-row">
                    <input type="checkbox" checked={mrp} onChange={(e) => setMrp(e.target.checked)} />
                    MRP
                  </label>
                </div>
              </div>

              <div className="so-actions">
                <button type="button" className="so-btn so-btn-primary" disabled={loading} onClick={handleView}>
                  <Save size={16} className="so-icon-save" />
                  {loading ? "Loading…" : "View"}
                </button>
                <button type="button" className="so-btn so-btn-secondary" onClick={handleRefresh} disabled={loading}>
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