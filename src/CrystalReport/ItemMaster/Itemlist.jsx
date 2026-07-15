// ─────────────────────────────────────────────────────────────────────────────
//  ItemList.jsx
//  React conversion of ItemList.js (jQuery) — "Item List Report" (Stock module)
//  Uses API helpers from Common.jsx (CC.api / CC.getLocal / CC.getStr etc.)
//  Styling: same so- design system as SaleOrder.jsx — no inline color values,
//  no new theme colors.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
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
    .so-shell { min-height: 100vh; background: #f0f2f5; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; flex-direction: column; }
    .so-topbar { background: var(--clr-primary, #1a56db); color: #fff; display: flex; align-items: center; justify-content: space-between; padding: 0 24px; height: 52px; box-shadow: 0 2px 8px rgba(0,0,0,.18); flex-shrink: 0; }
    .so-topbar-title { font-size: 15px; font-weight: 600; letter-spacing: .3px; }
    .so-close-btn { background: rgba(255,255,255,.15); border: none; color: #fff; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; transition: background .15s; }
    .so-close-btn:hover { background: rgba(255,255,255,.28); }
    .so-layout { display: flex; flex: 1; gap: 20px; padding: 24px; max-width: 1100px; width: 100%; margin: 0 auto; box-sizing: border-box; }
    .so-nav { width: 220px; flex-shrink: 0; display: flex; flex-direction: column; gap: 10px; }
    .so-nav-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; color: #8a94a6; padding: 0 4px; margin-bottom: 2px; }
    .so-nav-card { background: #fff; border: 2px solid transparent; border-radius: 10px; padding: 14px 16px; cursor: pointer; transition: border-color .15s, box-shadow .15s, background .15s; box-shadow: 0 1px 4px rgba(0,0,0,.07); display: flex; align-items: center; gap: 12px; }
    .so-nav-card:hover { border-color: var(--clr-primary, #1a56db); box-shadow: 0 3px 12px rgba(26,86,219,.12); }
    .so-nav-card.active { background: #eef3fd; border-color: var(--clr-primary, #1a56db); box-shadow: 0 3px 12px rgba(26,86,219,.15); }
    .so-nav-icon { width: 34px; height: 34px; border-radius: 8px; background: #e8edfc; display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0; }
    .so-nav-card.active .so-nav-icon { background: var(--clr-primary, #1a56db); }
    .so-nav-card-text { flex: 1; }
    .so-nav-card-name { font-size: 13px; font-weight: 600; color: #1e2d3d; line-height: 1.3; }
    .so-nav-card.active .so-nav-card-name { color: var(--clr-primary, #1a56db); }
    .so-panel { flex: 1; background: #fff; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,.08); padding: 28px 32px; display: flex; flex-direction: column; }
    .so-panel-header { border-bottom: 1px solid #e8ecf0; padding-bottom: 16px; margin-bottom: 28px; }
    .so-panel-eyebrow { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; color: var(--clr-primary, #1a56db); margin-bottom: 6px; }
    .so-panel-title { font-size: 20px; font-weight: 700; color: #1e2d3d; line-height: 1.2; }
    .so-form-grid { display: grid; grid-template-columns: 140px 1fr; gap: 20px 16px; align-items: center; max-width: 460px; }
    .so-label { font-size: 13px; font-weight: 600; color: #4a5568; }
    .so-input { height: 38px; border: 1.5px solid #d1d9e6; border-radius: 8px; padding: 0 12px; font-size: 13px; color: #1e2d3d; background: #fff; width: 100%; box-sizing: border-box; transition: border-color .15s, box-shadow .15s; outline: none; }
    .so-input:focus { border-color: var(--clr-primary, #1a56db); box-shadow: 0 0 0 3px rgba(26,86,219,.1); }
    .so-input:disabled { background: #f7f9fc; color: #a0aab8; cursor: not-allowed; }
    .so-toggle-row { display: flex; align-items: center; gap: 10px; height: 38px; background: #f7f9fc; border: 1.5px solid #d1d9e6; border-radius: 8px; padding: 0 12px; cursor: pointer; font-size: 13px; color: #4a5568; font-weight: 500; user-select: none; transition: border-color .15s; }
    .so-toggle-row:hover { border-color: var(--clr-primary, #1a56db); }
    .so-toggle-row input[type="checkbox"] { width: 15px; height: 15px; accent-color: var(--clr-primary, #1a56db); cursor: pointer; }
    .so-actions { display: flex; gap: 12px; margin-top: 32px; padding-top: 24px; border-top: 1px solid #e8ecf0; }
    .so-btn { height: 40px; padding: 0 28px; border-radius: 8px; border: none; font-size: 14px; font-weight: 600; cursor: pointer; transition: opacity .15s, box-shadow .15s; display: flex; align-items: center; gap: 8px; }
    .so-btn:disabled { opacity: .5; cursor: not-allowed; }
    .so-btn-primary { background: var(--clr-primary, #1a56db); color: #fff; box-shadow: 0 2px 8px rgba(26,86,219,.3); }
    .so-btn-primary:not(:disabled):hover { opacity: .9; box-shadow: 0 4px 14px rgba(26,86,219,.4); }
    .so-btn-secondary { background: #f0f2f5; color: #4a5568; border: 1.5px solid #d1d9e6; }
    .so-btn-secondary:not(:disabled):hover { background: #e8ecf0; }
    .so-msg { margin-top: 18px; padding: 10px 14px; border-radius: 8px; font-size: 13px; font-weight: 500; }
    .so-msg.err { background: #fff0f0; color: #c53030; border: 1px solid #fed7d7; }
    .so-msg.ok  { background: #f0fff4; color: #276749; border: 1px solid #c6f6d5; }
    .so-section-divider { border: none; border-top: 1px solid #e8ecf0; margin: 24px 0; }
    @media (max-width: 700px) {
      .so-layout { flex-direction: column; padding: 16px; }
      .so-nav { width: 100%; flex-direction: row; flex-wrap: wrap; }
      .so-nav-card { flex: 1 1 calc(50% - 5px); }
      .so-panel { padding: 20px 16px; }
      .so-form-grid { grid-template-columns: 110px 1fr; }
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
                {loading ? "Loading…" : "▶ View"}
              </button>
              <button type="button" className="so-btn so-btn-secondary" onClick={handleRefresh} disabled={loading}>
                ↺ Refresh
              </button>
            </div>

            {msg && <div className={`so-msg ${msg.isErr ? "err" : "ok"}`}>{msg.text}</div>}
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