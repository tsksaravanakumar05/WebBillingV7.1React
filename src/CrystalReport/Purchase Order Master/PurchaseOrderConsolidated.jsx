// ─────────────────────────────────────────────────────────────────────────────
//  PurchaseOrderConsolidated.jsx
//  React conversion of PurchaseOrderConsolidated.js (jQuery) —
//  "Purchase Order Consolidated Report"
//  Uses API helpers from Common.jsx (CC.api / CC.mkUrl / CC.authHeaders etc.)
//  Styling: same "so-*" design system used across the report screens (see
//  PurConsolidated.jsx / BankBook.jsx) — no inline color values, no new
//  theme colors, same card / form-grid / button language. Shared class
//  definitions now live in Reportstyles.css instead of a component-local
//  <style> block, matching the other report screens.
//
//  NOTE: like BankBook/CashBook, this legacy screen has no report-type radio
//  buttons — it's a single report, so the left nav-card report-type picker
//  is omitted here (not invented). The left column instead holds the
//  Supplier Wise checkbox, matching the Cash/Credit/Both + checkboxes split
//  used by PurConsolidated.jsx.
//
//  DATE INPUT: replaced native <input type="date"> with a custom dd-mm-yyyy
//  segmented text input (DateFieldDDMMYYYY), same component/behavior as
//  PurConsolidated.jsx and PurchaseDet.jsx. Native date inputs render in the
//  browser/OS locale format, which is NOT controllable from code. Internal
//  state stays ISO (yyyy-mm-dd) so validation / existing helpers keep
//  working unchanged; only the on-screen text is dd-mm-yyyy.
//
//  All business logic below (dual PageName permission check, GroupBy /
//  ReportType / Daily handling, the "PurchaseOrderConsalted" report name,
//  API payloads, and validation) is unchanged from the original file — only
//  the design/structure/markup has been aligned with PurConsolidated.jsx.
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
const PurchaseOrderConsolidateReportUrl = "/api/PurchaseReportApp/PurchaseOrderConsolidateReport";

// The legacy file loads the supplier combo via a shared
// `loadsuppliercombo("#cmbsupplier")` helper defined outside this file (not
// present in the source we converted). This endpoint is our best-effort
// match to that helper's data source, following the same
// /api/<Module>App/... convention used by BankBook's loadbankcombo
// equivalent — please confirm with the backend.Supplier/GetSupplier
const SupplierListUrl = "/api/SupplierApp/GetSupplier";

// ── Date helpers ────────────────────────────────────────────────────────────
// Internal state is always ISO (yyyy-mm-dd) — safe for `new Date()` comparisons
// and matches what todayStr() has always produced.
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
// Same design/behavior as PurConsolidated.jsx / PurchaseDet.jsx: three real
// segment inputs (DD / MM / YYYY) instead of relying on native
// <input type="date"> text-editing, whose typing order/cursor behaviour
// follows the browser/OS locale and can't be forced into DD-MM-YYYY with CSS
// alone. The calendar icon button opens a visually-hidden native date input
// for the picker UI; typing is handled entirely by the segment inputs below.
//
// Public value/onChange contract is plain ISO "YYYY-MM-DD" text, same as the
// native input it replaces — callers (fromDate/toDate state, toMMDDYYYY, the
// API payload, validation) are completely unchanged.

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

export default function PurchaseOrderConsolidated() {
  const navigate = useNavigate();

  // ── Session / permission state ─────────────────────────────────────────
  const [pageAccess, setPageAccess] = useState({
    ready: false,
    allowed: false,
    pageview: 0,
  });

  // ── Company / settings state (loaded once from localStorage, same as jQuery) ──
  // NOTE: the legacy source references CName/CAddress/CPhone globals when
  // building the report-viewer URL but never declares them locally — they
  // must come from a shared page-level source. Following the same
  // Companysetting-from-localStorage convention used by BankBook.jsx
  // (please confirm with the backend if this differs for this screen).
  const [session, setSession] = useState({
    Comid: "",
    CName: "",
    CAddress: "",
    CPhone: "",
  });

  // ── Form state (controlled inputs replacing jqx widgets) ────────────────
  // Stored as ISO (yyyy-mm-dd) internally; displayed as dd-mm-yyyy in the UI.
  const [fromDate, setFromDate] = useState(todayStr());
  const [toDate, setToDate] = useState(todayStr());
  // Replaces #chksupplier jqxCheckBox — "SupplierWise" toggle sent to the
  // report viewer as-is (true/false), never sent to the report API call
  // itself (legacy only reads it right before opening the report window).
  const [supplierWise, setSupplierWise] = useState(false);

  // Supplier combo (#cmbsupplier in the legacy markup) — replaces
  // jqxComboBox with a type-to-filter combobox (input + filtered dropdown).
  // Unlike BankBook's bank combo, selecting a supplier is OPTIONAL here:
  // the legacy handler only reads item.value into GroupBy when something is
  // selected; if nothing is selected it proceeds with GroupBy = "".
  const [supplierList, setSupplierList] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState(null); // { label, value } | null
  const [supplierSearch, setSupplierSearch] = useState("");
  const [supplierDropdownOpen, setSupplierDropdownOpen] = useState(false);
  const supplierWrapRef = useRef(null);

  // ── UI feedback state ────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null); // { text, isErr }

  // Filtered options as the user types — matches on label (supplier name).
  const filteredSuppliers = useMemo(() => {
    const q = (supplierSearch || "").trim().toLowerCase();
    if (!q) return supplierList;
    return supplierList.filter((s) => String(s.label ?? "").toLowerCase().includes(q));
  }, [supplierList, supplierSearch]);

  // Keep the visible text in sync with the confirmed selection — covers both
  // a user picking an option and selectedSupplier being cleared elsewhere
  // (handleRefresh, handleView's finally block).
  useEffect(() => {
    setSupplierSearch(selectedSupplier?.label ?? "");
  }, [selectedSupplier]);

  // Close the supplier combobox dropdown when clicking outside it.
  useEffect(() => {
    const onDocMouseDown = (e) => {
      if (supplierWrapRef.current && !supplierWrapRef.current.contains(e.target)) {
        setSupplierDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  // ── Bootstrap: session / permission check ───────────────────────────────
  // NOTE: the legacy .js runs this exact permission-check block TWICE in a
  // row — first filtering menulist by PageName "Purchase Order
  // Consolidated", then immediately again by PageName "Purchase
  // Consolidated". Because pageview/pageadd/pageedit/pagedelete are all
  // declared with `var` in the original, the second lookup silently
  // overwrites the first, so only the "Purchase Consolidated" entry's
  // permissions actually take effect at runtime (the first lookup only
  // matters in that it can independently deny access / redirect). This
  // looks like a copy-paste leftover in the source, but per "preserve 100%
  // of business logic" it is reproduced exactly below rather than
  // simplified to a single check.
  useEffect(() => {
    const menulistA = CC.getLocal("menulist");
    if (menulistA == null) {
      setMsg({ text: "Session Close Please Login !!!.", isErr: true });
      navigate("/Login/Index");
      return;
    }

    const menudataA = menulistA.filter((obj) => obj.PageName === "Purchase Order Consolidated");
    if (!menudataA || menudataA.length === 0) {
      setMsg({ text: "Page Access Permission Denied !!!.", isErr: true });
      setTimeout(() => navigate("/Login/Home"), 3000);
      return;
    }
    if (menudataA[0].View === 0) {
      setMsg({ text: "Page Access Permission Denied !!!.", isErr: true });
      setTimeout(() => navigate("/Login/Home"), 3000);
      return;
    }

    // Second (effectively decisive) check — mirrors the legacy re-read of
    // menulist and re-filter by the other PageName string.
    const menulistB = CC.getLocal("menulist");
    if (menulistB == null) {
      setMsg({ text: "Session Close Please Login !!!.", isErr: true });
      navigate("/Login/Index");
      return;
    }

    const menudataB = menulistB.filter((obj) => obj.PageName === "Purchase Consolidated");
    if (!menudataB || menudataB.length === 0) {
      setMsg({ text: "Page Access Permission Denied !!!.", isErr: true });
      setTimeout(() => navigate("/Login/Home"), 3000);
      return;
    }
    if (menudataB[0].View === 0) {
      setMsg({ text: "Page Access Permission Denied !!!.", isErr: true });
      setTimeout(() => navigate("/Login/Home"), 3000);
      return;
    }

    const Comid = CC.getStr("Comid");
    const ComSet = CC.getLocal("Companysetting") || [{}];

    setSession({
      Comid,
      CName: ComSet[0]?.CName || "",
      CAddress: ComSet[0]?.CAddress || "",
      CPhone: ComSet[0]?.CPhone || "",
    });

    setPageAccess({
      ready: true,
      allowed: true,
      pageview: menudataB[0].View,
      pageadd: menudataB[0].Add,
      pageedit: menudataB[0].Edit,
      pagedelete: menudataB[0].Delete,
    });
  }, [navigate]);

  // Loads the supplier combo once page access is granted — replaces the
  // legacy `loadsuppliercombo("#cmbsupplier")` call made from methods.load().
  useEffect(() => {
    if (!pageAccess.ready || !pageAccess.allowed) return;
    if (!session.Comid) return;

    let cancelled = false;

    const loadSuppliers = async () => {
      try {
        const res = await CC.api(
          SupplierListUrl,
          null,
          {},
          {
            Comid: session.Comid,
            AccountType: "SUPPLIER", // or whatever your API expects
          }
        );

        if (res?.IsSuccess !== true) {
          if (!cancelled) {
            setMsg({
              text: res?.Message || "Unable to load supplier list.",
              isErr: true,
            });
          }
          return;
        }
        console.log(res);
        const list = res.Data || res.Data1 || res.data || [];

        const normalized = (Array.isArray(list) ? list : []).map((item) => ({
          label:
          item.AccountName ??
            item.SupplierName ??
            item.Suppliername ??
            item.Name ??
            item.Text ??
            item.Label ??
            "",
          value:
            item.SupplierId ??
            item.Supplierid ??
            item.Id ??
            item.Value ??
            "",
        }));

        if (!cancelled) {
          setSupplierList(normalized);
        }
      } catch (err) {
        if (!cancelled) {
          setMsg({
            text: err.message || "Unable to load supplier list.",
            isErr: true,
          });
        }
      }
    };

    loadSuppliers();

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

  const handleRefresh = useCallback(() => {
    // Matches the legacy #btnrefresh handler: clears the supplier combo
    // selection, unchecks the supplier-wise checkbox. The date pickers were
    // merely re-initialised with the same format string in the legacy code,
    // not reset to a new value, so fromDate/toDate are left untouched here.
    setSelectedSupplier(null);
    setSupplierWise(false);
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
      w.addEventListener("load", () => { w.document.title = "Purchase Order Consolidated-Report"; }, false);
    }
  }, []);

  const handleView = useCallback(async () => {
    const RptType = "CASH";

    // Legacy: supplier selection is OPTIONAL. GroupBy stays "" unless an
    // item is actually selected in the combo; only then is its value
    // validated as non-null.
    let GroupBy = "";
    if (selectedSupplier) {
      GroupBy = selectedSupplier.value;
      if (GroupBy == null || GroupBy === "") {
        setMsg({ text: "Please Select Valid Supplier Name !!!.", isErr: true });
        setSelectedSupplier(null);
        return;
      }
    }

    const Daily = "false";
    const Fromdate = toMMDDYYYY(fromDate);
    const Todate = toMMDDYYYY(toDate);

    if (new Date(Fromdate) > new Date(Todate)) {
      setMsg({ text: "From Date Is Greater Than To Date!!", isErr: true });
      return;
    }

    const SupplierWise = supplierWise;

    setLoading(true);
    setMsg(null);

    try {
      // Legacy hand-builds the JSON body and reads back `data.ok === true`
      // (not IsSuccess/Data15) — preserved exactly, no React:1 header.
      const res = await CC.api(PurchaseOrderConsolidateReportUrl, null, { React:1}, {
        GroupBy,
        ReportType: RptType,
        Fromdate,
        Todate,
        Comid: session.Comid,
      });

      if (res?.ok === true) {

            const cacheKey =
              res.data15 ??
              res.Data15 ??
              res.data?.Data15 ??
              "";
        openReportViewer({
          // Preserved verbatim, including the "PurchaseOrderConsalted"
          // spelling used by the legacy source — the backend report engine
          // matches on this exact string.
          ReportName: "PurchaseOrderConsalted",
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
      // Legacy clears the combo selection unconditionally right after the
      // (synchronous, async:false) $.ajax call returns, win or lose.
      setSelectedSupplier(null);
    }
  }, [fromDate, toDate, selectedSupplier, supplierWise, session, openReportViewer]);

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
              <div className="so-card-header-title">Purchase Order Consolidated</div>
              <button type="button" className="so-close-x" aria-label="Close" onClick={() => navigate(-1)}>✕</button>
            </div>

            <div className="so-card-body">
              <div className="so-report-title">Purchase Order Consolidated - Report</div>

              <div className="so-content">
                {/* ── Left: supplier-wise option ── */}
                <div className="so-left">
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
                  </div>
                </div>

                {/* ── Right: supplier combo + dates ── */}
                <div className="so-right">
                  <div className="so-field">
                    <label className="so-label" htmlFor="poc-supplier">Supplier Name</label>
                    <div className="so-combo" ref={supplierWrapRef}>
                      <input
                        id="poc-supplier"
                        type="text"
                        className="so-input"
                        autoComplete="off"
                        placeholder="Type to search… (optional)"
                        value={supplierSearch}
                        onFocus={() => setSupplierDropdownOpen(true)}
                        onChange={(e) => {
                          setSupplierSearch(e.target.value);
                          setSupplierDropdownOpen(true);
                          // Typing invalidates any previously confirmed selection.
                          if (selectedSupplier) setSelectedSupplier(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") {
                            setSupplierDropdownOpen(false);
                          } else if (e.key === "Enter" && filteredSuppliers.length === 1) {
                            e.preventDefault();
                            const only = filteredSuppliers[0];
                            setSelectedSupplier({ label: only.label, value: only.value });
                            setSupplierDropdownOpen(false);
                          }
                        }}
                      />
                      {supplierDropdownOpen && (
                        <ul className="so-combo-list">
                          {filteredSuppliers.length === 0 ? (
                            <li className="so-combo-empty">No matching suppliers</li>
                          ) : (
                            filteredSuppliers.map((s, idx) => (
                              <li
                                key={s.value ?? `supplier-${idx}`}
                                className="so-combo-item"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  setSelectedSupplier({ label: s.label, value: s.value });
                                  setSupplierDropdownOpen(false);
                                }}
                              >
                                {s.label}
                              </li>
                            ))
                          )}
                        </ul>
                      )}
                    </div>
                  </div>

                  <div className="so-field">
                    <label className="so-label" htmlFor="poc-from-date">From Date</label>
                    <DateFieldDDMMYYYY id="poc-from-date" value={fromDate} onChange={setFromDate} />
                  </div>

                  <div className="so-field">
                    <label className="so-label" htmlFor="poc-to-date">To Date</label>
                    <DateFieldDDMMYYYY id="poc-to-date" value={toDate} onChange={setToDate} />
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