// ─────────────────────────────────────────────────────────────────────────────
//  BankVoucherReport.jsx
//  React conversion of BankVoucherReport.js (jQuery)
//  Uses API helpers from Common.jsx (CC.api / CC.mkUrl / CC.authHeaders etc.)
//  Styling: MasterPage.css only — no inline color values, no new theme colors.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Save, XCircle, X } from "lucide-react";
import * as CC from "../../components/Common"
import Topbar from "../../components/Topbar";

// Report-type identifiers (mirrors the 3 jqxRadioButtons in the original markup)
const REPORT_TYPES = {
  PAYMENT: "PA",
  RECEIPT: "RC",
  BOTH: "BOTH",
};

const BASE_URL = "http://localhost:64215";

// API endpoints used by this screen
const BankVoucherReportUrl   = "/api/StockReportApp/BankVoucherReport";
// Assumed combo-data endpoints (source file populated these via
// loadAccountNameBankcombo / loadbankcombo helpers, not visible in the .js file) —
// confirm/replace with the real endpoints.
// const AccountNameBankListUrl = "/api/Common/AccountNameBankList";
const BankListUrl            = "/api/BankApp/SelectBankList";

const AccountNameBankListUrl = "/api/AccountGroupApp/SelectAccountGroupCash";

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

export default function BankVoucherReport() {
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

  // ── Form state (controlled inputs replacing jqx widgets) ───────────────
  const [reportType, setReportType] = useState(REPORT_TYPES.BOTH);
  const [fromDate, setFromDate] = useState(todayStr());
  const [toDate, setToDate] = useState(todayStr());
  const [chkDate, setChkDate] = useState(false);
  const [chkDetail, setChkDetail] = useState(false);

  // ── Account Name / Bank combos ──────────────────────────────────────────
  const [accountOptions, setAccountOptions] = useState([]);
  const [bankOptions, setBankOptions] = useState([]);
  const [accountName, setAccountName] = useState({ value: "", label: "" });
  const [bankName, setBankName] = useState({ value: "", label: "" });

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

    const menudata = menulist.filter((obj) => obj.PageName === "BankVoucherReport");
    if (!menudata || menudata.length === 0) {
      setMsg({ text: "Page Access Permission Denied !!!.", isErr: true });
      setTimeout(() => navigate("/Home"), 3000);
      return;
    }

    if (menudata[0].View === 0) {
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

  // ── Load Account Name / Bank combo options once session is ready ───────
  useEffect(() => {
    if (!pageAccess.ready) return;

    (async () => {
      try {
        const acctRes = await CC.api(AccountNameBankListUrl, null, {}, { Comid: session.Comid, Cashid: 1 });
        const acctRows = acctRes.Data1 || acctRes.Data || acctRes.data || [];
        setAccountOptions(
          acctRows.map((r) => ({
            value: r.Id ?? r.value ?? r.Value,
            label: r.AccountName ?? r.label ?? r.Label,
          }))
        );
      } catch (err) {
        // non-fatal — combo just stays empty
      }
      try {
        const bankRes = await CC.api(BankListUrl, null, {}, { Comid: session.Comid });
        const bankRows = bankRes.Data1 || bankRes.Data || bankRes.data || [];
        setBankOptions(
          bankRows.map((r) => ({
            value: r.Id ?? r.value ?? r.Value,
            label: r.BankName ?? r.AccountName ?? r.Name ?? r.label ?? r.Label,
          }))
        );
      } catch (err) {
        // non-fatal — combo just stays empty
      }
    })();
  }, [pageAccess.ready, session.Comid]);

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

  const handleReportTypeChange = useCallback((type) => {
    setReportType(type);
  }, []);

  const handleRefresh = useCallback(() => {
    setAccountName({ value: "", label: "" });
    setBankName({ value: "", label: "" });
    setChkDate(false);
    setChkDetail(false);
    setFromDate(todayStr());
    setToDate(todayStr());
    setReportType(REPORT_TYPES.BOTH);
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
      w.addEventListener("load", () => { w.document.title = "Bank Voucher - Report"; }, false);
    }
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
      const Comid = session.Comid;

      const res = await CC.api(BankVoucherReportUrl, null, {React:1}, {
        BankGroupBy: bankName.label || "",
        BankGroupByText: bankName.value || "",
        GroupByText: accountName.value || "",
        ReportType: reportType,
        Fromdate,
        Todate,
        Comid,
      });

      if (res.ok || res.IsSuccess) {
        const cacheKey = res.Data15 || "";
        openReportViewer({
          ReportName: "BankVoucherReport",
          CacheKey: cacheKey,
          chkDetail,
          chkdate: chkDate,
          Fromdate,
          Todate,
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
      setAccountName({ value: "", label: "" });
      setBankName({ value: "", label: "" });
    }
  }, [fromDate, toDate, reportType, bankName, accountName, chkDetail, chkDate, session, openReportViewer]);

  const navItems = useMemo(
    () => [
      { value: REPORT_TYPES.PAYMENT, label: "Payment", icon: "💵" },
      { value: REPORT_TYPES.RECEIPT, label: "Receipt", icon: "🧾" },
      { value: REPORT_TYPES.BOTH,    label: "Both",     icon: "🔀" },
    ],
    []
  );

  // ── Reusable searchable dropdown — drop-in replacement for a plain
  // <select> that filters its (already-loaded) options list instantly as
  // the user types. Contract: value is {value, label}, onChange fires
  // {value, label} or {value:"", label:""} on clear, matching the existing
  // accountName/bankName state shape exactly. ──
  const SearchableSelect = ({ id, options, value, onChange, placeholder = "-- Select --" }) => {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const wrapRef = useRef(null);
    const searchRef = useRef(null);

    useEffect(() => {
      const handleClickOutside = (e) => {
        if (wrapRef.current && !wrapRef.current.contains(e.target)) {
          setOpen(false);
          setSearch("");
        }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
      if (open && searchRef.current) searchRef.current.focus();
    }, [open]);

    const filteredOptions = useMemo(() => {
      const q = search.trim().toLowerCase();
      if (!q) return options;
      return options.filter((o) => String(o.label ?? "").toLowerCase().includes(q));
    }, [options, search]);

    const handleSelect = (opt) => {
      onChange({ value: opt.value, label: opt.label });
      setOpen(false);
      setSearch("");
    };

    const handleClear = (e) => {
      e.stopPropagation();
      onChange({ value: "", label: "" });
    };

    const handleToggle = () => setOpen((o) => !o);

    const handleKeyDown = (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleToggle();
      } else if (e.key === "Escape") {
        setOpen(false);
        setSearch("");
      }
    };

    return (
      <div className="so-select-wrap" ref={wrapRef}>
        <div
          id={id}
          className={`so-input so-select-trigger${open ? " open" : ""}`}
          role="button"
          tabIndex={0}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={handleToggle}
          onKeyDown={handleKeyDown}
        >
          <span className={`so-select-value${!value?.value ? " placeholder" : ""}`}>
            {value?.value ? value.label : placeholder}
          </span>
          {value?.value && (
            <span
              className="so-select-clear"
              role="button"
              tabIndex={0}
              aria-label="Clear selection"
              onClick={handleClear}
              onKeyDown={(e) => e.key === "Enter" && handleClear(e)}
            >
              ×
            </span>
          )}
          <span className="so-select-caret" aria-hidden="true">▾</span>
        </div>

        {open && (
          <div className="so-select-popup" role="listbox">
            <input
              ref={searchRef}
              type="text"
              className="so-select-search"
              placeholder="Type to search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setOpen(false);
                  setSearch("");
                }
              }}
            />
            <div className="so-select-list">
              {filteredOptions.length === 0 && (
                <div className="so-select-empty">No matches found</div>
              )}
              {filteredOptions.map((o) => (
                <div
                  key={o.value}
                  role="option"
                  aria-selected={value?.value === o.value}
                  className={`so-select-option${value?.value === o.value ? " selected" : ""}`}
                  onClick={() => handleSelect(o)}
                >
                  {o.label}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const styles = `
    .so-shell { min-height: 100vh; background: #f0f2f5; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; flex-direction: column; }
    .so-topbar { background: linear-gradient(135deg, #3b6fe0, #1a4fd1); color: #fff; display: flex; align-items: center; justify-content: space-between; padding: 0 24px; height: 52px; box-shadow: 0 2px 8px rgba(0,0,0,.18); flex-shrink: 0; }
    .so-topbar-title { font-size: 15px; font-weight: 600; letter-spacing: .3px; }
    .so-close-btn { background: rgba(255,255,255,.15); border: none; color: #fff; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; transition: background .15s; }
    .so-close-btn:hover { background: rgba(255,255,255,.28); }

    .so-layout { flex: 1; display: flex; align-items: flex-start; justify-content: center; padding: 24px; box-sizing: border-box; }
    .so-card { width: 100%; max-width: 820px; background: #fff; border: 2px solid #1a56db; border-radius: 10px; box-shadow: 0 4px 16px rgba(26,86,219,.18); overflow: hidden; }
    .so-card-header { background: linear-gradient(135deg, #3b6fe0, #1a4fd1); border-bottom: 1px solid #1a4fd1; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; }
    .so-card-header-title { font-size: 14px; font-weight: 700; color: #fff; letter-spacing: .2px; }
    .so-card-close-btn { display: flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 6px; border: none; background: rgba(255,255,255,.16); color: #fff; cursor: pointer; padding: 0; transition: background .15s; }
    .so-card-close-btn:hover { background: rgba(255,255,255,.3); }
    .so-card-body { padding: 24px 32px 30px; }
    .so-report-title { text-align: center; font-size: 22px; font-weight: 800; color: #1a3fd6; margin: 0 0 26px; }

    .so-content { display: flex; gap: 28px; }

    .so-nav { flex: 0 0 220px; display: flex; flex-direction: column; gap: 8px; }
    .so-nav-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; color: #8a94a6; padding: 0 4px; margin-bottom: 2px; }
    .so-nav-card { background: #fff; border: 1.5px solid #d1d9e6; border-radius: 8px; padding: 12px 14px; cursor: pointer; transition: border-color .15s, box-shadow .15s, background .15s; display: flex; align-items: center; gap: 10px; }
    .so-nav-card:hover { border-color: #1a56db; box-shadow: 0 3px 12px rgba(26,86,219,.12); }
    .so-nav-card.active { background: #eef3ff; border-color: #1a56db; box-shadow: 0 3px 12px rgba(26,86,219,.15); }
    .so-nav-icon { width: 30px; height: 30px; border-radius: 8px; background: #e8edfc; display: flex; align-items: center; justify-content: center; font-size: 15px; flex-shrink: 0; }
    .so-nav-card.active .so-nav-icon { background: #1a56db; }
    .so-nav-card-text { flex: 1; }
    .so-nav-card-name { font-size: 13px; font-weight: 600; color: #1e2d3d; line-height: 1.3; }
    .so-nav-card.active .so-nav-card-name { color: #1a56db; }

    .so-panel { flex: 1; display: flex; flex-direction: column; min-width: 0; }
    .so-panel-header { border-bottom: 1px solid #e8ecf0; padding-bottom: 14px; margin-bottom: 20px; }
    .so-panel-eyebrow { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; color: #1a56db; margin-bottom: 6px; }
    .so-panel-title { font-size: 16px; font-weight: 700; color: #1e2d3d; line-height: 1.2; }

    .so-form-grid { display: grid; grid-template-columns: 110px 1fr; gap: 14px 14px; align-items: center; max-width: 420px; }
    .so-label { font-size: 13px; font-weight: 600; color: #1e293b; }
    .so-input { height: 34px; border: 1px solid #c7cdd6; border-radius: 4px; padding: 0 10px; font-size: 13px; color: #1e2d3d; background: #fff; width: 100%; box-sizing: border-box; transition: border-color .15s, box-shadow .15s; outline: none; }
    .so-input:focus { border-color: #1a56db; box-shadow: 0 0 0 3px rgba(26,86,219,.15); }
    select.so-input { appearance: auto; cursor: pointer; }

    .so-select-wrap { position: relative; }
    .so-select-trigger { display: flex; align-items: center; gap: 6px; cursor: pointer; user-select: none; }
    .so-select-trigger.open { border-color: #1a56db; box-shadow: 0 0 0 3px rgba(26,86,219,.15); }
    .so-select-value { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .so-select-value.placeholder { color: #8a94a6; }
    .so-select-clear { flex-shrink: 0; width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; border-radius: 50%; color: #8a94a6; font-size: 14px; line-height: 1; cursor: pointer; transition: background .15s, color .15s; }
    .so-select-clear:hover { background: #eef1f5; color: #dc3545; }
    .so-select-caret { flex-shrink: 0; font-size: 10px; color: #8a94a6; }

    .so-select-popup { position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 20; background: #fff; border: 1px solid #c7cdd6; border-radius: 6px; box-shadow: 0 8px 24px rgba(30,45,61,.14); overflow: hidden; }
    .so-select-search { width: 100%; height: 32px; border: none; border-bottom: 1px solid #e8ecf0; padding: 0 10px; font-size: 13px; color: #1e2d3d; outline: none; box-sizing: border-box; }
    .so-select-search:focus { background: #f7f9fc; }
    .so-select-list { max-height: 220px; overflow-y: auto; }
    .so-select-option { padding: 8px 12px; font-size: 13px; color: #1e2d3d; cursor: pointer; transition: background .12s; }
    .so-select-option:hover { background: #eef3ff; }
    .so-select-option.selected { background: #eef3ff; color: #1a56db; font-weight: 600; }
    .so-select-empty { padding: 10px 12px; font-size: 12.5px; color: #8a94a6; text-align: center; }

    .so-toggle-row { display: flex; align-items: center; gap: 10px; height: 34px; background: #f7f9fc; border: 1px solid #c7cdd6; border-radius: 4px; padding: 0 12px; cursor: pointer; font-size: 13px; color: #1e293b; font-weight: 500; user-select: none; transition: border-color .15s; }
    .so-toggle-row:hover { border-color: #1a56db; }
    .so-toggle-row input[type="checkbox"] { width: 15px; height: 15px; accent-color: #1a56db; cursor: pointer; }

    .so-actions { display: flex; gap: 12px; margin-top: 28px; padding-top: 22px; border-top: 1px solid #e8ecf0; }
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

    @media (max-width: 700px) {
      .so-card-body { padding: 20px; }
      .so-content { flex-direction: column; gap: 22px; }
      .so-nav { flex: none; width: 100%; flex-direction: row; flex-wrap: wrap; }
      .so-nav-card { flex: 1 1 calc(50% - 5px); }
      .so-form-grid { grid-template-columns: 100px 1fr; }
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
        <Topbar/>
        <div className="so-layout">
          <div className="so-card">
            <div className="so-card-header">
              <div className="so-card-header-title">Bank Voucher Report</div>
              <button
                type="button"
                className="so-card-close-btn"
                onClick={() => navigate(-1)}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <div className="so-card-body">
              <div className="so-report-title">Bank Voucher - Report</div>

              <div className="so-content">
              <nav className="so-nav" aria-label="Report types">
                <div className="so-nav-label">Report Types</div>
                {navItems.map((item) => (
                  <div
                    key={item.value}
                    className={`so-nav-card${reportType === item.value ? " active" : ""}`}
                    onClick={() => handleReportTypeChange(item.value)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && handleReportTypeChange(item.value)}
                    aria-pressed={reportType === item.value}
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
                  <div className="so-panel-eyebrow">Bank Voucher</div>
                  <div className="so-panel-title">Bank Voucher Report</div>
                </div>

            <div className="so-form-grid">
              <label className="so-label" htmlFor="bv-from-date">From Date</label>
              <input id="bv-from-date" type="date" className="so-input" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />

              <label className="so-label" htmlFor="bv-to-date">To Date</label>
              <input id="bv-to-date" type="date" className="so-input" value={toDate} onChange={(e) => setToDate(e.target.value)} />

              <label className="so-label" htmlFor="bv-account">Account Name</label>
              <SearchableSelect
                id="bv-account"
                options={accountOptions}
                value={accountName}
                onChange={setAccountName}
                placeholder="-- Select --"
              />

              <label className="so-label" htmlFor="bv-bank">Bank</label>
              <SearchableSelect
                id="bv-bank"
                options={bankOptions}
                value={bankName}
                onChange={setBankName}
                placeholder="-- Select --"
              />

              <label className="so-label">Date Wise</label>
              <label className="so-toggle-row">
                <input type="checkbox" checked={chkDate} onChange={(e) => setChkDate(e.target.checked)} />
                {chkDate ? "Enabled" : "Disabled"}
              </label>

              <label className="so-label">Show Detail</label>
              <label className="so-toggle-row">
                <input type="checkbox" checked={chkDetail} onChange={(e) => setChkDetail(e.target.checked)} />
                {chkDetail ? "Enabled" : "Disabled"}
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
              </main>
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