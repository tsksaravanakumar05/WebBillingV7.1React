// ─────────────────────────────────────────────────────────────────────────────
//  SupplierAgingReport.jsx
//  React conversion of the legacy supplieragingreport.js (jQuery / jqxWidgets)
//  — "Supplier Aging Report"
//  Built on the same skeleton/design as ClosingStock.jsx / InventoryQtyWise.jsx:
//    - CC.api / CC.getLocal / CC.getStr from Common.jsx
//    - same permission/session bootstrap pattern
//    - same openReportViewer(BASE_URL + /Reports/ReportViewer.aspx) pattern
//    - no Group-By nav sidebar (this page has only a single, optional Supplier
//      picker) — single centered panel, "sa-" scoped styles (unused elsewhere)
//  Styling: MasterPage.css tokens only — no new theme colors.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Save, XCircle, X } from "lucide-react";
import * as CC from "../../components/Common";
import Topbar from "../../components/Topbar";

const BASE_URL = "http://localhost:64215";

// ── API endpoints ───────────────────────────────────────────────────────────
// Report endpoint — the original supplieragingreport.js posted to
// "/PurchaseReport/SupplierAgingReport" (ASMX-style). Mapped to this app's
// Web API layer following the "<first path segment>App" convention used by
// the other converted pages. Please verify this against the real route.
const SupplierAgingReportUrl = "/api/PurchaseReportApp/SupplierAgingReport";

// Same Supplier dropdown endpoint already used by ClosingStock.jsx /
// InventoryQtyWise.jsx (loadsuppliercombo in the legacy jQuery layer).
const SupplierListUrl = "/api/SupplierApp/SelectSupplier";

// Identifies this report's cache-key bucket on the backend (Step 4 convention
// established across the converted pages — the legacy .js predates this).
const CACHE_KEY_TYPE = "SupplierAgingReport";

export default function SupplierAgingReport() {
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

  // ── Supplier combo selection { value, label } | null ────────────────────
  // Optional — leaving it unselected mirrors the legacy behaviour where
  // GroupByText stays "" (report runs for all suppliers).
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

    const menudata = menulist.filter((obj) => obj.PageName === "Supplier Aging Report");
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

  // ── Esc key — navigates away directly (confirm popup removed) ───────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.keyCode === 27) {
        e.preventDefault();
        navigate("/dashboard");
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [navigate]);

  // ── Refresh button — mirrors #btnrefresh click handler ─────────────────
  const handleRefresh = useCallback(() => {
    setSupplierSel(null);
    setMsg(null);
  }, []);

  // ── Header close (X) button — navigates away directly (confirm popup removed) ──
  const handleClose = useCallback(() => {
    navigate("/dashboard");
  }, [navigate]);

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
          w.document.title = "Supplier Aging-Report";
        },
        false
      );
    }
    return w;
  }, []);

  // ── View button — replicates the supplieragingreport.js $.ajax logic ───
  const handleView = useCallback(async () => {
    // GroupByText mirrors the legacy `item.value` read from the combo —
    // left "" (all suppliers) when nothing is selected.
    const GroupByText = supplierSel ? supplierSel.label : "";
    const Fromdate = ""; // the legacy file always sent Fromdate as "" (never set from the UI)

    setLoading(true);
    setMsg(null);

    try {
      const res = await CC.api(
        SupplierAgingReportUrl,
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
          ReportName: "SupplierAgingReport",
          CacheKey: cacheKey,
          GroupByText,
          Fromdate,
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
      // Clear the combo selection after view, matching the
      // $("#cmbsupplier").jqxComboBox('clearSelection') call at the end of
      // the legacy click handler (runs regardless of success/failure).
      setSupplierSel(null);
    }
  }, [supplierSel, session, openReportViewer]);

  // ── Supplier combo — same ApiSelect pattern used across converted pages ──
  // Enhanced: native <select> replaced with a searchable dropdown popup so the
  // user can instant-filter long lookup lists (Supplier here; the same
  // component pattern applies to any Brand/Category/Group/Company/Customer
  // combo built on this ApiSelect contract elsewhere in the app family).
  // Props, data fetching, and the onChange({ value, label }) contract are
  // unchanged — only the selection UI gained a filter box.
  //
  // The results popup is rendered through a portal into document.body and
  // positioned with `fixed` coordinates computed from the trigger button's
  // bounding rect. This keeps the full result list fully visible, floating
  // above the card, instead of being squeezed/clipped inside the form panel.
  const ApiSelect = ({ url, payload, headers = {}, labelKey, valueKey, value, onChange, placeholder }) => {
    const [list, setList] = useState([]);
    const [loadingList, setLoadingList] = useState(false);
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [popRect, setPopRect] = useState(null); // { top, left, width } for portal placement
    const wrapRef = useRef(null);
    const btnRef = useRef(null);
    const popRef = useRef(null);
    const searchRef = useRef(null);

    useEffect(() => {
      let active = true;
      (async () => {
        setLoadingList(true);
        try {
          const res = await CC.api(url, null, headers, payload);
          if (!active) return;
          const raw = Array.isArray(res?.data) ? res.data : Array.isArray(res?.Data1) ? res.Data1 : Array.isArray(res) ? res : [];
          setList(raw);
        } catch (err) {
          console.error(err);
        } finally {
          if (active) setLoadingList(false);
        }
      })();
      return () => { active = false; };
    }, [url, JSON.stringify(payload), JSON.stringify(headers)]);

    // Compute/refresh the popup's fixed-position coordinates from the button.
    const updatePopRect = useCallback(() => {
      if (!btnRef.current) return;
      const r = btnRef.current.getBoundingClientRect();
      setPopRect({ top: r.bottom + 6, left: r.left, width: r.width });
    }, []);

    // Close the popup on outside click — now checks both the trigger wrap
    // AND the portal popup itself, since the popup no longer lives inside
    // wrapRef in the DOM tree.
    useEffect(() => {
      if (!open) return;
      const handleClick = (e) => {
        const insideTrigger = wrapRef.current && wrapRef.current.contains(e.target);
        const insidePopup = popRef.current && popRef.current.contains(e.target);
        if (!insideTrigger && !insidePopup) {
          setOpen(false);
          setQuery("");
        }
      };
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }, [open]);

    // Keep the popup glued to the button on scroll/resize while open, and
    // close it if the trigger scrolls out of the viewport entirely (avoids
    // an orphaned popup floating over unrelated page content).
    useEffect(() => {
      if (!open) return;
      updatePopRect();
      const handleReposition = () => updatePopRect();
      window.addEventListener("scroll", handleReposition, true);
      window.addEventListener("resize", handleReposition);
      return () => {
        window.removeEventListener("scroll", handleReposition, true);
        window.removeEventListener("resize", handleReposition);
      };
    }, [open, updatePopRect]);

    // Autofocus the search box the moment the popup opens.
    useEffect(() => {
      if (open && searchRef.current) searchRef.current.focus();
    }, [open]);

    const filtered = query.trim()
      ? list.filter((o) =>
          String(o[labelKey] ?? "")
            .toLowerCase()
            .includes(query.trim().toLowerCase())
        )
      : list;

    const handleToggle = () => {
      if (loadingList) return;
      if (!open) updatePopRect();
      setOpen((o) => !o);
    };

    const handleSelect = (opt) => {
      onChange({ value: String(opt[valueKey]), label: opt[labelKey] });
      setOpen(false);
      setQuery("");
    };

    const handleClear = (e) => {
      e.stopPropagation();
      onChange(null);
      setQuery("");
    };

    const popup =
      open && !loadingList && popRect ? (
        <div
          ref={popRef}
          className="sa-select-pop sa-select-pop-portal"
          style={{ top: popRect.top, left: popRect.left, width: popRect.width }}
        >
          <div className="sa-select-search-wrap">
            <input
              ref={searchRef}
              type="text"
              className="sa-select-search"
              placeholder={`Search ${placeholder.replace("Select ", "")}...`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setOpen(false);
                  setQuery("");
                } else if (e.key === "Enter" && filtered.length === 1) {
                  handleSelect(filtered[0]);
                }
              }}
            />
          </div>
          <div className="sa-select-list">
            {filtered.length === 0 ? (
              <div className="sa-select-empty">No matches found</div>
            ) : (
              filtered.map((o) => (
                <div
                  key={o[valueKey]}
                  className={`sa-select-opt${
                    String(value?.value ?? "") === String(o[valueKey]) ? " is-selected" : ""
                  }`}
                  onClick={() => handleSelect(o)}
                >
                  {o[labelKey]}
                </div>
              ))
            )}
          </div>
        </div>
      ) : null;

    return (
      <div className="sa-field">
        <label className="sa-label" htmlFor="sa-supplier">{placeholder.replace("Select ", "")}</label>
        <div className="sa-select-wrap" ref={wrapRef}>
          <button
            type="button"
            id="sa-supplier"
            ref={btnRef}
            className="sa-input sa-select-btn"
            disabled={loadingList}
            onClick={handleToggle}
          >
            <span className={`sa-select-btn-text${!value ? " is-placeholder" : ""}`}>
              {loadingList ? "Loading..." : value?.label || placeholder}
            </span>
            {value && !loadingList && (
              <span
                className="sa-select-clear"
                onClick={handleClear}
                role="button"
                aria-label="Clear selection"
                title="Clear"
              >
                ✕
              </span>
            )}
            <span className="sa-select-caret" aria-hidden="true">▾</span>
          </button>

          {popup && createPortal(popup, document.body)}
        </div>
      </div>
    );
  };

  // ── Scoped styles injected once ("sa-" prefix, ported from BranchWise.jsx's
  //    design system — colors/spacing/cards/buttons only, no logic here) ────
  const styles = `
    .sa-shell { min-height: 100vh; background: #f0f2f5; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; flex-direction: column; }

    .sa-layout { flex: 1; display: flex; align-items: flex-start; justify-content: center; padding: 24px; box-sizing: border-box; }
    .sa-card { width: 100%; max-width: 480px; background: #fff; border: 2px solid #1a56db; border-radius: 10px; box-shadow: 0 4px 16px rgba(26,86,219,.18); }

    .sa-card-header { background: linear-gradient(135deg, #3b6fe0, #1a4fd1); border-bottom: 1px solid #1a4fd1; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; border-radius: 8px 8px 0 0; }
    .sa-card-header-title { font-size: 14px; font-weight: 700; color: #fff; letter-spacing: .2px; }
    .sa-close-btn { flex-shrink: 0; width: 26px; height: 26px; border-radius: 6px; border: none; background: rgba(255,255,255,.18); color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: background .15s; padding: 0; }
    .sa-close-btn:hover { background: rgba(255,255,255,.3); }

    .sa-card-body { padding: 24px 32px 30px; }
    .sa-report-title { text-align: center; font-size: 22px; font-weight: 800; color: #1a3fd6; margin: 0 0 26px; }

    .sa-content { display: flex; flex-direction: column; gap: 16px; }

    .sa-field { display: flex; align-items: center; gap: 14px; }
    .sa-label { font-size: 13px; font-weight: 600; color: #1e293b; width: 96px; flex-shrink: 0; }
    .sa-input { height: 34px; border: 1px solid #c7cdd6; border-radius: 4px; padding: 0 10px; font-size: 13px; color: #1e2d3d; background: #fff; width: 100%; box-sizing: border-box; transition: border-color .15s, box-shadow .15s; outline: none; }
    .sa-input:focus { border-color: #1a56db; box-shadow: 0 0 0 3px rgba(26,86,219,.15); }
    select.sa-input { appearance: auto; cursor: pointer; }
    .sa-input:disabled { background: #f5f6f8; cursor: not-allowed; }

    /* Searchable select (Supplier / Brand / Category / Group / Company / Customer, etc.) */
    .sa-select-wrap { position: relative; width: 100%; }
    .sa-select-btn { display: flex; align-items: center; gap: 8px; cursor: pointer; text-align: left; font-family: inherit; }
    .sa-select-btn:disabled { cursor: not-allowed; }
    .sa-select-btn-text { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .sa-select-btn-text.is-placeholder { color: #8a94a3; }
    .sa-select-clear { flex-shrink: 0; width: 16px; height: 16px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #8a94a3; transition: background .15s, color .15s; }
    .sa-select-clear:hover { background: #fff0f0; color: #dc3545; }
    .sa-select-caret { flex-shrink: 0; font-size: 10px; color: #8a94a3; }

    /* Base popup look. Positioning differs for the portal variant below. */
    .sa-select-pop { position: absolute; top: calc(100% + 6px); left: 0; right: 0; z-index: 40; background: #fff; border: 1px solid #c7cdd6; border-radius: 8px; box-shadow: 0 8px 24px rgba(26,43,80,.16); overflow: hidden; }

    /* Portal variant: rendered into document.body, so it's positioned with
       fixed viewport coordinates (set inline via popRect) instead of being
       anchored relative to a parent. This is what lets the full result list
       float above the card instead of being clipped/squeezed inside it. */
    .sa-select-pop-portal { position: fixed; right: auto; z-index: 3000; max-height: min(320px, calc(100vh - 24px)); display: flex; flex-direction: column; }

    .sa-select-search-wrap { padding: 8px; border-bottom: 1px solid #e8ecf0; flex-shrink: 0; }
    .sa-select-search { width: 100%; height: 32px; border: 1px solid #c7cdd6; border-radius: 4px; padding: 0 10px; font-size: 13px; color: #1e2d3d; box-sizing: border-box; outline: none; transition: border-color .15s, box-shadow .15s; }
    .sa-select-search:focus { border-color: #1a56db; box-shadow: 0 0 0 3px rgba(26,86,219,.15); }
    .sa-select-list { max-height: 260px; overflow-y: auto; }
    .sa-select-pop-portal .sa-select-list { max-height: none; overflow-y: auto; flex: 1; }
    .sa-select-opt { padding: 8px 12px; font-size: 13px; color: #1e2d3d; cursor: pointer; transition: background .12s; }
    .sa-select-opt:hover { background: #eef3ff; }
    .sa-select-opt.is-selected { background: #e3ecff; color: #1a4fd1; font-weight: 600; }
    .sa-select-empty { padding: 14px 12px; font-size: 13px; color: #8a94a3; text-align: center; }

    .sa-actions { display: flex; gap: 12px; justify-content: center; margin-top: 32px; padding-top: 22px; border-top: 1px solid #e8ecf0; }
    .sa-btn { height: 38px; padding: 0 30px; border-radius: 6px; border: 1px solid #1a56db; font-size: 14px; font-weight: 700; cursor: pointer; transition: opacity .15s, box-shadow .15s, background .15s; display: flex; align-items: center; gap: 8px; background: #fff; color: #1a56db; }
    .sa-btn:disabled { opacity: .5; cursor: not-allowed; }
    .sa-btn:not(:disabled):hover { background: #eef3ff; }
    .sa-btn-primary { border-color: #1e7e34; color: #1e7e34; }
    .sa-btn-primary .sa-icon-save { color: #1e7e34; }
    .sa-btn-secondary { border-color: #dc3545; color: #dc3545; }
    .sa-btn-secondary .sa-icon-cancel { color: #dc3545; }

    .sa-msg { margin-top: 18px; padding: 10px 14px; border-radius: 8px; font-size: 13px; font-weight: 500; text-align: center; }
    .sa-msg.err { background: #fff0f0; color: #c53030; border: 1px solid #fed7d7; }
    .sa-msg.ok  { background: #f0fff4; color: #276749; border: 1px solid #c6f6d5; }

    @media (max-width: 620px) {
      .sa-card-body { padding: 20px; }
      .sa-field { flex-direction: column; align-items: flex-start; gap: 6px; }
      .sa-label { width: auto; }
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
      <div className="sa-shell">
        <Topbar />

        <div className="sa-layout">
          <div className="sa-card">
            <div className="sa-card-header">
              <div className="sa-card-header-title">Supplier Aging Report</div>
              <button
                type="button"
                className="sa-close-btn"
                onClick={handleClose}
                aria-label="Close"
                title="Close"
              >
                <X size={16} />
              </button>
            </div>

            <div className="sa-card-body">
              <div className="sa-report-title">Supplier Aging - Report</div>

              <div className="sa-content">
                <ApiSelect
                  url={SupplierListUrl}
                  payload={{ Comid: Number(session.Comid), Startindex: -1, PageCount: 99999, AccountType: "SUPPLIER", Keyword: "", Column: "" }}
                  labelKey="AccountName"
                  valueKey="Id"
                  value={supplierSel}
                  onChange={setSupplierSel}
                  placeholder="Select Supplier"
                />
              </div>

              <div className="sa-actions">
                <button
                  type="button"
                  className="sa-btn sa-btn-primary"
                  disabled={loading || pageAccess.pageview === 0}
                  onClick={handleView}
                >
                  <Save size={16} className="sa-icon-save" />
                  {loading ? "Loading…" : "View"}
                </button>
                <button
                  type="button"
                  className="sa-btn sa-btn-secondary"
                  onClick={handleRefresh}
                  disabled={loading}
                >
                  <XCircle size={16} className="sa-icon-cancel" />
                  Refresh
                </button>
              </div>

              {msg && <div className={`sa-msg ${msg.isErr ? "err" : "ok"}`}>{msg.text}</div>}
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