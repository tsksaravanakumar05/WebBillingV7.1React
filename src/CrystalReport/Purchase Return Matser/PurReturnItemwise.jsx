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

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Save, XCircle, Calendar as CalendarIcon } from "lucide-react";
import * as CC from "../../components/Common";
import Topbar from "../../components/Topbar";
import "../Reportstyles.css";

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

// Hardcoded in the legacy file (`var RiceUOMSetting = "0";`) and never
// reassigned — carried over as-is rather than invented/derived.
const RiceUOMSetting = "0";

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

// ── DD-MM-YYYY segmented date input ─────────────────────────────────────────
// Same component/design as PurchaseDet.jsx: three real segment inputs (DD /
// MM / YYYY) instead of relying on native <input type="date"> text-editing,
// whose typing order/cursor behaviour follows the browser/OS locale and
// can't be forced into DD-MM-YYYY with CSS alone. The calendar icon button
// opens a visually-hidden native date input for the picker UI; typing is
// handled entirely by the segment inputs below.
//
// Public value/onChange contract is plain ISO "YYYY-MM-DD" text, identical
// to the native <input type="date"> it replaces — fromDate/toDate state,
// toMMDDYYYY(), and handleView's validation are all completely unchanged.

const pad2 = (n) => String(n).padStart(2, "0");

const parseIsoDate = (iso) => {
  if (!iso) return { d: "", m: "", y: "" };
  const [y, m, d] = iso.split("-");
  return { d: d || "", m: m || "", y: y || "" };
};

// Real calendar validity check (rejects e.g. 31-04-2026, 29-02-2027).
const isValidDMY = (d, m, y) => {
  if (!d || !m || y.length !== 4) return false;
  const dd = parseInt(d, 10);
  const mm = parseInt(m, 10);
  const yy = parseInt(y, 10);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return false;
  const dt = new Date(yy, mm - 1, dd);
  return dt.getFullYear() === yy && dt.getMonth() === mm - 1 && dt.getDate() === dd;
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

function DateFieldDDMMYYYY({ id, value, onChange, disabled }) {
  const initial = parseIsoDate(value);
  const [day, setDay] = useState(initial.d);
  const [month, setMonth] = useState(initial.m);
  const [year, setYear] = useState(initial.y);

  const dayRef = useRef(null);
  const monthRef = useRef(null);
  const yearRef = useRef(null);
  const nativeRef = useRef(null);

  // Stay in sync when the value changes from outside this component —
  // e.g. the native calendar-picker icon, or a programmatic reset.
  useEffect(() => {
    const p = parseIsoDate(value);
    setDay(p.d);
    setMonth(p.m);
    setYear(p.y);
  }, [value]);

  const commitIfValid = useCallback(
    (d, m, y) => {
      if (isValidDMY(d, m, y)) {
        onChange(`${y}-${pad2(parseInt(m, 10))}-${pad2(parseInt(d, 10))}`);
      }
    },
    [onChange]
  );

  const handleDayChange = (e) => {
    const v = e.target.value.replace(/\D/g, "").slice(0, 2);
    setDay(v);
    // Auto-advance to Month once 2 digits are entered, or immediately if a
    // single digit can only be a one-digit day (4-9, since 40-99 is invalid).
    if (v.length === 2 || (v.length === 1 && parseInt(v, 10) > 3)) {
      const padded = v.padStart(2, "0");
      setDay(padded);
      commitIfValid(padded, month, year);
      monthRef.current?.focus();
      monthRef.current?.select();
    } else {
      commitIfValid(v, month, year);
    }
  };

  const handleMonthChange = (e) => {
    const v = e.target.value.replace(/\D/g, "").slice(0, 2);
    setMonth(v);
    if (v.length === 2 || (v.length === 1 && parseInt(v, 10) > 1)) {
      const padded = v.padStart(2, "0");
      setMonth(padded);
      commitIfValid(day, padded, year);
      yearRef.current?.focus();
      yearRef.current?.select();
    } else {
      commitIfValid(day, v, year);
    }
  };

  const handleYearChange = (e) => {
    const v = e.target.value.replace(/\D/g, "").slice(0, 4);
    setYear(v);
    commitIfValid(day, month, v);
  };

  const handleSegmentKeyDown = (segment) => (e) => {
    const el = e.target;
    const atStart = el.selectionStart === 0 && el.selectionEnd === 0;
    const atEnd = el.selectionStart === el.value.length && el.selectionEnd === el.value.length;

    if (e.key === "Backspace" && atStart) {
      if (segment === "month") { dayRef.current?.focus(); dayRef.current?.select(); }
      if (segment === "year") { monthRef.current?.focus(); monthRef.current?.select(); }
    } else if (e.key === "ArrowLeft" && atStart) {
      if (segment === "month") dayRef.current?.focus();
      if (segment === "year") monthRef.current?.focus();
    } else if (e.key === "ArrowRight" && atEnd) {
      if (segment === "day") monthRef.current?.focus();
      if (segment === "month") yearRef.current?.focus();
    }
  };

  // Picker selection (native <input type="date">) updates all three
  // segments and commits the value exactly like typing does.
  const handleNativePickerChange = (e) => {
    const iso = e.target.value;
    if (!iso) return;
    const p = parseIsoDate(iso);
    setDay(p.d);
    setMonth(p.m);
    setYear(p.y);
    onChange(iso);
  };

  const openPicker = () => {
    const el = nativeRef.current;
    if (!el || disabled) return;
    if (typeof el.showPicker === "function") {
      try {
        el.showPicker();
        return;
      } catch {
        // fall through to focus-based fallback below
      }
    }
    el.focus();
  };

  return (
    <div className={`so-date-wrap${disabled ? " so-date-wrap-disabled" : ""}`}>
      <div className="so-date-segments">
        <input
          id={id}
          ref={dayRef}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="DD"
          maxLength={2}
          className="so-date-seg so-date-seg-dd"
          value={day}
          disabled={disabled}
          onChange={handleDayChange}
          onKeyDown={handleSegmentKeyDown("day")}
          onFocus={(e) => e.target.select()}
        />
        <span className="so-date-sep">-</span>
        <input
          ref={monthRef}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="MM"
          maxLength={2}
          className="so-date-seg so-date-seg-mm"
          value={month}
          disabled={disabled}
          onChange={handleMonthChange}
          onKeyDown={handleSegmentKeyDown("month")}
          onFocus={(e) => e.target.select()}
        />
        <span className="so-date-sep">-</span>
        <input
          ref={yearRef}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="YYYY"
          maxLength={4}
          className="so-date-seg so-date-seg-yyyy"
          value={year}
          disabled={disabled}
          onChange={handleYearChange}
          onKeyDown={handleSegmentKeyDown("year")}
          onFocus={(e) => e.target.select()}
        />
      </div>

      <button
        type="button"
        className="so-date-icon-btn"
        onClick={openPicker}
        disabled={disabled}
        tabIndex={-1}
        aria-label="Open calendar picker"
      >
        <CalendarIcon size={15} />
      </button>

      {/* Native date input kept only for the calendar picker UI — visually
          hidden, never used for typing, always mirrors the ISO value above. */}
      <input
        ref={nativeRef}
        type="date"
        className="so-date-native-hidden"
        value={value || ""}
        onChange={handleNativePickerChange}
        tabIndex={-1}
        aria-hidden="true"
        disabled={disabled}
      />
    </div>
  );
}

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

export default function PurReturnItemwise() {
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
        fetchList(UOMListUrl),
      ]);

      // Product list: fetched and normalized exactly as PurOrderItemwise.jsx
      // does it (direct CC.api call, same Data/data/Data1 fallback,
      // same field-fallback order for description/code/value) rather than through
      // the generic fetchList helper used by the other combos above.
      let productRaw = [];
      try {
        const res = await CC.api(ProductListUrl, null, {}, { Comid: session.Comid, AccountType: "SUPPLIER" });
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
          p.Productcode ??
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
        Category: normalize(categoryRaw, ["CategoryName", "Cat_Name", "label", "Label", "Name", "Text"], ["value", "Value", "CategoryId", "Id"]),
        Department: normalize(departmentRaw, ["DepartmentName", "label", "Label", "Name", "Text"], ["value", "Value", "DepartmentId", "Id"]),
        Supplier: normalize(supplierRaw, ["SupplierName", "AccountName", "label", "Label", "Name", "Text"], ["value", "Value", "SupplierId", "Id"]),
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
    const url = `${CC.BASE_URL}/Reports/ReportViewer.aspx?${qs}`;

    const w = window.open(
      url,
      "_blank",
      `directories=0,titlebar=0,toolbar=0,location=0,status=0,` +
      `menubar=0,scrollbars=yes,resizable=no,` +
      `width=${screen.width},height=${screen.height - 100}`
    );
    if (w) {
      w.addEventListener("load", () => { w.document.title = "Purchase Return Itemwise-Report"; }, false);
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
      const res = await CC.api(PurchaseReturnItemWiseReportUrl, null, {React:1}, {
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
          ReportName: "PurchaseReturnItemWise",
          CacheKey: cacheKey,
          RiceUOMSetting,
          GroupBy,
          Fromdate,
          Todate,
          Daily: daily,
          MRP: mrp,
          CName: session?.CName || localStorage.getItem("CompanyName") || "",
          CAddress: session?.CAddress || localStorage.getItem("Address") || "",
          CPhone: session?.CPhone || localStorage.getItem("Phone") || "",
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
      <div className="so-shell">
        <Topbar />
        <div className="so-layout">
          <div className="so-card so-card-wide">
            <div className="so-card-header">
              <div className="so-card-header-title">Purchase Return Itemwise</div>
              <button type="button" className="so-close-x" aria-label="Close" onClick={() => navigate(-1)}>✕</button>
            </div>

            <div className="so-card-body">
              <div className="so-report-title">Purchase Return Itemwise - Report</div>

              <div className="so-content so-content-groupby">
                <section className="so-groupby-col">
                  <div className="so-col-title">Group By</div>
                  <div className="so-groupby-grid">
                    {GROUPS.map((group) => (
                      <React.Fragment key={group.key}>
                        <label className="so-radio-row" htmlFor={`pri-rbt-${group.key.toLowerCase()}`}>
                          <input
                            id={`pri-rbt-${group.key.toLowerCase()}`}
                            type="radio"
                            name="pri-groupby"
                            checked={selectedGroup === group.key}
                            onChange={() => handleGroupByChange(group.key)}
                          />
                          <span>{group.title}</span>
                        </label>
                        <ComboField
                          id={`pri-cmb-${group.key.toLowerCase()}`}
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
                    <label className="so-label" htmlFor="pri-from-date">From Date</label>
                    <DateFieldDDMMYYYY id="pri-from-date" value={fromDate} onChange={setFromDate} />

                    <label className="so-label" htmlFor="pri-to-date">To Date</label>
                    <DateFieldDDMMYYYY id="pri-to-date" value={toDate} onChange={setToDate} />

                    <span className="so-label">Daily</span>
                    <label className="so-toggle-row" htmlFor="pri-chk-daily">
                      <input id="pri-chk-daily" type="checkbox" checked={dailyChecked} onChange={(e) => setDailyChecked(e.target.checked)} />
                      <span>Daily report</span>
                    </label>

                    <span className="so-label">MRP</span>
                    <label className="so-toggle-row" htmlFor="pri-chk-mrp">
                      <input id="pri-chk-mrp" type="checkbox" checked={mrpChecked} onChange={(e) => setMrpChecked(e.target.checked)} />
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
