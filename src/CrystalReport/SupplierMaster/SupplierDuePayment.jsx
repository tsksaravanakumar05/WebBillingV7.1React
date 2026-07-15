// ─────────────────────────────────────────────────────────────────────────────
//  SupplierDuePayment.jsx
//  React conversion of the legacy jQuery/jqxWidgets "Supplier Due Payment" report page
//  Built on the same skeleton as ClosingStock.jsx / SaleOrder.jsx:
//    - CC.api / CC.getLocal / CC.getStr from Common.jsx
//    - same permission/session bootstrap pattern
//    - same openReportViewer(BASE_URL + /Reports/ReportViewer.aspx) pattern
//    - "sd-" scoped style system (new prefix — no collision with cs-/iq-/iw-/db-/sl-/sb-/sp-)
//
//  ── Assumptions / call-outs (please verify) ─────────────────────────────────
//  1. `MComid` is referenced in the original's AJAX payload but is never
//     declared or read anywhere in this file (would be a ReferenceError as
//     written) — same situation as Supplier Balance — assumed to come from
//     `CC.getStr("MComid")`. Please verify.
//  2. `CName`/`CAddress`/`CPhone` aren't read in this file either — assumed
//     sourced from `Companysetting` like the other converted pages.
//  3. Endpoint mapping: `/PurchaseReport/SupplierDuePaymentReport` → assumed
//     `/api/PurchaseReportApp/SupplierDuePaymentReport` (PurchaseReport →
//     PurchaseReportApp convention). Please verify.
//  4. QUIRK PRESERVED: the selected supplier item's `.value` (not `.label`)
//     is used as `GroupBy`, same as the other Purchase-report pages.
//  5. QUIRK PRESERVED: `GroupBy` is sent in the AJAX payload but never
//     appears in the report-viewer URL (only Fromdate/CName/CAddress/CPhone
//     do). Reproduced exactly.
//  6. QUIRK PRESERVED: the window title is set to `"Supplier Due Payment
//     Status-Report"` — note "Status" is inserted, not present in the page
//     name ("Supplier Due Payment") — reproduced verbatim.
//  7. The original's XHR-title-scraping error handler (relying on a shared
//     `formatErrorMessage(xhr, err)` helper not defined in this file) is
//     approximated here with a generic technical-fault fallback — wire in
//     the real helper from Common.jsx if one exists.
//  8. The jqxComboBox-specific "uncheck clears selectedIndex" change handler
//     doesn't apply to a plain HTML `<select>` — selecting the blank option
//     already clears the selection here.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import * as CC from "../../components/Common";
import Topbar from "../../components/Topbar";

const BASE_URL = "http://localhost:64215";

// ── API endpoints ───────────────────────────────────────────────────────────
// Report endpoint — see assumption #3 above.
const SupplierDuePaymentReportUrl = "/api/PurchaseReportApp/SupplierDuePaymentReport";

// Supplier combo endpoint, reused from the established convention.
const SupplierListUrl = "/api/SupplierApp/SelectSupplier";

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

export default function SupplierDuePayment() {
  const navigate = useNavigate();

  // ── Session / permission state ──────────────────────────────────────────
  const [pageAccess, setPageAccess] = useState({
    ready: false,
    allowed: false,
    pageview: 0,
  });

  // ── Company / settings state ────────────────────────────────────────────
  const [session, setSession] = useState({
    Comid: "",
    MComid: "",
    CName: "",
    CAddress: "",
    CPhone: "",
  });

  // ── Supplier combo selection { value, label } ───────────────────────────
  const [supplierSel, setSupplierSel] = useState(null);

  // ── Date ─────────────────────────────────────────────────────────────────
  const [fromDate, setFromDate] = useState(todayStr());

  // ── UI feedback state ────────────────────────────────────────────────────
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

    const menudata = menulist.filter((obj) => obj.PageName === "Supplier Due Payment");
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
    const MComid = CC.getStr("MComid"); // see assumption #1
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

  // ── Esc key — "Do you want to quit page?" (app-wide convention) ─────────
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

  // ── Refresh button — clears the supplier selection and resets the date ──
  const handleRefresh = useCallback(() => {
    setSupplierSel(null);
    setFromDate(todayStr());
    setMsg(null);
  }, []);

  // ── Report viewer opener — same pattern used across converted pages ─────
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
      // Preserved verbatim from the original — see assumption #6.
      w.addEventListener(
        "load",
        function () {
          w.document.title = "Supplier Due Payment Status-Report";
        },
        false
      );
    }
    return w;
  }, []);

  // ── View button — replicates the SupplierDuePaymentReport $.ajax logic exactly ──
  const handleView = useCallback(async () => {
    // QUIRK PRESERVED (assumption #4): uses the selected item's `value`,
    // not its `label`.
    let GroupByText = "";
    if (supplierSel) {
      GroupByText = supplierSel.value;
      if (!GroupByText) {
        setMsg({ text: "Please Select Valid Supplier Name !!!.", isErr: true });
        setSupplierSel(null);
        return;
      }
    }

    const Fromdate = toMMDDYYYY(fromDate);

    setLoading(true);
    setMsg(null);

    try {
      const res = await CC.api(
        SupplierDuePaymentReportUrl,
        null,
        { CacheKeyType: "SupplierDuePaymentReport", React: 1 },
        {
          GroupBy: GroupByText,
          Fromdate,
          Comid: session.Comid,
          MComid: session.MComid,
        }
      );

      if (res?.ok || res?.IsSuccess) {
        const cacheKey = res.Data15 || res.CacheKey || "";
        // Note: GroupBy is never passed to the report-viewer URL in the
        // original — only the AJAX payload carries it. Preserved.
        openReportViewer({
          ReportName: "SupplierDuePaymentReport",
          CacheKey: cacheKey,
          Fromdate,
          CName: session.CName,
          CAddress: session.CAddress,
          CPhone: session.CPhone,
        });
      } else {
        setMsg({ text: "No Record !!!.", isErr: true });
      }
    } catch (err) {
      setMsg({ text: err?.message || "Technical Fault Contact Software Vendor  !!!.", isErr: true });
    } finally {
      setLoading(false);
      setSupplierSel(null);
    }
  }, [supplierSel, fromDate, session, openReportViewer]);

  // ── Reusable combo component (same pattern as other converted pages) ───
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
      <div className="sd-field">
        <label className="sd-label">{placeholder.replace("Select ", "")}</label>
        <select
          className="sd-input"
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

  // ── Scoped styles injected once ("sd-" prefix — new, non-colliding) ────
  const styles = `
    .sd-shell {
      min-height: 100vh;
      background: #f0f2f5;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      flex-direction: column;
    }
    .sd-layout {
      display: flex;
      flex: 1;
      justify-content: center;
      padding: 24px;
      box-sizing: border-box;
    }
    .sd-panel {
      width: 100%;
      max-width: 480px;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 2px 12px rgba(0,0,0,.08);
      padding: 28px 32px;
      display: flex;
      flex-direction: column;
      height: fit-content;
    }
    .sd-panel-header {
      border-bottom: 1px solid #e8ecf0;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .sd-panel-eyebrow {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .8px;
      color: var(--clr-primary, #1a56db);
      margin-bottom: 6px;
    }
    .sd-panel-title {
      font-size: 20px;
      font-weight: 700;
      color: #1e2d3d;
      line-height: 1.2;
    }
    .sd-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 8px;
    }
    .sd-label {
      font-size: 13px;
      font-weight: 600;
      color: #4a5568;
    }
    .sd-input {
      height: 36px;
      border: 1.5px solid #d1d9e6;
      border-radius: 8px;
      padding: 0 12px;
      font-size: 13px;
      color: #1e2d3d;
      background: #fff;
      width: 100%;
      box-sizing: border-box;
      transition: border-color .15s, box-shadow .15s;
      outline: none;
    }
    .sd-input:focus {
      border-color: var(--clr-primary, #1a56db);
      box-shadow: 0 0 0 3px rgba(26,86,219,.1);
    }
    .sd-actions {
      display: flex;
      gap: 12px;
      margin-top: 24px;
      padding-top: 20px;
      border-top: 1px solid #e8ecf0;
    }
    .sd-btn {
      height: 40px;
      padding: 0 28px;
      border-radius: 8px;
      border: none;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity .15s, box-shadow .15s;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .sd-btn:disabled { opacity: .5; cursor: not-allowed; }
    .sd-btn-primary {
      background: var(--clr-primary, #1a56db);
      color: #fff;
      box-shadow: 0 2px 8px rgba(26,86,219,.3);
    }
    .sd-btn-primary:not(:disabled):hover {
      opacity: .9;
      box-shadow: 0 4px 14px rgba(26,86,219,.4);
    }
    .sd-btn-secondary {
      background: #f0f2f5;
      color: #4a5568;
      border: 1.5px solid #d1d9e6;
    }
    .sd-btn-secondary:not(:disabled):hover {
      background: #e8ecf0;
    }
    .sd-msg {
      margin-top: 18px;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
    }
    .sd-msg.err { background: #fff0f0; color: #c53030; border: 1px solid #fed7d7; }
    .sd-msg.ok  { background: #f0fff4; color: #276749; border: 1px solid #c6f6d5; }
    @media (max-width: 760px) {
      .sd-layout { padding: 16px; }
      .sd-panel { padding: 20px 16px; }
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
      <div className="sd-shell">
        <Topbar />

        <div className="sd-layout">
          <main className="sd-panel">
            <div className="sd-panel-header">
              <div className="sd-panel-eyebrow">Purchase</div>
              <div className="sd-panel-title">Supplier Due Payment</div>
            </div>

            <ApiSelect
              url={SupplierListUrl}
              payload={{ Comid: Number(session.Comid), Startindex: -1, PageCount: 99999, AccountType: "SUPPLIER", Keyword: "", Column: "" }}
              labelKey="AccountName"
              valueKey="Id"
              value={supplierSel}
              onChange={setSupplierSel}
              placeholder="Select Supplier"
            />

            <div className="sd-field">
              <label className="sd-label" htmlFor="sd-from-date">From Date</label>
              <input
                id="sd-from-date"
                type="date"
                className="sd-input"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>

            <div className="sd-actions">
              <button
                type="button"
                className="sd-btn sd-btn-primary"
                disabled={loading || pageAccess.pageview === 0}
                onClick={handleView}
              >
                {loading ? "Loading…" : "▶ View"}
              </button>
              <button
                type="button"
                className="sd-btn sd-btn-secondary"
                onClick={handleRefresh}
                disabled={loading}
              >
                ↺ Refresh
              </button>
            </div>

            {msg && <div className={`sd-msg ${msg.isErr ? "err" : "ok"}`}>{msg.text}</div>}
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