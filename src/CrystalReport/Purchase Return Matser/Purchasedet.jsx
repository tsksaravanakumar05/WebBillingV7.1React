// ─────────────────────────────────────────────────────────────────────────────
//  PurchaseReturnDetailed.jsx
//  React conversion of the "Purchase Return Detailed" jQuery screen
//  Uses API helpers from Common.jsx (CC.api / CC.mkUrl / CC.authHeaders etc.)
//  Layout / card styling: shared "so-" design system (BranchWise.jsx /
//  PurchaseDet.jsx / PurReturnConsolidated.jsx palette — blue header,
//  green Save, red Cancel)
//
//  NOTES — preserved exactly from the source jQuery file:
//  1) Permission gate: redirect to /Login/Index if no session (menulist ==
//     null). If "Purchase Return Detailed" isn't in the menulist ->
//     Permission Denied + redirect after 3s. If found but View == 0 -> same
//     Permission Denied + redirect after 3s. NOTE: unlike PurchaseDet.js,
//     this source redirects to "/Login/Home" in BOTH denial branches (not
//     "/Home") — reproduced literally below.
//  2) Supplier combo (GroupBy) is OPTIONAL — the source only validates when
//     `jqxComboBox('getSelectedItem')` is non-null. If picked but its value
//     resolves to null, an alert fires ("Please Select Valid Supplier Name
//     !!!." — note the wording differs from PurchaseDet.js's "...Item
//     Name...") and the combo is cleared + focused. GroupBy stays "" unless
//     a supplier is actually selected.
//  3) Report Type is a single 3-way radio (Cash / Credit / Both) whose
//     values are literally "CASH" / "CREDIT" / "BOTH" (unlike PurchaseDet.js
//     which uses "CA"/"CR" — kept exactly as this source sends them).
//  4) Dates: source reads the widget's Date object, formats it to
//     MM/dd/yyyy via `$.jqx.dataFormat.formatdate(date, 'MM/dd/yyyy')` for
//     both the validation comparison AND the AJAX payload / query string.
//     Reproduced below with `toMMDDYYYY`.
//  5) From/To date validation: `new Date(Fromdate) > new Date(Todate)` ->
//     alert "From Date Is Greater Than To Date!!", focus fromdate, return.
//  6) `SupplierWise` and `Daily` are checkboxes forwarded only to the
//     ReportViewer query string, NOT to the AJAX report-generation call
//     (source AJAX body only sends GroupBy / ReportType / Fromdate /
//     Todate / Comid / MComid).
//  7) `MComid` is a page-global in the source (not declared in the snippet
//     itself — set elsewhere on the page, same convention as CName /
//     CAddress / CPhone). Sourced here from local storage alongside Comid.
//  8) AJAX call is a POST returning JSON; on `data.ok == true` a new window
//     is opened at
//     "../Reports/ReportViewer.aspx?ReportName=PurchaseReturnDetailed&Repor
//     tType=...&SupplierWise=...&Daily=...&Fromdate=...&Todate=...&CName=..
//     .&CAddress=...&CPhone=..." with the exact window feature string from
//     source, and its title is set to 'Purchase Return Detail-Report' once
//     loaded. On `data.ok == false` -> "No Record !!!." message.
//  9) Supplier combo selection is cleared after every View click,
//     success or not (source calls this unconditionally right after the
//     synchronous $.ajax call).
//  10) Refresh button: clears supplier selection, unchecks both checkboxes,
//      resets the date pickers (re-init defaults to today, reproduced as
//      todayStr()), and resets the radio group back to its default —
//      "Both" checked, Cash/Credit unchecked.
//  11) Loader shows for the duration of the (source: synchronous) AJAX
//      call; reproduced as a standard async call with a loading flag,
//      since real synchronous XHR is not available/desirable in React.
//
//  ASSUMPTIONS (please confirm / adjust):
//  - PageName string kept as "Purchase Return Detailed" (from source).
//  - Endpoint ported from the source's MVC action
//    "/PurchaseReport/PurchaseReturnDetailsReport" to the Web API
//    convention used elsewhere in this app:
//    "/api/PurchaseReportApp/PurchaseReturnDetailsReport". Swap the
//    constant below if your backend route differs.
//  - Supplier combo data source assumed as GetSupplier (same convention as
//    PurchaseDet.jsx / PurReturnConsolidated.jsx) — adjust the URL / field
//    names in loadLists() if your API differs.
//  - res.Data15 used as the ReportViewer CacheKey, per house convention
//    (the original jQuery didn't use a cache key at all, it just checked
//    data.ok === true).
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Save, XCircle, Calendar as CalendarIcon } from "lucide-react";
import * as CC from "../../components/Common";
import Topbar from "../../components/Topbar";

// Report-type identifiers (mirrors rbtcash / rbtcredit / rbtboth — values
// kept literally "CASH" / "CREDIT" / "BOTH" as sent by the source jQuery)
const REPORT_TYPES = {
  CASH: "CASH",
  CREDIT: "CREDIT",
  BOTH: "BOTH",
};

const BASE_URL = "http://localhost:64215";

// API endpoint used by this screen (ported from source MVC action
// "/PurchaseReport/PurchaseReturnDetailsReport")
const PurchaseReturnDetailsReportUrl = "/api/PurchaseReportApp/PurchaseReturnDetailsReport";

// Supplier combo data source — matches the real backend action:
// public class SupplierAppController : ApiController
// public HttpResponseMessage GetSupplier(Int32 Comid, string AccountType)
const SupplierListUrl = "/api/SupplierApp/GetSupplier";

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
// Same component as PurReturnConsolidated.jsx — replaces reliance on native
// <input type="date"> text-editing (whose typing order/cursor behaviour
// follows the browser/OS locale) with three real segment inputs (DD / MM /
// YYYY), always in DD-MM-YYYY order regardless of browser locale.
//
// The calendar icon still opens the browser's native date picker (via a
// visually-hidden <input type="date"> synced to the same value) so users get
// the familiar picker UI — only manual typing is now custom.
//
// IMPORTANT: this component's public value/onChange contract is still plain
// ISO "YYYY-MM-DD" text, identical to the native input it replaces. Callers
// (fromDate/toDate state, toMMDDYYYY, the API payload, validation) are
// completely unchanged.

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

// ─────────────────────────────────────────────────────────────────────────────
//  SearchableSelect
//  Drop-in replacement for a native <select> lookup field (Supplier, Customer,
//  Brand, Category, ...). Same visual footprint (uses the .so-input class)
//  but adds an instant-filter text popup so users can type to narrow long
//  master-data lists instead of scrolling. Selection/clear behaviour matches
//  the original <select onChange> exactly — it just calls onChange(value)
//  with "" for the placeholder row, same as before.
// ─────────────────────────────────────────────────────────────────────────────
function SearchableSelect({ id, options, labelKey = "label", value, onChange, disabled, placeholder = "-- Select --" }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef(null);

  const getLabel = useCallback(
    (opt) => String(opt?.[labelKey] ?? opt?.label ?? ""),
    [labelKey]
  );

  const selected = useMemo(
    () => options.find((o) => String(o.value) === String(value ?? "")) || null,
    [options, value]
  );

  // Keep the visible text in sync whenever the underlying value changes
  // (including external resets like the Refresh button).
  useEffect(() => {
    setQuery(selected ? getLabel(selected) : "");
  }, [selected, getLabel]);

  // Close + revert unsaved typed text on outside click.
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        setQuery(selected ? getLabel(selected) : "");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [selected, getLabel]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || (selected && q === getLabel(selected).toLowerCase())) return options;
    return options.filter((o) => getLabel(o).toLowerCase().includes(q));
  }, [options, query, selected, getLabel]);

  const handleSelect = (opt) => {
    onChange(String(opt.value));
    setQuery(getLabel(opt));
    setOpen(false);
  };

  const handleClear = () => {
    onChange("");
    setQuery("");
    setOpen(false);
  };

  return (
    <div className="so-combo" ref={wrapRef}>
      <input
        id={id}
        className="so-input"
        type="text"
        autoComplete="off"
        disabled={disabled}
        placeholder={placeholder}
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            setQuery(selected ? getLabel(selected) : "");
          }
        }}
      />
      {open && !disabled && (
        <ul className="so-combo-list" role="listbox">
          <li
            className="so-combo-item so-combo-item-clear"
            onMouseDown={(e) => { e.preventDefault(); handleClear(); }}
          >
            {placeholder}
          </li>
          {filtered.length === 0 ? (
            <li className="so-combo-empty">No matches found</li>
          ) : (
            filtered.map((opt) => (
              <li
                key={opt.value}
                className={`so-combo-item${String(opt.value) === String(value ?? "") ? " active" : ""}`}
                role="option"
                aria-selected={String(opt.value) === String(value ?? "")}
                onMouseDown={(e) => { e.preventDefault(); handleSelect(opt); }}
              >
                {getLabel(opt)}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

export default function PurchaseReturnDetailed() {
  const navigate = useNavigate();

  // ── Session / permission state ─────────────────────────────────────────
  const [pageAccess, setPageAccess] = useState({
    ready: false,
    allowed: false,
    pageview: 0,
  });

  // ── Company / settings state ────────────────────────────────────────────
  const [session, setSession] = useState({
    Comid: "",
    MComid: "",
    CName: "",
    CAddress: "",
    CPhone: "",
  });

  // ── Form state (controlled inputs replacing jqx widgets) ───────────────
  const [reportType, setReportType] = useState(REPORT_TYPES.BOTH);
  const [fromDate, setFromDate] = useState(todayStr());
  const [toDate, setToDate] = useState(todayStr());
  const [supplierWise, setSupplierWise] = useState(false); // chksupplier
  const [daily, setDaily] = useState(false);               // chkdaily
  const [selectedSupplier, setSelectedSupplier] = useState(""); // cmbsupplier

  // ── Combo data ───────────────────────────────────────────────────────────
  const [suppliers, setSuppliers] = useState([]);

  // Normalized {value,label} list for the searchable Supplier combo —
  // same Id/Name resolution the native <select> used, just precomputed.
  const supplierOptions = useMemo(
    () =>
      suppliers.map((s, idx) => ({
        value: s.Id ?? s.SupplierId ?? s.value ?? idx,
        label: s.AccountName,
      })),
    [suppliers]
  );

  // ── UI feedback state ───────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null); // { text, isErr }

  // Bootstrap: permission gate + session + supplier combo.
  useEffect(() => {
    const menulist = CC.getLocal("menulist");
    if (menulist == null) {
      setMsg({ text: "Session Close Please Login !!!.", isErr: true });
      navigate("/Login/Index");
      return;
    }

    const menudata = menulist.filter((obj) => obj.PageName === "Purchase Return Detailed");
    if (!menudata || menudata.length === 0) {
      setMsg({ text: "Page Access Permission Denied !!!.", isErr: true });
      // Source redirects to /Login/Home here (not /Home) — kept literal.
      setTimeout(() => navigate("/Login/Home"), 3000);
      return;
    }

    if (menudata[0].View === 0) {
      setMsg({ text: "Page Access Permission Denied !!!.", isErr: true });
      // Source redirects to /Login/Home here too — kept literal.
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

    const loadLists = async () => {
      try {
        // Backend requires AccountType too — "" / "ALL" fetches every
        // supplier regardless of Cash/Credit type. Adjust if your service
        // expects a specific non-empty value when nothing is filtered.
        const supRes = await CC.api(SupplierListUrl, null, {}, { Comid, AccountType: "SUPPLIER" });
        const supList = supRes?.Data1 || supRes?.data || [];

        setSuppliers(Array.isArray(supList) ? supList : []);
      } catch (err) {
        // Combo load failure shouldn't block the page — same as jQuery,
        // where loadsuppliercombo() failures just leave the combobox empty.
        console.error("PurchaseReturnDetailed supplier combo load error:", err);
      }
    };
    loadLists();
  }, [navigate]);

  const handleReportTypeChange = useCallback((type) => {
    setReportType(type);
  }, []);

  const handleRefresh = useCallback(() => {
    setSelectedSupplier("");
    setSupplierWise(false);
    setDaily(false);
    setFromDate(todayStr());
    setToDate(todayStr());
    setReportType(REPORT_TYPES.BOTH);
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
      w.addEventListener(
        "load",
        function () {
          w.document.title = "Purchase Return Detail-Report";
        },
        false
      );
    }
  }, []);

  const handleView = useCallback(async () => {
    // ── Supplier validation (only validated when something is selected — as in source) ──
    let GroupBy = "";
    if (selectedSupplier !== "") {
      GroupBy = selectedSupplier;
      if (GroupBy == null || GroupBy === "") {
        setMsg({ text: "Please Select Valid Supplier Name !!!.", isErr: true });
        setSelectedSupplier("");
        return;
      }
    }

    const RptType = reportType; // "CASH" / "CREDIT" / "BOTH"

    if (!fromDate || !toDate) {
      setMsg({ text: "Please select From Date and To Date.", isErr: true });
      return;
    }

    const Fromdate = toMMDDYYYY(fromDate);
    const Todate = toMMDDYYYY(toDate);

    if (new Date(Fromdate) > new Date(Todate)) {
      setMsg({ text: "From Date Is Greater Than To Date!!", isErr: true });
      return;
    }

    const SupplierWise = supplierWise;
    const Daily = daily;

    setLoading(true);
    setMsg(null);

    try {
      const Comid = session.Comid;
      const MComid = session.MComid;

      const res = await CC.api(PurchaseReturnDetailsReportUrl, null, {React:1}, {
        GroupBy,
        ReportType: RptType,
        Fromdate,
        Todate,
        Comid,
        MComid,
      });

      if (res.ok === true || res.IsSuccess) {
        const cacheKey = res.Data15 || "";
        openReportViewer({
          ReportName: "PurchaseReturnDetailed",
          CacheKey: cacheKey,
          ReportType: RptType,
          SupplierWise,
          Daily,
          Fromdate,
          Todate,
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
      // Source clears the supplier combobox after every View click
      setSelectedSupplier("");
    }
  }, [reportType, fromDate, toDate, supplierWise, daily, selectedSupplier, session, openReportViewer]);

  // ── Design system: colors sourced from global --clr-* variables (MasterPage.css),
  //   same convention as PurReturnConsolidated.jsx —
  //   Border / header / heading -> var(--clr-primary) / var(--clr-primary-dark)
  //   Save-style accents        -> var(--clr-green)
  //   Cancel / link accents     -> var(--clr-danger)

  const navItems = [
    { value: REPORT_TYPES.CASH,   label: "Cash" },
    { value: REPORT_TYPES.CREDIT, label: "Credit" },
    { value: REPORT_TYPES.BOTH,   label: "Both" },
  ];

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
          <div className="so-card">
            <div className="so-card-header">
              <div className="so-card-header-title">Purchase Detailed</div>
              <button type="button" className="so-close-x" aria-label="Close" onClick={() => navigate(-1)}>✕</button>
            </div>

            <div className="so-card-body">
              <div className="so-report-title">Purchase Detailed - Report</div>

              <div className="so-content">
                {/* ── Left: report type + options (design only, same reportType/supplierWise/daily state) ── */}
                <div className="so-left">
                  {navItems.map((item) => (
                    <label key={item.value} className="so-radio-row">
                      <input
                        type="radio"
                        name="pd-report-type"
                        checked={reportType === item.value}
                        onChange={() => handleReportTypeChange(item.value)}
                      />
                      {item.label}
                    </label>
                  ))}

                  <div className="so-basis-row">
                    <label className="so-checkbox">
                      <input
                        type="checkbox"
                        checked={supplierWise}
                        onChange={(e) => setSupplierWise(e.target.checked)}
                      />
                      <span className="so-checkbox-box">
                        <svg viewBox="0 0 24 24" fill="none" stroke="var(--clr-text-white)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </span>
                      Supplier Wise
                    </label>
                    <label className="so-checkbox">
                      <input
                        type="checkbox"
                        checked={daily}
                        onChange={(e) => setDaily(e.target.checked)}
                      />
                      <span className="so-checkbox-box">
                        <svg viewBox="0 0 24 24" fill="none" stroke="var(--clr-text-white)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </span>
                      Daily
                    </label>
                  </div>
                </div>

                {/* ── Right: supplier combo + dates ── */}
                <div className="so-right">
                  <div className="so-field">
                    <label className="so-label" htmlFor="pd-supplier">Supplier</label>
                    <SearchableSelect
                      id="pd-supplier"
                      options={supplierOptions}
                      labelKey="label"
                      value={selectedSupplier}
                      onChange={(val) => setSelectedSupplier(val)}
                      placeholder="-- Select Supplier --"
                    />
                  </div>

                  <div className="so-field">
                    <label className="so-label" htmlFor="pd-from-date">From Date</label>
                    <DateFieldDDMMYYYY id="pd-from-date" value={fromDate} onChange={setFromDate} />
                  </div>

                  <div className="so-field">
                    <label className="so-label" htmlFor="pd-to-date">To Date</label>
                    <DateFieldDDMMYYYY id="pd-to-date" value={toDate} onChange={setToDate} />
                  </div>
                </div>
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
