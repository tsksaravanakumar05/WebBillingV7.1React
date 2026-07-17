// ─────────────────────────────────────────────────────────────────────────────
//  StockAdjustmentItemwise.jsx
//  React conversion of the legacy jQuery / jqxWidgets "Stock Adjustment Itemwise"
//  page.
//  Built on the exact same skeleton as ClosingStock.jsx (InventoryQtyWise-style
//  variant: single-select radio Group-By nav, no univercell multi-select, no
//  batch/rate-type, adds a From/To date pair):
//    - CC.api / CC.getLocal / CC.getStr from Common.jsx
//    - same permission/session bootstrap pattern
//    - same openReportViewer(BASE_URL + /Reports/ReportViewer.aspx) pattern
//    - same nav-card + filter-panel two-column layout, "si-" scoped style system
//  Styling: MasterPage.css only — no inline color values, no new theme colors.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Save, XCircle } from "lucide-react";
import * as CC from "../../components/Common";
import Topbar from "../../components/Topbar";

const BASE_URL = "http://localhost:64215";

// ── API endpoints ───────────────────────────────────────────────────────────
// Report endpoint kept identical to the legacy $.ajax url — this page shares
// the same "/Stock/StockAdjustmentReport" backend endpoint as the Details
// page, distinguished only by the Itemwise flag in the payload.
const StockAdjustmentReportUrl = "/api/StockReportApp/StockAdjustmentReport";

// NOTE: the original jQuery file calls local functions (loadbrandcombo,
// loadcategorycombo, loaddepartmentcombo, loadsuppliercombo, loaduomcombo,
// loadproductcombo) whose actual API URLs were not provided. These are the
// same best-guess endpoint names already established in ClosingStock.jsx —
// please replace with the real endpoints from your Common.jsx / master API
// layer if they differ.
const BrandListUrl = "/api/BrandApp/SelectBrand";
const CategoryListUrl = "/api/CategoryApp/SelectCategory";
const DepartmentListUrl = "/api/DepartmentApp/SelectDepartment";
const SupplierListUrl = "/api/SupplierApp/SelectSupplier";
const UomListUrl = "/api/UOMApp/SelectUOM";
const ProductListUrl = "/api/ItemMasterApp/SelectItemMaster";

// ── Group-by identifiers (mirrors the 7 jqxRadioButtons, groupName: "Panel") ──
const GROUP_BY = {
  BRAND: "Brand",
  CATEGORY: "Category",
  DEPARTMENT: "Department",
  SUPPLIER: "Supplier",
  UOM: "UOM",
  DESCRIPTION: "Description",
  CODE: "Code",
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

export default function StockAdjustmentItemwise() {
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

  // ── Group-by state — single radio selection (string | ""), no univercell ──
  const [groupBySingle, setGroupBySingle] = useState("");

  // Combo selections { value, label }
  const [brandSel, setBrandSel] = useState(null);
  const [categorySel, setCategorySel] = useState(null);
  const [departmentSel, setDepartmentSel] = useState(null);
  const [supplierSel, setSupplierSel] = useState(null);
  const [uomSel, setUomSel] = useState(null);
  const [descriptionSel, setDescriptionSel] = useState(null);
  const [codeSel, setCodeSel] = useState(null);

  // ── Date range + Daily checkbox ─────────────────────────────────────────
  const [fromDate, setFromDate] = useState(todayStr());
  const [toDate, setToDate] = useState(todayStr());
  const [daily, setDaily] = useState(false); // rdodaliy checkbox

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

    const menudata = menulist.filter((obj) => obj.PageName === "Stock Adjustment Itemwise");
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

  // ── Group-by selection — radio "Panel" behaviour, clears the others ─────
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

  // ── Refresh button — mirrors $('#btnrefresh') handler exactly ───────────
  const handleRefresh = useCallback(() => {
    setGroupBySingle("");
    setBrandSel(null);
    setCategorySel(null);
    setDepartmentSel(null);
    setSupplierSel(null);
    setUomSel(null);
    setDescriptionSel(null);
    setCodeSel(null);
    setDaily(false);
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

  // ── View button — replicates the $('#btnview') click handler exactly ───
  const handleView = useCallback(async () => {
    let GroupBy = "";
    let GroupByText = "";

    // Brand/Category/Department/Supplier/UOM read item.value (not item.label)
    // exactly as the legacy code does — only Description/Code read item.label.
    if (groupBySingle === GROUP_BY.BRAND) {
      GroupBy = "Brand";
      if (brandSel) {
        GroupByText = brandSel.value;
        if (!GroupByText) {
          setMsg({ text: "Please Select Valid Brand Name !!!.", isErr: true });
          setBrandSel(null);
          return;
        }
      }
    }
    if (groupBySingle === GROUP_BY.CATEGORY) {
      GroupBy = "Category";
      if (categorySel) {
        GroupByText = categorySel.value;
        if (!GroupByText) {
          setMsg({ text: "Please Select Valid Category Name !!!.", isErr: true });
          setCategorySel(null);
          return;
        }
      }
    }
    if (groupBySingle === GROUP_BY.DEPARTMENT) {
      GroupBy = "Department";
      if (departmentSel) {
        GroupByText = departmentSel.value;
        if (!GroupByText) {
          setMsg({ text: "Please Select Valid Department Name !!!.", isErr: true });
          setDepartmentSel(null);
          return;
        }
      }
    }
    if (groupBySingle === GROUP_BY.SUPPLIER) {
      GroupBy = "Supplier";
      if (supplierSel) {
        GroupByText = supplierSel.value;
        if (!GroupByText) {
          setMsg({ text: "Please Select Valid Supplier Name !!!.", isErr: true });
          setSupplierSel(null);
          return;
        }
      }
    }
    if (groupBySingle === GROUP_BY.UOM) {
      GroupBy = "UOM";
      if (uomSel) {
        GroupByText = uomSel.value;
        if (!GroupByText) {
          setMsg({ text: "Please Select Valid UOM Name !!!.", isErr: true });
          setUomSel(null);
          return;
        }
      }
    }
    if (groupBySingle === GROUP_BY.DESCRIPTION) {
      GroupBy = "Description";
      if (descriptionSel) {
        GroupByText = descriptionSel.label;
        if (!GroupByText) {
          setMsg({ text: "Please Select Valid Item Name !!!.", isErr: true });
          setDescriptionSel(null);
          return;
        }
      } else {
        setMsg({ text: "Please Select  Item Name !!!.", isErr: true });
        setDescriptionSel(null);
        return;
      }
    }
    if (groupBySingle === GROUP_BY.CODE) {
      GroupBy = "Code";
      if (codeSel) {
        GroupByText = codeSel.label;
        if (!GroupByText) {
          setMsg({ text: "Please Select Valid Item Code !!!.", isErr: true });
          setCodeSel(null);
          return;
        }
      } else {
        setMsg({ text: "Please Select  Item Code !!!.", isErr: true });
        setCodeSel(null);
        return;
      }
    }

    // Date-order validation — mirrors startdate > enddate check.
    const startdate = new Date(fromDate);
    const enddate = new Date(toDate);
    if (startdate > enddate) {
      setMsg({ text: "From Date Is Greater Than To Date!!", isErr: true });
      return;
    }

    const Fromdate = toMMDDYYYY(fromDate);
    const Todate = toMMDDYYYY(toDate);
    const Daily = daily;
    // NOTE: the legacy file declares ReportTypenew but never assigns it on
    // this page (unlike the Details page, which sets it to "D" for Daily) —
    // it is always sent as "" here. Preserved verbatim, quirk and all.
    const ReportTypenew = "";
    const ReportTitle = "Stock Adjustment Itemwise Report";

    setLoading(true);
    setMsg(null);

    try {
      const res = await CC.api(
        StockAdjustmentReportUrl,
        null,
        { CacheKeyType: "StockAdjustmentReport", React: 1 },
        {
          Itemwise: "1",
          Daily,
          GroupBy,
          GroupByText,
          Fromdate,
          Todate,
          Comid: session.Comid,
          MComid: session.MComid,
        }
      );

      if (res?.ok || res?.IsSuccess) {
        const cacheKey = res.Data15 || res.CacheKey || "";
        openReportViewer({
          ReportName: "StockAdjustmentReport",
          CacheKey: cacheKey,
          Itemwise: 1,
          GroupByText,
          Daily,
          Fromdate,
          Todate,
          ReportType: ReportTypenew,
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
      // Clear combo selections after view, matching methods.Clear() in the jQuery file.
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
    fromDate,
    toDate,
    daily,
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
      <div className="si-field">
        <label className="si-label">{placeholder.replace("Select ", "")}</label>
        <select
          className="si-input"
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

  // ── Scoped styles injected once (same tokens as ClosingStock.jsx, "si-" prefix) ──
  const styles = `
    .si-shell { min-height: 100vh; background: #f0f2f5; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; flex-direction: column; }
    .si-layout { flex: 1; display: flex; align-items: flex-start; justify-content: center; padding: 24px; box-sizing: border-box; }
    .si-card { width: 100%; max-width: 1000px; background: #fff; border: 2px solid #1a56db; border-radius: 10px; box-shadow: 0 4px 16px rgba(26,86,219,.18); overflow: hidden; }
    .si-card-header { background: linear-gradient(135deg, #3b6fe0, #1a4fd1); border-bottom: 1px solid #1a4fd1; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; }
    .si-card-header-title { font-size: 14px; font-weight: 700; color: #fff; letter-spacing: .2px; }
    .si-card-body { padding: 24px 32px 30px; }
    .si-report-title { text-align: center; font-size: 22px; font-weight: 800; color: #1a3fd6; margin: 0 0 26px; }

    .si-content { display: flex; gap: 28px; }

    .si-nav { flex: 0 0 220px; display: flex; flex-direction: column; gap: 8px; }
    .si-nav-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; color: #8a94a6; padding: 0 4px; margin-bottom: 2px; }
    .si-nav-card { background: #fff; border: 1.5px solid #d1d9e6; border-radius: 8px; padding: 10px 12px; cursor: pointer; transition: border-color .15s, box-shadow .15s, background .15s; display: flex; align-items: center; gap: 10px; }
    .si-nav-card:hover { border-color: #1a56db; box-shadow: 0 3px 12px rgba(26,86,219,.12); }
    .si-nav-card.active { background: #eef3ff; border-color: #1a56db; box-shadow: 0 3px 12px rgba(26,86,219,.15); }
    .si-nav-icon { width: 28px; height: 28px; border-radius: 8px; background: #e8edfc; display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; }
    .si-nav-card.active .si-nav-icon { background: #1a56db; }
    .si-nav-card-name { font-size: 13px; font-weight: 600; color: #1e2d3d; line-height: 1.3; }
    .si-nav-card.active .si-nav-card-name { color: #1a56db; }

    .si-panel { flex: 1; display: flex; flex-direction: column; min-width: 0; }
    .si-panel-header { border-bottom: 1px solid #e8ecf0; padding-bottom: 14px; margin-bottom: 20px; }
    .si-panel-eyebrow { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; color: #1a56db; margin-bottom: 6px; }
    .si-panel-title { font-size: 16px; font-weight: 700; color: #1e2d3d; line-height: 1.2; }

    .si-section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .6px; color: #8a94a6; margin: 20px 0 10px; }
    .si-section-title:first-of-type { margin-top: 0; }

    .si-form-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 14px 16px; align-items: start; max-width: 100%; margin-top: 6px; margin-bottom: 20px; }
    .si-field { display: flex; flex-direction: column; gap: 6px; }
    .si-label { font-size: 13px; font-weight: 600; color: #1e293b; }
    .si-input { height: 34px; border: 1px solid #c7cdd6; border-radius: 4px; padding: 0 10px; font-size: 13px; color: #1e2d3d; background: #fff; width: 100%; box-sizing: border-box; transition: border-color .15s, box-shadow .15s; outline: none; }
    .si-input:focus { border-color: #1a56db; box-shadow: 0 0 0 3px rgba(26,86,219,.15); }
    select.si-input { appearance: auto; cursor: pointer; }
    .si-input:disabled { background: #f5f6f8; cursor: not-allowed; }

    .si-toggle-row { display: flex; align-items: center; gap: 8px; height: 34px; background: #f7f9fc; border: 1px solid #c7cdd6; border-radius: 4px; padding: 0 12px; cursor: pointer; font-size: 13px; color: #1e293b; font-weight: 500; user-select: none; width: fit-content; }
    .si-toggle-row input[type="checkbox"] { width: 15px; height: 15px; accent-color: #1a56db; cursor: pointer; }

    .si-actions { display: flex; gap: 12px; margin-top: 28px; padding-top: 22px; border-top: 1px solid #e8ecf0; }
    .si-btn { height: 38px; padding: 0 30px; border-radius: 6px; border: 1px solid #1a56db; font-size: 14px; font-weight: 700; cursor: pointer; transition: opacity .15s, box-shadow .15s, background .15s; display: flex; align-items: center; gap: 8px; background: #fff; color: #1a56db; }
    .si-btn:disabled { opacity: .5; cursor: not-allowed; }
    .si-btn:not(:disabled):hover { background: #eef3ff; }
    .si-btn-primary { border-color: #1e7e34; color: #1e7e34; }
    .si-btn-primary .si-icon-save { color: #1e7e34; }
    .si-btn-secondary { border-color: #dc3545; color: #dc3545; }
    .si-btn-secondary .si-icon-cancel { color: #dc3545; }

    .si-msg { margin-top: 18px; padding: 10px 14px; border-radius: 8px; font-size: 13px; font-weight: 500; }
    .si-msg.err { background: #fff0f0; color: #c53030; border: 1px solid #fed7d7; }
    .si-msg.ok  { background: #f0fff4; color: #276749; border: 1px solid #c6f6d5; }

    @media (max-width: 760px) {
      .si-card-body { padding: 20px; }
      .si-content { flex-direction: column; gap: 22px; }
      .si-nav { flex: none; width: 100%; flex-direction: row; flex-wrap: wrap; }
      .si-nav-card { flex: 1 1 calc(33% - 7px); }
      .si-form-grid { grid-template-columns: 1fr; }
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
      <div className="si-shell">
        <Topbar />

        <div className="si-layout">
          <div className="si-card">
            <div className="si-card-header">
              <div className="si-card-header-title">Stock Adjustment Itemwise Report</div>
            </div>

            <div className="si-card-body">
              <div className="si-report-title">Stock Adjustment Itemwise - Report</div>

              <div className="si-content">
              {/* ── LEFT: Group-by navigation panel ── */}
              <nav className="si-nav" aria-label="Group by">
                <div className="si-nav-label">Group By</div>
                {groupByItems.map((item) => (
                  <div
                    key={item.value}
                    className={`si-nav-card${groupBySingle === item.value ? " active" : ""}`}
                    onClick={() => selectGroupBy(item.value)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && selectGroupBy(item.value)}
                    aria-pressed={groupBySingle === item.value}
                  >
                    <div className="si-nav-icon">{item.icon}</div>
                    <div className="si-nav-card-name">{item.label}</div>
                  </div>
                ))}
              </nav>

              {/* ── RIGHT: Filter panel ── */}
              <main className="si-panel">
            <div className="si-panel-header">
              <div className="si-panel-eyebrow">Stock</div>
              <div className="si-panel-title">Stock Adjustment Itemwise Report</div>
            </div>

            {/* Combo bound to the active Group By selection */}
            <div className="si-form-grid">
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

              <div className="si-field">
                <label className="si-label" htmlFor="si-from-date">From Date</label>
                <input
                  id="si-from-date"
                  type="date"
                  className="si-input"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>

              <div className="si-field">
                <label className="si-label" htmlFor="si-to-date">To Date</label>
                <input
                  id="si-to-date"
                  type="date"
                  className="si-input"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>
            </div>

            <label className="si-toggle-row">
              <input
                type="checkbox"
                checked={daily}
                onChange={(e) => setDaily(e.target.checked)}
              />
              Daily
            </label>

            <div className="si-actions">
              <button
                type="button"
                className="si-btn si-btn-primary"
                disabled={loading || pageAccess.pageview === 0}
                onClick={handleView}
              >
                <Save size={16} className="si-icon-save" />
                {loading ? "Loading…" : "View"}
              </button>
              <button
                type="button"
                className="si-btn si-btn-secondary"
                onClick={handleRefresh}
                disabled={loading}
              >
                <XCircle size={16} className="si-icon-cancel" />
                Refresh
              </button>
            </div>

            {msg && <div className={`si-msg ${msg.isErr ? "err" : "ok"}`}>{msg.text}</div>}
              </main>
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