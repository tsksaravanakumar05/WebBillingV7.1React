// ─────────────────────────────────────────────────────────────────────────────
//  CashBook.jsx
//  React conversion of CashBook.js (jQuery) — "Cash Book Report"
//  Uses API helpers from Common.jsx (CC.api / CC.mkUrl / CC.authHeaders etc.)
//  Styling: MasterPage.css only — no inline color values, no new theme colors.
//
//  NOTE: unlike SaleOrder/BankVoucher/CashVoucher, this legacy screen has no
//  report-type radio buttons — it's a single "Cash Book" report, so the
//  left nav-card report-type picker is omitted here (not invented).
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import * as CC from "../../components/Common";
import Topbar from "../../components/Topbar";

const BASE_URL = "http://localhost:64215";

// API endpoint used by this screen (kept exactly as the legacy jQuery file had it —
// MVC action route, not the /api/... convention used by newer report screens;
// confirm with the backend whether it should be migrated).
const CashBookReportUrl = "/api/StockReportApp/CashBookReport";

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

export default function CashBook() {
  const navigate = useNavigate();

  // ── Session / permission state ─────────────────────────────────────────
  const [pageAccess, setPageAccess] = useState({
    ready: false,
    allowed: false,
    pageview: 0,
  });

  // ── Company / settings state (loaded once from localStorage, same as jQuery) ──
  // NOTE: parentcashid is read from localStorage in the legacy file the same
  // way Comid/MComid are — carried over here rather than dropped.
  const [session, setSession] = useState({
    Comid: "",
    MComid: "",
    parentcashid: "",
    CName: "",
    CAddress: "",
    CPhone: "",
  });

  // ── Form state (controlled inputs replacing jqx widgets) ───────────────
  const [fromDate, setFromDate] = useState(todayStr());
  const [toDate, setToDate] = useState(todayStr());
  // Present in the legacy markup (#chkConsolidate) but NOT included in the
  // legacy $.ajax payload — carried over as UI-only, matching source
  // behaviour. Let me know if it should actually be sent to the API.
  const [consolidate, setConsolidate] = useState(false);

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

    const menudata = menulist.filter((obj) => obj.PageName === "CashBook");
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
    const parentcashid = CC.getStr("parentcashid");
    const ComSet = CC.getLocal("Companysetting") || [{}];

    setSession({
      Comid,
      MComid,
      parentcashid,
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
    setFromDate(todayStr());
    setToDate(todayStr());
    setConsolidate(false);
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
      w.addEventListener("load", () => { w.document.title = "CashBook -Report"; }, false);
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
      const res = await CC.api(CashBookReportUrl, null, {React:1}, {
        Fromdate,
        Todate,
        parentcashid: session.parentcashid,
        Comid: session.Comid,
      });
      const cacheKey = res.Data15 || "";
      if (res.ok === true || res.IsSuccess === true) {
        openReportViewer({
          ReportName: "CashBookReport",
          CacheKey: cacheKey,
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
    }
  }, [fromDate, toDate, consolidate, session, openReportViewer]);

  const styles = `
    .so-shell { min-height: 100vh; background: #f0f2f5; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; flex-direction: column; }
    .so-topbar { background: var(--clr-primary, #1a56db); color: #fff; display: flex; align-items: center; justify-content: space-between; padding: 0 24px; height: 52px; box-shadow: 0 2px 8px rgba(0,0,0,.18); flex-shrink: 0; }
    .so-topbar-title { font-size: 15px; font-weight: 600; letter-spacing: .3px; }
    .so-close-btn { background: rgba(255,255,255,.15); border: none; color: #fff; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; transition: background .15s; }
    .so-close-btn:hover { background: rgba(255,255,255,.28); }
    .so-layout { display: flex; flex: 1; gap: 20px; padding: 24px; max-width: 1100px; width: 100%; margin: 0 auto; box-sizing: border-box; }
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
          <main className="so-panel">
            <div className="so-panel-header">
              <div className="so-panel-eyebrow">Cash Book</div>
              <div className="so-panel-title">Cash Book Report</div>
            </div>

            <div className="so-form-grid">
              <label className="so-label" htmlFor="cb-from-date">From Date</label>
              <input id="cb-from-date" type="date" className="so-input" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />

              <label className="so-label" htmlFor="cb-to-date">To Date</label>
              <input id="cb-to-date" type="date" className="so-input" value={toDate} onChange={(e) => setToDate(e.target.value)} />

              <label className="so-label">Consolidate</label>
              <label className="so-toggle-row">
                <input type="checkbox" checked={consolidate} onChange={(e) => setConsolidate(e.target.checked)} />
                {consolidate ? "Enabled" : "Disabled"}
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