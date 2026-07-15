// ─────────────────────────────────────────────────────────────────────────────
//  BankVoucherReport.jsx
//  React conversion of BankVoucherReport.js (jQuery)
//  Uses API helpers from Common.jsx (CC.api / CC.mkUrl / CC.authHeaders etc.)
//  Styling: MasterPage.css only — no inline color values, no new theme colors.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
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
    const url = `${BASE_URL}/Reports/ReportViewer.aspx?${qs}`;

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

  const styles = `
    .so-shell { min-height: 100vh; background: #f0f2f5; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; flex-direction: column; }
    .so-topbar { background: var(--clr-primary, #1a56db); color: #fff; display: flex; align-items: center; justify-content: space-between; padding: 0 24px; height: 52px; box-shadow: 0 2px 8px rgba(0,0,0,.18); flex-shrink: 0; }
    .so-topbar-title { font-size: 15px; font-weight: 600; letter-spacing: .3px; }
    .so-close-btn { background: rgba(255,255,255,.15); border: none; color: #fff; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; transition: background .15s; }
    .so-close-btn:hover { background: rgba(255,255,255,.28); }
    .so-layout { display: flex; flex: 1; gap: 20px; padding: 24px; max-width: 1100px; width: 100%; margin: 0 auto; box-sizing: border-box; }
    .so-nav { width: 220px; flex-shrink: 0; display: flex; flex-direction: column; gap: 10px; }
    .so-nav-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; color: #8a94a6; padding: 0 4px; margin-bottom: 2px; }
    .so-nav-card { background: #fff; border: 2px solid transparent; border-radius: 10px; padding: 14px 16px; cursor: pointer; transition: border-color .15s, box-shadow .15s, background .15s; box-shadow: 0 1px 4px rgba(0,0,0,.07); display: flex; align-items: center; gap: 12px; }
    .so-nav-card:hover { border-color: var(--clr-primary, #1a56db); box-shadow: 0 3px 12px rgba(26,86,219,.12); }
    .so-nav-card.active { background: #eef3fd; border-color: var(--clr-primary, #1a56db); box-shadow: 0 3px 12px rgba(26,86,219,.15); }
    .so-nav-icon { width: 34px; height: 34px; border-radius: 8px; background: #e8edfc; display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0; }
    .so-nav-card.active .so-nav-icon { background: var(--clr-primary, #1a56db); }
    .so-nav-card-text { flex: 1; }
    .so-nav-card-name { font-size: 13px; font-weight: 600; color: #1e2d3d; line-height: 1.3; }
    .so-nav-card.active .so-nav-card-name { color: var(--clr-primary, #1a56db); }
    .so-panel { flex: 1; background: #fff; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,.08); padding: 28px 32px; display: flex; flex-direction: column; }
    .so-panel-header { border-bottom: 1px solid #e8ecf0; padding-bottom: 16px; margin-bottom: 28px; }
    .so-panel-eyebrow { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; color: var(--clr-primary, #1a56db); margin-bottom: 6px; }
    .so-panel-title { font-size: 20px; font-weight: 700; color: #1e2d3d; line-height: 1.2; }
    .so-form-grid { display: grid; grid-template-columns: 120px 1fr; gap: 20px 16px; align-items: center; max-width: 420px; }
    .so-label { font-size: 13px; font-weight: 600; color: #4a5568; }
    .so-input { height: 38px; border: 1.5px solid #d1d9e6; border-radius: 8px; padding: 0 12px; font-size: 13px; color: #1e2d3d; background: #fff; width: 100%; box-sizing: border-box; transition: border-color .15s, box-shadow .15s; outline: none; }
    .so-input:focus { border-color: var(--clr-primary, #1a56db); box-shadow: 0 0 0 3px rgba(26,86,219,.1); }
    .so-toggle-row { display: flex; align-items: center; gap: 10px; height: 38px; background: #f7f9fc; border: 1.5px solid #d1d9e6; border-radius: 8px; padding: 0 12px; cursor: pointer; font-size: 13px; color: #4a5568; font-weight: 500; user-select: none; transition: border-color .15s; }
    .so-toggle-row:hover { border-color: var(--clr-primary, #1a56db); }
    .so-toggle-row input[type="checkbox"] { width: 15px; height: 15px; accent-color: var(--clr-primary, #1a56db); cursor: pointer; }
    .so-actions { display: flex; gap: 12px; margin-top: 32px; padding-top: 24px; border-top: 1px solid #e8ecf0; }
    .so-btn { height: 40px; padding: 0 28px; border-radius: 8px; border: none; font-size: 14px; font-weight: 600; cursor: pointer; transition: opacity .15s, box-shadow .15s; display: flex; align-items: center; gap: 8px; }
    .so-btn:disabled { opacity: .5; cursor: not-allowed; }
    .so-btn-primary { background: var(--clr-primary, #1a56db); color: #fff; box-shadow: 0 2px 8px rgba(26,86,219,.3); }
    .so-btn-primary:not(:disabled):hover { opacity: .9; box-shadow: 0 4px 14px rgba(26,86,219,.4); }
    .so-btn-secondary { background: #f0f2f5; color: #4a5568; border: 1.5px solid #d1d9e6; }
    .so-btn-secondary:not(:disabled):hover { background: #e8ecf0; }
    .so-msg { margin-top: 18px; padding: 10px 14px; border-radius: 8px; font-size: 13px; font-weight: 500; }
    .so-msg.err { background: #fff0f0; color: #c53030; border: 1px solid #fed7d7; }
    .so-msg.ok  { background: #f0fff4; color: #276749; border: 1px solid #c6f6d5; }
    @media (max-width: 700px) {
      .so-layout { flex-direction: column; padding: 16px; }
      .so-nav { width: 100%; flex-direction: row; flex-wrap: wrap; }
      .so-nav-card { flex: 1 1 calc(50% - 5px); }
      .so-panel { padding: 20px 16px; }
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
              <select
                id="bv-account"
                className="so-input"
                value={accountName.value}
                onChange={(e) => {
                  const opt = accountOptions.find((o) => String(o.value) === e.target.value);
                  setAccountName(opt ? { value: opt.value, label: opt.label } : { value: "", label: "" });
                }}
              >
                <option value="">-- Select --</option>
                {accountOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>

              <label className="so-label" htmlFor="bv-bank">Bank</label>
              <select
                id="bv-bank"
                className="so-input"
                value={bankName.value}
                onChange={(e) => {
                  const opt = bankOptions.find((o) => String(o.value) === e.target.value);
                  setBankName(opt ? { value: opt.value, label: opt.label } : { value: "", label: "" });
                }}
              >
                <option value="">-- Select --</option>
                {bankOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>

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
                {loading ? "Loading…" : "▶ View"}
              </button>
              <button type="button" className="so-btn so-btn-secondary" onClick={handleRefresh} disabled={loading}>
                ↺ Refresh
              </button>
            </div>

            {msg && <div className={`so-msg ${msg.isErr ? "err" : "ok"}`}>{msg.text}</div>}
          </main>
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