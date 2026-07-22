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

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Save, XCircle } from "lucide-react";
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
    const url = `${CC.BASE_URL}/Reports/ReportViewer.aspx?${qs}`;

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

  // Re-usable API-backed searchable combo box — identical pattern/contract to
  // ClosingStock.jsx's ApiSelect (same dropdown endpoints), now with an
  // instant-filter search popup instead of a plain <select>.
  const ApiSelect = ({ url, payload, headers = {}, labelKey, valueKey, value, onChange, placeholder }) => {
    const [list, setList] = useState([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const boxRef = useRef(null);
    const searchRef = useRef(null);

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

    // Close the popup on outside click.
    useEffect(() => {
      if (!open) return;
      const handleClickOutside = (e) => {
        if (boxRef.current && !boxRef.current.contains(e.target)) {
          setOpen(false);
        }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [open]);

    useEffect(() => {
      if (open) {
        setSearch("");
        setTimeout(() => searchRef.current?.focus(), 0);
      }
    }, [open]);

    const filteredList = useMemo(() => {
      const q = search.trim().toLowerCase();
      if (!q) return list;
      return list.filter((o) => String(o[labelKey] ?? "").toLowerCase().includes(q));
    }, [list, search, labelKey]);

    const handlePick = (opt) => {
      onChange(opt ? { value: String(opt[valueKey]), label: opt[labelKey] } : null);
      setOpen(false);
    };

    return (
      <div className="so-field">
        <label className="so-label">{placeholder.replace("Select ", "")}</label>
        <div className="so-combo" ref={boxRef}>
          <button
            type="button"
            className="so-input so-combo-toggle"
            disabled={loading}
            onClick={() => setOpen((o) => !o)}
          >
            <span className={`so-combo-value${value?.label ? "" : " ph"}`}>
              {loading ? "Loading..." : value?.label || placeholder}
            </span>
            <span className="so-combo-caret" aria-hidden="true">▾</span>
          </button>

          {open && !loading && (
            <div className="so-combo-panel">
              <input
                ref={searchRef}
                type="text"
                className="so-combo-search"
                placeholder="Type to search…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setOpen(false);
                  if (e.key === "Enter" && filteredList.length === 1) handlePick(filteredList[0]);
                }}
              />
              <ul className="so-combo-list" role="listbox">
                <li
                  className={`so-combo-option so-combo-clear${!value ? " active" : ""}`}
                  onClick={() => handlePick(null)}
                >
                  {placeholder}
                </li>
                {filteredList.length === 0 && (
                  <li className="so-combo-empty">No matches found</li>
                )}
                {filteredList.map((o) => (
                  <li
                    key={o[valueKey]}
                    className={`so-combo-option${String(value?.value) === String(o[valueKey]) ? " active" : ""}`}
                    onClick={() => handlePick(o)}
                    role="option"
                    aria-selected={String(value?.value) === String(o[valueKey])}
                  >
                    {o[labelKey]}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  };

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
    .so-card { width: 100%; max-width: 940px; background: #fff; border: 2px solid #1a56db; border-radius: 10px; box-shadow: 0 4px 16px rgba(26,86,219,.18); overflow: hidden; }

    .so-card-header { background: linear-gradient(135deg, #3b6fe0, #1a4fd1); border-bottom: 1px solid #1a4fd1; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; }
    .so-card-header-title { font-size: 14px; font-weight: 700; color: #fff; letter-spacing: .2px; }
    .so-close-x { background: rgba(255,255,255,.15); border: none; font-size: 14px; color: #fff; cursor: pointer; line-height: 1; padding: 6px 8px; border-radius: 6px; transition: background .15s; }
    .so-close-x:hover { background: rgba(255,255,255,.28); }

    .so-card-body { padding: 24px 32px 30px; }
    .so-report-title { text-align: center; font-size: 22px; font-weight: 800; color: #1a3fd6; margin: 0 0 26px; }

    .so-content { display: flex; gap: 32px; align-items: flex-start; flex-wrap: wrap; }
    .so-left { flex: 0 0 190px; display: flex; flex-direction: column; gap: 12px; }
    .so-right { flex: 1; min-width: 320px; }

    .so-col-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; color: #8492a6; margin-bottom: 4px; }
    .so-section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; color: #8492a6; margin: 22px 0 10px; }
    .so-section-title:first-of-type { margin-top: 0; }

    .so-radio-row { display: flex; flex-wrap: wrap; gap: 18px; }
    .so-radio-chip { display: flex; align-items: center; gap: 8px; cursor: pointer; user-select: none; font-size: 13px; color: #2b2b2b; font-weight: 500; }
    .so-radio-dot { width: 16px; height: 16px; flex-shrink: 0; border-radius: 50%; border: 1.5px solid #c7cdd6; display: flex; align-items: center; justify-content: center; transition: border-color .15s; }
    .so-radio-chip.active .so-radio-dot { border-color: #1a56db; }
    .so-radio-chip.active .so-radio-dot::after { content: ""; width: 8px; height: 8px; border-radius: 50%; background: #1a56db; }

    .so-form-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px 18px; align-items: start; margin-top: 4px; margin-bottom: 6px; }
    .so-field { display: flex; flex-direction: column; gap: 6px; }
    .so-label { font-size: 13px; font-weight: 600; color: #1e293b; }
    .so-input { height: 34px; border: 1px solid #c7cdd6; border-radius: 4px; padding: 0 10px; font-size: 13px; color: #1e2d3d; background: #fff; width: 100%; box-sizing: border-box; transition: border-color .15s, box-shadow .15s; outline: none; }
    .so-input:focus { border-color: #1a56db; box-shadow: 0 0 0 3px rgba(26,86,219,.15); }
    select.so-input { appearance: auto; cursor: pointer; }

    .so-combo { position: relative; }
    .so-combo-toggle { display: flex; align-items: center; justify-content: space-between; gap: 8px; text-align: left; cursor: pointer; }
    .so-combo-toggle:disabled { cursor: not-allowed; opacity: .65; }
    .so-combo-value { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #1e2d3d; }
    .so-combo-value.ph { color: #8492a6; }
    .so-combo-caret { flex-shrink: 0; font-size: 10px; color: #8492a6; }
    .so-combo-panel { position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 30; background: #fff; border: 1px solid #1a56db; border-radius: 6px; box-shadow: 0 8px 24px rgba(26,86,219,.18); overflow: hidden; }
    .so-combo-search { width: 100%; height: 32px; border: none; border-bottom: 1px solid #e8ecf0; padding: 0 10px; font-size: 13px; color: #1e2d3d; box-sizing: border-box; outline: none; background: #f8fafc; }
    .so-combo-search:focus { background: #eef3ff; }
    .so-combo-list { list-style: none; margin: 0; padding: 4px 0; max-height: 220px; overflow-y: auto; }
    .so-combo-option { padding: 7px 12px; font-size: 13px; color: #1e2d3d; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .so-combo-option:hover { background: #eef3ff; }
    .so-combo-option.active { background: #e3ecff; color: #1a4fd1; font-weight: 600; }
    .so-combo-option.so-combo-clear { color: #8492a6; font-style: italic; border-bottom: 1px solid #e8ecf0; margin-bottom: 2px; }
    .so-combo-empty { padding: 10px 12px; font-size: 12.5px; color: #8492a6; text-align: center; }

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

    @media (max-width: 900px) {
      .so-content { flex-direction: column; }
      .so-left { flex: none; flex-direction: row; flex-wrap: wrap; }
    }
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
              <div className="so-card-header-title">Inventory Qty Wise</div>
              <button type="button" className="so-close-x" aria-label="Close" onClick={() => navigate(-1)}>✕</button>
            </div>

            <div className="so-card-body">
              <div className="so-report-title">Inventory Qty Wise Report</div>

              <div className="so-content">
                {/* ── LEFT: Group-by navigation ── */}
                <div className="so-left" aria-label="Group by">
                  <div className="so-col-title">Group By</div>
                  {groupByItems.map((item) => (
                    <div
                      key={item.value}
                      className={`so-radio-chip${groupBySingle === item.value ? " active" : ""}`}
                      onClick={() => selectGroupBy(item.value)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === "Enter" && selectGroupBy(item.value)}
                      aria-pressed={groupBySingle === item.value}
                    >
                      <span className="so-radio-dot" aria-hidden="true" />
                      {item.label}
                    </div>
                  ))}
                </div>

                {/* ── RIGHT: Filter panel ── */}
                <div className="so-right">
                  {/* Combo bound to the active Group By selection — same dropdown
                      APIs as ClosingStock.jsx */}
                  <div className="so-form-grid">
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

                    <div className="so-field">
                      <label className="so-label" htmlFor="iq-from-date">From Date</label>
                      <input
                        id="iq-from-date"
                        type="date"
                        className="so-input"
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                      />
                    </div>
                    <div className="so-field">
                      <label className="so-label" htmlFor="iq-to-date">To Date</label>
                      <input
                        id="iq-to-date"
                        type="date"
                        className="so-input"
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Stock type */}
                  <div className="so-section-title">Stock Type</div>
                  <div className="so-radio-row">
                    {[
                      { value: STOCK_TYPE.ALL, label: "All" },
                      { value: STOCK_TYPE.WITH_STOCK, label: "With Stock" },
                      { value: STOCK_TYPE.WITHOUT_STOCK, label: "Without Stock" },
                    ].map((o) => (
                      <div
                        key={o.value}
                        className={`so-radio-chip${stockType === o.value ? " active" : ""}`}
                        onClick={() => setStockType(o.value)}
                        role="button"
                        tabIndex={0}
                      >
                        <span className="so-radio-dot" aria-hidden="true" />
                        {o.label}
                      </div>
                    ))}
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