// ─────────────────────────────────────────────────────────────────────────────
//  BankBook.jsx
//  React conversion of BankBook.js (jQuery) — "Bank Book Report"
//  Uses API helpers from Common.jsx (CC.api / CC.mkUrl / CC.authHeaders etc.)
//  Styling: MasterPage.css only — no inline color values, no new theme colors.
//
//  NOTE: unlike SaleOrder/BankVoucher/CashVoucher, this legacy screen has no
//  report-type radio buttons — it's a single "Bank Book" report, so the
//  left nav-card report-type picker is omitted here (not invented), same
//  as CashBook.jsx.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import * as CC from "../../components/Common";
import Topbar from "../../components/Topbar";

const BASE_URL = "http://localhost:64215";

// API endpoint used by this screen (kept exactly as the legacy jQuery file had it —
// MVC action route, not the /api/... convention used by newer report screens;
// confirm with the backend whether it should be migrated).
const BankBookReportUrl = "/api/StockReportApp/BankBookReport";

// The legacy file loads the bank combo via a shared `loadbankcombo("#cmbbank")`
// helper defined outside BankBook.js itself (not present in the source file
// we converted). This endpoint is our best-effort match to that helper's data
// source, following the same /api/StockReportApp/... convention as the report
// endpoint above — please confirm with the backend.
const BankListUrl = "/api/BankApp/SelectBankList";

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

export default function BankBook() {
  const navigate = useNavigate();

  // ── Session / permission state ─────────────────────────────────────────
  const [pageAccess, setPageAccess] = useState({
    ready: false,
    allowed: false,
    pageview: 0,
  });

  // ── Company / settings state (loaded once from localStorage, same as jQuery) ──
  // NOTE: CommonCompany is read from localStorage in the legacy file the same
  // way Comid/MComid are, but the CommonComid-swap logic under it was already
  // commented out in the legacy source — carried over here commented out too,
  // rather than dropped or silently enabled.
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

  // Bank combo (#cmbbank in the legacy markup) — replaces jqxComboBox with a
  // type-to-filter combobox (input + filtered dropdown). Each option carries
  // both label and value, since the legacy handler reads item.label
  // (GroupBy, unused beyond assignment) and item.value (GroupByText, sent to
  // the API) separately.
  const [bankList, setBankList] = useState([]);
  const [selectedBank, setSelectedBank] = useState(null); // { label, value } | null
  const [bankSearch, setBankSearch] = useState("");
  const [bankDropdownOpen, setBankDropdownOpen] = useState(false);
  const bankWrapRef = useRef(null);

  // ── UI feedback state ───────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null); // { text, isErr }

  // Filtered options as the user types — matches on label (bank name).
  const filteredBanks = useMemo(() => {
    const q = (bankSearch || "").trim().toLowerCase();
    if (!q) return bankList;
    return bankList.filter((b) => String(b.label ?? "").toLowerCase().includes(q));
  }, [bankList, bankSearch]);

  // Keep the visible text in sync with the confirmed selection — covers both
  // a user picking an option and selectedBank being cleared elsewhere
  // (handleRefresh, handleView's finally block).
  useEffect(() => {
    setBankSearch(selectedBank?.label ?? "");
  }, [selectedBank]);

  // Close the bank combobox dropdown when clicking outside it.
  useEffect(() => {
    const onDocMouseDown = (e) => {
      if (bankWrapRef.current && !bankWrapRef.current.contains(e.target)) {
        setBankDropdownOpen(false);
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

    const menudata = menulist.filter((obj) => obj.PageName === "BankBook");
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
    // if (CommonCompany == "true") {
    //   Comid = MComid;
    // }
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

  // Loads the bank combo once page access is granted — replaces the legacy
  // `loadbankcombo("#cmbbank")` call made from methods.load().
  useEffect(() => {
    if (!pageAccess.ready || !pageAccess.allowed) return;
    if (!session.Comid) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await CC.api(BankListUrl, null, {}, { Comid: session.Comid });

        if (res?.IsSuccess === false) {
          if (!cancelled) setMsg({ text: res.Message || "Unable to load bank list.", isErr: true });
          return;
        }
        console.log(res);
        const rawList = res?.Data || res?.data || res?.Data1 || [];

        // Debug: uncomment this once to see the exact field names your API
        // returns, then adjust the candidate keys below to match.
        // console.log("Raw bank list from API:", rawList);

        // Normalize whatever shape the backend actually sends into the
        // { label, value } shape this component uses everywhere else.
        // This was the real bug: the API almost certainly returns objects
        // like { BankId, BankName } (or similar), not { label, value }, so
        // b.label / b.value were undefined — items rendered but with blank
        // text, which is exactly the "white box, no visible data" symptom.
        const normalized = (Array.isArray(rawList) ? rawList : []).map((b) => ({
          label:  b.AccountName ?? b.label ?? b.Label ?? b.BankName ?? b.Bankname ?? b.Name ?? b.Text ?? "",
          value: b.value ?? b.Value ?? b.BankId ?? b.Bankid ?? b.Id ?? b.BankCode ?? "",
        }));

        if (!cancelled) setBankList(normalized);
      } catch (err) {
        if (!cancelled) setMsg({ text: err.message || "Unable to load bank list.", isErr: true });
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

  const handleRefresh = useCallback(() => {
    // Matches the legacy #btnrefresh handler, which only clears the bank
    // combo selection — the date pickers were merely re-initialised with the
    // same format string, not reset to a new value.
    setSelectedBank(null);
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
      w.addEventListener("load", () => { w.document.title = "Bank Book -Report"; }, false);
    }
  }, []);

  const handleView = useCallback(async () => {
    // Legacy: reads item.label into GroupBy (never sent to the API) and
    // item.value into GroupByText (the actual API param) — preserved as-is.
    if (!selectedBank) {
      setMsg({ text: "Please Select  Bank Name !!!.", isErr: true });
      return;
    }
    const GroupBy = selectedBank.label;
    const GroupByText = selectedBank.value;
    if (GroupByText == null || GroupByText === "") {
      setMsg({ text: "Please Select Valid Bank Name !!!.", isErr: true });
      setSelectedBank(null);
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
      const res = await CC.api(BankBookReportUrl, null, { React: 1 }, {
        GroupByText,
        Fromdate,
        Todate,
        Comid: session.Comid,
      });
      if (res.ok === true || res.IsSuccess === true) {
        const cacheKey = res.Data15 || "";
        openReportViewer({
            
          ReportName: "BankBookReport",
          // was: cacheKey (undefined in this scope) — the cache key comes
          // back from the WebAPI response (ro.Data15) when React=1.
          CacheKey:cacheKey ,
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
      // Legacy clears the combo selection unconditionally right after the
      // (synchronous, async:false) $.ajax call returns, win or lose.
      setSelectedBank(null);
    }
  }, [fromDate, toDate, selectedBank, session, openReportViewer]);

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
    .so-select { height: 38px; border: 1.5px solid #d1d9e6; border-radius: 8px; padding: 0 12px; font-size: 13px; color: #1e2d3d; background: #fff; width: 100%; box-sizing: border-box; transition: border-color .15s, box-shadow .15s; outline: none; cursor: pointer; }
    .so-select:focus { border-color: var(--clr-primary, #1a56db); box-shadow: 0 0 0 3px rgba(26,86,219,.1); }
    .so-combo { position: relative; }
    .so-combo-list { position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 20; margin: 0; padding: 4px; list-style: none; max-height: 220px; overflow-y: auto; background: #fff; border: 1.5px solid #d1d9e6; border-radius: 8px; box-shadow: 0 6px 20px rgba(0,0,0,.12); }
    .so-combo-item { padding: 8px 10px; font-size: 13px; color: #1e2d3d; border-radius: 6px; cursor: pointer; }
    .so-combo-item:hover { background: #f0f2f5; }
    .so-combo-empty { padding: 8px 10px; font-size: 13px; color: #4a5568; }
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
        <Topbar />
        <div className="so-layout">
          <main className="so-panel">
            <div className="so-panel-header">
              <div className="so-panel-eyebrow">Bank Book</div>
              <div className="so-panel-title">Bank Book Report</div>
            </div>

            <div className="so-form-grid">
              <label className="so-label" htmlFor="bb-bank">Bank Name</label>
              <div className="so-combo" ref={bankWrapRef}>
                <input
                  id="bb-bank"
                  type="text"
                  className="so-input"
                  autoComplete="off"
                  placeholder="Type to search bank…"
                  value={bankSearch}
                  onFocus={() => setBankDropdownOpen(true)}
                  onChange={(e) => {
                    setBankSearch(e.target.value);
                    setBankDropdownOpen(true);
                    // Typing invalidates any previously confirmed selection —
                    // handleView's "!selectedBank" check then correctly blocks
                    // submitting free text that was never actually chosen.
                    if (selectedBank) setSelectedBank(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setBankDropdownOpen(false);
                    } else if (e.key === "Enter" && filteredBanks.length === 1) {
                      e.preventDefault();
                      const only = filteredBanks[0];
                      setSelectedBank({ label: only.label, value: only.value });
                      setBankDropdownOpen(false);
                    }
                  }}
                />
{bankDropdownOpen && (
                  <ul className="so-combo-list">
                    {filteredBanks.length === 0 ? (
                      <li className="so-combo-empty">No matching banks</li>
                    ) : (
                      filteredBanks.map((b, idx) => (
                        <li
                          key={b.value ?? `bank-${idx}`}
                          className="so-combo-item"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setSelectedBank({ label: b.label, value: b.value });
                            setBankDropdownOpen(false);
                          }}
                        >
                          {b.label}
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </div>

              <label className="so-label" htmlFor="bb-from-date">From Date</label>
              <input id="bb-from-date" type="date" className="so-input" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />

              <label className="so-label" htmlFor="bb-to-date">To Date</label>
              <input id="bb-to-date" type="date" className="so-input" value={toDate} onChange={(e) => setToDate(e.target.value)} />
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