// ─────────────────────────────────────────────────────────────────────────────
//  ItemList.jsx
//  React conversion of ItemList.js (jQuery) — "Item List Report" (Stock module)
//  Uses API helpers from Common.jsx (CC.api / CC.getLocal / CC.getStr etc.)
//  Styling: same so- design system as SaleOrder.jsx — no inline color values,
//  no new theme colors.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Save, XCircle } from "lucide-react";
import * as CC from "../../components/Common";
import Topbar from "../../components/Topbar";

// Group-by field identifiers (mirrors the 7 jqxRadioButtons in the original markup)
const GROUP_FIELDS = {
  BRAND: "BRAND",
  CATEGORY: "CATEGORY",
  DEPARTMENT: "DEPARTMENT",
  SUPPLIER: "SUPPLIER",
  UOM: "UOM",
  DESCRIPTION: "DESCRIPTION",
  CODE: "CODE",
};

// The exact GroupBy string the API / report viewer expects (unchanged from source)
const GROUP_BY_VALUE = {
  [GROUP_FIELDS.BRAND]: "Brand",
  [GROUP_FIELDS.CATEGORY]: "Category",
  [GROUP_FIELDS.DEPARTMENT]: "Department",
  [GROUP_FIELDS.SUPPLIER]: "Supplier",
  [GROUP_FIELDS.UOM]: "UOM",
  [GROUP_FIELDS.DESCRIPTION]: "Description",
  [GROUP_FIELDS.CODE]: "Code",
};

// These now reuse the REAL endpoint constants already exported by Common.jsx
// (same ones useReportCombos() uses elsewhere in the project) instead of
// guessed URLs. GetSupplierAll needs an AccountType, same as useReportCombos().
const BrandListUrl      = CC.BrandSelect;       // "/api/BrandApp/SelectBrand"
const CategoryListUrl   = CC.CategorySelect;    // "/api/CategoryApp/SelectCategory"
const DepartmentListUrl = CC.DepartmentSelect;  // "/api/DepartmentApp/SelectDepartment"
const SupplierListUrl   = CC.GetSupplierAll;    // "/api/SupplierApp/SelectSupplierAll"
const UomListUrl        = CC.UOMSelect;         // "/api/UOMApp/SelectUOM"
const ProductListUrl    = CC.IM_ProductList;    // "/api/ItemMasterApp/GetProductListV7" — supplies Description & Code combos

const ItemListReportUrl = "/api/StockReportApp/ItemList"; // unchanged from your edit

// CC.toComboOption() only recognises row.Name / row.label / row.Description —
// but SelectBrand's SQL returns "Id, Brand_Name as BrandName", not "Name".
// The generic mapper was silently falling back to showing the raw Id as the
// label. This picks the first matching alias, confirmed for Brand and
// guessed (same Id + XxxName convention) for the others — confirm these
// against SelectCategory/SelectDepartment/SelectSupplierAll/SelectUOM if the
// dropdown text still looks wrong for any of them.
const buildComboOption = (row, aliases = []) => {
  const value = row.Id ?? row.id ?? row.value ?? row.Code ?? row.code ?? "";
  const label =
    aliases.map((a) => row[a]).find((v) => v != null && v !== "") ??
    row.Name ?? row.name ?? row.Description ?? String(value);
  return { value, label };
};

export default function ItemList() {
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

  // ── Group-by field selection (mirrors the 7 jqxRadioButtons — mutually exclusive) ──
  const [groupField, setGroupField] = useState(null);

  // ── Combo-box master data (replaces loadbrandcombo / loadcategorycombo / etc.) ──
  const [options, setOptions] = useState({
    brand: [],
    category: [],
    department: [],
    supplier: [],
    uom: [],
    product: [],
  });

  // ── Combo-box selections, one per group-by field ───────────────────────
  const [selections, setSelections] = useState({
    BRAND: null,
    CATEGORY: null,
    DEPARTMENT: null,
    SUPPLIER: null,
    UOM: null,
    DESCRIPTION: null,
    CODE: null,
  });

  // ── Suppress-column checkboxes (all default checked, same as methods.load()) ──
  const [chkDescription, setChkDescription] = useState(true);
  const [chkLandingCost, setChkLandingCost] = useState(true);
  const [chkPurchaseRate, setChkPurchaseRate] = useState(true);
  const [chkMrp, setChkMrp] = useState(true);
  const [chkSaleRate, setChkSaleRate] = useState(true);
  const [chkGst, setChkGst] = useState(true);
  const [chkMultipleMrp, setChkMultipleMrp] = useState(false);

  // ── UI feedback state ───────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null); // { text, isErr }

  // ── Bootstrap: permission + session (mirrors $(document).ready guard) ──
  useEffect(() => {
    const menulist = CC.getLocal("menulist");
    if (menulist == null) {
      setMsg({ text: "Session Close Please Login !!!.", isErr: true });
      navigate("/Login/Index");
      return;
    }

    const menudata = menulist.filter((obj) => obj.PageName === "ItemList");
    if (!menudata || menudata.length === 0) {
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

  // ── Esc-to-quit (same convention as other report screens) ──
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

  // ── Load combo-box master data once page access is confirmed ──
  useEffect(() => {
    if (!pageAccess.ready) return;

    (async () => {
      try {
        const MComid = session.MComid;

        // Every Master-data select endpoint in this project requires a Comid
        // query param — that's what was actually causing the 404s (the route
        // exists, but without Comid the backend rejects it). Same convention
        // CC.useReportCombos() already uses elsewhere in the app.
        const results = await Promise.allSettled([
          CC.api(BrandListUrl, null, {}, { Comid: MComid }),
          CC.api(CategoryListUrl, null, {}, { Comid: MComid }),
          CC.api(DepartmentListUrl, null, {}, { Comid: MComid }),
          CC.api(SupplierListUrl, null, {}, { AccountType: "SUPPLIER", Comid: MComid }),
          CC.api(UomListUrl, null, {}, { Comid: MComid }),
          CC.api(ProductListUrl, null, {}, { Comid: MComid }),
        ]);

        const dualLogin = results.some((r) => r.status === "fulfilled" && r.value?._dualLogin);
        if (dualLogin) {
          alert("Already Login Another User Please Login Again!!!");
          navigate("/Login/Index");
          return;
        }

        const [brandRes, categoryRes, departmentRes, supplierRes, uomRes, productRes] = results;
        const val = (r) => (r.status === "fulfilled" ? r.value : null);

        const productRows = CC.extractComboList(val(productRes));
        console.log("Product API raw row:", productRows[0]);  
        setOptions({
          brand: CC.extractComboList(val(brandRes)).map((r) => buildComboOption(r, ["BrandName"])),
          category: CC.extractComboList(val(categoryRes)).map((r) => buildComboOption(r, ["Cat_Name"])),
          department: CC.extractComboList(val(departmentRes)).map((r) => buildComboOption(r, ["DepartmentName"])),
          supplier: CC.extractComboList(val(supplierRes)).map((r) => buildComboOption(r, ["SupplierName", "AccountName", "CompanyName"])),
          uom: CC.extractComboList(val(uomRes)).map((r) => buildComboOption(r, ["UOMName", "UomName", "Uom_Name"])),
          // Product list keeps its raw Description/Code fields since the same
          // list feeds both the Description combo and the Code combo.
          product: productRows.map((row) => ({
            value:
              row.Id ??
              row.PCode ??
              row.Prod_Code ??
              "",
          
            description:
              row.PName ??
              row.TamilName ??
              "",
          
            code:
              row.PCode ??
              row.Prod_Code ??
              "",
          })),
        });
      } catch (err) {
        setMsg({ text: err.message || "Failed to load filter lists.", isErr: true });
      }
    })();
  }, [pageAccess.ready, session.MComid, navigate]);

  const handleFieldSelect = useCallback((field) => {
    setGroupField(field);
  }, []);

  const handleComboChange = useCallback((field, value, list) => {
    if (value === "") {
      setSelections((prev) => ({ ...prev, [field]: null }));
      return;
    }
    const item = list.find((o) => String(o.value) === value) || null;
    setSelections((prev) => ({ ...prev, [field]: item }));
  }, []);

  const clearSelections = useCallback(() => {
    setSelections({
      BRAND: null,
      CATEGORY: null,
      DEPARTMENT: null,
      SUPPLIER: null,
      UOM: null,
      DESCRIPTION: null,
      CODE: null,
    });
  }, []);

  // Mirrors #btnrefresh click: clear combos, disable them (groupField -> null
  // disables all selects), and reset the suppress checkboxes to their defaults.
  const handleRefresh = useCallback(() => {
    setGroupField(null);
    clearSelections();
    setChkDescription(true);
    setChkLandingCost(true);
    setChkPurchaseRate(true);
    setChkMrp(true);
    setChkSaleRate(true);
    setChkGst(true);
    setChkMultipleMrp(false);
    setMsg(null);
  }, [clearSelections]);

  // const openReportViewer = useCallback((params) => {
  //   const qs = new URLSearchParams(params).toString();
  //   // Relative path kept exactly as in the source (not switched to an absolute BASE_URL).
  //   const url = `../Reports/ReportViewer.aspx?${qs}`;

  //   const w = window.open(
  //     url,
  //     "_blank",
  //     `directories=0,titlebar=0,toolbar=0,location=0,status=0,` +
  //     `menubar=0,scrollbars=yes,resizable=no,` +
  //     `width=${screen.width},height=${screen.height - 100}`
  //   );
  //   if (w) {
  //     w.addEventListener("load", () => { w.document.title = "ItemList-Report"; }, false);
  //   }
  // }, []);
  const openReportViewer = useCallback((params) => {
    const qs = new URLSearchParams(params).toString();
    const url = `${CC.BASE_URL}/Reports/ReportViewer.aspx?${qs}`;   // ✅ absolute, matches PurchaseOrderDetail.jsx pattern
  
    const w = window.open(
      url,
      "_blank",
      `directories=0,titlebar=0,toolbar=0,location=0,status=0,` +
      `menubar=0,scrollbars=yes,resizable=no,` +
      `width=${screen.width},height=${screen.height - 100}`
    );
    if (w) {
      w.addEventListener("load", () => { w.document.title = "ItemList-Report"; }, false);
    }
  }, []);

  const FIELD_DISPLAY_NAME = {
    [GROUP_FIELDS.BRAND]: "Brand",
    [GROUP_FIELDS.CATEGORY]: "Category",
    [GROUP_FIELDS.DEPARTMENT]: "Department",
    [GROUP_FIELDS.SUPPLIER]: "Supplier",
    [GROUP_FIELDS.UOM]: "UOM",
    [GROUP_FIELDS.DESCRIPTION]: "Item Name",
    [GROUP_FIELDS.CODE]: "Item Code",
  };

  // Mirrors #btnview click handler exactly: derive GroupBy/GroupByText from the
  // selected field, let chkMultipleMrp override it to "MRP", build the suppress
  // flags, POST to ItemListReportUrl, then open the report viewer or show
  // "No Record !!!.". methods.Clear() ran unconditionally after the (synchronous)
  // ajax call in the source, so combo selections are always cleared in `finally`.
  const handleView = useCallback(async () => {
    let groupBy = "";
    let groupByText = "";

    if (groupField) {
      groupBy = GROUP_BY_VALUE[groupField];
      const item = selections[groupField];
      if (item != null) {
        groupByText = item.value;
        if (groupByText == null) {
          alert(`Please Select Valid ${FIELD_DISPLAY_NAME[groupField]} Name !!!.`);
          setSelections((prev) => ({ ...prev, [groupField]: null }));
          return;
        }
      }
    }

    if (chkMultipleMrp === true) {
      groupBy = "MRP";
      groupByText = "";
    }

    const description = chkDescription ? "YES" : "";
    const landingcost = chkLandingCost ? "YES" : "";
    const mrp = chkMrp ? "YES" : "";
    const purrate = chkPurchaseRate ? "YES" : "";
    const gst = chkGst ? "YES" : "";
    const salerate = chkSaleRate ? "YES" : "";

    setLoading(true);
    setMsg(null);

    try {
      const res = await CC.api(ItemListReportUrl, null, {React:1}, {
        GroupBy: groupBy,
        GroupByName: groupByText,
        MComid: session.MComid,
      });

      if (res.ok === true || res.IsSuccess) {
        const cacheKey =
        res.data15 ??
        res.Data15 ??
        res.data?.Data15 ??
        "";
        openReportViewer({
          ReportName: "ItemListNew",
          CacheKey: cacheKey,
          GroupBy: groupBy,
          suppressdesc: description,
          suppressLand: landingcost,
          suppressmrp: mrp,
          suppresspurrate: purrate,
          suppresssalerate: salerate,
          suppresstax: gst,
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
      clearSelections();
    }
  }, [
    groupField,
    selections,
    chkMultipleMrp,
    chkDescription,
    chkLandingCost,
    chkMrp,
    chkPurchaseRate,
    chkGst,
    chkSaleRate,
    session,
    openReportViewer,
    clearSelections,
  ]);

  const navItems = useMemo(() => ([
    { value: GROUP_FIELDS.BRAND, label: "Brand", icon: "🏷️" },
    { value: GROUP_FIELDS.CATEGORY, label: "Category", icon: "📂" },
    { value: GROUP_FIELDS.DEPARTMENT, label: "Department", icon: "🏢" },
    { value: GROUP_FIELDS.SUPPLIER, label: "Supplier", icon: "🚚" },
    { value: GROUP_FIELDS.UOM, label: "UOM", icon: "📏" },
    { value: GROUP_FIELDS.DESCRIPTION, label: "Item Description", icon: "📦" },
    { value: GROUP_FIELDS.CODE, label: "Item Code", icon: "🔢" },
  ]), []);

  // Which options list + which field of each option to display, per group-by field.
  const comboByField = {
    [GROUP_FIELDS.BRAND]: { list: options.brand, labelKey: "label" },
    [GROUP_FIELDS.CATEGORY]: { list: options.category, labelKey: "label" },
    [GROUP_FIELDS.DEPARTMENT]: { list: options.department, labelKey: "label" },
    [GROUP_FIELDS.SUPPLIER]: { list: options.supplier, labelKey: "label" },
    [GROUP_FIELDS.UOM]: { list: options.uom, labelKey: "label" },
    [GROUP_FIELDS.DESCRIPTION]: { list: options.product, labelKey: "description" },
    [GROUP_FIELDS.CODE]: { list: options.product, labelKey: "code" },
  };

  const activeCombo = groupField ? comboByField[groupField] : null;

  const styles = `
    /* ── BranchWise.jsx design system, ported 1:1 (colors/spacing/cards/buttons) ── */
    .so-shell { min-height: 100vh; background: #f0f2f5; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; flex-direction: column; }
    .so-topbar { background: linear-gradient(135deg, #3b6fe0, #1a4fd1); color: #fff; display: flex; align-items: center; justify-content: space-between; padding: 0 24px; height: 52px; box-shadow: 0 2px 8px rgba(0,0,0,.18); flex-shrink: 0; }
    .so-topbar-title { font-size: 15px; font-weight: 600; letter-spacing: .3px; }
    .so-close-btn { background: rgba(255,255,255,.15); border: none; color: #fff; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; transition: background .15s; }
    .so-close-btn:hover { background: rgba(255,255,255,.28); }

    .so-layout { flex: 1; display: flex; align-items: flex-start; justify-content: center; padding: 24px; box-sizing: border-box; }
    .so-card { width: 100%; max-width: 900px; background: #fff; border: 2px solid #1a56db; border-radius: 10px; box-shadow: 0 4px 16px rgba(26,86,219,.18); overflow: hidden; }
    .so-card-header { background: linear-gradient(135deg, #3b6fe0, #1a4fd1); border-bottom: 1px solid #1a4fd1; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; }
    .so-card-header-title { font-size: 14px; font-weight: 700; color: #fff; letter-spacing: .2px; }
    .so-card-body { padding: 24px 32px 30px; }
    .so-report-title { text-align: center; font-size: 22px; font-weight: 800; color: #1a3fd6; margin: 0 0 26px; }

    .so-content { display: flex; gap: 32px; }

    /* ── Left rail: Group By ── */
    .so-nav { flex: 0 0 220px; display: flex; flex-direction: column; gap: 2px; padding: 4px 0 18px; border-right: 1px solid #ececec; margin-right: 4px; }
    .so-nav-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; color: #8a94a6; padding: 0 4px; margin-bottom: 8px; }
    .so-nav-card { position: relative; background: transparent; border: none; border-radius: 6px; padding: 8px 8px 8px 30px; cursor: pointer; transition: background .15s; box-shadow: none; display: flex; align-items: center; gap: 8px; }
    .so-nav-card:hover { background: #f4f7fc; }
    .so-nav-card.active { background: transparent; }
    /* fake radio-button ring, matches BranchWise's radio accent color */
    .so-nav-card::before { content: ""; position: absolute; left: 6px; top: 50%; transform: translateY(-50%); width: 16px; height: 16px; border-radius: 50%; border: 2px solid #c7cdd6; background: #fff; box-sizing: border-box; transition: border-color .15s, background .15s, box-shadow .15s; }
    .so-nav-card.active::before { border-color: #1a56db; background: #1a56db; box-shadow: inset 0 0 0 3px #fff; }
    .so-nav-icon { width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; font-size: 13px; flex-shrink: 0; background: transparent; border-radius: 0; }
    .so-nav-card-text { flex: 1; }
    .so-nav-card-name { font-size: 13px; font-weight: 500; color: #2b2b2b; line-height: 1.3; }
    .so-nav-card.active .so-nav-card-name { color: #1a56db; font-weight: 700; }

    .so-panel { flex: 1; display: flex; flex-direction: column; min-width: 0; }
    .so-panel-header { margin-bottom: 18px; }
    .so-panel-eyebrow { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; color: #1a56db; margin-bottom: 6px; }
    .so-panel-title { font-size: 15px; font-weight: 700; color: #1e2d3d; line-height: 1.2; }

    .so-form-grid { display: grid; grid-template-columns: 130px 1fr; gap: 14px 14px; align-items: center; max-width: 480px; }
    .so-label { font-size: 13px; font-weight: 600; color: #1e293b; }
    .so-input { height: 34px; border: 1px solid #c7cdd6; border-radius: 4px; padding: 0 10px; font-size: 13px; color: #1e2d3d; background: #fff; width: 100%; box-sizing: border-box; transition: border-color .15s, box-shadow .15s; outline: none; }
    .so-input:focus { border-color: #1a56db; box-shadow: 0 0 0 3px rgba(26,86,219,.15); }
    .so-input:disabled { background: #f5f6f8; color: #9aa5b1; cursor: not-allowed; }
    select.so-input { appearance: auto; cursor: pointer; }

    .so-toggle-row { display: flex; align-items: center; gap: 10px; height: 34px; background: #f7f9fc; border: 1px solid #c7cdd6; border-radius: 4px; padding: 0 12px; cursor: pointer; font-size: 13px; color: #1e293b; font-weight: 500; user-select: none; transition: border-color .15s, background .15s; }
    .so-toggle-row:hover { border-color: #1a56db; background: #f2f6ff; }
    .so-toggle-row input[type="checkbox"] { width: 15px; height: 15px; accent-color: #1a56db; cursor: pointer; }

    .so-actions { display: flex; gap: 12px; margin-top: 28px; padding-top: 22px; border-top: 1px solid #e8ecf0; }
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
    .so-section-divider { border: none; border-top: 1px solid #e8ecf0; margin: 22px 0; }

    @media (max-width: 700px) {
      .so-card-body { padding: 20px; }
      .so-content { flex-direction: column; gap: 22px; }
      .so-nav { flex: none; width: 100%; flex-direction: row; flex-wrap: wrap; border-right: none; border-bottom: 1px solid #ececec; padding-bottom: 14px; }
      .so-nav-card { flex: 1 1 calc(50% - 5px); }
      .so-form-grid { grid-template-columns: 1fr; }
      .so-actions { flex-direction: column; }
      .so-btn { width: 100%; justify-content: center; }
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
              <div className="so-card-header-title">Item List Report</div>
            </div>

            <div className="so-card-body">
              <div className="so-report-title">Item List - Report</div>

              <div className="so-content">
              <nav className="so-nav" aria-label="Group by">
                <div className="so-nav-label">Group By</div>
                {navItems.map((item) => (
                  <div
                    key={item.value}
                    className={`so-nav-card${groupField === item.value ? " active" : ""}`}
                    onClick={() => handleFieldSelect(item.value)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && handleFieldSelect(item.value)}
                    aria-pressed={groupField === item.value}
                  >
                    <div className="so-nav-icon">{item.icon}</div>
                    <div className="so-nav-card-text">
                      <div className="so-nav-card-name">{item.label}</div>
                    </div>
                  </div>
                ))}
              </nav>

              <main className="so-panel">
                <div className="so-panel-header">
                  <div className="so-panel-eyebrow">Stock</div>
              <div className="so-panel-title">Item List Report</div>
            </div>

            {groupField && (
              <div className="so-form-grid">
                <label className="so-label" htmlFor="il-combo">
                  {navItems.find((n) => n.value === groupField)?.label}
                </label>
                <select
                  id="il-combo"
                  className="so-input"
                  value={selections[groupField]?.value ?? ""}
                  onChange={(e) => handleComboChange(groupField, e.target.value, activeCombo.list)}
                >
                  <option value="">-- Select --</option>
                  {activeCombo.list.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt[activeCombo.labelKey] ?? opt.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <hr className="so-section-divider" />

            <div className="so-form-grid">
              <label className="so-label">Description</label>
              <label className="so-toggle-row">
                <input type="checkbox" checked={chkDescription} onChange={(e) => setChkDescription(e.target.checked)} />
                {chkDescription ? "Included" : "Excluded"}
              </label>

              <label className="so-label">Landing Cost</label>
              <label className="so-toggle-row">
                <input type="checkbox" checked={chkLandingCost} onChange={(e) => setChkLandingCost(e.target.checked)} />
                {chkLandingCost ? "Included" : "Excluded"}
              </label>

              <label className="so-label">Purchase Rate</label>
              <label className="so-toggle-row">
                <input type="checkbox" checked={chkPurchaseRate} onChange={(e) => setChkPurchaseRate(e.target.checked)} />
                {chkPurchaseRate ? "Included" : "Excluded"}
              </label>

              <label className="so-label">MRP</label>
              <label className="so-toggle-row">
                <input type="checkbox" checked={chkMrp} onChange={(e) => setChkMrp(e.target.checked)} />
                {chkMrp ? "Included" : "Excluded"}
              </label>

              <label className="so-label">Sale Rate</label>
              <label className="so-toggle-row">
                <input type="checkbox" checked={chkSaleRate} onChange={(e) => setChkSaleRate(e.target.checked)} />
                {chkSaleRate ? "Included" : "Excluded"}
              </label>

              <label className="so-label">GST</label>
              <label className="so-toggle-row">
                <input type="checkbox" checked={chkGst} onChange={(e) => setChkGst(e.target.checked)} />
                {chkGst ? "Included" : "Excluded"}
              </label>

              <label className="so-label">Multiple MRP</label>
              <label className="so-toggle-row">
                <input type="checkbox" checked={chkMultipleMrp} onChange={(e) => setChkMultipleMrp(e.target.checked)} />
                {chkMultipleMrp ? "Enabled" : "Disabled"}
              </label>
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
              <button type="button" className="so-btn so-btn-secondary" onClick={handleRefresh} disabled={loading}>
                <XCircle size={16} className="so-icon-cancel" />
                Refresh
              </button>
            </div>

            {msg && <div className={`so-msg ${msg.isErr ? "err" : "ok"}`}>{msg.text}</div>}
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