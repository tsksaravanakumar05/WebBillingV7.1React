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

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Save, XCircle } from "lucide-react";
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
  // Same external contract as before: value={value}/onChange({value,label}) —
  // only the picker UI changed, from a native <select> to a searchable
  // popup, so it gets instant-filter without touching any surrounding logic.
  const ApiSelect = ({ url, payload, headers = {}, labelKey, valueKey, value, onChange, placeholder }) => {
    const [list, setList] = useState([]);
    const [loadingList, setLoadingList] = useState(false);
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const wrapRef = useRef(null);
    const searchRef = useRef(null);

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

    // Close popup on outside click.
    useEffect(() => {
      const handleClickOutside = (e) => {
        if (wrapRef.current && !wrapRef.current.contains(e.target)) {
          setOpen(false);
          setSearch("");
        }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Focus the search box the moment the popup opens.
    useEffect(() => {
      if (open) searchRef.current?.focus();
    }, [open]);

    const filteredList = useMemo(() => {
      const q = search.trim().toLowerCase();
      if (!q) return list;
      return list.filter((o) => String(o[labelKey] ?? "").toLowerCase().includes(q));
    }, [list, search, labelKey]);

    const selectOption = (opt) => {
      onChange({ value: String(opt[valueKey]), label: opt[labelKey] });
      setOpen(false);
      setSearch("");
    };

    const clearSelection = (e) => {
      e.stopPropagation();
      onChange(null);
      setSearch("");
    };

    return (
      <div className="so-field">
        <label className="so-label" htmlFor="sp-supplier">
          {placeholder.replace("Select ", "")}
        </label>
        <div className="so-select-wrap" ref={wrapRef}>
          <button
            id="sp-supplier"
            type="button"
            className="so-input so-select-btn"
            disabled={loadingList}
            onClick={() => setOpen((o) => !o)}
          >
            <span className={`so-select-btn-text${value ? "" : " so-select-placeholder"}`}>
              {loadingList ? "Loading..." : value ? value.label : placeholder}
            </span>
            {value && !loadingList && (
              <span className="so-select-clear" onClick={clearSelection} aria-label="Clear selection">✕</span>
            )}
            <span className="so-select-caret" aria-hidden="true">▾</span>
          </button>

          {open && !loadingList && (
            <div className="so-select-popup">
              <input
                ref={searchRef}
                type="text"
                className="so-select-search"
                placeholder="Type to search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
              <div className="so-select-options">
                {filteredList.length === 0 ? (
                  <div className="so-select-empty">No matches found</div>
                ) : (
                  filteredList.map((o) => (
                    <div
                      key={o[valueKey]}
                      className={`so-select-option${value?.value === String(o[valueKey]) ? " active" : ""}`}
                      onClick={() => selectOption(o)}
                    >
                      {o[labelKey]}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── Design system: recolored/restructured to match BranchWise.jsx exactly ──
  //   Border / header / heading -> blue (#1a56db)
  //   Save-style accents        -> green (#1e7e34)
  //   Cancel / link accents     -> red   (#dc3545)
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

    .so-content { display: flex; justify-content: center; }
    .so-right { flex: 1; display: flex; flex-direction: column; gap: 16px; max-width: 340px; margin: 0 auto; }

    .so-field { display: flex; align-items: center; gap: 14px; }
    .so-label { font-size: 13px; font-weight: 600; color: #1e293b; width: 96px; flex-shrink: 0; }
    .so-input { height: 34px; border: 1px solid #c7cdd6; border-radius: 4px; padding: 0 10px; font-size: 13px; color: #1e2d3d; background: #fff; width: 100%; box-sizing: border-box; transition: border-color .15s, box-shadow .15s; outline: none; }
    .so-input:focus { border-color: #1a56db; box-shadow: 0 0 0 3px rgba(26,86,219,.15); }
    .so-input:disabled { background: #f5f6f8; color: #a0aab5; cursor: not-allowed; }
    select.so-input { appearance: auto; cursor: pointer; }

    .so-select-wrap { position: relative; flex: 1; min-width: 0; }
    .so-select-btn { display: flex; align-items: center; gap: 8px; cursor: pointer; text-align: left; }
    .so-select-btn:disabled { cursor: not-allowed; opacity: .7; }
    .so-select-btn-text { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .so-select-placeholder { color: #8492a6; }
    .so-select-caret { font-size: 11px; color: #8492a6; flex-shrink: 0; }
    .so-select-clear { font-size: 11px; color: #8492a6; flex-shrink: 0; padding: 2px 4px; border-radius: 4px; line-height: 1; }
    .so-select-clear:hover { color: #dc3545; background: #fff0f0; }

    .so-select-popup { position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 20; background: #fff; border: 1px solid #c7cdd6; border-radius: 6px; box-shadow: 0 8px 24px rgba(20,30,50,.16); overflow: hidden; }
    .so-select-search { width: 100%; box-sizing: border-box; height: 34px; padding: 0 10px; border: none; border-bottom: 1px solid #e8ecf0; font-size: 13px; color: #1e2d3d; outline: none; }
    .so-select-search:focus { border-bottom-color: #1a56db; }
    .so-select-options { max-height: 220px; overflow-y: auto; }
    .so-select-option { padding: 9px 12px; font-size: 13px; color: #1e2d3d; cursor: pointer; }
    .so-select-option:hover { background: #eef3ff; }
    .so-select-option.active { background: #e3ecff; font-weight: 600; color: #1a56db; }
    .so-select-empty { padding: 12px; font-size: 13px; color: #8492a6; text-align: center; }

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
      .so-right { max-width: none; }
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
              <div className="so-card-header-title">Supplier Pending Bill Report</div>
              <button type="button" className="so-close-x" aria-label="Close" onClick={() => navigate(-1)}>✕</button>
            </div>

            <div className="so-card-body">
              <div className="so-report-title">Supplier Pending Bill Report</div>

              <div className="so-content">
                <div className="so-right">
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
                </div>
              </div>

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