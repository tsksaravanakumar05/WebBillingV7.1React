import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Save, XCircle, Calendar as CalendarIcon } from "lucide-react";
import * as CC from "../../components/Common";
import Topbar from "../../components/Topbar";
import "../Reportstyles.css";

const PurchaseLotReportUrl = "/api/PurchaseApp/SelectPurchaseLot";
const SaleActualLotReportUrl = "/api/SalesReportApp/SaleLotActualReport";

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
            <li className="so-combo-empty">No matching records</li>
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
    return { label: String(label), value: value };
  });

export default function PurchaseLotWise() {
  const navigate = useNavigate();
  const [pageAccess, setPageAccess] = useState({ ready: false, allowed: false, pageview: 0 });
  const [session, setSession] = useState({
    Comid: "",
    MComid: "",
    CName: "",
    CAddress: "",
    CPhone: "",
  });

  const [fromDate, setFromDate] = useState(todayStr());
  const [toDate, setToDate] = useState(todayStr());
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedCashier, setSelectedCashier] = useState(null);
  const [supplierWise, setSupplierWise] = useState(false);
  const [horizontal, setHorizontal] = useState(false);
  const [saleWise, setSaleWise] = useState(false);
  const [consolidate, setConsolidate] = useState(false);

  const [supplierList, setSupplierList] = useState([]);
  const [productList, setProductList] = useState([]);
  const [cashierList, setCashierList] = useState([]);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    const menulist = CC.getLocal("menulist");
    if (menulist == null) {
      setMsg({ text: "Session Close Please Login !!!.", isErr: true });
      navigate("/Login/Index");
      return;
    }

    const menuNames = ["Purchase Lot Wise Report", "Purchase Lot Report", "Purchase Lot Wise-Report"];
    const menudata = menulist.filter((obj) => menuNames.includes(obj.PageName));

    if (!menudata || menudata.length === 0 || menudata[0].View === 0) {
      setMsg({ text: "Page Access Permission Denied !!!.", isErr: true });
      setTimeout(() => navigate("/Login/Home"), 3000);
      return;
    }

    const Comid = CC.getStr("Comid");
    const MComid = CC.getStr("MComid") || Comid;
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

  useEffect(() => {
    if (!pageAccess.ready || !pageAccess.allowed) return;

    let cancelled = false;
    const loadCombos = async () => {
      const supplierComid = session.MComid || session.Comid;
      const productComid = session.MComid || session.Comid;
      const cashierComid = session.Comid;

      const [supplierRes, productRes, cashierRes] = await Promise.all([
        CC.api(CC.GetSupplierAll, null, {}, { Comid: supplierComid, AccountType: "SUPPLIER" }),
        CC.api(CC.GetProductListV7, null, {}, { Comid: productComid }),
        CC.api(CC.CashierSelect, null, {}, { Comid: cashierComid }),
      ]);

      if (cancelled) return;

      setSupplierList(normalize(
        supplierRes?.Data || supplierRes?.data || supplierRes?.Data1 || [],
        ["AccountName", "SupplierName", "Name", "Text"],
        ["Id", "SupplierId", "value", "Value"]
      ));

      setProductList(normalize(
        productRes?.Data || productRes?.data || productRes?.Data1 || [],
        ["ProductName", "PrintName", "Description", "Name", "Text"],
        ["Id", "ProductId", "value", "Value"]
      ));

      setCashierList(normalize(
        cashierRes?.Data || cashierRes?.data || cashierRes?.Data1 || [],
        ["Cashier_Name", "CashierName", "Name", "Text"],
        ["Id", "CashierId", "value", "Value"]
      ));
    };

    loadCombos();
    return () => {
      cancelled = true;
    };
  }, [pageAccess.ready, pageAccess.allowed, session.Comid, session.MComid]);

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
    setSelectedSupplier(null);
    setSelectedProduct(null);
    setSelectedCashier(null);
    setSupplierWise(false);
    setHorizontal(false);
    setSaleWise(false);
    setConsolidate(false);
  }, []);

  const handleView = useCallback(async () => {
    const Fromdate = toMMDDYYYY(fromDate);
    const Todate = toMMDDYYYY(toDate);

    if (new Date(Fromdate) > new Date(Todate)) {
      setMsg({ text: "From Date Is Greater Than To Date!!", isErr: true });
      return;
    }

    const Sid = Number(selectedSupplier?.value || 0);
    const Pid = Number(selectedProduct?.value || 0);
    const CashierId = Number(selectedCashier?.value || 0);
    const SDate = saleWise ? 1 : 0;

    setLoading(true);
    setMsg(null);

    try {
      const res = consolidate
        ? await CC.api(SaleActualLotReportUrl, null, { React: 1 }, {
            Fromdate,
            Todate,
            Comid: session.Comid,
            Supid: Sid,
            Proid: Pid,
          })
        : await CC.api(PurchaseLotReportUrl, null, { React: 1 }, {
            Fromdate,
            Todate,
            Comid: session.Comid,
            Sid,
            Pid,
            SDate,
            CashierId,
          });

      if (res?.ok === true) {
        const cacheKey = res.Data15 || res.data15 || res.data?.Data15 || res.CacheKey || "";
        openReportViewer(
          {
            ReportName: consolidate ? "SaleActualLot" : "PurchaseLot",
            CacheKey: cacheKey,
            Fromdate,
            Todate,
            Sid,
            Pid,
            CashierId,
            SDate,
            Horizontal: horizontal,
            SupplierWise: supplierWise,
            SaleWise: saleWise,
            Consolidate: consolidate,
            CName: session.CName || localStorage.getItem("CompanyName") || "",
            CAddress: session.CAddress || localStorage.getItem("Address") || "",
            CPhone: session.CPhone || localStorage.getItem("Phone") || "",
          },
          consolidate ? "Sale Actual Lot-Report" : "Purchase Lot Wise-Report"
        );
      } else {
        setMsg({ text: res?.message || "No Record !!!.", isErr: true });
      }
    } catch (err) {
      setMsg({ text: err.message || "Something went wrong.", isErr: true });
    } finally {
      setLoading(false);
    }
  }, [
    consolidate,
    fromDate,
    horizontal,
    openReportViewer,
    saleWise,
    selectedCashier,
    selectedProduct,
    selectedSupplier,
    session.CAddress,
    session.CName,
    session.CPhone,
    session.Comid,
    supplierWise,
    toDate,
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
    <div className="so-shell">
      <Topbar />
      <div className="so-layout">
        <div className="so-card so-card-wide">
          <div className="so-card-header">
            <div className="so-card-header-title">Purchase Lot Wise</div>
            <button type="button" className="so-close-x" aria-label="Close" onClick={() => navigate(-1)}>x</button>
          </div>

          <div className="so-card-body">
            <div className="so-report-title">Purchase Lot Wise - Report</div>

            <div className="so-content">
              <div className="so-left">
                <div className="so-basis-row">
                  <label className="so-checkbox">
                    <input type="checkbox" checked={consolidate} onChange={(e) => setConsolidate(e.target.checked)} />
                    <span className="so-checkbox-box">
                      <svg viewBox="0 0 24 24" fill="none" stroke="var(--clr-text-white)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                    Consolidate
                  </label>
                </div>

                <div className="so-basis-row">
                  <label className="so-checkbox">
                    <input type="checkbox" checked={horizontal} onChange={(e) => setHorizontal(e.target.checked)} />
                    <span className="so-checkbox-box">
                      <svg viewBox="0 0 24 24" fill="none" stroke="var(--clr-text-white)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                    Horizontal
                  </label>
                </div>

                <div className="so-basis-row">
                  <label className="so-checkbox">
                    <input type="checkbox" checked={saleWise} onChange={(e) => setSaleWise(e.target.checked)} />
                    <span className="so-checkbox-box">
                      <svg viewBox="0 0 24 24" fill="none" stroke="var(--clr-text-white)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                    Sale Wise
                  </label>
                </div>

                <div className="so-basis-row">
                  <label className="so-checkbox">
                    <input type="checkbox" checked={supplierWise} onChange={(e) => setSupplierWise(e.target.checked)} />
                    <span className="so-checkbox-box">
                      <svg viewBox="0 0 24 24" fill="none" stroke="var(--clr-text-white)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                    Supplier Wise Group Order
                  </label>
                </div>
              </div>

              <div className="so-right">
                <div className="so-field">
                  <label className="so-label" htmlFor="plw-cashier">Cashier Name</label>
                  <SearchCombo
                    id="plw-cashier"
                    list={cashierList}
                    selected={selectedCashier}
                    onSelect={setSelectedCashier}
                    placeholder="Type to search cashier..."
                  />
                </div>

                <div className="so-field">
                  <label className="so-label" htmlFor="plw-supplier">Supplier Name</label>
                  <SearchCombo
                    id="plw-supplier"
                    list={supplierList}
                    selected={selectedSupplier}
                    onSelect={setSelectedSupplier}
                    placeholder="Type to search supplier..."
                  />
                </div>

                <div className="so-field">
                  <label className="so-label" htmlFor="plw-product">Product Name</label>
                  <SearchCombo
                    id="plw-product"
                    list={productList}
                    selected={selectedProduct}
                    onSelect={setSelectedProduct}
                    placeholder="Type to search product..."
                  />
                </div>

                <div className="so-field">
                  <label className="so-label" htmlFor="plw-from-date">From Date</label>
                  <DateFieldDDMMYYYY id="plw-from-date" value={fromDate} onChange={setFromDate} />
                </div>

                <div className="so-field">
                  <label className="so-label" htmlFor="plw-to-date">To Date</label>
                  <DateFieldDDMMYYYY id="plw-to-date" value={toDate} onChange={setToDate} />
                </div>
              </div>
            </div>

            <div className="so-actions">
              <button type="button" className="mp-btn nw" disabled={loading || pageAccess.pageview === 0} onClick={handleView}>
                <Save size={16} className="so-icon-save" />
                {loading ? "Loading..." : "View"}
              </button>
              <button type="button" className="mp-btn dl" onClick={handleRefresh} disabled={loading}>
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
  );
}
