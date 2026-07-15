// ─────────────────────────────────────────────────────────────────────────────
//  InventoryQtyWise.jsx
//  React conversion of inventoryqtywise.js (jQuery / jqxWidgets) — "Inventory Qty Wise Report"
//  Built on the exact same skeleton/design as ClosingStock.jsx:
//    - CC.api / CC.getLocal / CC.getStr from Common.jsx
//    - same permission/session bootstrap pattern
//    - same openReportViewer(BASE_URL + /Reports/ReportViewer.aspx) pattern
//    - same nav-card Group-By panel + chip radio rows + "iq-" scoped styles
//    - re-uses the same dropdown APIs (Brand/Category/Department/Supplier/UOM/Product)
//      that ClosingStock.jsx uses for its combos
//  Styling: MasterPage.css tokens only — no new theme colors.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import * as CC from "../../components/Common";
import Topbar from "../../components/Topbar";

const BASE_URL = "http://localhost:64215";

// ── API endpoints ───────────────────────────────────────────────────────────
// Report endpoint — mirrors the original inventoryqtywise.js $.ajax url
// ("/Stock/InventoryQtyWiseReport"), rewritten to the Web API layer.
const InventoryQtyWiseReportUrl = "/api/StockReportApp/InventoryQtyWiseReport";

// Same dropdown endpoints used by ClosingStock.jsx (loadbrandcombo,
// loadcategorycombo, loaddepartmentcombo, loadsuppliercombo, loaduomcombo,
// loadproductcombo in the legacy jQuery layer).
const BrandListUrl = "/api/BrandApp/SelectBrand";
const CategoryListUrl = "/api/CategoryApp/SelectCategory";
const DepartmentListUrl = "/api/DepartmentApp/SelectDepartment";
const SupplierListUrl = "/api/SupplierApp/SelectSupplier";
const UomListUrl = "/api/UOMApp/SelectUOM";
const ProductListUrl = "/api/ItemMasterApp/SelectItemMaster";

// Identifies this report's cache-key bucket on the backend — sent along with
// the report request so the API can namespace/return the correct CacheKey
// (mirrors the "Data15" cache-key pattern used by ClosingStockReport).
const CACHE_KEY_TYPE = "InventoryQtyWiseReport";

// ── Group-by identifiers (mirrors the 7 jqxRadioButtons, groupName="Panel") ─
const GROUP_BY = {
  BRAND: "Brand",
  CATEGORY: "Category",
  DEPARTMENT: "Department",
  SUPPLIER: "Supplier",
  UOM: "UOM",
  DESCRIPTION: "Description",
  CODE: "Code",
};

const GROUP_BY_NAME = {
  Brand: "Brand",
  Category: "Category",
  Department: "Department",
  Supplier: "Supplier",
  UOM: "UOM",
  Description: "PName",
  Code: "Prod_code",
};

// ── Stock-type identifiers (groupName="Pane2") ──────────────────────────────
const STOCK_TYPE = {
  ALL: "ALL",
  WITH_STOCK: "WStock",
  WITHOUT_STOCK: "WOSTOCK",
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

export default function InventoryQtyWise() {
  const navigate = useNavigate();

  // ── Session / permission state ─────────────────────────────────────────
  const [pageAccess, setPageAccess] = useState({
    ready: false,
    allowed: false,
    pageview: 0,
  });

  // ── Company / settings state (loaded once from localStorage) ────────────
  const [session, setSession] = useState(() => {
    try {
      const Comid = CC.getStr("Comid") || "1";
      const MComid = CC.getStr("MComid") || Comid;
      const ComSet = CC.getLocal("Companysetting") || [{}];
      return {
        Comid,
        MComid,
        CName: ComSet[0]?.CName || "",
        CAddress: ComSet[0]?.CAddress || "",
        CPhone: ComSet[0]?.CPhone || "",
      };
    } catch {
      return { Comid: "1", MComid: "1", CName: "", CAddress: "", CPhone: "" };
    }
  });

  // ── Group-by state (single-select radio "Panel" behaviour) ─────────────
  const [groupBySingle, setGroupBySingle] = useState("");

  // Combo selections { value, label }
  const [brandSel, setBrandSel] = useState(null);
  const [categorySel, setCategorySel] = useState(null);
  const [departmentSel, setDepartmentSel] = useState(null);
  const [supplierSel, setSupplierSel] = useState(null);
  const [uomSel, setUomSel] = useState(null);
  const [descriptionSel, setDescriptionSel] = useState(null);
  const [codeSel, setCodeSel] = useState(null);

  // ── Stock type / Date range ─────────────────────────────────────────────
  const [stockType, setStockType] = useState(STOCK_TYPE.ALL);
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

    const menudata = menulist.filter((obj) => obj.PageName === "Inventory Qty Wise");
    if (!menudata || menudata.length === 0) {
      setMsg({ text: "Page Access Permission Denied !!!.", isErr: true });
      setTimeout(() => navigate("/Home"), 3000);
      return;
    }

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

  // ── Group-by selection (radio "Panel" behaviour: pick one, clear rest) ──
  const selectGroupBy = useCallback((value) => {
    setGroupBySingle((prev) => (prev === value ? "" : value));
    setBrandSel(null);
    setCategorySel(null);
    setDepartmentSel(null);
    setSupplierSel(null);
    setUomSel(null);
    setDescriptionSel(null);
    setCodeSel(null);
  }, []);

  // ── Refresh button — mirrors #btnrefresh click handler ─────────────────
  const handleRefresh = useCallback(() => {
    setGroupBySingle("");
    setBrandSel(null);
    setCategorySel(null);
    setDepartmentSel(null);
    setSupplierSel(null);
    setUomSel(null);
    setDescriptionSel(null);
    setCodeSel(null);
    setStockType(STOCK_TYPE.ALL);
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

  // ── View button — replicates the inventoryqtywise.js $.ajax logic ──────
  const handleView = useCallback(async () => {
    // Resolve GroupBy / GroupByName / GroupByText, mirroring the sequential
    // if-blocks in inventoryqtywise.js.
    let GroupBy = "";
    let GroupByName = "";
    let GroupByText = "";

    if (groupBySingle === GROUP_BY.BRAND) {
      GroupBy = "Brand";
      GroupByName = "Brand";
      GroupByText = brandSel?.label ?? "";
    }
    if (groupBySingle === GROUP_BY.CATEGORY) {
      GroupBy = "Category";
      GroupByName = "Category";
      GroupByText = categorySel?.label ?? "";
    }
    if (groupBySingle === GROUP_BY.DEPARTMENT) {
      GroupBy = "Department";
      GroupByName = "Department";
      GroupByText = departmentSel?.label ?? "";
    }
    if (groupBySingle === GROUP_BY.SUPPLIER) {
      GroupBy = "Supplier";
      GroupByName = "Supplier";
      if (!supplierSel) {
        setMsg({ text: "Please Select Valid Supplier Name !!!.", isErr: true });
        return;
      }
      GroupByText = supplierSel.label;
    }
    if (groupBySingle === GROUP_BY.UOM) {
      GroupBy = "UOM";
      GroupByName = "UOM";
      if (!uomSel) {
        setMsg({ text: "Please Select Valid UOM Name !!!.", isErr: true });
        return;
      }
      GroupByText = uomSel.label;
    }
    if (groupBySingle === GROUP_BY.DESCRIPTION) {
      GroupBy = "Description";
      GroupByName = "PName";
      if (!descriptionSel) {
        setMsg({ text: "Please Select Item Name !!!.", isErr: true });
        return;
      }
      GroupByText = descriptionSel.label;
    }
    if (groupBySingle === GROUP_BY.CODE) {
      GroupBy = "Code";
      GroupByName = "Prod_code";
      if (!codeSel) {
        setMsg({ text: "Please Select Valid Code !!!.", isErr: true });
        return;
      }
      GroupByText = codeSel.label;
    }

    // Date validation — mirrors "From Date Is Greater Than To Date!!"
    const Fromdate = toMMDDYYYY(fromDate);
    const Todate = toMMDDYYYY(toDate);
    const startdate = new Date(Fromdate);
    const enddate = new Date(Todate);
    if (startdate > enddate) {
      setMsg({ text: "From Date Is Greater Than To Date!!", isErr: true });
      return;
    }

    const Comid = session.Comid;
    const MComid = session.MComid;

    setLoading(true);
    setMsg(null);

    try {
      const res = await CC.api(
        InventoryQtyWiseReportUrl,
        null,
        {  React: 1 },
        {
          GroupBy,
          GroupByName,
          GroupByText,
          Fromdate,
          Todate,
          StockType: stockType,
          Comid,
          MComid,
        }
      );

      if (res?.ok || res?.IsSuccess) {
        // CacheKey returned by the backend for this report run (same
        // Data15 pattern ClosingStockReport uses) — passed through to the
        // report viewer so it can pull the cached dataset.
        const cacheKey = res.Data15 || res.CacheKey || "";

        openReportViewer({
          ReportName: "InventoryQtyWiseReport",
          CacheKey: cacheKey,
          GroupBy,
          Fromdate,
          Todate,
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
      // Clear combo selections after view, matching methods.Clear() in the
      // original jQuery file.
      setBrandSel(null);
      setCategorySel(null);
      setDepartmentSel(null);
      setSupplierSel(null);
      setUomSel(null);
      setDescriptionSel(null);
      setCodeSel(null);
    }
  }, [
    groupBySingle,
    brandSel,
    categorySel,
    departmentSel,
    supplierSel,
    uomSel,
    descriptionSel,
    codeSel,
    stockType,
    fromDate,
    toDate,
    session,
    openReportViewer,
  ]);

  // ── Group-by nav items ──────────────────────────────────────────────────
  const groupByItems = useMemo(
    () => [
      { value: GROUP_BY.BRAND, label: "Brand", icon: "🏷️" },
      { value: GROUP_BY.CATEGORY, label: "Category", icon: "🗂️" },
      { value: GROUP_BY.DEPARTMENT, label: "Department", icon: "🏬" },
      { value: GROUP_BY.SUPPLIER, label: "Supplier", icon: "🚚" },
      { value: GROUP_BY.UOM, label: "UOM", icon: "📐" },
      { value: GROUP_BY.DESCRIPTION, label: "Description", icon: "📝" },
      { value: GROUP_BY.CODE, label: "Code", icon: "#️⃣" },
    ],
    []
  );

  // Re-usable API-backed <select> — identical pattern to ClosingStock.jsx's
  // ApiSelect, so it hits the exact same dropdown endpoints.
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
      <div className="iq-field">
        <label className="iq-label">{placeholder.replace("Select ", "")}</label>
        <select
          className="iq-input"
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

  // ── Scoped styles injected once (same tokens as ClosingStock.jsx, "iq-" prefix) ──
  const styles = `
    .iq-shell {
      min-height: 100vh;
      background: #f0f2f5;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      flex-direction: column;
    }
    .iq-layout {
      display: flex;
      flex: 1;
      gap: 20px;
      padding: 24px;
      max-width: 1200px;
      width: 100%;
      margin: 0 auto;
      box-sizing: border-box;
    }
    .iq-nav {
      width: 220px;
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .iq-nav-label {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .8px;
      color: #8a94a6;
      padding: 0 4px;
      margin-bottom: 2px;
    }
    .iq-nav-card {
      background: #fff;
      border: 2px solid transparent;
      border-radius: 10px;
      padding: 12px 14px;
      cursor: pointer;
      transition: border-color .15s, box-shadow .15s, background .15s;
      box-shadow: 0 1px 4px rgba(0,0,0,.07);
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .iq-nav-card:hover {
      border-color: var(--clr-primary, #1a56db);
      box-shadow: 0 3px 12px rgba(26,86,219,.12);
    }
    .iq-nav-card.active {
      background: #eef3fd;
      border-color: var(--clr-primary, #1a56db);
      box-shadow: 0 3px 12px rgba(26,86,219,.15);
    }
    .iq-nav-icon {
      width: 30px;
      height: 30px;
      border-radius: 8px;
      background: #e8edfc;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 15px;
      flex-shrink: 0;
    }
    .iq-nav-card.active .iq-nav-icon {
      background: var(--clr-primary, #1a56db);
    }
    .iq-nav-card-name {
      font-size: 13px;
      font-weight: 600;
      color: #1e2d3d;
      line-height: 1.3;
    }
    .iq-nav-card.active .iq-nav-card-name {
      color: var(--clr-primary, #1a56db);
    }
    .iq-panel {
      flex: 1;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 2px 12px rgba(0,0,0,.08);
      padding: 28px 32px;
      display: flex;
      flex-direction: column;
    }
    .iq-panel-header {
      border-bottom: 1px solid #e8ecf0;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .iq-panel-eyebrow {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .8px;
      color: var(--clr-primary, #1a56db);
      margin-bottom: 6px;
    }
    .iq-panel-title {
      font-size: 20px;
      font-weight: 700;
      color: #1e2d3d;
      line-height: 1.2;
    }
    .iq-section-title {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .6px;
      color: #8a94a6;
      margin: 20px 0 10px;
    }
    .iq-section-title:first-of-type { margin-top: 0; }
    .iq-radio-row {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
    .iq-chip {
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
    .iq-chip:hover { border-color: var(--clr-primary, #1a56db); }
    .iq-chip.active {
      background: var(--clr-primary, #1a56db);
      border-color: var(--clr-primary, #1a56db);
      color: #fff;
    }
    .iq-form-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 16px 20px;
      align-items: start;
      max-width: 100%;
      margin-top: 10px;
      margin-bottom: 24px;
    }
    .iq-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .iq-label {
      font-size: 13px;
      font-weight: 600;
      color: #4a5568;
    }
    .iq-input {
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
    .iq-input:focus {
      border-color: var(--clr-primary, #1a56db);
      box-shadow: 0 0 0 3px rgba(26,86,219,.1);
    }
    .iq-actions {
      display: flex;
      gap: 12px;
      margin-top: 28px;
      padding-top: 20px;
      border-top: 1px solid #e8ecf0;
    }
    .iq-btn {
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
    .iq-btn:disabled { opacity: .5; cursor: not-allowed; }
    .iq-btn-primary {
      background: var(--clr-primary, #1a56db);
      color: #fff;
      box-shadow: 0 2px 8px rgba(26,86,219,.3);
    }
    .iq-btn-primary:not(:disabled):hover {
      opacity: .9;
      box-shadow: 0 4px 14px rgba(26,86,219,.4);
    }
    .iq-btn-secondary {
      background: #f0f2f5;
      color: #4a5568;
      border: 1.5px solid #d1d9e6;
    }
    .iq-btn-secondary:not(:disabled):hover {
      background: #e8ecf0;
    }
    .iq-msg {
      margin-top: 18px;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
    }
    .iq-msg.err { background: #fff0f0; color: #c53030; border: 1px solid #fed7d7; }
    .iq-msg.ok  { background: #f0fff4; color: #276749; border: 1px solid #c6f6d5; }
    @media (max-width: 760px) {
      .iq-layout { flex-direction: column; padding: 16px; }
      .iq-nav { width: 100%; flex-direction: row; flex-wrap: wrap; }
      .iq-nav-card { flex: 1 1 calc(33% - 7px); }
      .iq-panel { padding: 20px 16px; }
      .iq-form-grid { grid-template-columns: 1fr; }
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
      <div className="iq-shell">
        <Topbar />

        <div className="iq-layout">
          {/* ── LEFT: Group-by navigation panel ── */}
          <nav className="iq-nav" aria-label="Group by">
            <div className="iq-nav-label">Group By</div>
            {groupByItems.map((item) => (
              <div
                key={item.value}
                className={`iq-nav-card${groupBySingle === item.value ? " active" : ""}`}
                onClick={() => selectGroupBy(item.value)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && selectGroupBy(item.value)}
                aria-pressed={groupBySingle === item.value}
              >
                <div className="iq-nav-icon">{item.icon}</div>
                <div className="iq-nav-card-name">{item.label}</div>
              </div>
            ))}
          </nav>

          {/* ── RIGHT: Filter panel ── */}
          <main className="iq-panel">
            <div className="iq-panel-header">
              <div className="iq-panel-eyebrow">Stock</div>
              <div className="iq-panel-title">Inventory Qty Wise Report</div>
            </div>

            {/* Combo bound to the active Group By selection — same dropdown
                APIs as ClosingStock.jsx */}
            <div className="iq-form-grid">
              {groupBySingle === GROUP_BY.BRAND && (
                <ApiSelect url={BrandListUrl} payload={{ Comid: session.Comid }} labelKey="BrandName" valueKey="Id" value={brandSel} onChange={setBrandSel} placeholder="Select Brand" />
              )}
              {groupBySingle === GROUP_BY.CATEGORY && (
                <ApiSelect url={CategoryListUrl} payload={{ Comid: session.Comid }} labelKey="Cat_Name" valueKey="Id" value={categorySel} onChange={setCategorySel} placeholder="Select Category" />
              )}
              {groupBySingle === GROUP_BY.DEPARTMENT && (
                <ApiSelect url={DepartmentListUrl} payload={{ Comid: session.Comid }} labelKey="DepartmentName" valueKey="Id" value={departmentSel} onChange={setDepartmentSel} placeholder="Select Department" />
              )}
              {groupBySingle === GROUP_BY.SUPPLIER && (
                <ApiSelect url={SupplierListUrl} payload={{ Comid: Number(session.Comid), Startindex: -1, PageCount: 99999, AccountType: "SUPPLIER", Keyword: "", Column: "" }} labelKey="AccountName" valueKey="Id" value={supplierSel} onChange={setSupplierSel} placeholder="Select Supplier" />
              )}
              {groupBySingle === GROUP_BY.UOM && (
                <ApiSelect url={UomListUrl} payload={{ Comid: session.Comid }} labelKey="UOMName" valueKey="Id" value={uomSel} onChange={setUomSel} placeholder="Select UOM" />
              )}
              {groupBySingle === GROUP_BY.DESCRIPTION && (
                <ApiSelect url={ProductListUrl} payload={{ Comid: session.MComid, Startindex: 0, PageCount: 99999, Keyword: "", Column: "" }} headers={{ Download: "1" }} labelKey="ProductName" valueKey="Id" value={descriptionSel} onChange={setDescriptionSel} placeholder="Select Item Name" />
              )}
              {groupBySingle === GROUP_BY.CODE && (
                <ApiSelect url={ProductListUrl} payload={{ Comid: session.MComid, Startindex: 0, PageCount: 99999, Keyword: "", Column: "" }} headers={{ Download: "1" }} labelKey="ProductCode" valueKey="Id" value={codeSel} onChange={setCodeSel} placeholder="Select Item Code" />
              )}

              <div className="iq-field">
                <label className="iq-label" htmlFor="iq-from-date">From Date</label>
                <input
                  id="iq-from-date"
                  type="date"
                  className="iq-input"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>
              <div className="iq-field">
                <label className="iq-label" htmlFor="iq-to-date">To Date</label>
                <input
                  id="iq-to-date"
                  type="date"
                  className="iq-input"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>
            </div>

            {/* Stock type */}
            <div className="iq-section-title">Stock Type</div>
            <div className="iq-radio-row">
              {[
                { value: STOCK_TYPE.ALL, label: "All" },
                { value: STOCK_TYPE.WITH_STOCK, label: "With Stock" },
                { value: STOCK_TYPE.WITHOUT_STOCK, label: "Without Stock" },
              ].map((o) => (
                <div
                  key={o.value}
                  className={`iq-chip${stockType === o.value ? " active" : ""}`}
                  onClick={() => setStockType(o.value)}
                  role="button"
                  tabIndex={0}
                >
                  {o.label}
                </div>
              ))}
            </div>

            <div className="iq-actions">
              <button
                type="button"
                className="iq-btn iq-btn-primary"
                disabled={loading || pageAccess.pageview === 0}
                onClick={handleView}
              >
                {loading ? "Loading…" : "▶ View"}
              </button>
              <button
                type="button"
                className="iq-btn iq-btn-secondary"
                onClick={handleRefresh}
                disabled={loading}
              >
                ↺ Refresh
              </button>
            </div>

            {msg && <div className={`iq-msg ${msg.isErr ? "err" : "ok"}`}>{msg.text}</div>}
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