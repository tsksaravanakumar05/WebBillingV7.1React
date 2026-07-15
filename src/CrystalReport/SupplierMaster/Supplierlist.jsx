// ─────────────────────────────────────────────────────────────────────────────
//  SupplierList.jsx
//  React conversion of the legacy jQuery/jqxWidgets "Supplier List" report page
//  Built on the same skeleton as ClosingStock.jsx / SaleOrder.jsx:
//    - CC.api / CC.getLocal / CC.getStr from Common.jsx
//    - same permission/session bootstrap pattern
//    - same openReportViewer(BASE_URL + /Reports/ReportViewer.aspx) pattern
//    - "sl-" scoped style system (new prefix — no collision with cs-/iq-/iw-/db-)
//
//  ── Assumptions / call-outs (please verify) ─────────────────────────────────
//  1. This .js file never reads CName/CAddress/CPhone itself — they're used
//     as bare globals, presumably set by a shared master/bootstrap script
//     common to this app family. Following the established convention from
//     ClosingStock.jsx, these are sourced here from
//     CC.getLocal("Companysetting")[0].CName / .CAddress / .CPhone. Please
//     verify against whatever actually populates those globals in your app.
//  2. QUIRK PRESERVED: the selected supplier's `GroupByText` is taken from
//     `item.value` (not `item.label`, unlike every other converted report),
//     so it's the supplier's underlying id/code — not its display name —
//     that gets sent to the server as `GroupBy`. Reproduced verbatim below.
//  3. Endpoint mapping: `/PurchaseReport/SupplierListReport` → assumed to be
//     `/api/PurchaseReportApp/SupplierListReport` per this app family's
//     module-naming convention (PurchaseReport → PurchaseReportApp). Please
//     verify.
//  4. Per this app's report-request convention, a `CacheKeyType` header and
//     `React: 1` are sent (absent in the original), and the returned cache
//     key is passed through to the report viewer as `CacheKey`. Note the
//     original's report-viewer URL never includes `GroupBy` itself (only the
//     AJAX payload does) — that omission is preserved exactly.
//  5. The original's `error` handler parses a `<title>` tag out of the raw
//     XHR response and feeds it (plus a shared `formatErrorMessage(xhr, err)`
//     helper that isn't defined in this file) into MsgBox. That helper isn't
//     available here, so the catch block below falls back to a generic
//     technical-fault message — wire in the equivalent helper from
//     Common.jsx if one exists.
//  6. The legacy `$('#cmbsupplier').on('change', …)` handler that resets
//     `selectedIndex` to -1 when a combo checkbox is unchecked is a
//     jqxComboBox-specific behavior (checkbox-style combo items) that
//     doesn't apply to a plain HTML `<select>` — selecting the blank option
//     already clears the selection here, so no equivalent code was added.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import * as CC from "../../components/Common";
import Topbar from "../../components/Topbar";

const BASE_URL = "http://localhost:64215";

// ── API endpoints ───────────────────────────────────────────────────────────
// Report endpoint — see assumption #3 above.
const SupplierListReportUrl = "/api/PurchaseReportApp/SupplierListReport";

// Supplier combo endpoint, reused from the established convention across
// converted pages.
const SupplierListUrl = "/api/SupplierApp/SelectSupplier";

export default function SupplierList() {
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
    CName: "",
    CAddress: "",
    CPhone: "",
  });

  // ── Supplier combo selection { value, label } ───────────────────────────
  const [supplierSel, setSupplierSel] = useState(null);

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

    const menudata = menulist.filter((obj) => obj.PageName === "Supplier List");
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
    const ComSet = CC.getLocal("Companysetting") || [{}];

    setSession({
      Comid,
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

  // ── Refresh button — clears the supplier selection, same as the legacy handler ──
  const handleRefresh = useCallback(() => {
    setSupplierSel(null);
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
      w.addEventListener(
        "load",
        function () {
          w.document.title = "Supplier List-Report";
        },
        false
      );
    }
    return w;
  }, []);

  // ── View button — replicates the SupplierListReport $.ajax logic exactly ──
  const handleView = useCallback(async () => {
    // QUIRK PRESERVED (assumption #2): uses the selected item's `value`,
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

    setLoading(true);
    setMsg(null);

    try {
      const res = await CC.api(
        SupplierListReportUrl,
        null,
        { CacheKeyType: "SupplierListReport", React: 1 },
        {
          GroupBy: GroupByText,
          Comid: session.Comid,
        }
      );

      if (res?.ok || res?.IsSuccess) {
        const cacheKey = res.Data15 || res.CacheKey || "";
        // Note: the original never includes GroupBy in the report-viewer URL
        // itself — only in the AJAX payload above. Preserved as-is.
        openReportViewer({
          ReportName: "SupplierListReport",
          CacheKey: cacheKey,
          BatchWiseStockSalePurchase: "0",
          CName: session.CName,
          CAddress: session.CAddress,
          CPhone: session.CPhone,
        });
      } else {
        setMsg({ text: "No Record !!!.", isErr: true });
      }
    } catch (err) {
      // See assumption #5 — original parses a <title> tag from the XHR
      // response via a shared formatErrorMessage() helper not present here.
      setMsg({ text: err?.message || "Technical Fault Contact Software Vendor  !!!.", isErr: true });
    } finally {
      setLoading(false);
      setSupplierSel(null);
    }
  }, [supplierSel, session, openReportViewer]);

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
      <div className="sl-field">
        <label className="sl-label">{placeholder.replace("Select ", "")}</label>
        <select
          className="sl-input"
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

  // ── Scoped styles injected once ("sl-" prefix — new, non-colliding) ────
  const styles = `
    .sl-shell {
      min-height: 100vh;
      background: #f0f2f5;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      flex-direction: column;
    }
    .sl-layout {
      display: flex;
      flex: 1;
      justify-content: center;
      padding: 24px;
      box-sizing: border-box;
    }
    .sl-panel {
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
    .sl-panel-header {
      border-bottom: 1px solid #e8ecf0;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .sl-panel-eyebrow {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .8px;
      color: var(--clr-primary, #1a56db);
      margin-bottom: 6px;
    }
    .sl-panel-title {
      font-size: 20px;
      font-weight: 700;
      color: #1e2d3d;
      line-height: 1.2;
    }
    .sl-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 8px;
    }
    .sl-label {
      font-size: 13px;
      font-weight: 600;
      color: #4a5568;
    }
    .sl-input {
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
    .sl-input:focus {
      border-color: var(--clr-primary, #1a56db);
      box-shadow: 0 0 0 3px rgba(26,86,219,.1);
    }
    .sl-actions {
      display: flex;
      gap: 12px;
      margin-top: 24px;
      padding-top: 20px;
      border-top: 1px solid #e8ecf0;
    }
    .sl-btn {
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
    .sl-btn:disabled { opacity: .5; cursor: not-allowed; }
    .sl-btn-primary {
      background: var(--clr-primary, #1a56db);
      color: #fff;
      box-shadow: 0 2px 8px rgba(26,86,219,.3);
    }
    .sl-btn-primary:not(:disabled):hover {
      opacity: .9;
      box-shadow: 0 4px 14px rgba(26,86,219,.4);
    }
    .sl-btn-secondary {
      background: #f0f2f5;
      color: #4a5568;
      border: 1.5px solid #d1d9e6;
    }
    .sl-btn-secondary:not(:disabled):hover {
      background: #e8ecf0;
    }
    .sl-msg {
      margin-top: 18px;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
    }
    .sl-msg.err { background: #fff0f0; color: #c53030; border: 1px solid #fed7d7; }
    .sl-msg.ok  { background: #f0fff4; color: #276749; border: 1px solid #c6f6d5; }
    @media (max-width: 760px) {
      .sl-layout { padding: 16px; }
      .sl-panel { padding: 20px 16px; }
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
      <div className="sl-shell">
        <Topbar />

        <div className="sl-layout">
          <main className="sl-panel">
            <div className="sl-panel-header">
              <div className="sl-panel-eyebrow">Purchase</div>
              <div className="sl-panel-title">Supplier List</div>
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

            <div className="sl-actions">
              <button
                type="button"
                className="sl-btn sl-btn-primary"
                disabled={loading || pageAccess.pageview === 0}
                onClick={handleView}
              >
                {loading ? "Loading…" : "▶ View"}
              </button>
              <button
                type="button"
                className="sl-btn sl-btn-secondary"
                onClick={handleRefresh}
                disabled={loading}
              >
                ↺ Refresh
              </button>
            </div>

            {msg && <div className={`sl-msg ${msg.isErr ? "err" : "ok"}`}>{msg.text}</div>}
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