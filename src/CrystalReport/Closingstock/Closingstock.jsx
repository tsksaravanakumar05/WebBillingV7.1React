// ─────────────────────────────────────────────────────────────────────────────
//  ClosingStock.jsx
//  React conversion of closingstock.js (jQuery / jqxWidgets) — "Closing Stock Report"
//  Built on the exact same skeleton as SaleOrder.jsx:
//    - CC.api / CC.getLocal / CC.getStr from Common.jsx
//    - same permission/session bootstrap pattern
//    - same openReportViewer(BASE_URL + /Reports/ReportViewer.aspx) pattern
//    - same "cs-" scoped style system (renamed from "so-")
//  Styling: MasterPage.css only — no inline color values, no new theme colors.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import * as CC from "../../components/Common";
import Topbar from "../../components/Topbar";

const BASE_URL = "http://localhost:64215";

// ── API endpoints ───────────────────────────────────────────────────────────
// Report endpoint kept identical to the original closingstock.js ($.ajax url).
const ClosingStockReportUrl = "/api/StockReportApp/ClosingStockReport";

// NOTE: the original jQuery file calls local functions (loadbrandcombo,
// loadcategorycombo, loaddepartmentcombo, loadsuppliercombo, loaduomcombo,
// loadproductcombo) whose actual API URLs were not provided. These are best-
// guess endpoint names following the SaleOrder.jsx naming convention — please
// replace with the real endpoints from your Common.jsx / master API layer.
const BrandListUrl = "/api/BrandApp/SelectBrand";
const CategoryListUrl = "/api/CategoryApp/SelectCategory";
const DepartmentListUrl = "/api/DepartmentApp/SelectDepartment";
const SupplierListUrl = "/api/SupplierApp/SelectSupplier";
const UomListUrl = "/api/UOMApp/SelectUOM";
const ProductListUrl = "/api/ItemMasterApp/SelectItemMaster";

// ── Group-by identifiers (mirrors the 7 jqxRadioButtons / jqxCheckBoxes) ───
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

// ── Stock-type identifiers (Pane2) ──────────────────────────────────────────
const STOCK_TYPE = {
  ALL: "ALL",
  WITH_STOCK: "WStock",
  WITHOUT_STOCK: "WOSTOCK",
};

// ── Rate-type identifiers (Pane3) ───────────────────────────────────────────
const RATE_TYPE = {
  PURCHASE: "PURCHASE",
  SALE: "SALE",
  MRP: "MRP",
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

export default function ClosingStock() {
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
    Ecotech: false,
    univercell: false,
    RiceUOMSetting: false, // MultipleUOMBilling
    BatchNoText: "",
    TextilesSerialNowiseBilling: false,
    TruckStockReport: false,
    GroupCommission: false,
    BatchWiseStock: false,
  });

  // ── Group-by state ───────────────────────────────────────────────────────
  // Non-univercell mode: single radio selection (string | "").
  // Univercell mode: multi checkbox selection across Brand/Category/Department
  // ORed with the single-select Supplier/UOM/Description/Code group.
  const [groupBySingle, setGroupBySingle] = useState(""); // used when !univercell
  const [multiSel, setMultiSel] = useState({
    Brand: false,
    Category: false,
    Department: false,
  }); // used when univercell

  // Combo selections { value, label }
  const [brandSel, setBrandSel] = useState(null);
  const [categorySel, setCategorySel] = useState(null);
  const [departmentSel, setDepartmentSel] = useState(null);
  const [supplierSel, setSupplierSel] = useState(null);
  const [uomSel, setUomSel] = useState(null);
  const [descriptionSel, setDescriptionSel] = useState(null);
  const [codeSel, setCodeSel] = useState(null);



  // ── Stock type / Rate type / Date ───────────────────────────────────────
  const [stockType, setStockType] = useState(STOCK_TYPE.ALL);
  const [rateType, setRateType] = useState(RATE_TYPE.PURCHASE);
  const [fromDate, setFromDate] = useState(todayStr());

  // ── Extra checkboxes ─────────────────────────────────────────────────────
  const [chkImage, setChkImage] = useState(false);
  const [chkMinimum, setChkMinimum] = useState(false);
  const [chkWoPrice, setChkWoPrice] = useState(false);
  const [chkWoMaster, setChkWoMaster] = useState(false);
  const [chkBatch, setChkBatch] = useState(false); // Batch-wise stock
  const [chkBatch1, setChkBatch1] = useState(false); // Textiles batch-wise stock

  // ── UI feedback state ───────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null); // { text, isErr }

  const showBatchCheckboxes =
    session.TextilesSerialNowiseBilling === true || session.BatchWiseStock === true;

  // ── Bootstrap: permission + session, mirrors top of $(document).ready ──
  useEffect(() => {
    const menulist = CC.getLocal("menulist");
    if (menulist == null) {
      setMsg({ text: "Session Close Please Login !!!.", isErr: true });
      navigate("/Login/Index");
      return;
    }

    const menudata = menulist.filter((obj) => obj.PageName === "Closing Stock");
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
    const MainSet = CC.getLocal("Mainsetting") || [{}];
    const ComSet = CC.getLocal("Companysetting") || [{}];

    setSession({
      Comid,
      MComid,
      CName: ComSet[0]?.CName || "",
      CAddress: ComSet[0]?.CAddress || "",
      CPhone: ComSet[0]?.CPhone || "",
      Ecotech: !!MainSet[0]?.Ecotech,
      univercell: !!MainSet[0]?.univercell,
      RiceUOMSetting: !!MainSet[0]?.MultipleUOMBilling,
      BatchNoText: MainSet[0]?.BatchNoName || "",
      TextilesSerialNowiseBilling: !!MainSet[0]?.TextilesSerialNowiseBilling,
      TruckStockReport: !!MainSet[0]?.TruckStockReport,
      GroupCommission: !!MainSet[0]?.GroupCommission,
      BatchWiseStock: !!MainSet[0]?.BatchWiseStock,
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



  // ── Esc key — "Do you want to quit page?" (preserved from SaleOrder.jsx) ──
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

  // ── Group-by selection handlers ─────────────────────────────────────────
  // Non-univercell radio select: clicking Brand/Category/Department/Supplier/
  // UOM/Description/Code clears the others (radio "Panel" behaviour).
  const selectSingleGroupBy = useCallback((value) => {
    setGroupBySingle((prev) => (prev === value ? "" : value));
    setBrandSel(null);
    setCategorySel(null);
    setDepartmentSel(null);
    setSupplierSel(null);
    setUomSel(null);
    setDescriptionSel(null);
    setCodeSel(null);
  }, []);

  // Univercell: Brand/Category/Department are independent checkboxes that can
  // combine (→ GroupBy = "MULTIPLE"); selecting any of them clears the
  // Supplier/UOM/Description/Code single-select group, and vice versa.
  const toggleMultiGroupBy = useCallback((key) => {
    setMultiSel((prev) => ({ ...prev, [key]: !prev[key] }));
    setGroupBySingle("");
    setSupplierSel(null);
    setUomSel(null);
    setDescriptionSel(null);
    setCodeSel(null);
  }, []);

  const selectSingleGroupByUnivercell = useCallback((value) => {
    setGroupBySingle((prev) => (prev === value ? "" : value));
    setMultiSel({ Brand: false, Category: false, Department: false });
    setSupplierSel(null);
    setUomSel(null);
    setDescriptionSel(null);
    setCodeSel(null);
  }, []);

  // ── Refresh button ───────────────────────────────────────────────────────
  const handleRefresh = useCallback(() => {
    setGroupBySingle("");
    setMultiSel({ Brand: false, Category: false, Department: false });
    setBrandSel(null);
    setCategorySel(null);
    setDepartmentSel(null);
    setSupplierSel(null);
    setUomSel(null);
    setDescriptionSel(null);
    setCodeSel(null);
    setStockType(STOCK_TYPE.ALL);
    setRateType(RATE_TYPE.PURCHASE);
    setFromDate(todayStr());
    setChkImage(false);
    setChkMinimum(false);
    setChkWoPrice(false);
    setChkWoMaster(false);
    setChkBatch(false);
    setChkBatch1(false);
    setMsg(null);
  }, []);

  // ── Report viewer opener — same pattern as SaleOrder.jsx ────────────────
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

  // ── View button — replicates the closingstock.js $.ajax logic exactly ──
  const handleView = useCallback(async () => {
    if (!fromDate) {
      setMsg({ text: "Please select a From Date.", isErr: true });
      return;
    }

    // Resolve GroupBy / GroupByName / GroupByText / multiple, mirroring the
    // sequential if-blocks in closingstock.js.
    let GroupBy = "";
    let GroupByName = "";
    let GroupByText = "";
    let multiple = 0;

    const brandActive = session.univercell ? multiSel.Brand : groupBySingle === GROUP_BY.BRAND;
    const categoryActive = session.univercell ? multiSel.Category : groupBySingle === GROUP_BY.CATEGORY;
    const departmentActive = session.univercell ? multiSel.Department : groupBySingle === GROUP_BY.DEPARTMENT;

    if (brandActive) {
      GroupBy = "Brand";
      GroupByName = "Brand";
      if (brandSel) {
        if (session.univercell) {
          multiple += 1;
          GroupByText += (GroupByText !== "" ? "&" : "") + brandSel.label;
        } else {
          GroupByText = brandSel.label;
        }
      }
    }
    if (categoryActive) {
      GroupBy = "Category";
      GroupByName = "Category";
      if (categorySel) {
        if (session.univercell) {
          multiple += 1;
          GroupByText += (GroupByText !== "" ? "&" : "") + categorySel.label;
        } else {
          GroupByText = categorySel.label;
        }
      }
    }
    if (departmentActive) {
      GroupBy = "Department";
      GroupByName = "Department";
      if (departmentSel) {
        if (session.univercell) {
          multiple += 1;
          GroupByText += (GroupByText !== "" ? "&" : "") + departmentSel.label;
        } else {
          GroupByText = departmentSel.label;
        }
      }
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
    if (multiple > 1) {
      GroupBy = "MULTIPLE";
      GroupByName = "MULTIPLE";
    }

    // batch resolution — mirrors chkbatch / chkbatch1 / GroupCommission logic
    let batch = 0;
    if (chkBatch) batch = 1;
    if (chkBatch1) batch = 2;
    if (session.GroupCommission) batch = 3;

    // min resolution — mirrors chkminimum / chkwomaster / chkwoprice priority
    let min = "0";
    if (chkMinimum) min = "1";
    else if (chkWoMaster) min = "2";
    else if (chkWoPrice) min = "3";

    const image = chkImage ? 1 : 0;
    const Fromdate = toMMDDYYYY(fromDate);
    const Comid = parseInt(session.Comid, 10);
    const MComid = parseInt(session.MComid, 10);

    setLoading(true);
    setMsg(null);

    try {
      const res = await CC.api(
        ClosingStockReportUrl,
        null,
        { TruckStockReport: 0, Image: image,React:1 },
        {
          Batch: batch,
          GroupBy,
          GroupByName,
          GroupByText,
          Fromdate,
          StockType: stockType,
          MUOM: session.RiceUOMSetting,
          Comid,
          MComid,
          min,
        }
      );

      if (res?.ok || res?.IsSuccess) {
        const cacheKey = res.Data15 || "";
        
        if (batch === 0) {
          openReportViewer({
            ReportName: "ClosingStockReport",
            CacheKey: cacheKey,
            Img: image,
            min,
            GroupBy,
            EcoTech: session.Ecotech ? 1 : 0,
            Fromdate,
            BatchNoText: session.BatchNoText,
            RiceSetting: session.RiceUOMSetting,
            RateType: rateType,
            CName: session.CName,
            CAddress: session.CAddress,
            CPhone: session.CPhone,
          });
        } else if (batch === 1) {
          openReportViewer({
            ReportName: "ClosingBatchStockReport",
            CacheKey: cacheKey,
            GroupBy,
            Fromdate,
            CName: session.CName,
            CAddress: session.CAddress,
            CPhone: session.CPhone,
          });
        } else if (batch === 2) {
          openReportViewer({
            ReportName: "ClosingBatchTextilesStockReport",
            CacheKey: cacheKey,
            GroupBy,
            Fromdate,
            CName: session.CName,
            CAddress: session.CAddress,
            CPhone: session.CPhone,
          });
        } else if (batch === 3) {
          openReportViewer({
            ReportName: "ClosingStockReportPCS",
            CacheKey: cacheKey,
            GroupBy,
            Fromdate,
            BatchNoText: session.BatchNoText,
            RiceSetting: session.RiceUOMSetting,
            RateType: rateType,
            CName: session.CName,
            CAddress: session.CAddress,
            CPhone: session.CPhone,
          });
        }
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
    fromDate,
    session,
    groupBySingle,
    multiSel,
    brandSel,
    categorySel,
    departmentSel,
    supplierSel,
    uomSel,
    descriptionSel,
    codeSel,
    stockType,
    rateType,
    chkImage,
    chkMinimum,
    chkWoPrice,
    chkWoMaster,
    chkBatch,
    chkBatch1,
    openReportViewer,
  ]);

  // ── Group-by nav items ──────────────────────────────────────────────────
  const groupByItems = useMemo(
    () => [
      { value: GROUP_BY.BRAND, label: "Brand", icon: "🏷️", multi: true },
      { value: GROUP_BY.CATEGORY, label: "Category", icon: "🗂️", multi: true },
      { value: GROUP_BY.DEPARTMENT, label: "Department", icon: "🏬", multi: true },
      { value: GROUP_BY.SUPPLIER, label: "Supplier", icon: "🚚", multi: false },
      { value: GROUP_BY.UOM, label: "UOM", icon: "📐", multi: false },
      { value: GROUP_BY.DESCRIPTION, label: "Description", icon: "📝", multi: false },
      { value: GROUP_BY.CODE, label: "Code", icon: "#️⃣", multi: false },
    ],
    []
  );

  const isGroupByActive = (value, multi) => {
    if (multi && session.univercell) return multiSel[value];
    return groupBySingle === value;
  };

  const handleGroupByClick = (value, multi) => {
    if (multi && session.univercell) {
      toggleMultiGroupBy(value);
    } else if (multi && !session.univercell) {
      selectSingleGroupBy(value);
    } else {
      selectSingleGroupByUnivercell(value);
    }
  };

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
      <div className="cs-field">
        <label className="cs-label">{placeholder.replace("Select ", "")}</label>
        <select
          className="cs-input"
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

  // ── Scoped styles injected once (same tokens as SaleOrder.jsx, "cs-" prefix) ──
  const styles = `
    .cs-shell {
      min-height: 100vh;
      background: #f0f2f5;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      flex-direction: column;
    }
    .cs-layout {
      display: flex;
      flex: 1;
      gap: 20px;
      padding: 24px;
      max-width: 1200px;
      width: 100%;
      margin: 0 auto;
      box-sizing: border-box;
    }
    .cs-nav {
      width: 220px;
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .cs-nav-label {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .8px;
      color: #8a94a6;
      padding: 0 4px;
      margin-bottom: 2px;
    }
    .cs-nav-card {
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
    .cs-nav-card:hover {
      border-color: var(--clr-primary, #1a56db);
      box-shadow: 0 3px 12px rgba(26,86,219,.12);
    }
    .cs-nav-card.active {
      background: #eef3fd;
      border-color: var(--clr-primary, #1a56db);
      box-shadow: 0 3px 12px rgba(26,86,219,.15);
    }
    .cs-nav-icon {
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
    .cs-nav-card.active .cs-nav-icon {
      background: var(--clr-primary, #1a56db);
    }
    .cs-nav-card-name {
      font-size: 13px;
      font-weight: 600;
      color: #1e2d3d;
      line-height: 1.3;
    }
    .cs-nav-card.active .cs-nav-card-name {
      color: var(--clr-primary, #1a56db);
    }
    .cs-panel {
      flex: 1;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 2px 12px rgba(0,0,0,.08);
      padding: 28px 32px;
      display: flex;
      flex-direction: column;
    }
    .cs-panel-header {
      border-bottom: 1px solid #e8ecf0;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .cs-panel-eyebrow {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .8px;
      color: var(--clr-primary, #1a56db);
      margin-bottom: 6px;
    }
    .cs-panel-title {
      font-size: 20px;
      font-weight: 700;
      color: #1e2d3d;
      line-height: 1.2;
    }
    .cs-section-title {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .6px;
      color: #8a94a6;
      margin: 20px 0 10px;
    }
    .cs-section-title:first-of-type { margin-top: 0; }
    .cs-radio-row {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
    .cs-chip {
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
    .cs-chip:hover { border-color: var(--clr-primary, #1a56db); }
    .cs-chip.active {
      background: var(--clr-primary, #1a56db);
      border-color: var(--clr-primary, #1a56db);
      color: #fff;
    }
    .cs-form-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 16px 20px;
      align-items: start;
      max-width: 100%;
      margin-top: 10px;
      margin-bottom: 24px;
    }
    .cs-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .cs-label {
      font-size: 13px;
      font-weight: 600;
      color: #4a5568;
    }
    .cs-input {
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
    .cs-input:focus {
      border-color: var(--clr-primary, #1a56db);
      box-shadow: 0 0 0 3px rgba(26,86,219,.1);
    }
    .cs-toggle-row {
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
    .cs-toggle-row input[type="checkbox"] {
      width: 15px;
      height: 15px;
      accent-color: var(--clr-primary, #1a56db);
      cursor: pointer;
    }
    .cs-toggle-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px 16px;
      max-width: 460px;
      margin-top: 10px;
    }
    .cs-actions {
      display: flex;
      gap: 12px;
      margin-top: 28px;
      padding-top: 20px;
      border-top: 1px solid #e8ecf0;
    }
    .cs-btn {
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
    .cs-btn:disabled { opacity: .5; cursor: not-allowed; }
    .cs-btn-primary {
      background: var(--clr-primary, #1a56db);
      color: #fff;
      box-shadow: 0 2px 8px rgba(26,86,219,.3);
    }
    .cs-btn-primary:not(:disabled):hover {
      opacity: .9;
      box-shadow: 0 4px 14px rgba(26,86,219,.4);
    }
    .cs-btn-secondary {
      background: #f0f2f5;
      color: #4a5568;
      border: 1.5px solid #d1d9e6;
    }
    .cs-btn-secondary:not(:disabled):hover {
      background: #e8ecf0;
    }
    .cs-msg {
      margin-top: 18px;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
    }
    .cs-msg.err { background: #fff0f0; color: #c53030; border: 1px solid #fed7d7; }
    .cs-msg.ok  { background: #f0fff4; color: #276749; border: 1px solid #c6f6d5; }
    @media (max-width: 760px) {
      .cs-layout { flex-direction: column; padding: 16px; }
      .cs-nav { width: 100%; flex-direction: row; flex-wrap: wrap; }
      .cs-nav-card { flex: 1 1 calc(33% - 7px); }
      .cs-panel { padding: 20px 16px; }
      .cs-form-grid, .cs-toggle-grid { grid-template-columns: 1fr; }
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
      <div className="cs-shell">
        <Topbar />

        <div className="cs-layout">
          {/* ── LEFT: Group-by navigation panel ── */}
          <nav className="cs-nav" aria-label="Group by">
            <div className="cs-nav-label">Group By</div>
            {groupByItems.map((item) => (
              <div
                key={item.value}
                className={`cs-nav-card${isGroupByActive(item.value, item.multi) ? " active" : ""}`}
                onClick={() => handleGroupByClick(item.value, item.multi)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && handleGroupByClick(item.value, item.multi)}
                aria-pressed={isGroupByActive(item.value, item.multi)}
              >
                <div className="cs-nav-icon">{item.icon}</div>
                <div className="cs-nav-card-name">{item.label}</div>
              </div>
            ))}
          </nav>

          {/* ── RIGHT: Filter panel ── */}
          <main className="cs-panel">
            <div className="cs-panel-header">
              <div className="cs-panel-eyebrow">Stock</div>
              <div className="cs-panel-title">Closing Stock Report</div>
            </div>

            {/* Combo bound to the active Group By selection */}
            <div className="cs-form-grid">
              {isGroupByActive(GROUP_BY.BRAND, true) && (
                <ApiSelect url={BrandListUrl} payload={{ Comid: session.Comid }} labelKey="BrandName" valueKey="Id" value={brandSel} onChange={setBrandSel} placeholder="Select Brand" />
              )}
              {isGroupByActive(GROUP_BY.CATEGORY, true) && (
                <ApiSelect url={CategoryListUrl} payload={{ Comid: session.Comid }} labelKey="Cat_Name" valueKey="Id" value={categorySel} onChange={setCategorySel} placeholder="Select Category" />
              )}
              {isGroupByActive(GROUP_BY.DEPARTMENT, true) && (
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

              <div className="cs-field">
                <label className="cs-label" htmlFor="cs-from-date">From Date</label>
                <input
                  id="cs-from-date"
                  type="date"
                  className="cs-input"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>
            </div>

            {/* Stock type */}
            <div className="cs-section-title">Stock Type</div>
            <div className="cs-radio-row">
              {[
                { value: STOCK_TYPE.ALL, label: "All" },
                { value: STOCK_TYPE.WITH_STOCK, label: "With Stock" },
                { value: STOCK_TYPE.WITHOUT_STOCK, label: "Without Stock" },
              ].map((o) => (
                <div
                  key={o.value}
                  className={`cs-chip${stockType === o.value ? " active" : ""}`}
                  onClick={() => setStockType(o.value)}
                  role="button"
                  tabIndex={0}
                >
                  {o.label}
                </div>
              ))}
            </div>

            {/* Rate type */}
            <div className="cs-section-title">Rate Type</div>
            <div className="cs-radio-row">
              {[
                { value: RATE_TYPE.PURCHASE, label: "Purchase" },
                { value: RATE_TYPE.SALE, label: "Sale" },
                { value: RATE_TYPE.MRP, label: "MRP" },
              ].map((o) => (
                <div
                  key={o.value}
                  className={`cs-chip${rateType === o.value ? " active" : ""}`}
                  onClick={() => setRateType(o.value)}
                  role="button"
                  tabIndex={0}
                >
                  {o.label}
                </div>
              ))}
            </div>

            {/* Extra options */}
            <div className="cs-section-title">Options</div>
            <div className="cs-toggle-grid">
              <label className="cs-toggle-row">
                <input type="checkbox" checked={chkImage} onChange={(e) => setChkImage(e.target.checked)} />
                Show Image
              </label>
              <label className="cs-toggle-row">
                <input
                  type="checkbox"
                  checked={chkMinimum}
                  onChange={(e) => {
                    setChkMinimum(e.target.checked);
                    if (e.target.checked) {
                      setChkWoMaster(false);
                      setChkWoPrice(false);
                    }
                  }}
                />
                Minimum Level
              </label>
              <label className="cs-toggle-row">
                <input
                  type="checkbox"
                  checked={chkWoPrice}
                  onChange={(e) => {
                    setChkWoPrice(e.target.checked);
                    if (e.target.checked) {
                      setChkMinimum(false);
                      setChkWoMaster(false);
                    }
                  }}
                />
                Without Price
              </label>
              <label className="cs-toggle-row">
                <input
                  type="checkbox"
                  checked={chkWoMaster}
                  onChange={(e) => {
                    setChkWoMaster(e.target.checked);
                    if (e.target.checked) {
                      setChkMinimum(false);
                      setChkWoPrice(false);
                    }
                  }}
                />
                Without Master
              </label>
              {showBatchCheckboxes && (
                <>
                  <label className="cs-toggle-row">
                    <input
                      type="checkbox"
                      checked={chkBatch}
                      onChange={(e) => {
                        setChkBatch(e.target.checked);
                        if (e.target.checked) setChkBatch1(false);
                      }}
                    />
                    Batch Wise Stock
                  </label>
                  <label className="cs-toggle-row">
                    <input
                      type="checkbox"
                      checked={chkBatch1}
                      onChange={(e) => {
                        setChkBatch1(e.target.checked);
                        if (e.target.checked) setChkBatch(false);
                      }}
                    />
                    Textiles Batch Wise Stock
                  </label>
                </>
              )}
            </div>

            <div className="cs-actions">
              <button
                type="button"
                className="cs-btn cs-btn-primary"
                disabled={loading || pageAccess.pageview === 0}
                onClick={handleView}
              >
                {loading ? "Loading…" : "▶ View"}
              </button>
              <button
                type="button"
                className="cs-btn cs-btn-secondary"
                onClick={handleRefresh}
                disabled={loading}
              >
                ↺ Refresh
              </button>
            </div>

            {msg && <div className={`cs-msg ${msg.isErr ? "err" : "ok"}`}>{msg.text}</div>}
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