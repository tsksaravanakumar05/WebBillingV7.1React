// ─────────────────────────────────────────────────────────────────────────────
//  CustomerReceipt.jsx
//  React conversion of customerreceipt.js (jQuery / jqxWidgets) — "Customer Receipts"
//  Design/template copied from BranchWise.jsx (card + left/right two-column
//  panel, same "so-"-style token values, renamed to a unique "cr-" prefix).
//  Logic ported 1:1 from customerreceipt.js — see inline notes for the few
//  quirks preserved exactly (do not "fix"):
//
//  1) The permission/menulist check block in customerreceipt.js is ACTIVE
//     (unlike BranchWise.js where it's commented out), so this page DOES
//     gate on "Customer Receipts" page access — ported from the standard
//     bootstrap pattern (ClosingStock/SaleOrder), not skipped.
//  2) Only the Customer combo selection is cleared after every View click
//     (`$("#cmbcustomer").jqxComboBox('clearSelection')` runs right after
//     the synchronous $.ajax call, regardless of success/failure). The
//     Salesman combo, radios and checkboxes are left as-is. Preserved.
//  3) Customer selection is OPTIONAL — GroupByText only gets validated if a
//     customer item is actually selected (`getSelectedItem() != null`);
//     leaving the combo empty is a valid "no filter" state. Preserved.
//  4) Salesman "SSId" defaults to 0 when no salesman is selected. Preserved.
//  5) ReportName is sent as "CustomerReceieptReport" (misspelled exactly
//     like this in the source window.open call) — preserved verbatim since
//     it is almost certainly what the backend report route expects.
//  6) Refresh resets rbtboth to checked (the only rbt default in the
//     source) and clears both combos + all four checkboxes. The source only
//     re-inits the date pickers' formatString without pinning a value; this
//     port resets both dates back to today, matching the convention used by
//     every other converted page (flagged as an assumption below).
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Save, XCircle } from "lucide-react";
import * as CC from "../../components/Common";
import Topbar from "../../components/Topbar";

const BASE_URL = "http://localhost:64215";

// ── API endpoints ───────────────────────────────────────────────────────────
// Report endpoint: original path "/SalesReport/CustomerReceiptReport" mapped
// to the app's Web API layer following the same "/api/SalesReportApp/..."
// convention already established by BranchWise.jsx's BranchWiseReportUrl.
const CustomerReceiptReportUrl = "/api/SalesReportApp/CustomerReceiptReport";

// NOTE (assumption — please verify): the source calls a local
// CustomerComboListSingle("#cmbcustomer", true, "CUSTOMER") helper whose real
// endpoint wasn't provided. Reusing the same account-lookup endpoint/payload
// shape already established for Supplier in ClosingStock.jsx, swapping
// AccountType to "CUSTOMER".
const CustomerListUrl = "/api/SupplierApp/SelectSupplier";

// NOTE (assumption — please verify): loadSalesMancombo("#cmbsalesman") has no
// known real endpoint either; named following the same <Thing>ListUrl
// convention used elsewhere.
const SalesmanListUrl = "/api/SalesmanApp/SelectSalesman";

// ── Report-type identifiers (mirrors rbtcash / rbtcredit / rbtboth) ────────
const RPT_TYPE = {
  CASH: "CA",
  CREDIT: "CR",
  BOTH: "BOTH",
};

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

export default function CustomerReceipt() {
  const navigate = useNavigate();

  // ── Session / permission state (ported from the active menulist check) ──
  const [pageAccess, setPageAccess] = useState({
    ready: false,
    allowed: false,
    pageview: 0,
  });

  const [session, setSession] = useState({
    Comid: "",
    MComid: "",
    CName: "",
    CAddress: "",
    CPhone: "",
  });

  // ── Form state (controlled inputs replacing jqx widgets) ───────────────
  const [rptType, setRptType] = useState(RPT_TYPE.BOTH); // rbtboth checked by default
  const [customerSel, setCustomerSel] = useState(null); // cmbcustomer
  const [salesmanSel, setSalesmanSel] = useState(null); // cmbsalesman
  const [fromDate, setFromDate] = useState(todayStr());
  const [toDate, setToDate] = useState(todayStr());

  // chkcustomer / chksalesman / chkdaily / chkNarration
  const [chkCustomerWise, setChkCustomerWise] = useState(false);
  const [chkSalesmanWise, setChkSalesmanWise] = useState(false);
  const [chkDaily, setChkDaily] = useState(false);
  const [chkNarration, setChkNarration] = useState(false);

  // ── UI feedback state ───────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null); // { text, isErr }

  // ── Bootstrap: permission + session, mirrors top of $(document).ready ──
  useEffect(() => {
    const menulist = CC.getLocal("menulist");
    if (menulist == null) {
      setMsg({ text: "Session Close Please Login !!!.", isErr: true });
      navigate("/Login/Index");
      return;
    }

    const menudata = menulist.filter((obj) => obj.PageName === "Customer Receipts");
    if (!menudata || menudata.length === 0) {
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

  // ── Esc key — "Do you want to quit page?" (same app-wide convention) ────
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
    setCustomerSel(null);
    setSalesmanSel(null);
    setChkSalesmanWise(false);
    setChkDaily(false);
    setChkCustomerWise(false);
    setChkNarration(false);
    setFromDate(todayStr());
    setToDate(todayStr());
    setRptType(RPT_TYPE.BOTH); // rbtboth checked, rbtcash/rbtcredit unchecked
    setMsg(null);
  }, []);

  const openReportViewer = useCallback((params) => {
    const qs = new URLSearchParams(params).toString();
    const url = `${BASE_URL}/Reports/ReportViewer.aspx?${qs}`;

    window.open(
      url,
      "_blank",
      `directories=0,titlebar=0,toolbar=0,location=0,status=0,` +
        `menubar=0,scrollbars=yes,resizable=no,` +
        `width=${screen.width},height=${screen.height - 100}`
    );
  }, []);

  // ── View button — replicates the customerreceipt.js $.ajax logic exactly ──
  const handleView = useCallback(async () => {
    // ── Customer is OPTIONAL: only validated if something is selected ──
    let GroupByText = "";
    if (customerSel != null) {
      GroupByText = customerSel.label;
      if (GroupByText == null) {
        setMsg({ text: "Please Select Valid Customer Name !!!.", isErr: true });
        setCustomerSel(null);
        return;
      }
    }

    // ── Salesman defaults to 0 when nothing selected ──
    let ssid = 0;
    if (salesmanSel != null) {
      ssid = salesmanSel.value;
    }

    const RptType = rptType;

    const Fromdate = toMMDDYYYY(fromDate);
    const Todate = toMMDDYYYY(toDate);

    if (new Date(Fromdate) > new Date(Todate)) {
      setMsg({ text: "From Date Is Greater Than To Date!!", isErr: true });
      return;
    }

    const CustomerWise = chkCustomerWise;
    const Daily = chkDaily;
    const Narration = chkNarration;
    const Salesmanwise = chkSalesmanWise;

    setLoading(true);
    setMsg(null);

    try {
      const res = await CC.api(
        CustomerReceiptReportUrl,
        null,
        { CacheKeyType: "CustomerReceiptReport", React: 1 },
        {
          GroupBy: GroupByText,
          ReportType: RptType,
          Fromdate, Todate,
          Comid: session.Comid,
          MComid: session.MComid,       // 👈 சேருங்க
          Daily: Daily ? "true" : "false",
CustomerWise: CustomerWise ? "true" : "false",
Narration: Narration ? "true" : "false",
Salesmanwise: Salesmanwise ? "true" : "false",
          SSId: ssid,
        }
      );

      if (res?.ok || res?.IsSuccess) {
        const cacheKey = res.Data15 || res.CacheKey || "";
        openReportViewer({
          ReportName: "CustomerReceieptReport", // verbatim spelling from source
          CacheKey: cacheKey,
          CustomerWise,
          Daily,
          Salesmanwise,
          Narration,
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
      // Source only clears the customer combo after View — salesman, radios
      // and checkboxes are intentionally left untouched. Preserved.
      setCustomerSel(null);
    }
  }, [
    rptType,
    customerSel,
    salesmanSel,
    fromDate,
    toDate,
    chkCustomerWise,
    chkSalesmanWise,
    chkDaily,
    chkNarration,
    session,
    openReportViewer,
  ]);

  // ── Reusable combo, same fetch/normalize pattern as the template ───────
  const ApiSelect = ({ url, payload, headers = {}, labelKey, valueKey, value, onChange, placeholder }) => {
    const [list, setList] = useState([]);
    const [loadingList, setLoadingList] = useState(false);

    useEffect(() => {
      let active = true;
      (async () => {
        setLoadingList(true);
        try {
          const res = await CC.api(url, null, headers, payload);
          if (!active) return;
          const raw = Array.isArray(res?.data)
            ? res.data
            : Array.isArray(res?.Data1)
            ? res.Data1
            : Array.isArray(res)
            ? res
            : [];
          setList(raw);
        } catch (err) {
          console.error(err);
        } finally {
          if (active) setLoadingList(false);
        }
      })();
      return () => {
        active = false;
      };
    }, [url, JSON.stringify(payload), JSON.stringify(headers)]);

    return (
      <div className="cr-field">
        <label className="cr-label">{placeholder.replace("Select ", "")}</label>
        <select
          className="cr-input"
          value={value?.value ?? ""}
          disabled={loadingList}
          onChange={(e) => {
            const selectedVal = e.target.value;
            const opt = list.find((o) => String(o[valueKey]) === selectedVal);
            if (opt) {
              onChange({ value: String(opt[valueKey]), label: opt[labelKey] });
            } else {
              onChange(null);
            }
          }}
        >
          <option value="">{loadingList ? "Loading..." : placeholder}</option>
          {list.map((o) => (
            <option key={o[valueKey]} value={o[valueKey]}>
              {o[labelKey]}
            </option>
          ))}
        </select>
      </div>
    );
  };

  // ── Styling: BranchWise.jsx design, values copied token-for-token,
  //   class-name prefix changed from "so-" to "cr-" (unique per page). ────
  const styles = `
    .cr-shell { min-height: 100vh; background: #f0f2f5; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; flex-direction: column; }
    .cr-topbar { background: linear-gradient(135deg, #3b6fe0, #1a4fd1); color: #fff; display: flex; align-items: center; justify-content: space-between; padding: 0 24px; height: 52px; box-shadow: 0 2px 8px rgba(0,0,0,.18); flex-shrink: 0; }
    .cr-topbar-title { font-size: 15px; font-weight: 600; letter-spacing: .3px; }
    .cr-close-btn { background: rgba(255,255,255,.15); border: none; color: #fff; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; transition: background .15s; }
    .cr-close-btn:hover { background: rgba(255,255,255,.28); }

    .cr-layout { flex: 1; display: flex; align-items: flex-start; justify-content: center; padding: 24px; box-sizing: border-box; }
    .cr-card { width: 100%; max-width: 740px; background: #fff; border: 2px solid #1a56db; border-radius: 10px; box-shadow: 0 4px 16px rgba(26,86,219,.18); overflow: hidden; }

    .cr-card-header { background: linear-gradient(135deg, #3b6fe0, #1a4fd1); border-bottom: 1px solid #1a4fd1; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; }
    .cr-card-header-title { font-size: 14px; font-weight: 700; color: #fff; letter-spacing: .2px; }
    .cr-close-x { background: rgba(255,255,255,.15); border: none; font-size: 14px; color: #fff; cursor: pointer; line-height: 1; padding: 6px 8px; border-radius: 6px; transition: background .15s; }
    .cr-close-x:hover { background: rgba(255,255,255,.28); }

    .cr-card-body { padding: 24px 32px 30px; }
    .cr-report-title { text-align: center; font-size: 22px; font-weight: 800; color: #1a3fd6; margin: 0 0 26px; }

    .cr-content { display: flex; gap: 32px; }

    .cr-left { flex: 0 0 190px; display: flex; flex-direction: column; gap: 14px; }
    .cr-right { flex: 1; display: flex; flex-direction: column; gap: 16px; max-width: 320px; }

    .cr-radio-row { display: flex; align-items: center; gap: 8px; cursor: pointer; user-select: none; font-size: 13px; color: #2b2b2b; font-weight: 500; }
    .cr-radio-row input[type="radio"] { width: 16px; height: 16px; accent-color: #1a56db; cursor: pointer; flex-shrink: 0; }
    .cr-radio-row input[type="checkbox"] { width: 16px; height: 16px; accent-color: #1a56db; cursor: pointer; flex-shrink: 0; }

    .cr-basis-row { display: flex; flex-direction: column; gap: 10px; margin-top: 4px; padding-top: 10px; border-top: 1px solid #ececec; }

    .cr-field { display: flex; align-items: center; gap: 14px; }
    .cr-label { font-size: 13px; font-weight: 600; color: #1e293b; width: 96px; flex-shrink: 0; }
    .cr-input { height: 34px; border: 1px solid #c7cdd6; border-radius: 4px; padding: 0 10px; font-size: 13px; color: #1e2d3d; background: #fff; width: 100%; box-sizing: border-box; transition: border-color .15s, box-shadow .15s; outline: none; }
    .cr-input:focus { border-color: #1a56db; box-shadow: 0 0 0 3px rgba(26,86,219,.15); }
    select.cr-input { appearance: auto; cursor: pointer; }

    .cr-actions { display: flex; gap: 12px; justify-content: center; margin-top: 32px; padding-top: 22px; border-top: 1px solid #e8ecf0; }
    .cr-btn { height: 38px; padding: 0 30px; border-radius: 6px; border: 1px solid #1a56db; font-size: 14px; font-weight: 700; cursor: pointer; transition: opacity .15s, box-shadow .15s, background .15s; display: flex; align-items: center; gap: 8px; background: #fff; color: #1a56db; }
    .cr-btn:disabled { opacity: .5; cursor: not-allowed; }
    .cr-btn:not(:disabled):hover { background: #eef3ff; }
    .cr-btn-primary { border-color: #1e7e34; color: #1e7e34; }
    .cr-btn-primary .cr-icon-save { color: #1e7e34; }
    .cr-btn-secondary { border-color: #dc3545; color: #dc3545; }
    .cr-btn-secondary .cr-icon-cancel { color: #dc3545; }

    .cr-msg { margin-top: 18px; padding: 10px 14px; border-radius: 8px; font-size: 13px; font-weight: 500; text-align: center; }
    .cr-msg.err { background: #fff0f0; color: #c53030; border: 1px solid #fed7d7; }
    .cr-msg.ok  { background: #f0fff4; color: #276749; border: 1px solid #c6f6d5; }

    @media (max-width: 620px) {
      .cr-card-body { padding: 20px; }
      .cr-content { flex-direction: column; gap: 22px; }
      .cr-left { flex: none; }
      .cr-right { max-width: none; }
    }
  `;

  if (!pageAccess.ready) {
    return (
      <div className="cr-shell">
        <Topbar />
        <div className="cr-layout">
          {msg && <div className={`cr-msg ${msg.isErr ? "err" : "ok"}`}>{msg.text}</div>}
        </div>
      </div>
    );
  }

  if (!pageAccess.allowed) {
    return (
      <div className="cr-shell">
        <Topbar />
        <div className="cr-layout">
          <div className="cr-msg err">Page Access Permission Denied !!!.</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{styles}</style>
      <div className="cr-shell">
        <Topbar />
        <div className="cr-layout">
          <div className="cr-card">
            <div className="cr-card-header">
              <div className="cr-card-header-title">Customer Receipts</div>
              <button type="button" className="cr-close-x" aria-label="Close" onClick={() => navigate(-1)}>✕</button>
            </div>

            <div className="cr-card-body">
              <div className="cr-report-title">Customer Receipt - Report</div>

              <div className="cr-content">
                {/* ── Left: report type + option checkboxes ── */}
                <div className="cr-left">
                  <label className="cr-radio-row">
                    <input type="radio" name="cr-rpt-type" checked={rptType === RPT_TYPE.CASH} onChange={() => setRptType(RPT_TYPE.CASH)} />
                    Cash
                  </label>
                  <label className="cr-radio-row">
                    <input type="radio" name="cr-rpt-type" checked={rptType === RPT_TYPE.CREDIT} onChange={() => setRptType(RPT_TYPE.CREDIT)} />
                    Credit
                  </label>
                  <label className="cr-radio-row">
                    <input type="radio" name="cr-rpt-type" checked={rptType === RPT_TYPE.BOTH} onChange={() => setRptType(RPT_TYPE.BOTH)} />
                    Both
                  </label>

                  <div className="cr-basis-row">
                    <label className="cr-radio-row">
                      <input type="checkbox" checked={chkCustomerWise} onChange={(e) => setChkCustomerWise(e.target.checked)} />
                      Customer Wise
                    </label>
                    <label className="cr-radio-row">
                      <input type="checkbox" checked={chkSalesmanWise} onChange={(e) => setChkSalesmanWise(e.target.checked)} />
                      Salesman Wise
                    </label>
                    <label className="cr-radio-row">
                      <input type="checkbox" checked={chkDaily} onChange={(e) => setChkDaily(e.target.checked)} />
                      Daily
                    </label>
                    <label className="cr-radio-row">
                      <input type="checkbox" checked={chkNarration} onChange={(e) => setChkNarration(e.target.checked)} />
                      Narration
                    </label>
                  </div>
                </div>

                {/* ── Right: customer + salesman + dates ── */}
                <div className="cr-right">
                  <ApiSelect
                    url={CustomerListUrl}
                    payload={{ Comid: Number(session.Comid), Startindex: -1, PageCount: 99999, AccountType: "CUSTOMER", Keyword: "", Column: "" }}
                    labelKey="AccountName"
                    valueKey="Id"
                    value={customerSel}
                    onChange={setCustomerSel}
                    placeholder="Select Customer"
                  />

                  <ApiSelect
                    url={SalesmanListUrl}
                    payload={{ Comid: session.Comid }}
                    labelKey="SalesmanName"
                    valueKey="Id"
                    value={salesmanSel}
                    onChange={setSalesmanSel}
                    placeholder="Select Salesman"
                  />

                  <div className="cr-field">
                    <label className="cr-label" htmlFor="cr-from-date">From Date</label>
                    <input id="cr-from-date" type="date" className="cr-input" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                  </div>

                  <div className="cr-field">
                    <label className="cr-label" htmlFor="cr-to-date">To Date</label>
                    <input id="cr-to-date" type="date" className="cr-input" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="cr-actions">
                <button type="button" className="cr-btn cr-btn-primary" disabled={loading || pageAccess.pageview === 0} onClick={handleView}>
                  <Save size={16} className="cr-icon-save" />
                  {loading ? "Loading…" : "View"}
                </button>
                <button type="button" className="cr-btn cr-btn-secondary" onClick={handleRefresh} disabled={loading}>
                  <XCircle size={16} className="cr-icon-cancel" />
                  Refresh
                </button>
              </div>

              {msg && <div className={`cr-msg ${msg.isErr ? "err" : "ok"}`}>{msg.text}</div>}
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