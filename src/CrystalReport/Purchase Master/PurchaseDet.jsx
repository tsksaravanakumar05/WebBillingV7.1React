// ─────────────────────────────────────────────────────────────────────────────
//  PurchaseDet.jsx
//  React conversion of PurchaseDet.js (jQuery) — "Purchase Detailed Report"
//  Uses API helpers from Common.jsx (CC.api / CC.mkUrl / CC.authHeaders etc.)
//  Styling: same "so-*" design system introduced in BankBook.jsx — no inline
//  color values, no new theme colors, same card / form-grid / button language.
//
//  NOTE: unlike BankBook, this legacy screen has a Report-Type radio group
//  (Cash / Credit / Both), a Supplier combo that is OPTIONAL (not required
//  to run the report), and two extra flags — SupplierWise / Daily — carried
//  as checkboxes. Supplier selection is preserved exactly as optional, same
//  as the legacy jqxComboBox behaviour (GroupBy stays "" when nothing is
//  picked; only an item with a null/empty value is treated as an error).
//  This screen is functionally near-identical to PurConsolidated.jsx, with
//  three legacy differences preserved exactly: the report endpoint/name,
//  the "Item Name" wording on the combo-validation error, and MComid being
//  included in the POST body (the legacy PurchaseDet.js sends MComid; the
//  Purchase Consolidated screen does not).
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Save, XCircle, Calendar as CalendarIcon } from "lucide-react";
import * as CC from "../../components/Common";
import Topbar from "../../components/Topbar";
import "../Reportstyles.css";
const BASE_URL = "http://localhost:64215";

// API endpoint used by this screen (kept exactly as the legacy jQuery file had it —
// MVC action route, not the /api/... convention used by newer report screens;
// confirm with the backend whether it should be migrated).
const PurchaseDetailedReportUrl = "/api/PurchaseReportApp/PurchaseBillDetailsReport";

// The legacy file loads the supplier combo via a shared `loadsuppliercombo("#cmbsupplier")`
// helper defined outside PurchaseDet.js itself (not present in the source file
// we converted). This endpoint is our best-effort match to that helper's data
// source, following the same /api/...App/... convention as BankListUrl in
// BankBook.jsx — please confirm with the backend.
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
// Replaces reliance on native <input type="date"> text-editing (whose typing
// order/cursor behaviour follows the browser/OS locale — e.g. MM-DD-YYYY —
// and can't be overridden with CSS). Three real segment inputs (DD / MM /
// YYYY) give full control over typing, auto-advance, backspace and arrow-key
// navigation, always in DD-MM-YYYY order regardless of browser locale.
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

export default function PurchaseDet() {
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

  // Report type (#rbtcash / #rbtcredit / #rbtboth) — legacy defaults to
  // "both" checked on load (methods.load()), preserved here as initial state.
  const [reportType, setReportType] = useState("BOTH"); // "CA" | "CR" | "BOTH"

  // Supplier-wise / Daily flags (#chksupplier / #chkdaily).
  const [supplierWise, setSupplierWise] = useState(false);
  const [daily, setDaily] = useState(false);

  // Supplier combo (#cmbsupplier in the legacy markup) — replaces jqxComboBox
  // with a type-to-filter combobox (input + filtered dropdown), same pattern
  // as the bank combo in BankBook.jsx. Unlike BankBook, selecting a supplier
  // is OPTIONAL — GroupBy is simply "" when nothing is chosen.
  const [supplierList, setSupplierList] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState(null); // { label, value } | null
  const [supplierSearch, setSupplierSearch] = useState("");
  const [supplierDropdownOpen, setSupplierDropdownOpen] = useState(false);
  const supplierWrapRef = useRef(null);

  // ── UI feedback state ───────────────────────────────────────────────────
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

  useEffect(() => {
    const menulist = CC.getLocal("menulist");
    if (menulist == null) {
      setMsg({ text: "Session Close Please Login !!!.", isErr: true });
      navigate("/Login/Index");
      return;
    }

    const menudata = menulist.filter((obj) => obj.PageName === "Purchase Detailed");
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

  // Loads the supplier combo once page access is granted — replaces the
  // legacy `loadsuppliercombo("#cmbsupplier")` call made from methods.load().
  useEffect(() => {
    if (!pageAccess.ready || !pageAccess.allowed) return;
    if (!session.Comid) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await CC.api(SupplierListUrl, null, {}, { Comid: session.Comid,AccountType: "SUPPLIER", });

        if (res?.IsSuccess === false) {
          if (!cancelled) setMsg({ text: res.Message || "Unable to load supplier list.", isErr: true });
          return;
        }

        const rawList = res?.Data || res?.data || res?.Data1 || [];

        // Normalize whatever shape the backend actually sends into the
        // { label, value } shape this component uses everywhere else.
        const normalized = (Array.isArray(rawList) ? rawList : []).map((s) => ({
         label:
          s.AccountName ??
          s.AccountType ??
          s.SupplierName ??
          s.label ??
          s.Label ??
          s.Name ??
          s.Text ??
          "",
          value: s.value ?? s.Value ?? s.SupplierId ?? s.Supplierid ?? s.Id ?? s.SupplierCode ?? "",
        }));

        if (!cancelled) setSupplierList(normalized);
      } catch (err) {
        if (!cancelled) setMsg({ text: err.message || "Unable to load supplier list.", isErr: true });
      }
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

  // Matches the legacy #btnrefresh handler: clears the supplier combo
  // selection, unchecks Daily / Supplier-wise, and resets the report-type
  // radios back to "Both" (the date pickers were merely re-initialised with
  // the same format string in the legacy code, not reset to a new value).
  const handleRefresh = useCallback(() => {
    setSelectedSupplier(null);
    setDaily(false);
    setSupplierWise(false);
    setReportType("BOTH");
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
      w.addEventListener("load", () => { w.document.title = "Purchase Detail-Report"; }, false);
    }
  }, []);

  const handleView = useCallback(async () => {
    // Legacy: GroupBy stays "" when no supplier is selected — the combo is
    // optional here, unlike BankBook. If a selection exists but its value is
    // somehow null/empty, that's treated as an error, same as the jQuery.
    let GroupBy = "";
    if (selectedSupplier) {
      GroupBy = selectedSupplier.value;
      if (GroupBy == null || GroupBy === "") {
        setMsg({ text: "Please Select Valid Item Name !!!.", isErr: true });
        setSelectedSupplier(null);
        return;
      }
    }

    const RptType = reportType; // "CA" | "CR" | "BOTH"

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
      const res = await CC.api(PurchaseDetailedReportUrl, null, {React:1}, {
        GroupBy,
        ReportType: RptType,
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
          ReportName: "PurchaseDetailed",
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
  }, [fromDate, toDate, reportType, supplierWise, daily, selectedSupplier, session, openReportViewer]);

  // ── Design system: colors sourced from global --clr-* variables (MasterPage.css) ──
  //   Border / header / heading -> var(--clr-primary) / var(--clr-primary-dark)
  //   Save-style accents        -> var(--clr-green)
  //   Cancel / link accents     -> var(--clr-danger)


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
              <div className="so-report-title">Purchase Bill Detailed Report</div>

              <div className="so-content">
                {/* ── Left: report type + options (design only, same reportType/supplierWise/daily state) ── */}
                <div className="so-left">
                  <label className="so-radio-row">
                    <input
                      type="radio"
                      name="pd-report-type"
                      checked={reportType === "CA"}
                      onChange={() => setReportType("CA")}
                    />
                    Cash
                  </label>
                  <label className="so-radio-row">
                    <input
                      type="radio"
                      name="pd-report-type"
                      checked={reportType === "CR"}
                      onChange={() => setReportType("CR")}
                    />
                    Credit
                  </label>
                  <label className="so-radio-row">
                    <input
                      type="radio"
                      name="pd-report-type"
                      checked={reportType === "BOTH"}
                      onChange={() => setReportType("BOTH")}
                    />
                    Both
                  </label>

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
                    <div className="so-combo" ref={supplierWrapRef}>
                      <input
                        id="pd-supplier"
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