// ─────────────────────────────────────────────────────────────────────────────
//  PurOrderItemwise.jsx
//  React conversion of PurOrderItemwise.js (jQuery) —
//  "Purchase Order Itemwise Report"
//  Uses API helpers from Common.jsx (CC.api / CC.mkUrl / CC.authHeaders etc.)
//  Styling/Layout: aligned with PurItemwise.jsx — shared so- classes now
//  live in Reportstyles.css (no more inline <style> block), and the two
//  date fields use the same segmented DD-MM-YYYY input component. No inline
//  color values, no new theme colors, no new classes beyond what
//  PurItemwise/Reportstyles.css already define.
//
//  NOTE: unlike SaleOrder/BankVoucher/CashVoucher, this legacy screen has no
//  report-type radio buttons for the *report itself* — it's a single
//  "Purchase Order Itemwise" report, so the left nav-card report-type
//  picker is omitted (not invented). The radio buttons that DO exist here
//  are a "Group By" field selector (Brand/Category/Department/Supplier/
//  UOM/Description/Code), which is a different concept.
//
//  DESIGN-MATCH ONLY: every change below is presentational (imports, the
//  segmented date-input component, wrapper class names, moving CSS to the
//  shared stylesheet). No state variable, effect, API call, request
//  parameter, validation rule, or calculation has been altered — the
//  per-field group-by state, the handleView if-blocks (including the
//  preserved `.lable` typo on Description/Code), handleRefresh, and the
//  report-viewer params are all byte-for-byte the same logic as before.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Save, XCircle, Calendar as CalendarIcon } from "lucide-react";
import * as CC from "../../components/Common";
import Topbar from "../../components/Topbar";
import "../Reportstyles.css";

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

// ── DD-MM-YYYY segmented date input ─────────────────────────────────────────
// Same component/design as PurItemwise.jsx: three real segment inputs (DD /
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
    const url = `${CC.BASE_URL}/Reports/ReportViewer.aspx?${qs}`;

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
          CName:    session?.CName    || localStorage.getItem("CompanyName") || "",
          CAddress: session?.CAddress || localStorage.getItem("Address")     || "",
          CPhone:   session?.CPhone   || localStorage.getItem("Phone")       || "",
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
              <div className="so-card-header-title">Purchase Order Itemwise</div>
              <button type="button" className="so-close-x" aria-label="Close" onClick={() => navigate(-1)}>✕</button>
            </div>

            <div className="so-card-body">
              <div className="so-report-title">Purchase Order Itemwise Report</div>

              <div className="so-content so-content-groupby">
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
                    <DateFieldDDMMYYYY id="poi-from-date" value={fromDate} onChange={setFromDate} />

                    <label className="so-label" htmlFor="poi-to-date">To Date</label>
                    <DateFieldDDMMYYYY id="poi-to-date" value={toDate} onChange={setToDate} />

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