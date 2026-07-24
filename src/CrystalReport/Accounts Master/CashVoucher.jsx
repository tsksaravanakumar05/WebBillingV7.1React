// ─────────────────────────────────────────────────────────────────────────────
//  CashVoucherReport.jsx
//  React conversion of CashVoucherReport.js (jQuery) — "Cash Voucher Report"
//  Uses API helpers from Common.jsx (CC.api / CC.mkUrl / CC.authHeaders etc.)
//  Styling: MasterPage.css only — no inline color values, no new theme colors.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Save, XCircle, X } from "lucide-react";
import * as CC from "../../components/Common"
import Topbar from "../../components/Topbar";
import   DateFieldDDMMYYYY from "../../Commondatetime";

// Report-type identifiers (mirrors the 3 jqxRadioButtons in the original markup)
const REPORT_TYPES = {
  PAYMENT: "PA",
  RECEIPT: "RC",
  BOTH: "BOTH",
};
//api/AccountGroupApp/SelectAccountGroupCash

const BASE_URL = "http://localhost:64215";

// API endpoint used by this screen (kept exactly as the legacy jQuery file had it —
// note it does not follow the /api/... convention used by newer report screens;
// confirm with the backend whether it should be migrated).
const CashVoucherReportUrl = "/api/StockReportApp/CashVoucherReport";
const SelectAccountGroupCash = "/api/AccountGroupApp/SelectAccountGroupCash";
// RESOLVED: the legacy loadAccountNameBankcombo() merges two real endpoints
// (confirmed in Common.jsx) into one dropdown — Customer + Supplier ledger
// accounts, plus the Bank master list — rather than a single
// "/api/Common/AccountNameBank" endpoint, which does not exist on the
// backend (see CC.GetSupplierAll / CC.BankAllSelect below).

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

export default function CashVoucherReport() {
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
  const [reportType, setReportType] = useState(REPORT_TYPES.BOTH);
  const [fromDate, setFromDate] = useState(todayStr());
  const [toDate, setToDate] = useState(todayStr());
  const [chkDate, setChkDate] = useState(false);

  // ── Account Name combo (was jqxComboBox #cmbaccountname) ────────────────
  const [accountOptions, setAccountOptions] = useState([]);
  const [accountName, setAccountName] = useState("");

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

    const menudata = menulist.filter((obj) => obj.PageName === "CashVoucherReport");
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
    const CommonCompany = CC.getStr("CommonCompany");
    const ComSet = CC.getLocal("Companysetting") || [{}];

    // NOTE: the original file has this reassignment commented out
    // (if (CommonCompany == "true") { Comid = MComid; }) — left disabled
    // here too, matching the source. Uncomment if that behaviour is wanted.
    // const effectiveComid = CommonCompany === "true" ? MComid : Comid;

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

  // Load Account Name / Bank combo options once page access is confirmed.
  // Mirrors the legacy loadAccountNameBankcombo(): a cash voucher can be
  // paid to / received from a Customer, a Supplier, or a Bank, so we merge
  // all three lists into a single dropdown, same as the old jqxComboBox did.
  //
  // NOTE: accountName is sent verbatim as GroupByText to CashVoucherReport
  // (see handleView below), so option `value` must be the account/bank
  // NAME text itself — not a Code/Id — matching what the legacy combo passed.
  useEffect(() => {
    if (!pageAccess.ready || !pageAccess.allowed) return;
  
    let cancelled = false;
  
    (async () => {
      try {
        const res = await CC.api(
          SelectAccountGroupCash,
          null,
          {},
          { Comid: session.Comid, Cashid: 1 }
        );
  
        if (cancelled) return;
  
        if (res.ok !== false) {
          setAccountOptions(CC.extractComboList(res));
        }
      } catch (err) {
        console.error(err);
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

  const handleReportTypeChange = useCallback((type) => {
    setReportType(type);
  }, []);

  const handleRefresh = useCallback(() => {
    setAccountName("");
    setChkDate(false);
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
      w.addEventListener("load", () => { w.document.title = "Cash Voucher - Report"; }, false);
    }
  }, []);

  const handleView = useCallback(async () => {
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

    setLoading(true);
    setMsg(null);

    try {
      const res = await CC.api(CashVoucherReportUrl, null, {React:1}, {
        
        GroupByText: accountName,
        ReportType: reportType,
        Fromdate,
        Todate,
        Comid: session.Comid,
      });

      if (res.ok || res.IsSuccess) {
        // ASSUMPTION: kept for parity with the CacheKey convention shared by
        // other report screens. The legacy CashVoucherReport.js response only
        // checked data.ok and never referenced a cache key — confirm whether
        // the backend for this endpoint actually returns Data15.
        const cacheKey = res.Data15 || "";
        openReportViewer({
          ReportName: "CashVoucherReport",
          CacheKey: cacheKey,
          chkdate: chkDate,
          Fromdate,
          Todate,
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
      setAccountName("");
    }
  }, [fromDate, toDate, reportType, accountName, chkDate, session, openReportViewer]);

  const navItems = useMemo(
    () => [
      { value: REPORT_TYPES.BOTH, label: "Both", icon: "🧾" },
      { value: REPORT_TYPES.PAYMENT, label: "Payment", icon: "📤" },
      { value: REPORT_TYPES.RECEIPT, label: "Receipt", icon: "📥" },
    ],
    []
  );

  // Same fallback field lookups used by the original <option> rendering,
  // factored out so the searchable list can filter/display consistently.
  const getAccountValue = (opt) => opt.AccountName ?? opt.value ?? opt.Value ?? "";
  const getAccountLabel = (opt) => opt.AccountName ?? opt.label ?? opt.Label ?? opt.text ?? opt.Text ?? "";

  // Account Name combo (Customer + Supplier + Bank merged list) — now a
  // searchable popup instead of a plain <select>, since this list can be
  // long. Keeps the same contract as before: `value` is the plain account
  // name string, `onChange` receives that string directly.
  const AccountSelect = ({ options, value, onChange, placeholder }) => {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const boxRef = useRef(null);
    const searchRef = useRef(null);

    useEffect(() => {
      if (!open) return;
      const handleClickOutside = (e) => {
        if (boxRef.current && !boxRef.current.contains(e.target)) {
          setOpen(false);
        }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [open]);

    useEffect(() => {
      if (open) {
        setSearch("");
        setTimeout(() => searchRef.current?.focus(), 0);
      }
    }, [open]);

    const filteredOptions = useMemo(() => {
      const q = search.trim().toLowerCase();
      if (!q) return options;
      return options.filter((o) => getAccountLabel(o).toLowerCase().includes(q));
    }, [options, search]);

    const currentLabel = useMemo(() => {
      if (!value) return "";
      const match = options.find((o) => getAccountValue(o) === value);
      return match ? getAccountLabel(match) : value;
    }, [options, value]);

    const handlePick = (opt) => {
      onChange(opt ? getAccountValue(opt) : "");
      setOpen(false);
    };

    return (
      <div className="so-combo" ref={boxRef}>
        <button
          type="button"
          className="so-input so-combo-toggle"
          onClick={() => setOpen((o) => !o)}
        >
          <span className={`so-combo-value${currentLabel ? "" : " ph"}`}>
            {currentLabel || placeholder}
          </span>
          <span className="so-combo-caret" aria-hidden="true">▾</span>
        </button>

        {open && (
          <div className="so-combo-panel">
            <input
              ref={searchRef}
              type="text"
              className="so-combo-search"
              placeholder="Type to search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setOpen(false);
                if (e.key === "Enter" && filteredOptions.length === 1) handlePick(filteredOptions[0]);
              }}
            />
            <ul className="so-combo-list" role="listbox">
              <li
                className={`so-combo-option so-combo-clear${!value ? " active" : ""}`}
                onClick={() => handlePick(null)}
              >
                {placeholder}
              </li>
              {filteredOptions.length === 0 && (
                <li className="so-combo-empty">No matches found</li>
              )}
              {filteredOptions.map((o, idx) => (
                <li
                  key={getAccountValue(o) || idx}
                  className={`so-combo-option${value === getAccountValue(o) ? " active" : ""}`}
                  onClick={() => handlePick(o)}
                  role="option"
                  aria-selected={value === getAccountValue(o)}
                >
                  {getAccountLabel(o)}
                </li>
              ))}
            </ul>
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

    .so-combo { position: relative; }
    .so-combo-toggle { display: flex; align-items: center; justify-content: space-between; gap: 8px; text-align: left; cursor: pointer; }
    .so-combo-toggle:disabled { cursor: not-allowed; opacity: .65; }
    .so-combo-value { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #1e2d3d; }
    .so-combo-value.ph { color: #8492a6; }
    .so-combo-caret { flex-shrink: 0; font-size: 10px; color: #8492a6; }
    .so-combo-panel { position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 30; background: #fff; border: 1px solid #1a56db; border-radius: 6px; box-shadow: 0 8px 24px rgba(26,86,219,.18); overflow: hidden; }
    .so-combo-search { width: 100%; height: 32px; border: none; border-bottom: 1px solid #e8ecf0; padding: 0 10px; font-size: 13px; color: #1e2d3d; box-sizing: border-box; outline: none; background: #f8fafc; }
    .so-combo-search:focus { background: #eef3ff; }
    .so-combo-list { list-style: none; margin: 0; padding: 4px 0; max-height: 220px; overflow-y: auto; }
    .so-combo-option { padding: 7px 12px; font-size: 13px; color: #1e2d3d; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .so-combo-option:hover { background: #eef3ff; }
    .so-combo-option.active { background: #e3ecff; color: #1a4fd1; font-weight: 600; }
    .so-combo-option.so-combo-clear { color: #8492a6; font-style: italic; border-bottom: 1px solid #e8ecf0; margin-bottom: 2px; }
    .so-combo-empty { padding: 10px 12px; font-size: 12.5px; color: #8492a6; text-align: center; }

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
              <div className="so-card-header-title">Cash Voucher Report</div>
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
              <div className="so-report-title">Cash Voucher - Report</div>

              <div className="so-content">
              <nav className="so-nav" aria-label="Report types">
                <div className="so-nav-label">Voucher Type</div>
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
                  <div className="so-panel-eyebrow">Cash Voucher</div>
                  <div className="so-panel-title">Cash Voucher Report</div>
                </div>

            <div className="so-form-grid">
              <label className="so-label" htmlFor="cv-account">Account Name</label>
              <AccountSelect
                options={accountOptions}
                value={accountName}
                onChange={(v) => setAccountName(v || "")}
                placeholder="-- All --"
              />

              <label className="so-label" htmlFor="cv-from-date">From Date</label>
              <DateFieldDDMMYYYY id="pri-from-date" value={fromDate} onChange={setFromDate} />

              <label className="so-label" htmlFor="cv-to-date">To Date</label>
              <DateFieldDDMMYYYY id="pri-to-date" value={toDate} onChange={setToDate} />

              <label className="so-label">Date Wise</label>
              <label className="so-toggle-row">
                <input type="checkbox" checked={chkDate} onChange={(e) => setChkDate(e.target.checked)} />
                {chkDate ? "Enabled" : "Disabled"}
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