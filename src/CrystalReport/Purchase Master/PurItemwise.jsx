// ─────────────────────────────────────────────────────────────────────────────
//  PurItemwise.jsx
//  React conversion of PurItemwise.js (jQuery) — "Purchase Item-Wise Report"
//  Uses API helpers from Common.jsx (CC.api / CC.mkUrl / CC.authHeaders etc.)
//  Styling/Layout: copied verbatim (per request) from PurOrderItemwise.jsx —
//  so-groupby-col (radio + always-mounted combo per field, in a two-column
//  grid) on the left, so-filters-col (dates, options, actions) on the right.
//  No inline color values, no new theme colors, no new classes beyond what
//  PurOrderItemwise already defines.
//
//  NOTE: this legacy screen has SEVEN mutually-exclusive "group by" radios,
//  each paired with its own combo box that is only enabled while its radio
//  is checked. Selecting a group does NOT force a value in its combo — the
//  legacy code only errors if a combo has an item picked whose value/label
//  turns out to be null, never for leaving it blank. That optionality is
//  preserved exactly. The Description/Code combos are unusual in that they
//  read `item.label` (not `item.value`) into GroupByText — also preserved.
//
//  DESIGN-MATCH ASSUMPTION: PurOrderItemwise's radio group has no "click
//  again to turn off" behavior (plain mutually-exclusive radios, always one
//  active once any is picked). To match that design exactly, the previous
//  toggle-off-by-reclicking behavior has been dropped here — clicking a
//  radio now just switches the active group, same as PurOrderItemwise.
//  Switching groups clears every group's stored combo selection, mirroring
//  PurOrderItemwise's handleGroupByChange.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Save, XCircle } from "lucide-react";
import * as CC from "../../components/Common";
import Topbar from "../../components/Topbar";

const BASE_URL = "http://localhost:64215";

// API endpoint used by this screen (kept exactly as the legacy jQuery file had it —
// MVC action route, not the /api/... convention used by newer report screens;
// confirm with the backend whether it should be migrated).
const PurchaseItemWiseReportUrl = "/api/PurchaseReportApp/PurchaseItemWiseReport";

// The legacy file populates each combo via shared helpers (loadbrandcombo,
// loadcategorycombo, loaddepartmentcombo, loadsuppliercombo, loaduomcombo,
// loadproductcombo) defined outside PurItemwise.js itself (not present in
// the source file we converted). These endpoints are our best-effort match
// to those helpers' data sources, following the same /api/...App/... naming
// convention used elsewhere in this app — please confirm with the backend.
const BrandListUrl = "/api/BrandApp/SelectBrand";
const CategoryListUrl = "/api/CategoryApp/SelectCategory";
const DepartmentListUrl = "/api/DepartmentApp/SelectDepartment";
const SupplierListUrl = "/api/SupplierApp/GetSupplier";
const UOMListUrl = "/api/UOMApp/SelectUOM";
// loadproductcombo("#cmbdescription", "#cmbcode") fills both the Description
// and Code combos from the same product master — one endpoint, two views.
const ProductListUrl = "/api/ItemMasterApp/GetProductList";

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

// Static config for the 7 group-by fields. `valueField` tells handleView
// whether GroupByText should read the item's `value` or `label` — the
// legacy code uses `.value` for Brand/Category/Department/Supplier/UOM and
// `.label` for Description/Code.
const GROUPS = [
  { key: "Brand", title: "Brand", placeholder: "Type to search brand…", errMsg: "Please Select Valid Brand Name !!!.", valueField: "value" },
  { key: "Category", title: "Category", placeholder: "Type to search category…", errMsg: "Please Select Valid Category Name !!!.", valueField: "value" },
  { key: "Department", title: "Department", placeholder: "Type to search department…", errMsg: "Please Select Valid Department Name !!!.", valueField: "value" },
  { key: "Supplier", title: "Supplier", placeholder: "Type to search supplier…", errMsg: "Please Select Valid Supplier Name !!!.", valueField: "value" },
  { key: "UOM", title: "UOM", placeholder: "Type to search UOM…", errMsg: "Please Select Valid UOM Name !!!.", valueField: "value" },
  { key: "Description", title: "Description", placeholder: "Type to search item name…", errMsg: "Please Select Valid Item Name !!!.", valueField: "label" },
  { key: "Code", title: "Code", placeholder: "Type to search item code…", errMsg: "Please Select Valid Item Code !!!.", valueField: "label" },
];

// ── Reusable searchable combobox, matching PurOrderItemwise's ComboField
// markup/CSS exactly (so-combo / so-combo-list / so-combo-item classes),
// parameterized so it can be reused for all seven group-by fields without
// duplicating the dropdown markup seven times.
function ComboField({ id, list, selected, onSelect, disabled, placeholder }) {
  const [search, setSearch] = useState(selected?.label ?? "");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    setSearch(selected?.label ?? "");
  }, [selected]);

  useEffect(() => {
    const onDocMouseDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  const filtered = useMemo(() => {
    const q = (search || "").trim().toLowerCase();
    if (!q) return list || [];
    return (list || []).filter((o) => String(o.label ?? "").toLowerCase().includes(q));
  }, [list, search]);

  return (
    <div className="so-combo" ref={wrapRef}>
      <input
        id={id}
        type="text"
        className="so-input"
        autoComplete="off"
        disabled={disabled}
        placeholder={placeholder}
        value={search}
        onFocus={() => { if (!disabled) setOpen(true); }}
        onChange={(e) => {
          setSearch(e.target.value);
          setOpen(true);
          if (selected) onSelect(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
          } else if (e.key === "Enter" && filtered.length === 1) {
            e.preventDefault();
            const only = filtered[0];
            onSelect({ label: only.label, value: only.value });
            setOpen(false);
          }
        }}
      />
      {open && !disabled && (
        <ul className="so-combo-list">
          {filtered.length === 0 ? (
            <li className="so-combo-empty">No matches</li>
          ) : (
            filtered.map((o, idx) => (
              <li
                key={o.value ?? `opt-${idx}`}
                className="so-combo-item"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect({ label: o.label, value: o.value });
                  setOpen(false);
                }}
              >
                {o.label}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

export default function PurItemwise() {
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
    CommonCompany: "",
    CName: "",
    CAddress: "",
    CPhone: "",
  });

  // Hardcoded in the legacy file (`var RiceUOMSetting = "0";`) and never
  // reassigned — carried over as-is rather than invented/derived.
  const RiceUOMSetting = "0";

  // ── Form state (controlled inputs replacing jqx widgets) ───────────────
  const [fromDate, setFromDate] = useState(todayStr());
  const [toDate, setToDate] = useState(todayStr());

  // Which of the 7 group-by radios is on ("" = none, matches legacy default
  // of no radio pre-checked on load).
  const [selectedGroup, setSelectedGroup] = useState("");

  // One combo selection slot per group — mirrors PurOrderItemwise's
  // selectedBrand/selectedCategory/... state, just kept in one object here
  // since this screen already had a GROUPS config to drive off of.
  const [groupSelections, setGroupSelections] = useState({
    Brand: null, Category: null, Department: null, Supplier: null,
    UOM: null, Description: null, Code: null,
  });
  const setGroupSelection = useCallback((key, value) => {
    setGroupSelections((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Source lists for each combo, loaded once page access is granted.
  const [lists, setLists] = useState({
    Brand: [], Category: [], Department: [], Supplier: [],
    UOM: [], Description: [], Code: [],
  });

  // Daily / MRP checkboxes (#chkdaily / #chkmrp).
  const [dailyChecked, setDailyChecked] = useState(false);
  const [mrpChecked, setMrpChecked] = useState(false);

  // ── UI feedback state ───────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null); // { text, isErr }

  useEffect(() => {
    const menulist = CC.getLocal("menulist");
    if (menulist == null) {
      setMsg({ text: "Session Close Please Login !!!.", isErr: true });
      navigate("/Login/Index");
      return;
    }

    const menudata = menulist.filter((obj) => obj.PageName === "Purchase Itemwise");
    if (!menudata || menudata.length === 0) {
      setMsg({ text: "Page Access Permission Denied !!!.", isErr: true });
      setTimeout(() => navigate("/Login/Home"), 3000);
      return;
    }

    if (menudata[0].View === 0) {
      setMsg({ text: "Page Access Permission Denied !!!.", isErr: true });
      setTimeout(() => navigate("/Login/Home"), 3000);
      return;
    }

    const Comid = CC.getStr("Comid");
    const MComid = CC.getStr("MComid");
    const CommonCompany = CC.getStr("CommonCompany");
    const ComSet = CC.getLocal("Companysetting") || [{}];

    setSession({
      Comid,
      MComid,
      CommonCompany,
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

  // Normalizes whatever shape the backend actually sends into the
  // { label, value } shape every combo in this screen uses.
  const normalize = (rawList, labelKeys, valueKeys) =>
    (Array.isArray(rawList) ? rawList : []).map((item) => {
      let label = "";
      for (const k of labelKeys) { if (item[k] != null) { label = item[k]; break; } }
      let value = "";
      for (const k of valueKeys) { if (item[k] != null) { value = item[k]; break; } }
      return { label, value };
    });

  // Loads all 7 combo sources once page access is granted — replaces the
  // legacy methods.load() calls to loadbrandcombo / loadcategorycombo /
  // loaddepartmentcombo / loadsuppliercombo / loaduomcombo / loadproductcombo.
  useEffect(() => {
    if (!pageAccess.ready || !pageAccess.allowed) return;
    if (!session.Comid) return;

    let cancelled = false;
    (async () => {
        const fetchList = async (url) => {
            try {
              // AccountType தேவைப்பட்டால் மட்டும் அனுப்பவும், இல்லையெனில் நீக்கவும்
              const params = { Comid: session.Comid };
              
              // Supplier-க்கு மட்டும் தேவை என்றால் மட்டும் இதை சேர்க்கவும்
              if (url.includes("SupplierApp")) {
                 params.AccountType = "SUPPLIER";
              }
          
              const res = await CC.api(url, null, {}, params);
              if (res?.IsSuccess === false) return [];
              return res?.Data || res?.data || res?.Data1 || [];
            } catch {
              return [];
            }
          };
          const [brandRaw, categoryRaw, departmentRaw, supplierRaw, uomRaw] = await Promise.all([
            fetchList(BrandListUrl),
            fetchList(CategoryListUrl),
            fetchList(DepartmentListUrl),
            fetchList(SupplierListUrl),
            fetchList(UOMListUrl), // இங்கே UomListUrl என்பதற்கு பதிலாக UOMListUrl என மாற்றவும்
          ]);

      // Product list: fetched and normalized exactly as PurOrderItemwise.jsx
      // does it (direct CC.api call, same Data/data/Data1 fallback, same
      // field-fallback order for description/code/value) rather than through
      // the generic fetchList helper used by the other combos above.
      let productRaw = [];
      try {
        const res = await CC.api(ProductListUrl, null, {}, { Comid: session.Comid,AccountType: "SUPPLIER", });
        productRaw = res?.Data || res?.data || res?.Data1 || [];
      } catch (err) {
        if (!cancelled) setMsg({ text: err.message || "Unable to load product list.", isErr: true });
      }
      

      if (cancelled) return;

      const normalizedProduct = (Array.isArray(productRaw) ? productRaw : []).map((p) => ({
        description:
          p.ProductName ??
          p.PrintName ??
          p.ProductDescription ??
          p.Description ??
          p.Cat_Name ??
          p.Name ??
          p.Text ??
          "",
        code:
          p.Productcode ??      // small c, matches PurOrderItemwise.jsx
          p.ProductCode ??
          p.ItemCode ??
          p.Code ??
          "",
        value:
          p.Id ??
          p.ProductId ??
          "",
      }));
      
      setLists({
        Brand: normalize(brandRaw, ["BrandName", "label", "Label", "Name", "Text"], ["value", "Value", "BrandId", "Id"]),
        Category: normalize(categoryRaw, ["CategoryName", "Cat_Name" ,"label", "Label", "Name", "Text"], ["value", "Value", "CategoryId", "Id"]),
        Department: normalize(departmentRaw, ["DepartmentName", "label", "Label", "Name", "Text"], ["value", "Value", "DepartmentId", "Id"]),
        Supplier: normalize(supplierRaw, ["SupplierName","AccountName", "label", "Label", "Name", "Text"], ["value", "Value", "SupplierId", "Id"]),
        UOM: normalize(uomRaw, ["UOMName", "UomName", "label", "Label", "Name", "Text"], ["value", "Value", "UOMId", "UomId", "Id"]),
        // Description combo shows the product name; Code combo shows the
        // product code — both derived from the same normalized product list.
        Description: normalizedProduct.map((p) => ({ label: p.description, value: p.value })),
        Code: normalizedProduct.map((p) => ({ label: p.code, value: p.value })),
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [pageAccess.ready, pageAccess.allowed, session.Comid]);

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

  // Replaces the old toggle-button click handler. Matches PurOrderItemwise's
  // handleGroupByChange: switching the active group clears every group's
  // stored combo selection in one step.
  const handleGroupByChange = useCallback((key) => {
    setSelectedGroup(key);
    setGroupSelections({
      Brand: null, Category: null, Department: null, Supplier: null,
      UOM: null, Description: null, Code: null,
    });
  }, []);

  // Matches the legacy #btnrefresh handler: clears every combo selection,
  // turns off all 7 group-by radios, unchecks Daily / MRP. Dates are left
  // untouched, same as the legacy code (it only re-initialises the
  // date-picker widgets with the same format string, never assigns a new
  // date).
  const handleRefresh = useCallback(() => {
    setGroupSelections({
      Brand: null, Category: null, Department: null, Supplier: null,
      UOM: null, Description: null, Code: null,
    });
    setSelectedGroup("");
    setDailyChecked(false);
    setMrpChecked(false);
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
      w.addEventListener("load", () => { w.document.title = "Purchase Itemwise-Report"; }, false);
    }
  }, []);

  // Mirrors methods.Clear() — called after the report request completes
  // (success or not), clearing all 7 combo selections but leaving the group
  // radio, dates, and checkboxes untouched.
  const clearAllSelections = useCallback(() => {
    setGroupSelections({
      Brand: null, Category: null, Department: null, Supplier: null,
      UOM: null, Description: null, Code: null,
    });
  }, []);

  const handleView = useCallback(async () => {
    let GroupBy = "";
    let GroupByText = "";

    if (selectedGroup) {
      const config = GROUPS.find((g) => g.key === selectedGroup);
      GroupBy = selectedGroup;
      const item = groupSelections[selectedGroup];
      if (item) {
        GroupByText = item[config.valueField];
        if (GroupByText == null || GroupByText === "") {
          setMsg({ text: config.errMsg, isErr: true });
          setGroupSelection(selectedGroup, null);
          return;
        }
      }
      // If no item was picked under the selected group, GroupByText simply
      // stays "" — the legacy code only validates when an item IS selected.
    }

    const Fromdate = toMMDDYYYY(fromDate);
    const Todate = toMMDDYYYY(toDate);

    if (new Date(Fromdate) > new Date(Todate)) {
      setMsg({ text: "From Date Is Greater Than To Date!!", isErr: true });
      return;
    }

    // mrp defaults to "Pur.Rate"; checking the MRP box switches it to "".
    const mrp = mrpChecked ? "" : "Pur.Rate";
    const daily = dailyChecked ? "YES" : "";

    setLoading(true);
    setMsg(null);

    try {
      const res = await CC.api(PurchaseItemWiseReportUrl, null, {React:1}, {
        Daily: daily,
        MRP: mrp,
        GroupBy,
        GroupByText,
        Fromdate,
        Todate,
        Comid: session.Comid,
        MComid: session.MComid,
      });

      if (res?.ok === true) {
        const cacheKey =
        res.data15 ??
        res.Data15 ??
        res.data?.Data15 ??
        "";
        openReportViewer({
          ReportName: "PurchaseItemWise",
          CacheKey: cacheKey,
          RiceUOMSetting,
          GroupBy,
          Fromdate,
          Todate,
          Daily: daily,
          MRP: mrp,
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
      // Legacy calls methods.Clear() unconditionally right after the
      // (synchronous, async:false) $.ajax call returns, win or lose.
      clearAllSelections();
    }
  }, [fromDate, toDate, selectedGroup, groupSelections, dailyChecked, mrpChecked, session, openReportViewer, clearAllSelections, setGroupSelection]);

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
    .so-card { width: 100%; max-width: 900px; background: #fff; border: 2px solid #1a56db; border-radius: 10px; box-shadow: 0 4px 16px rgba(26,86,219,.18); overflow: hidden; }

    .so-card-header { background: linear-gradient(135deg, #3b6fe0, #1a4fd1); border-bottom: 1px solid #1a4fd1; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; }
    .so-card-header-title { font-size: 14px; font-weight: 700; color: #fff; letter-spacing: .2px; }
    .so-close-x { background: rgba(255,255,255,.15); border: none; font-size: 14px; color: #fff; cursor: pointer; line-height: 1; padding: 6px 8px; border-radius: 6px; transition: background .15s; }
    .so-close-x:hover { background: rgba(255,255,255,.28); }

    .so-card-body { padding: 24px 32px 30px; }
    .so-report-title { text-align: center; font-size: 22px; font-weight: 800; color: #1a3fd6; margin: 0 0 26px; }

    .so-content { display: flex; gap: 40px; align-items: flex-start; flex-wrap: wrap; }
    .so-groupby-col { flex: 1.4; min-width: 340px; }
    .so-filters-col { flex: 1; min-width: 260px; padding-left: 32px; border-left: 1px solid #ececec; display: flex; flex-direction: column; }
    .so-col-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; color: #8492a6; margin-bottom: 16px; }

    .so-groupby-grid { display: grid; grid-template-columns: 128px 1fr; gap: 14px 16px; align-items: center; }
    .so-filters-grid { display: grid; grid-template-columns: 96px 1fr; gap: 14px 16px; align-items: center; }

    .so-label { font-size: 13px; font-weight: 600; color: #1e293b; }
    .so-input { height: 34px; border: 1px solid #c7cdd6; border-radius: 4px; padding: 0 10px; font-size: 13px; color: #1e2d3d; background: #fff; width: 100%; box-sizing: border-box; transition: border-color .15s, box-shadow .15s; outline: none; }
    .so-input:focus { border-color: #1a56db; box-shadow: 0 0 0 3px rgba(26,86,219,.15); }
    .so-input:disabled { background: #f5f6f8; color: #a0aab5; cursor: not-allowed; }
    select.so-input { appearance: auto; cursor: pointer; }

    .so-combo { position: relative; }
    .so-combo-list { position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 20; margin: 0; padding: 4px; list-style: none; max-height: 200px; overflow-y: auto; background: #fff; border: 1px solid #c7cdd6; border-radius: 4px; box-shadow: 0 6px 20px rgba(0,0,0,.12); }
    .so-combo-item { padding: 7px 10px; font-size: 13px; color: #1e2d3d; border-radius: 4px; cursor: pointer; }
    .so-combo-item:hover { background: #eef3ff; }
    .so-combo-empty { padding: 7px 10px; font-size: 13px; color: #4a5568; }

    .so-radio-row { display: flex; align-items: center; gap: 8px; cursor: pointer; user-select: none; }
    .so-radio-row input[type="radio"] { width: 16px; height: 16px; accent-color: #1a56db; cursor: pointer; flex-shrink: 0; }
    .so-radio-row span { font-size: 13px; font-weight: 500; color: #2b2b2b; }

    .so-toggle-row { display: flex; align-items: center; gap: 8px; cursor: pointer; user-select: none; }
    .so-toggle-row input[type="checkbox"] { width: 16px; height: 16px; accent-color: #1a56db; cursor: pointer; flex-shrink: 0; }
    .so-toggle-row span { font-size: 13px; color: #1e2d3d; }

    .so-actions { display: flex; gap: 12px; margin-top: 32px; padding-top: 22px; border-top: 1px solid #e8ecf0; }
    .so-btn { height: 38px; padding: 0 30px; border-radius: 6px; border: 1px solid #1a56db; font-size: 14px; font-weight: 700; cursor: pointer; transition: opacity .15s, box-shadow .15s, background .15s; display: flex; align-items: center; gap: 8px; background: #fff; color: #1a56db; }
    .so-btn:disabled { opacity: .5; cursor: not-allowed; }
    .so-btn:not(:disabled):hover { background: #eef3ff; }
    .so-btn-primary { border-color: #1e7e34; color: #1e7e34; }
    .so-btn-primary .so-icon-save { color: #1e7e34; }
    .so-btn-secondary { border-color: #dc3545; color: #dc3545; }
    .so-btn-secondary .so-icon-cancel { color: #dc3545; }

    .so-msg { margin-top: 18px; padding: 10px 14px; border-radius: 8px; font-size: 13px; font-weight: 500; }
    .so-msg.err { background: #fff0f0; color: #c53030; border: 1px solid #fed7d7; }
    .so-msg.ok  { background: #f0fff4; color: #276749; border: 1px solid #c6f6d5; }

    @media (max-width: 900px) {
      .so-content { flex-direction: column; }
      .so-filters-col { padding-left: 0; border-left: none; border-top: 1px solid #ececec; padding-top: 22px; margin-top: 4px; }
    }
    @media (max-width: 620px) {
      .so-card-body { padding: 20px; }
      .so-groupby-grid { grid-template-columns: 100px 1fr; }
      .so-filters-grid { grid-template-columns: 90px 1fr; }
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
              <div className="so-card-header-title">Purchase Itemwise</div>
              <button type="button" className="so-close-x" aria-label="Close" onClick={() => navigate(-1)}>✕</button>
            </div>

            <div className="so-card-body">
              <div className="so-report-title">Purchase Item-Wise - Report</div>

              <div className="so-content">
                <section className="so-groupby-col">
                  <div className="so-col-title">Group By</div>
                  <div className="so-groupby-grid">
                    {GROUPS.map((group) => (
                      <React.Fragment key={group.key}>
                        <label className="so-radio-row" htmlFor={`pi-rbt-${group.key.toLowerCase()}`}>
                          <input
                            id={`pi-rbt-${group.key.toLowerCase()}`}
                            type="radio"
                            name="pi-groupby"
                            checked={selectedGroup === group.key}
                            onChange={() => handleGroupByChange(group.key)}
                          />
                          <span>{group.title}</span>
                        </label>
                        <ComboField
                          id={`pi-cmb-${group.key.toLowerCase()}`}
                          list={lists[group.key]}
                          selected={groupSelections[group.key]}
                          onSelect={(item) => setGroupSelection(group.key, item)}
                          disabled={selectedGroup !== group.key}
                          placeholder={group.placeholder}
                        />
                      </React.Fragment>
                    ))}
                  </div>
                </section>

                <section className="so-filters-col">
                  <div className="so-col-title">Filters</div>
                  <div className="so-filters-grid">
                    <label className="so-label" htmlFor="pi-from-date">From Date</label>
                    <input id="pi-from-date" type="date" className="so-input" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />

                    <label className="so-label" htmlFor="pi-to-date">To Date</label>
                    <input id="pi-to-date" type="date" className="so-input" value={toDate} onChange={(e) => setToDate(e.target.value)} />

                    <span className="so-label">Daily</span>
                    <label className="so-toggle-row" htmlFor="pi-chk-daily">
                      <input id="pi-chk-daily" type="checkbox" checked={dailyChecked} onChange={(e) => setDailyChecked(e.target.checked)} />
                      <span>Daily report</span>
                    </label>

                    <span className="so-label">MRP</span>
                    <label className="so-toggle-row" htmlFor="pi-chk-mrp">
                      <input id="pi-chk-mrp" type="checkbox" checked={mrpChecked} onChange={(e) => setMrpChecked(e.target.checked)} />
                      <span>Use MRP (unchecked uses Pur. Rate)</span>
                    </label>
                  </div>

                  <div className="so-actions">
                    <button type="button" className="so-btn so-btn-primary" disabled={loading || pageAccess.pageview === 0} onClick={handleView}>
                      <Save size={16} className="so-icon-save" />
                      {loading ? "Loading…" : "View"}
                    </button>
                    <button type="button" className="so-btn so-btn-secondary" onClick={handleRefresh} disabled={loading}>
                      <XCircle size={16} className="so-icon-cancel" />
                      Refresh
                    </button>
                  </div>

                  {msg && <div className={`so-msg ${msg.isErr ? "err" : "ok"}`}>{msg.text}</div>}
                </section>
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