// ─────────────────────────────────────────────────────────────────────────────
//  PurOrderItemwise.jsx
//  React conversion of PurOrderItemwise.js (jQuery) —
//  "Purchase Order Itemwise Report"
//  Uses API helpers from Common.jsx (CC.api / CC.mkUrl / CC.authHeaders etc.)
//  Styling: MasterPage.css only — no inline color values, no new theme colors.
//  Structure/CSS copied verbatim from BankBook.jsx (per request), extended
//  only with a radio-group + 7 comboboxes + 2 checkboxes to match this
//  legacy source's richer filter form. The so-radio-group / so-toggle-row
//  additions reuse BankBook's existing color tokens, spacing, and font
//  sizes rather than inventing a new visual language.
//
//  NOTE: unlike SaleOrder/BankVoucher/CashVoucher, this legacy screen has no
//  report-type radio buttons for the *report itself* — it's a single
//  "Purchase Order Itemwise" report, so the left nav-card report-type
//  picker is omitted (not invented). The radio buttons that DO exist here
//  are a "Group By" field selector (Brand/Category/Department/Supplier/
//  UOM/Description/Code), which is a different concept.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Save, XCircle } from "lucide-react";
import * as CC from "../../components/Common";
import Topbar from "../../components/Topbar";

const BASE_URL = "http://localhost:64215";

// API endpoint used by this screen (kept exactly as the legacy jQuery file
// had it — MVC action route, POST with a hand-built JSON body, response
// shape is `{ ok: true/false }`, not the newer IsSuccess/Data15 cache-key
// convention used by some other report screens; confirm with the backend
// whether it should be migrated).
const PurchaseOrderItemWiseReportUrl = "/api/PurchaseReportApp/PurchaseOrderItemWiseReport";

// The legacy file loads each combo via shared helpers (loadbrandcombo,
// loadcategorycombo, loaddepartmentcombo, loadsuppliercombo, loaduomcombo,
// loadproductcombo) defined outside this file (not present in the source we
// converted). These endpoints are our best-effort match to those helpers'
// data sources, following the same /api/<Module>App/... convention used
// elsewhere — please confirm all six with the backend.
const BrandListUrl = "/api/BrandApp/SelectBrand";
const CategoryListUrl = "/api/CategoryApp/SelectCategory";
const DepartmentListUrl = "/api/DepartmentApp/SelectDepartment";
const SupplierListUrl = "/api/SupplierApp/GetSupplier";
const UOMListUrl = "/api/UOMApp/SelectUOM";
// loadproductcombo("#cmbdescription", "#cmbcode") populates BOTH the
// description and code comboboxes from one shared product list — modeled
// here as a single fetch whose results are projected into two label views.
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

// Generic { label, value } normalizer for the simple combo endpoints
// (Brand/Category/Department/Supplier/UOM), trying a handful of plausible
// backend field-name candidates.
function normalizeOptions(rawList, labelKeys, valueKeys) {
  return (Array.isArray(rawList) ? rawList : []).map((o) => {
    let label = "";
    for (const k of labelKeys) { if (o[k] != null) { label = o[k]; break; } }
    let value = "";
    for (const k of valueKeys) { if (o[k] != null) { value = o[k]; break; } }
    return { label, value };
  });
}

// ── Reusable searchable combobox, matching BankBook's #cmbbank markup/CSS ──
// exactly (so-combo / so-combo-list / so-combo-item classes), parameterized
// so it can be reused for all seven group-by fields without duplicating the
// dropdown markup seven times.
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
    if (!q) return list;
    return list.filter((o) => String(o.label ?? "").toLowerCase().includes(q));
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

export default function PurOrderItemwise() {
  const navigate = useNavigate();

  // ── Session / permission state ─────────────────────────────────────────
  const [pageAccess, setPageAccess] = useState({
    ready: false,
    allowed: false,
    pageview: 0,
  });

  // ── Company / settings state (loaded once from localStorage, same as jQuery) ──
  // NOTE: the legacy source references MComid/CName/CAddress/CPhone globals
  // (the ajax body sends MComid, the report-viewer URL sends CName/CAddress/
  // CPhone) but never declares any of them locally — they must come from a
  // shared page-level source, same as PurchaseOrderDetail.jsx / BankBook.jsx.
  const [session, setSession] = useState({
    Comid: "",
    MComid: "",
    CName: "",
    CAddress: "",
    CPhone: "",
  });

  // Fixed literal from the legacy source — not derived from any UI control.
  const RiceUOMSetting = "0";

  // ── Form state: date range ──────────────────────────────────────────────
  const [fromDate, setFromDate] = useState(todayStr());
  const [toDate, setToDate] = useState(todayStr());

  // ── Form state: "Group By" field selector (rbtbrand..rbtcode) ──────────
  // Replaces the seven independent jqxRadioButton widgets with a single
  // mutually-exclusive selection, matching the intent of the legacy click
  // handlers (each one enables its own combo and disables the other six).
  const [groupByField, setGroupByField] = useState(null); // "Brand" | "Category" | ... | null

  // ── Form state: the seven group-by comboboxes ───────────────────────────
  const [brandList, setBrandList] = useState([]);
  const [selectedBrand, setSelectedBrand] = useState(null);
  const [categoryList, setCategoryList] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [departmentList, setDepartmentList] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [supplierList, setSupplierList] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [uomList, setUomList] = useState([]);
  const [selectedUOM, setSelectedUOM] = useState(null);
  // Description and Code combos both derive from the same product list.
  const [productList, setProductList] = useState([]); // [{ label(desc), value, code }]
  const [selectedDescription, setSelectedDescription] = useState(null);
  const [selectedCode, setSelectedCode] = useState(null);

  const descriptionOptions = useMemo(
    () => productList.map((p) => ({ label: p.description, value: p.value })),
    [productList]
  );
  const codeOptions = useMemo(
    () => productList.map((p) => ({ label: p.code, value: p.value })),
    [productList]
  );

  // ── Form state: Daily / MRP checkboxes ──────────────────────────────────
  const [dailyChecked, setDailyChecked] = useState(false);
  const [mrpChecked, setMrpChecked] = useState(false);

  // ── UI feedback state ────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null); // { text, isErr }

  // ── Bootstrap: session / permission check ───────────────────────────────
  // Single check, PageName "Purchase Order Itemwise" — matches the legacy
  // source exactly (no duplicate lookup here, unlike
  // PurchaseOrderConsolidated.js).
  useEffect(() => {
    const menulist = CC.getLocal("menulist");
    if (menulist == null) {
      setMsg({ text: "Session Close Please Login !!!.", isErr: true });
      navigate("/Login/Index");
      return;
    }

    const menudata = menulist.filter((obj) => obj.PageName === "Purchase Order Itemwise");
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

  // ── Load all seven combo sources once page access is granted ───────────
  // Replaces methods.load()'s loadbrandcombo/loadcategorycombo/
  // loaddepartmentcombo/loadsuppliercombo/loaduomcombo/loadproductcombo calls.
  useEffect(() => {
    if (!pageAccess.ready || !pageAccess.allowed || !session.Comid) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await CC.api(BrandListUrl, null, {}, { Comid: session.Comid });
        const raw = res?.Data || res?.data || res?.Data1 || [];
        if (!cancelled) {
          setBrandList(normalizeOptions(raw,
            ["label", "Label", "BrandName", "Brandname", "Name", "Text"],
            ["value", "Value", "BrandId", "Brandid", "Id", "BrandCode"]));
        }
      } catch (err) {
        if (!cancelled) setMsg({ text: err.message || "Unable to load brand list.", isErr: true });
      }
    })();

    return () => { cancelled = true; };
  }, [pageAccess.ready, pageAccess.allowed, session.Comid]);

  useEffect(() => {
    if (!pageAccess.ready || !pageAccess.allowed || !session.Comid) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await CC.api(CategoryListUrl, null, {}, { Comid: session.Comid });
        const raw = res?.Data || res?.data || res?.Data1 || [];
        console.log(raw);
        if (!cancelled) {
          setCategoryList(normalizeOptions(raw,
            ["label", "Label", "CategoryName", "Categoryname","Cat_Name",  "Name", "Text"],
            ["value", "Value", "CategoryId", "Categoryid", "Id", "CategoryCode"]));
        }
      } catch (err) {
        if (!cancelled) setMsg({ text: err.message || "Unable to load category list.", isErr: true });
      }
    })();

    return () => { cancelled = true; };
  }, [pageAccess.ready, pageAccess.allowed, session.Comid]);

  useEffect(() => {
    if (!pageAccess.ready || !pageAccess.allowed || !session.Comid) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await CC.api(DepartmentListUrl, null, {}, { Comid: session.Comid });
        const raw = res?.Data || res?.data || res?.Data1 || [];
        if (!cancelled) {
          setDepartmentList(normalizeOptions(raw,
            ["label", "Label", "DepartmentName", "Departmentname", "Name", "Text"],
            ["value", "Value", "DepartmentId", "Departmentid", "Id", "DepartmentCode"]));
        }
      } catch (err) {
        if (!cancelled) setMsg({ text: err.message || "Unable to load department list.", isErr: true });
      }
    })();

    return () => { cancelled = true; };
  }, [pageAccess.ready, pageAccess.allowed, session.Comid]);

  useEffect(() => {
    if (!pageAccess.ready || !pageAccess.allowed || !session.Comid) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await CC.api(SupplierListUrl, null, {}, {  Comid: session.Comid,
          AccountType: "SUPPLIER", });
        const raw = res?.Data || res?.data || res?.Data1 || [];
       
        if (!cancelled) {
          setSupplierList(normalizeOptions(raw,
            ["label", "Label", "SupplierName","AccountName", "Suppliername", "Name", "Text"],
            ["value", "Value", "SupplierId", "Supplierid", "Id", "SupplierCode"]));
        }
      } catch (err) {
        if (!cancelled) setMsg({ text: err.message || "Unable to load supplier list.", isErr: true });
      }
    })();

    return () => { cancelled = true; };
  }, [pageAccess.ready, pageAccess.allowed, session.Comid]);

  useEffect(() => {
    if (!pageAccess.ready || !pageAccess.allowed || !session.Comid) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await CC.api(UOMListUrl, null, {}, { Comid: session.Comid });
        const raw = res?.Data || res?.data || res?.Data1 || [];
        if (!cancelled) {
          setUomList(normalizeOptions(raw,
            ["label", "Label", "UOMName", "Uomname", "Name", "Text"],
            ["value", "Value", "UOMId", "Uomid", "Id", "UOMCode"]));
        }
      } catch (err) {
        if (!cancelled) setMsg({ text: err.message || "Unable to load UOM list.", isErr: true });
      }
    })();

    return () => { cancelled = true; };
  }, [pageAccess.ready, pageAccess.allowed, session.Comid]);

  useEffect(() => {
    if (!pageAccess.ready || !pageAccess.allowed || !session.Comid) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await CC.api(ProductListUrl, null, {}, { Comid: session.Comid });
        const raw = res?.Data || res?.data || res?.Data1 || [];
        console.log(raw);
        if (!cancelled) {
          const normalized = (Array.isArray(raw) ? raw : []).map((p) => ({
            description:
              p.ProductName ??
              p.PrintName ??
              p.ProductDescription ??
              p.Description ??
              p.Name ??
              p.Text ??
              "",
          
            code:
              p.Productcode ??      // ✅ small c
              p.ProductCode ??
              p.ItemCode ??
              p.Code ??
              "",
          
            value:
              p.Id ??
              p.ProductId ??
              "",
          }));
          
          setProductList(normalized);
        }
      } catch (err) {
        if (!cancelled) setMsg({ text: err.message || "Unable to load product list.", isErr: true });
      }
    })();

    return () => { cancelled = true; };
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

  // Replaces the seven rbtX 'click' handlers (enable own combo, disable the
  // rest) plus the paired 'change' handlers (clear the combo of whichever
  // radio just became unchecked). Since only one field can be active at a
  // time, switching clears every other field's selection in one step —
  // equivalent to the legacy per-radio reset, given only the previously
  // active combo could have held a selection.
  const handleGroupByChange = useCallback((field) => {
    setGroupByField(field);
    setSelectedBrand(null);
    setSelectedCategory(null);
    setSelectedDepartment(null);
    setSelectedSupplier(null);
    setSelectedUOM(null);
    setSelectedDescription(null);
    setSelectedCode(null);
  }, []);

  // Matches the legacy #btnrefresh handler: clears all seven combo
  // selections, unchecks all seven radios (groupByField -> null), and
  // unchecks both Daily and MRP checkboxes. Date pickers were merely
  // re-initialised with the same format string in the legacy code, not
  // reset to a new value, so fromDate/toDate are left untouched here.
  const handleRefresh = useCallback(() => {
    setGroupByField(null);
    setSelectedBrand(null);
    setSelectedCategory(null);
    setSelectedDepartment(null);
    setSelectedSupplier(null);
    setSelectedUOM(null);
    setSelectedDescription(null);
    setSelectedCode(null);
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
      w.addEventListener("load", () => { w.document.title = "Purchase Order Itemwise-Report"; }, false);
    }
  }, []);

  const handleView = useCallback(async () => {
    let GroupBy = "";
    let GroupByText = "";

    // Mirrors the legacy sequential if-blocks (one per radio) exactly,
    // including per-field validation messages. Because groupByField can
    // only ever hold one value at a time, this behaves the same as the
    // legacy's independent-but-mutually-exclusive-in-practice checks.
    if (groupByField === "Brand") {
      GroupBy = "Brand";
      if (selectedBrand) {
        GroupByText = selectedBrand.value;
        if (GroupByText == null) {
          setMsg({ text: "Please Select Valid Brand Name !!!.", isErr: true });
          setSelectedBrand(null);
          return;
        }
      }
    }
    if (groupByField === "Category") {
      GroupBy = "Category";
      if (selectedCategory) {
        GroupByText = selectedCategory.value;
        if (GroupByText == null) {
          setMsg({ text: "Please Select Valid Category Name !!!.", isErr: true });
          setSelectedCategory(null);
          return;
        }
      }
    }
    if (groupByField === "Department") {
      GroupBy = "Department";
      if (selectedDepartment) {
        GroupByText = selectedDepartment.value;
        if (GroupByText == null) {
          setMsg({ text: "Please Select Valid Department Name !!!.", isErr: true });
          setSelectedDepartment(null);
          return;
        }
      }
    }
    if (groupByField === "Supplier") {
      GroupBy = "Supplier";
      if (selectedSupplier) {
        GroupByText = selectedSupplier.value;
        if (GroupByText == null) {
          setMsg({ text: "Please Select Valid Supplier Name !!!.", isErr: true });
          setSelectedSupplier(null);
          return;
        }
      }
    }
    if (groupByField === "UOM") {
      GroupBy = "UOM";
      if (selectedUOM) {
        GroupByText = selectedUOM.value;
        if (GroupByText == null) {
          setMsg({ text: "Please Select Valid UOM Name !!!.", isErr: true });
          setSelectedUOM(null);
          return;
        }
      }
    }
    if (groupByField === "Description") {
      GroupBy = "Description";
      if (selectedDescription) {
        // NOTE: legacy source reads `item.lable` here (typo for `label`),
        // which is always undefined on a real jqxComboBox item — so this
        // branch ALWAYS falls into the "invalid" alert once something is
        // selected. Preserved exactly as a known source bug (not fixed to
        // `.label`) per the "100% of existing business logic" instruction;
        // flagging in case it was meant to be `label`.
        GroupByText = selectedDescription.lable;
        if (GroupByText == null) {
          setMsg({ text: "Please Select Valid Item Name !!!.", isErr: true });
          setSelectedDescription(null);
          return;
        }
      }
    }
    if (groupByField === "Code") {
      GroupBy = "Code";
      if (selectedCode) {
        // Same preserved `.lable` typo as the Description branch above —
        // this field always rejects a selection with "Please Select Valid
        // Item Code !!!." in the legacy source.
        GroupByText = selectedCode.lable;
        if (GroupByText == null) {
          setMsg({ text: "Please Select Valid Item Code !!!.", isErr: true });
          setSelectedCode(null);
          return;
        }
      }
    }

    const Fromdate = toMMDDYYYY(fromDate);
    const Todate = toMMDDYYYY(toDate);

    if (new Date(Fromdate) > new Date(Todate)) {
      setMsg({ text: "From Date Is Greater Than To Date!!", isErr: true });
      return;
    }

    // Inverted checkbox semantics preserved from the legacy source: MRP
    // checked -> mrp sent as "" (empty); unchecked -> mrp sent as "Pur.Rate".
    const mrp = mrpChecked ? "" : "Pur.Rate";
    const daily = dailyChecked ? "YES" : "";

    setLoading(true);
    setMsg(null);

    try {
      // Legacy hand-builds the JSON body and reads back `data.ok === true`
      // (not IsSuccess/Data15) — preserved exactly, no React:1 header.
      const res = await CC.api(PurchaseOrderItemWiseReportUrl, null, {React:1}, {
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
        // NOTE: legacy's live success handler builds the report-viewer URL
        // WITHOUT GroupByText — only GroupBy (the field name) is passed
        // through, not the selected value. A GroupByText-inclusive variant
        // exists in the source but only inside a commented-out dead
        // `window.open` call, so it's intentionally not resurrected here.
        
        const cacheKey =
        res.data15 ??
        res.Data15 ??
        res.data?.Data15 ??
        "";
        openReportViewer({

          ReportName: "PurchaseOrderItemWise",
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
      // Matches methods.Clear(): clears all seven combo selections only —
      // does not touch the radio (groupByField), the two checkboxes, or the
      // date range.
      setSelectedBrand(null);
      setSelectedCategory(null);
      setSelectedDepartment(null);
      setSelectedSupplier(null);
      setSelectedUOM(null);
      setSelectedDescription(null);
      setSelectedCode(null);
    }
  }, [
    groupByField, selectedBrand, selectedCategory, selectedDepartment,
    selectedSupplier, selectedUOM, selectedDescription, selectedCode,
    fromDate, toDate, mrpChecked, dailyChecked, session, openReportViewer,
  ]);

  // ── Design system: recolored/restructured to match BranchWise.jsx exactly ──
  //   Border / header / heading -> blue (#1a56db)
  //   Save-style accents        -> green (#1e7e34)
  //   Cancel / link accents     -> red   (#dc3545)
  const styles = `
    .so-shell { min-height: 100vh; background: #f0f2f5; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; flex-direction: column; }
    .so-topbar { background: linear-gradient(135deg, #3b6fe0, #1a4fd1); color: #fff; display: flex; align-items: center; justify-content: space-between; padding: 0 24px; height: 52px; box-shadow: 0 2px 8px rgba(0,0,0,.18); flex-shrink: 0; }
    .so-topbar-title { font-size: 15px; font-weight: 600; letter-spacing: .3px; }
    .so-close-btn { background: rgba(255,255,255,.15); border: none; color: #fff; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; transition: background .15s; }
    .so-close-btn:hover { background: rgba(255,255,255,.28); }

    .so-layout { flex: 1; display: flex; align-items: flex-start; justify-content: center; padding: 24px; box-sizing: border-box; }
    .so-card { width: 100%; max-width: 920px; background: #fff; border: 2px solid #1a56db; border-radius: 10px; box-shadow: 0 4px 16px rgba(26,86,219,.18); overflow: hidden; }

    .so-card-header { background: linear-gradient(135deg, #3b6fe0, #1a4fd1); border-bottom: 1px solid #1a4fd1; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; }
    .so-card-header-title { font-size: 14px; font-weight: 700; color: #fff; letter-spacing: .2px; }
    .so-close-x { background: rgba(255,255,255,.15); border: none; font-size: 14px; color: #fff; cursor: pointer; line-height: 1; padding: 6px 8px; border-radius: 6px; transition: background .15s; }
    .so-close-x:hover { background: rgba(255,255,255,.28); }

    .so-card-body { padding: 24px 32px 30px; }
    .so-report-title { text-align: center; font-size: 22px; font-weight: 800; color: #1a3fd6; margin: 0 0 26px; }

    .so-content { display: flex; gap: 40px; align-items: flex-start; flex-wrap: wrap; }
    .so-groupby-col { flex: 1.4; min-width: 340px; }
    .so-filters-col { flex: 1; min-width: 260px; padding-left: 32px; border-left: 1px solid #ececec; display: flex; flex-direction: column; }
    .so-col-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; color: #1a56db; margin-bottom: 16px; }

    .so-groupby-grid { display: grid; grid-template-columns: 118px 1fr; gap: 14px 16px; align-items: center; }
    .so-filters-grid { display: grid; grid-template-columns: 90px 1fr; gap: 16px; align-items: center; }

    .so-label { font-size: 13px; font-weight: 600; color: #1e293b; }
    .so-input { height: 34px; border: 1px solid #c7cdd6; border-radius: 4px; padding: 0 10px; font-size: 13px; color: #1e2d3d; background: #fff; width: 100%; box-sizing: border-box; transition: border-color .15s, box-shadow .15s; outline: none; }
    .so-input:focus { border-color: #1a56db; box-shadow: 0 0 0 3px rgba(26,86,219,.15); }
    .so-input:disabled { background: #f5f6f8; color: #a0aab5; cursor: not-allowed; }
    select.so-input { appearance: auto; cursor: pointer; }

    .so-combo { position: relative; }
    .so-combo-list { position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 20; margin: 0; padding: 4px; list-style: none; max-height: 200px; overflow-y: auto; background: #fff; border: 1px solid #c7cdd6; border-radius: 6px; box-shadow: 0 6px 20px rgba(0,0,0,.12); }
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

    .so-msg { margin-top: 18px; padding: 10px 14px; border-radius: 8px; font-size: 13px; font-weight: 500; text-align: center; }
    .so-msg.err { background: #fff0f0; color: #c53030; border: 1px solid #fed7d7; }
    .so-msg.ok  { background: #f0fff4; color: #276749; border: 1px solid #c6f6d5; }

    @media (max-width: 900px) {
      .so-content { flex-direction: column; }
      .so-filters-col { padding-left: 0; border-left: none; border-top: 1px solid #ececec; padding-top: 22px; }
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
              <div className="so-card-header-title">Purchase Order Itemwise</div>
              <button type="button" className="so-close-x" aria-label="Close" onClick={() => navigate(-1)}>✕</button>
            </div>

            <div className="so-card-body">
              <div className="so-report-title">Purchase Order Itemwise Report</div>

              <div className="so-content">
                <section className="so-groupby-col">
                  <div className="so-col-title">Group By</div>
                  <div className="so-groupby-grid">
                    <label className="so-radio-row" htmlFor="poi-rbt-brand">
                      <input id="poi-rbt-brand" type="radio" name="poi-groupby" checked={groupByField === "Brand"} onChange={() => handleGroupByChange("Brand")} />
                      <span>Brand</span>
                    </label>
                    <ComboField
                      id="poi-cmb-brand"
                      list={brandList}
                      selected={selectedBrand}
                      onSelect={setSelectedBrand}
                      disabled={groupByField !== "Brand"}
                      placeholder="Type to search brand…"
                    />

                    <label className="so-radio-row" htmlFor="poi-rbt-category">
                      <input id="poi-rbt-category" type="radio" name="poi-groupby" checked={groupByField === "Category"} onChange={() => handleGroupByChange("Category")} />
                      <span>Category</span>
                    </label>
                    <ComboField
                      id="poi-cmb-category"
                      list={categoryList}
                      selected={selectedCategory}
                      onSelect={setSelectedCategory}
                      disabled={groupByField !== "Category"}
                      placeholder="Type to search category…"
                    />

                    <label className="so-radio-row" htmlFor="poi-rbt-department">
                      <input id="poi-rbt-department" type="radio" name="poi-groupby" checked={groupByField === "Department"} onChange={() => handleGroupByChange("Department")} />
                      <span>Department</span>
                    </label>
                    <ComboField
                      id="poi-cmb-department"
                      list={departmentList}
                      selected={selectedDepartment}
                      onSelect={setSelectedDepartment}
                      disabled={groupByField !== "Department"}
                      placeholder="Type to search department…"
                    />

                    <label className="so-radio-row" htmlFor="poi-rbt-supplier">
                      <input id="poi-rbt-supplier" type="radio" name="poi-groupby" checked={groupByField === "Supplier"} onChange={() => handleGroupByChange("Supplier")} />
                      <span>Supplier</span>
                    </label>
                    <ComboField
                      id="poi-cmb-supplier"
                      list={supplierList}
                      selected={selectedSupplier}
                      onSelect={setSelectedSupplier}
                      disabled={groupByField !== "Supplier"}
                      placeholder="Type to search supplier…"
                    />

                    <label className="so-radio-row" htmlFor="poi-rbt-uom">
                      <input id="poi-rbt-uom" type="radio" name="poi-groupby" checked={groupByField === "UOM"} onChange={() => handleGroupByChange("UOM")} />
                      <span>UOM</span>
                    </label>
                    <ComboField
                      id="poi-cmb-uom"
                      list={uomList}
                      selected={selectedUOM}
                      onSelect={setSelectedUOM}
                      disabled={groupByField !== "UOM"}
                      placeholder="Type to search UOM…"
                    />

                    <label className="so-radio-row" htmlFor="poi-rbt-description">
                      <input id="poi-rbt-description" type="radio" name="poi-groupby" checked={groupByField === "Description"} onChange={() => handleGroupByChange("Description")} />
                      <span>Description</span>
                    </label>
                    <ComboField
                      id="poi-cmb-description"
                      list={descriptionOptions}
                      selected={selectedDescription}
                      onSelect={setSelectedDescription}
                      disabled={groupByField !== "Description"}
                      placeholder="Type to search item name…"
                    />

                    <label className="so-radio-row" htmlFor="poi-rbt-code">
                      <input id="poi-rbt-code" type="radio" name="poi-groupby" checked={groupByField === "Code"} onChange={() => handleGroupByChange("Code")} />
                      <span>Code</span>
                    </label>
                    <ComboField
                      id="poi-cmb-code"
                      list={codeOptions}
                      selected={selectedCode}
                      onSelect={setSelectedCode}
                      disabled={groupByField !== "Code"}
                      placeholder="Type to search item code…"
                    />
                  </div>
                </section>

                <section className="so-filters-col">
                  <div className="so-col-title">Filters</div>
                  <div className="so-filters-grid">
                    <label className="so-label" htmlFor="poi-from-date">From Date</label>
                    <input id="poi-from-date" type="date" className="so-input" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />

                    <label className="so-label" htmlFor="poi-to-date">To Date</label>
                    <input id="poi-to-date" type="date" className="so-input" value={toDate} onChange={(e) => setToDate(e.target.value)} />

                    <span className="so-label">Daily</span>
                    <label className="so-toggle-row" htmlFor="poi-chk-daily">
                      <input id="poi-chk-daily" type="checkbox" checked={dailyChecked} onChange={(e) => setDailyChecked(e.target.checked)} />
                      <span>Daily report</span>
                    </label>

                    <span className="so-label">MRP</span>
                    <label className="so-toggle-row" htmlFor="poi-chk-mrp">
                      <input id="poi-chk-mrp" type="checkbox" checked={mrpChecked} onChange={(e) => setMrpChecked(e.target.checked)} />
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