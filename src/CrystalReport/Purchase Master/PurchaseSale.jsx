import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Save, XCircle, Calendar as CalendarIcon } from "lucide-react";
import * as CC from "../../components/Common";
import Topbar from "../../components/Topbar";
import "../Reportstyles.css";

const PurchaseSaleReportUrl = "/api/PurchaseReportApp/PurchaseSaleReport";

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

const pad2 = (n) => String(n).padStart(2, "0");

const parseIsoDate = (iso) => {
  if (!iso) return { d: "", m: "", y: "" };
  const [y, m, d] = iso.split("-");
  return { d: d || "", m: m || "", y: y || "" };
};

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

  useEffect(() => {
    const p = parseIsoDate(value);
    setDay(p.d);
    setMonth(p.m);
    setYear(p.y);
  }, [value]);

  const commitIfValid = useCallback((d, m, y) => {
    if (isValidDMY(d, m, y)) {
      onChange(`${y}-${pad2(parseInt(m, 10))}-${pad2(parseInt(d, 10))}`);
    }
  }, [onChange]);

  const handleDayChange = (e) => {
    const v = e.target.value.replace(/\D/g, "").slice(0, 2);
    setDay(v);
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
      if (segment === "month") {
        dayRef.current?.focus();
        dayRef.current?.select();
      }
      if (segment === "year") {
        monthRef.current?.focus();
        monthRef.current?.select();
      }
    } else if (e.key === "ArrowLeft" && atStart) {
      if (segment === "month") dayRef.current?.focus();
      if (segment === "year") monthRef.current?.focus();
    } else if (e.key === "ArrowRight" && atEnd) {
      if (segment === "day") monthRef.current?.focus();
      if (segment === "month") yearRef.current?.focus();
    }
  };

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
      }
    }
    el.focus();
  };

  return (
    <div className={`so-date-wrap${disabled ? " so-date-wrap-disabled" : ""}`}>
      <div className="so-date-segments">
        <input id={id} ref={dayRef} type="text" inputMode="numeric" autoComplete="off" placeholder="DD" maxLength={2} className="so-date-seg so-date-seg-dd" value={day} disabled={disabled} onChange={handleDayChange} onKeyDown={handleSegmentKeyDown("day")} onFocus={(e) => e.target.select()} />
        <span className="so-date-sep">-</span>
        <input ref={monthRef} type="text" inputMode="numeric" autoComplete="off" placeholder="MM" maxLength={2} className="so-date-seg so-date-seg-mm" value={month} disabled={disabled} onChange={handleMonthChange} onKeyDown={handleSegmentKeyDown("month")} onFocus={(e) => e.target.select()} />
        <span className="so-date-sep">-</span>
        <input ref={yearRef} type="text" inputMode="numeric" autoComplete="off" placeholder="YYYY" maxLength={4} className="so-date-seg so-date-seg-yyyy" value={year} disabled={disabled} onChange={handleYearChange} onKeyDown={handleSegmentKeyDown("year")} onFocus={(e) => e.target.select()} />
      </div>

      <button type="button" className="so-date-icon-btn" onClick={openPicker} disabled={disabled} tabIndex={-1} aria-label="Open calendar picker">
        <CalendarIcon size={15} />
      </button>

      <input ref={nativeRef} type="date" className="so-date-native-hidden" value={value || ""} onChange={handleNativePickerChange} tabIndex={-1} aria-hidden="true" disabled={disabled} />
    </div>
  );
}

function SearchCombo({ id, list, selected, onSelect, placeholder, disabled }) {
  const [search, setSearch] = useState(selected?.label ?? "");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    setSearch(selected?.label ?? "");
  }, [selected]);

  useEffect(() => {
    const onDocMouseDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
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
        placeholder={placeholder}
        disabled={disabled}
        value={search}
        onFocus={() => !disabled && setOpen(true)}
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
            onSelect(filtered[0]);
            setOpen(false);
          }
        }}
      />
      {open && !disabled && (
        <ul className="so-combo-list">
          {filtered.length === 0 ? (
            <li className="so-combo-empty">No matching suppliers</li>
          ) : (
            filtered.map((item, idx) => (
              <li
                key={item.value ?? `opt-${idx}`}
                className="so-combo-item"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(item);
                  setOpen(false);
                }}
              >
                {item.label}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

const normalize = (rawList, labelKeys, valueKeys) =>
  (Array.isArray(rawList) ? rawList : []).map((item) => {
    let label = "";
    for (const key of labelKeys) {
      if (item[key] != null && item[key] !== "") {
        label = item[key];
        break;
      }
    }
    let value = "";
    for (const key of valueKeys) {
      if (item[key] != null && item[key] !== "") {
        value = item[key];
        break;
      }
    }
    return { label: String(label), value };
  });

const toBool = (value) =>
  value === true || value === 1 || value === "1" || String(value).toLowerCase() === "true";

export default function PurchaseSale() {
  const navigate = useNavigate();
  
  useEffect(() => {
    document.title = "PurchaseSale-Kassapos";
  }, []);
  const [pageAccess, setPageAccess] = useState({ ready: false, allowed: false, pageview: 0 });
  const [session, setSession] = useState({
    Comid: "",
    MComid: "",
    CName: "",
    CAddress: "",
    CPhone: "",
    CMBTPatty: false,
  });
  const [fromDate, setFromDate] = useState(todayStr());
  const [toDate, setToDate] = useState(todayStr());
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [supplierWise, setSupplierWise] = useState(false);
  const [daily, setDaily] = useState(false);
  const [saleType, setSaleType] = useState("BOTH");
  const [supplierList, setSupplierList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    const menulist = CC.getLocal("menulist");
    if (menulist == null) {
      setMsg({ text: "Session Close Please Login !!!.", isErr: true });
      navigate("/Login/Index");
      return;
    }

    const menudata = menulist.filter((obj) => obj.PageName === "Purchase Sale Report");
    if (!menudata || menudata.length === 0 || menudata[0].View === 0) {
      setMsg({ text: "Page Access Permission Denied !!!.", isErr: true });
      setTimeout(() => navigate("/dashboard"), 3000);
      return;
    }

    const Comid = CC.getStr("Comid");
    const MComid = CC.getStr("MComid") || Comid;
    const ComSet = CC.getLocal("Companysetting") || [{}];
    const MainSet = CC.getLocal("Mainsetting") || [{}];
    const main0 = MainSet[0] || {};

    setSession({
      Comid,
      MComid,
      CName: ComSet[0]?.CName || "",
      CAddress: ComSet[0]?.CAddress || "",
      CPhone: ComSet[0]?.CPhone || "",
      CMBTPatty: toBool(main0.CMBTPatty),
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

  useEffect(() => {
    if (!pageAccess.ready || !pageAccess.allowed) return;
    let cancelled = false;

    const loadSuppliers = async () => {
      const res = await CC.api(CC.GetSupplierAll, null, {}, {
        Comid: session.MComid || session.Comid,
        AccountType: "SUPPLIER",
      });
      if (cancelled) return;
      setSupplierList(normalize(
        res?.Data || res?.data || res?.Data1 || [],
        ["AccountName", "SupplierName", "Name", "Text"],
        ["Id", "SupplierId", "value", "Value"]
      ));
    };

    loadSuppliers();
    return () => {
      cancelled = true;
    };
  }, [pageAccess.ready, pageAccess.allowed, session.Comid, session.MComid]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.keyCode === 27) {
        e.preventDefault();
        navigate("/dashboard");
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [navigate]);

  const openReportViewer = useCallback((params, title) => {
    const qs = new URLSearchParams(params).toString();
    const url = `${CC.BASE_URL}/Reports/ReportViewer.aspx?${qs}`;
    const w = window.open(
      url,
      "_blank",
      `directories=0,titlebar=0,toolbar=0,location=0,status=0,` +
      `menubar=0,scrollbars=yes,resizable=no,` +
      `width=${screen.width},height=${screen.height - 100}`
    );
    if (w && title) {
      w.addEventListener("load", () => { w.document.title = title; }, false);
    }
  }, []);

  const handleRefresh = useCallback(() => {
    setFromDate(todayStr());
    setToDate(todayStr());
    setSelectedSupplier(null);
    setSupplierWise(false);
    setDaily(false);
    setSaleType("BOTH");
    setMsg(null);
  }, []);

  const handleView = useCallback(async () => {
    const Fromdate = toMMDDYYYY(fromDate);
    const Todate = toMMDDYYYY(toDate);

    if (new Date(Fromdate) > new Date(Todate)) {
      setMsg({ text: "From Date Is Greater Than To Date!!", isErr: true });
      return;
    }

    setLoading(true);
    setMsg(null);

    try {
      const res = await CC.api(
        PurchaseSaleReportUrl,
        null,
        { React: 1, Patty: session.CMBTPatty ? 1 : 0 },
        {
          Fromdate,
          Todate,
          Comid: session.Comid,
        }
      );

      if (res?.ok === true || res?.IsSuccess === true) {
        const cacheKey = res.Data15 || res.data15 || res.data?.Data15 || res.CacheKey || "";
        openReportViewer(
          {
            ReportName: "PurchaseSale",
            CacheKey: cacheKey,
            Fromdate,
            Todate,
            GroupBy: selectedSupplier?.value || "",
            ReportType: saleType,
            SupplierWise: supplierWise,
            Daily: daily,
            CName: session.CName || localStorage.getItem("CompanyName") || "",
            CAddress: session.CAddress || localStorage.getItem("Address") || "",
            CPhone: session.CPhone || localStorage.getItem("Phone") || "",
          },
          "Purchase Sale - Report"
        );
      } else {
        setMsg({ text: res?.message || "No Record !!!.", isErr: true });
      }
    } catch (err) {
      setMsg({ text: err.message || "Something went wrong.", isErr: true });
    } finally {
      setLoading(false);
      setSelectedSupplier(null);
    }
  }, [
    daily,
    fromDate,
    openReportViewer,
    saleType,
    selectedSupplier,
    session.CAddress,
    session.CMBTPatty,
    session.CName,
    session.CPhone,
    session.Comid,
    supplierWise,
    toDate,
  ]);

  if (!pageAccess.ready) {
    return (
      <>
        <Topbar />
        <div className="salebill-loading">Loading...</div>
      </>
    );
  }

  return (
    <>
      <Topbar />
      <div className="so-shell">
        <div className="so-wrap">
          <div className="so-card">
            <div className="so-titlebar">
              <div>
                <h1 className="so-title">Purchase Sale Report</h1>
                <p className="so-subtitle">Legacy purchase-sale report converted with the same crystal report open flow.</p>
              </div>
            </div>

            {msg?.text && (
              <div className={`so-alert ${msg.isErr ? "so-alert-err" : "so-alert-ok"}`}>
                {msg.text}
              </div>
            )}

            <div className="so-grid">
              <div className="so-field">
                <label className="so-label" htmlFor="ps-fromdate">From Date</label>
                <DateFieldDDMMYYYY id="ps-fromdate" value={fromDate} onChange={setFromDate} disabled={loading} />
              </div>

              <div className="so-field">
                <label className="so-label" htmlFor="ps-todate">To Date</label>
                <DateFieldDDMMYYYY id="ps-todate" value={toDate} onChange={setToDate} disabled={loading} />
              </div>

              <div className="so-field so-field-span-2">
                <label className="so-label" htmlFor="ps-supplier">Supplier Name</label>
                <SearchCombo
                  id="ps-supplier"
                  list={supplierList}
                  selected={selectedSupplier}
                  onSelect={setSelectedSupplier}
                  placeholder="Optional supplier"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="so-options">
              <label className="so-check">
                <input type="checkbox" checked={supplierWise} onChange={(e) => setSupplierWise(e.target.checked)} disabled={loading} />
                Supplier Wise Group Order
              </label>
              <label className="so-check">
                <input type="checkbox" checked={daily} onChange={(e) => setDaily(e.target.checked)} disabled={loading} />
                Daily
              </label>
            </div>

            <div className="so-radio-row">
              <label className="so-radio">
                <input type="radio" name="purchase-sale-type" checked={saleType === "CA"} onChange={() => setSaleType("CA")} disabled={loading} />
                Cash
              </label>
              <label className="so-radio">
                <input type="radio" name="purchase-sale-type" checked={saleType === "CR"} onChange={() => setSaleType("CR")} disabled={loading} />
                Credit
              </label>
              <label className="so-radio">
                <input type="radio" name="purchase-sale-type" checked={saleType === "BOTH"} onChange={() => setSaleType("BOTH")} disabled={loading} />
                Both
              </label>
            </div>

            <div className="so-inline-note">
              <span>Backend API uses date range + company only.</span>
              <span>Other options are kept for old-form parity.</span>
            </div>

            <div className="so-actions">
              <button type="button" className="mp-btn nw" onClick={handleView} disabled={loading}>
                <Save size={16} />
                {loading ? "Processing..." : "View"}
              </button>
              <button type="button" className="mp-btn dl" onClick={handleRefresh} disabled={loading}>
                <XCircle size={16} />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
