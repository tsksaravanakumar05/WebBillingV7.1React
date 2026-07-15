// ─────────────────────────────────────────────────────────────────────────────
//  LedgerStatment.jsx
//  React conversion of ledgerStatment.js (jQuery) — "Ledger Statement Report"
//  Uses API helpers from Common.jsx (CC.api / CC.mkUrl / CC.authHeaders etc.)
//  Styling: same shell/patterns as BankBook.jsx — no inline color values,
//  no new theme colors.
//
//  NOTE: like BankBook.jsx, this legacy screen has no report-type radio
//  buttons — it's a single "Ledger Statement" report, so the left nav-card
//  report-type picker is omitted here (not invented).
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import * as CC from "../../components/Common";
import Topbar from "../../components/Topbar";

const BASE_URL = "http://localhost:64215";
///AccountGroup/SelectAccountGroupCash
// API endpoint used by this screen (kept exactly as the legacy jQuery file had
// it — MVC action route "/Stock/LedgerStatementReport", not the "/api/..."
// convention used by newer report screens like BankBookReport; confirm with
// the backend whether it should be migrated).
const LedgerStatementReportUrl = "/api/StockReportApp/LedgerStatementReport";
///Bank/SelectBankList
// The legacy file loads the account combo via a shared
// `loadAccountNameBankcombo("#cmbAccountName", 1)` helper defined outside
// ledgerStatment.js itself (not present in the source file we converted).
// This endpoint is our best-effort match to that helper's data source,
// following the same /api/StockReportApp/... convention as BankBook.jsx's
// bank list — please confirm with the backend.
const AccountListUrl = "/api/AccountGroupApp/SelectAccountGroupCash";

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

export default function LedgerStatment() {
  const navigate = useNavigate();

  // ── Session / permission state ─────────────────────────────────────────
  const [pageAccess, setPageAccess] = useState({
    ready: false,
    allowed: false,
    pageview: 0,
  });

  // ── Company / settings state (loaded once from localStorage, same as jQuery) ──
  // NOTE: unlike BankBook.jsx, the legacy ledgerStatment.js *actively uses*
  // the CommonCompany swap (Comid = MComid when CommonCompany === "true"),
  // it was not commented out in the source file — preserved as live logic
  // here, not disabled.
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

  // Account Name combo (#cmbAccountName in the legacy markup) — replaces
  // jqxComboBox with a type-to-filter combobox (input + filtered dropdown).
  // Each option carries both label and value, since the legacy handler reads
  // item.label (GroupBy — sent to the report viewer URL) and item.value
  // (GroupByText — sent to the ajax API) separately.
  const [accountList, setAccountList] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null); // { label, value } | null
  const [accountSearch, setAccountSearch] = useState("");
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
  const accountWrapRef = useRef(null);

  // ── UI feedback state ───────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null); // { text, isErr }

  // Filtered options as the user types — matches on label (account name).
  const filteredAccounts = useMemo(() => {
    const q = (accountSearch || "").trim().toLowerCase();
    if (!q) return accountList;
    return accountList.filter((a) => String(a.label ?? "").toLowerCase().includes(q));
  }, [accountList, accountSearch]);

  // Keep the visible text in sync with the confirmed selection — covers both
  // a user picking an option and selectedAccount being cleared elsewhere
  // (handleRefresh, handleView's finally block).
  useEffect(() => {
    setAccountSearch(selectedAccount?.label ?? "");
  }, [selectedAccount]);

  // Close the account combobox dropdown when clicking outside it.
  useEffect(() => {
    const onDocMouseDown = (e) => {
      if (accountWrapRef.current && !accountWrapRef.current.contains(e.target)) {
        setAccountDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  useEffect(() => {
    const menulist = CC.getLocal("menulist");
  
    // Debug: இதை ஒரு தடவை பாத்து menulist-ல என்ன இருக்குனு confirm பண்ணுங்க
    console.log("menulist from localStorage:", menulist);
  
    // null-ஆ இருந்தாலும், empty array-ஆ இருந்தாலும் இரண்டையும் catch பண்ணும்
    if (!menulist || menulist.length === 0) {
      setMsg({ text: "Session Close Please Login !!!.", isErr: true });
      navigate("/Login/Index");
      return;
    }
  
    const menudata = menulist.filter((obj) => obj.PageName === "Ledger Statement");
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

    let Comid = CC.getStr("Comid");
    const MComid = CC.getStr("MComid");
    const CommonCompany = CC.getStr("CommonCompany");
    // Preserved live from legacy source (not commented out there):
    if (CommonCompany === "true") {
      Comid = MComid;
    }
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

  // Loads the account combo once page access is granted — replaces the
  // legacy `loadAccountNameBankcombo("#cmbAccountName", 1)` call made from
  // methods.load().


  useEffect(() => {
    if (!pageAccess.ready || !pageAccess.allowed) return;
    if (!session.Comid) return;
  
    let cancelled = false;
  
    const loadAccounts = async () => {
      try {
        const comid = Number(session.Comid);
        const cashid = 0; // <-- தேவையான Cash Id கொடுங்க
  
        const url = `${AccountListUrl}?Comid=${comid}&Cashid=${cashid}`;
  
        const res = await CC.api(url); // no body needed, params are in the query string
  
        if (res?.IsSuccess === false) {
          if (!cancelled) {
            setMsg({
              text: res.Message || "Unable to load account list.",
              isErr: true,
            });
          }
          return;
        }
  
        console.log("Response :", res);
  
        const rawList = res?.Data ?? res?.Data1 ?? [];
  
        const normalized = (Array.isArray(rawList) ? rawList : []).map((item) => ({
          label:
            item.AccountGroupName ??
            item.AccountName ??
            item.BankName ??
            item.Name ??
            item.Text ??
            "",
          value:
            item.Id ??
            item.AccountGroupId ??
            item.AccountId ??
            item.BankId ??
            "",
        }));
  
        if (!cancelled) {
          setAccountList(normalized);
        }
      } catch (err) {
        if (!cancelled) {
          setMsg({
            text: err.message || "Unable to load account list.",
            isErr: true,
          });
        }
      }
    };
  
    loadAccounts();
  
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
    // Matches the legacy #btnrefresh handler, which only clears the account
    // combo selection — the date pickers were merely re-initialised with the
    // same format string, not reset to a new value.
    setSelectedAccount(null);
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
      w.addEventListener("load", () => { w.document.title = "Ledger Statement-Report"; }, false);
    }
  }, []);

  const handleView = useCallback(async () => {
    // Legacy: reads item.label into GroupBy (sent to the report viewer URL)
    // and item.value into GroupByText (the ajax API param, sent as
    // "GroupByName") — preserved as-is, including the distinct usage of each.
    if (!selectedAccount) {
      setMsg({ text: "Please Select  Account Name !!!.", isErr: true });
      return;
    }
    const GroupBy = selectedAccount.label;
    const GroupByText = selectedAccount.value;
    if (GroupByText == null || GroupByText === "") {
      setMsg({ text: "Please Select Valid Account Name !!!.", isErr: true });
      setSelectedAccount(null);
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
      // Legacy body: {"GroupByName": GroupByText, "Fromdate", "Todate", "Comid"}
      const res = await CC.api(LedgerStatementReportUrl, null, { React:1}, {
        GroupByName: GroupByText,
        Fromdate,
        Todate,
        Comid: session.Comid,
      });
      if (res.ok === true) {
        const cacheKey = res.Data15 || "";
        openReportViewer({          
          ReportName: "LedgerStatementReport",
          CacheKey: cacheKey,
          GroupBy,
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
      setMsg({ text: "Technical Fault Contact Software Vendor  !!!.", isErr: true });
    } finally {
      setLoading(false);
      // Legacy clears the combo selection unconditionally right after the
      // (synchronous, async:false) $.ajax call returns, win or lose.
      setSelectedAccount(null);
    }
  }, [fromDate, toDate, selectedAccount, session, openReportViewer]);

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
              <div className="so-panel-eyebrow">Ledger Statement</div>
              <div className="so-panel-title">Ledger Statement Report</div>
            </div>

            <div className="so-form-grid">
              <label className="so-label" htmlFor="ls-account">Account Name</label>
              <div className="so-combo" ref={accountWrapRef}>
                <input
                  id="ls-account"
                  type="text"
                  className="so-input"
                  autoComplete="off"
                  placeholder="Type to search account…"
                  value={accountSearch}
                  onFocus={() => setAccountDropdownOpen(true)}
                  onChange={(e) => {
                    setAccountSearch(e.target.value);
                    setAccountDropdownOpen(true);
                    // Typing invalidates any previously confirmed selection —
                    // handleView's "!selectedAccount" check then correctly
                    // blocks submitting free text that was never actually chosen.
                    if (selectedAccount) setSelectedAccount(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setAccountDropdownOpen(false);
                    } else if (e.key === "Enter" && filteredAccounts.length === 1) {
                      e.preventDefault();
                      const only = filteredAccounts[0];
                      setSelectedAccount({ label: only.label, value: only.value });
                      setAccountDropdownOpen(false);
                    }
                  }}
                />
                {accountDropdownOpen && (
                  <ul className="so-combo-list">
                    {filteredAccounts.length === 0 ? (
                      <li className="so-combo-empty">No matching accounts</li>
                    ) : (
                      filteredAccounts.map((a, idx) => (
                        <li
                          key={a.value ?? `account-${idx}`}
                          className="so-combo-item"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setSelectedAccount({ label: a.label, value: a.value });
                            setAccountDropdownOpen(false);
                          }}
                        >
                          {a.label}
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </div>

              <label className="so-label" htmlFor="ls-from-date">From Date</label>
              <input id="ls-from-date" type="date" className="so-input" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />

              <label className="so-label" htmlFor="ls-to-date">To Date</label>
              <input id="ls-to-date" type="date" className="so-input" value={toDate} onChange={(e) => setToDate(e.target.value)} />
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