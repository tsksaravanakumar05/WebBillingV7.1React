// ─────────────────────────────────────────────────────────────────────────────
//  SupplierPendingBillReport.jsx
//  React conversion of the legacy jQuery / jqxWidgets page — "Supplier Pending
//  Bill Report" (PageName in menulist: "Supplier Pending Bill Report").
//  Built on the exact same skeleton as ClosingStock.jsx / InventoryQtyWise.jsx:
//    - CC.api / CC.getLocal / CC.getStr from Common.jsx
//    - same permission/session bootstrap pattern
//    - same openReportViewer(BASE_URL + /Reports/ReportViewer.aspx) pattern
//    - same CacheKeyType/CacheKey convention used across the converted pages
//      (the legacy .js predates it, but every report call in this app family
//      now sends it)
//  Layout: no Group-By nav sidebar — the legacy page only has a single
//  Supplier combo, so this follows the "single centered panel" variant
//  (same pattern used for ItemwiseStockDetails.jsx), with a fresh "sp-"
//  scoped class prefix (unused elsewhere in the app).
//  Styling: MasterPage.css tokens only — no new theme colors.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import * as CC from "../../components/Common";
import Topbar from "../../components/Topbar";

const BASE_URL = "http://localhost:64215";

// ── API endpoints ───────────────────────────────────────────────────────────
// Original $.ajax url was "/PurchaseReport/SupplierPendingReportCR". Mapped to
// the app's Web API layer following the "<FirstSegment>App" convention used
// elsewhere (e.g. /Stock/... -> /api/StockReportApp/...). Please verify this
// is the real route on the PurchaseReport module.
const SupplierPendingReportUrl = "/api/PurchaseReportApp/SupplierPendingReportCR";

// Same supplier dropdown endpoint used by ClosingStock.jsx / InventoryQtyWise.jsx
// (loadsuppliercombo in the legacy jQuery layer).
const SupplierListUrl = "/api/SupplierApp/SelectSupplier";

// Identifies this report's cache-key bucket on the backend (mirrors the
// Data15/CacheKey pattern established across the converted pages).
const CACHE_KEY_TYPE = "SupplierPendingReport";

export default function SupplierPendingBillReport() {
  const navigate = useNavigate();

  // ── Session / permission state ─────────────────────────────────────────
  const [pageAccess, setPageAccess] = useState({
    ready: false,
    allowed: false,
    pageview: 0,
  });

  // ── Company / settings state (loaded once from localStorage) ────────────
  const [session, setSession] = useState({
    Comid: "",
    MComid: "",
    CName: "",
    CAddress: "",
    CPhone: "",
  });

  // Supplier combo selection { value, label } — matches jqxComboBox getSelectedItem
  const [supplierSel, setSupplierSel] = useState(null);

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

    const menudata = menulist.filter(
      (obj) => obj.PageName === "Supplier Pending Bill Report"
    );
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

  // ── Esc key — "Do you want to quit page?" (same as ClosingStock.jsx) ────
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

  // ── Refresh button — mirrors #btnrefresh click handler (clearSelection) ─
  const handleRefresh = useCallback(() => {
    setSupplierSel(null);
    setMsg(null);
  }, []);

  // ── Report viewer opener — same pattern as ClosingStock.jsx ─────────────
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
      w.addEventListener(
        "load",
        function () {
          w.document.title = "Supplier Pending-Report";
        },
        false
      );
    }
    return w;
  }, []);

  // ── View button — replicates the legacy $.ajax logic exactly ───────────
  // Legacy: Supplier selection is OPTIONAL. GroupByText is only set (to the
  // selected item's *value*, i.e. its id — not its label) when a supplier is
  // actually selected; leaving it blank runs the report for all suppliers.
  const handleView = useCallback(async () => {
    const GroupByText = supplierSel ? supplierSel.value : "";

    setLoading(true);
    setMsg(null);

    try {
      const res = await CC.api(
        SupplierPendingReportUrl,
        null,
        { CacheKeyType: CACHE_KEY_TYPE, React: 1 },
        {
          GroupBy: GroupByText,
          Comid: session.Comid,
          MComid: session.MComid,
        }
      );

      if (res?.ok || res?.IsSuccess) {
        const cacheKey = res.Data15 || res.CacheKey || "";
        openReportViewer({
          ReportName: "SupplierPendingReport",
          ReportType: "",
          ReportTitle: "Supplier Invoice Report",
          CacheKey: cacheKey,
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
      // Clear the combo after the run, matching the clearSelection() call
      // that follows the (synchronous) $.ajax call in the legacy handler.
      setSupplierSel(null);
    }
  }, [supplierSel, session, openReportViewer]);

  // ── Supplier combo — same ApiSelect pattern used across converted pages ──
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
      <div className="sp-field">
        <label className="sp-label" htmlFor="sp-supplier">
          {placeholder.replace("Select ", "")}
        </label>
        <select
          id="sp-supplier"
          className="sp-input"
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

  // ── Scoped styles injected once ("sp-" prefix, single centered panel) ──
  const styles = `
    .sp-shell {
      min-height: 100vh;
      background: #f0f2f5;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      flex-direction: column;
    }
    .sp-layout {
      flex: 1;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      padding: 48px 24px;
    }
    .sp-panel {
      width: 100%;
      max-width: 480px;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 2px 12px rgba(0,0,0,.08);
      padding: 28px 32px;
      display: flex;
      flex-direction: column;
    }
    .sp-panel-header {
      border-bottom: 1px solid #e8ecf0;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .sp-panel-eyebrow {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .8px;
      color: var(--clr-primary, #1a56db);
      margin-bottom: 6px;
    }
    .sp-panel-title {
      font-size: 20px;
      font-weight: 700;
      color: #1e2d3d;
    }
    .sp-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 20px;
    }
    .sp-label {
      font-size: 12px;
      font-weight: 600;
      color: #5a6472;
    }
    .sp-input {
      height: 40px;
      border-radius: 8px;
      border: 1.5px solid #d1d9e6;
      padding: 0 12px;
      font-size: 14px;
      color: #1e2d3d;
      background: #fff;
      outline: none;
    }
    .sp-input:focus {
      border-color: var(--clr-primary, #1a56db);
      box-shadow: 0 0 0 3px rgba(26,86,219,.1);
    }
    .sp-actions {
      display: flex;
      gap: 12px;
      margin-top: 8px;
      padding-top: 20px;
      border-top: 1px solid #e8ecf0;
    }
    .sp-btn {
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
    .sp-btn:disabled { opacity: .5; cursor: not-allowed; }
    .sp-btn-primary {
      background: var(--clr-primary, #1a56db);
      color: #fff;
      box-shadow: 0 2px 8px rgba(26,86,219,.3);
    }
    .sp-btn-primary:not(:disabled):hover {
      opacity: .9;
      box-shadow: 0 4px 14px rgba(26,86,219,.4);
    }
    .sp-btn-secondary {
      background: #f0f2f5;
      color: #4a5568;
      border: 1.5px solid #d1d9e6;
    }
    .sp-btn-secondary:not(:disabled):hover {
      background: #e8ecf0;
    }
    .sp-msg {
      margin-top: 18px;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
    }
    .sp-msg.err { background: #fff0f0; color: #c53030; border: 1px solid #fed7d7; }
    .sp-msg.ok  { background: #f0fff4; color: #276749; border: 1px solid #c6f6d5; }
    @media (max-width: 760px) {
      .sp-layout { padding: 16px; }
      .sp-panel { padding: 20px 16px; }
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
      <div className="sp-shell">
        <Topbar />

        <div className="sp-layout">
          <main className="sp-panel">
            <div className="sp-panel-header">
              <div className="sp-panel-eyebrow">Purchase</div>
              <div className="sp-panel-title">Supplier Pending Bill Report</div>
            </div>

            <ApiSelect
              url={SupplierListUrl}
              payload={{
                Comid: Number(session.Comid),
                Startindex: -1,
                PageCount: 99999,
                AccountType: "SUPPLIER",
                Keyword: "",
                Column: "",
              }}
              labelKey="AccountName"
              valueKey="Id"
              value={supplierSel}
              onChange={setSupplierSel}
              placeholder="Select Supplier"
            />

            <div className="sp-actions">
              <button
                type="button"
                className="sp-btn sp-btn-primary"
                disabled={loading || pageAccess.pageview === 0}
                onClick={handleView}
              >
                {loading ? "Loading…" : "▶ View"}
              </button>
              <button
                type="button"
                className="sp-btn sp-btn-secondary"
                onClick={handleRefresh}
                disabled={loading}
              >
                ↺ Refresh
              </button>
            </div>

            {msg && <div className={`sp-msg ${msg.isErr ? "err" : "ok"}`}>{msg.text}</div>}
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