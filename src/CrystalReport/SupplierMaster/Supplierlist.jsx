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

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Save, XCircle } from "lucide-react";
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
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const wrapRef = useRef(null);

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

    // Keep the visible text in sync whenever the selection changes
    // externally (Refresh button, invalid-selection reset, etc.).
    useEffect(() => {
      setQuery(value?.label ?? "");
    }, [value]);

    // Close + revert unsaved typed text on outside click.
    useEffect(() => {
      const handleClickOutside = (e) => {
        if (wrapRef.current && !wrapRef.current.contains(e.target)) {
          setOpen(false);
          setQuery(value?.label ?? "");
        }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [value]);

    const q = query.trim().toLowerCase();
    const isSelectedText = value && q === String(value.label ?? "").toLowerCase();
    const filtered =
      !q || isSelectedText
        ? list
        : list.filter((o) => String(o[labelKey] ?? "").toLowerCase().includes(q));

    const handleSelect = (opt) => {
      onChange({ value: String(opt[valueKey]), label: opt[labelKey] });
      setQuery(opt[labelKey]);
      setOpen(false);
    };

    const handleClear = () => {
      onChange(null);
      setQuery("");
      setOpen(false);
    };

    return (
      <div className="so-field">
        <label className="so-label">{placeholder.replace("Select ", "")}</label>
        <div className="so-combo-wrap" ref={wrapRef}>
          <input
            className="so-input"
            type="text"
            autoComplete="off"
            disabled={loadingList}
            placeholder={loadingList ? "Loading..." : placeholder}
            value={query}
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setOpen(false);
                setQuery(value?.label ?? "");
              }
            }}
          />
          {open && !loadingList && (
            <div className="so-combo-list" role="listbox">
              <div
                className="so-combo-item so-combo-item-clear"
                onMouseDown={(e) => { e.preventDefault(); handleClear(); }}
              >
                {placeholder}
              </div>
              {filtered.length === 0 ? (
                <div className="so-combo-empty">No matches found</div>
              ) : (
                filtered.map((o) => (
                  <div
                    key={o[valueKey]}
                    className={`so-combo-item${value && String(value.value) === String(o[valueKey]) ? " active" : ""}`}
                    role="option"
                    aria-selected={value && String(value.value) === String(o[valueKey])}
                    onMouseDown={(e) => { e.preventDefault(); handleSelect(o); }}
                  >
                    {o[labelKey]}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── Recolored/restyled to match BranchWise.jsx's card design system ──────
  //   Border / header / heading : blue  #1a56db
  //   Save accent                : green #1e7e34
  //   Cancel / link accent       : red   #dc3545
  const styles = `
    .so-shell { min-height: 100vh; background: #f0f2f5; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; flex-direction: column; }
    .so-topbar { background: linear-gradient(135deg, #3b6fe0, #1a4fd1); color: #fff; display: flex; align-items: center; justify-content: space-between; padding: 0 24px; height: 52px; box-shadow: 0 2px 8px rgba(0,0,0,.18); flex-shrink: 0; }
    .so-topbar-title { font-size: 15px; font-weight: 600; letter-spacing: .3px; }
    .so-close-btn { background: rgba(255,255,255,.15); border: none; color: #fff; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; transition: background .15s; }
    .so-close-btn:hover { background: rgba(255,255,255,.28); }

    .so-layout { flex: 1; display: flex; align-items: flex-start; justify-content: center; padding: 24px; box-sizing: border-box; }
    .so-card { width: 100%; max-width: 480px; background: #fff; border: 2px solid #1a56db; border-radius: 10px; box-shadow: 0 4px 16px rgba(26,86,219,.18); overflow: hidden; }

    .so-card-header { background: linear-gradient(135deg, #3b6fe0, #1a4fd1); border-bottom: 1px solid #1a4fd1; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; }
    .so-card-header-title { font-size: 14px; font-weight: 700; color: #fff; letter-spacing: .2px; }
    .so-close-x { background: rgba(255,255,255,.15); border: none; font-size: 14px; color: #fff; cursor: pointer; line-height: 1; padding: 6px 8px; border-radius: 6px; transition: background .15s; }
    .so-close-x:hover { background: rgba(255,255,255,.28); }

    .so-card-body { padding: 24px 32px 30px; }
    .so-report-title { text-align: center; font-size: 22px; font-weight: 800; color: #1a3fd6; margin: 0 0 26px; }

    .so-field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 8px; }
    .so-label { font-size: 13px; font-weight: 600; color: #1e293b; }
    .so-input { height: 34px; border: 1px solid #c7cdd6; border-radius: 4px; padding: 0 10px; font-size: 13px; color: #1e2d3d; background: #fff; width: 100%; box-sizing: border-box; transition: border-color .15s, box-shadow .15s; outline: none; }
    .so-input:focus { border-color: #1a56db; box-shadow: 0 0 0 3px rgba(26,86,219,.15); }
    select.so-input { appearance: auto; cursor: pointer; }

    /* ── Searchable lookup dropdown (Supplier / Customer / Brand / Category ...) ── */
    .so-combo-wrap { position: relative; width: 100%; }
    .so-combo-list { position: absolute; top: calc(100% + 4px); left: 0; right: 0; max-height: 220px; overflow-y: auto; background: #fff; border: 1px solid #c7cdd6; border-radius: 6px; box-shadow: 0 8px 24px rgba(26,86,219,.15); z-index: 20; padding: 4px; box-sizing: border-box; }
    .so-combo-item { padding: 8px 10px; font-size: 13px; color: #1e2d3d; border-radius: 4px; cursor: pointer; line-height: 1.3; }
    .so-combo-item:hover, .so-combo-item.active { background: #eef3ff; color: #1a56db; }
    .so-combo-item-clear { color: #8a94a6; font-style: italic; border-bottom: 1px solid #ececec; margin-bottom: 2px; border-radius: 0; }
    .so-combo-empty { padding: 10px; font-size: 12px; color: #9aa5b1; text-align: center; }

    .so-actions { display: flex; gap: 12px; justify-content: center; margin-top: 32px; padding-top: 22px; border-top: 1px solid #e8ecf0; }
    .so-btn { height: 38px; padding: 0 30px; border-radius: 6px; border: 1px solid #1a56db; font-size: 14px; font-weight: 700; cursor: pointer; transition: opacity .15s, box-shadow .15s, background .15s; display: flex; align-items: center; gap: 8px; background: #fff; color: #1a56db; }
    .so-btn:disabled { opacity: .5; cursor: not-allowed; }
    .so-btn:not(:disabled):hover { background: #eef3ff; }
    .so-btn-primary { border-color: #1e7e34; color: #1e7e34; }
    .so-btn-primary .so-icon-save { color: #1e7e34; }
    .so-btn-secondary { border-color: #dc3545; color: #dc3545; }
    .so-btn-secondary .so-icon-cancel { color: #dc3545; }

    .so-msg { margin-top: 18px; padding: 10px 14px; border-radius: 8px; font-size: 13px; font-weight: 500; text-align: center; }
    .so-msg.err { background: #fff0f0; color: #c53030; border: 1px solid #fed7d7; }
    .so-msg.ok  { background: #f0fff4; color: #276749; border: 1px solid #c6f6d5; }

    @media (max-width: 620px) {
      .so-card-body { padding: 20px; }
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
          <div className="so-card">
            <div className="so-card-header">
              <div className="so-card-header-title">Supplier List</div>
              <button type="button" className="so-close-x" aria-label="Close" onClick={() => navigate(-1)}>✕</button>
            </div>

            <div className="so-card-body">
              <div className="so-report-title">Supplier List - Report</div>

              <ApiSelect
                url={SupplierListUrl}
                payload={{ Comid: Number(session.Comid), Startindex: -1, PageCount: 99999, AccountType: "SUPPLIER", Keyword: "", Column: "" }}
                labelKey="AccountName"
                valueKey="Id"
                value={supplierSel}
                onChange={setSupplierSel}
                placeholder="Select Supplier"
              />

              <div className="so-actions">
                <button
                  type="button"
                  className="so-btn so-btn-primary"
                  disabled={loading || pageAccess.pageview === 0}
                  onClick={handleView}
                >
                  <Save size={16} className="so-icon-save" />
                  {loading ? "Loading…" : "View"}
                </button>
                <button
                  type="button"
                  className="so-btn so-btn-secondary"
                  onClick={handleRefresh}
                  disabled={loading}
                >
                  <XCircle size={16} className="so-icon-cancel" />
                  Refresh
                </button>
              </div>

              {msg && <div className={`so-msg ${msg.isErr ? "err" : "ok"}`}>{msg.text}</div>}
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