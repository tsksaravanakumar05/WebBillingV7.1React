// ─────────────────────────────────────────────────────────────────────────────
//  SupplierBalance.jsx
//  React conversion of the legacy jQuery/jqxWidgets "Supplier Balance" report page
//  Built on the same skeleton as ClosingStock.jsx / SaleOrder.jsx:
//    - CC.api / CC.getLocal / CC.getStr from Common.jsx
//    - same permission/session bootstrap pattern
//    - same openReportViewer(BASE_URL + /Reports/ReportViewer.aspx) pattern
//    - "sb-" scoped style system (new prefix — no collision with cs-/iq-/iw-/db-/sl-)
//
//  ── Assumptions / call-outs (please verify) ─────────────────────────────────
//  1. `MComid` is referenced in the original's AJAX payload but is never
//     declared or read anywhere in this file (would be a ReferenceError as
//     written) — following the same pattern as `Comid`, it's assumed to come
//     from `CC.getStr("MComid")`. Please verify.
//  2. `CName`/`CAddress`/`CPhone` aren't read in this file either — assumed
//     sourced from `Companysetting` like the other converted pages.
//  3. Endpoint mapping: `/PurchaseReport/SupplierBalanceReportNew` → assumed
//     `/api/PurchaseReportApp/SupplierBalanceReportNew` (PurchaseReport →
//     PurchaseReportApp convention). Please verify.
//  4. There's no established SalesMan combo endpoint in this app family yet —
//     `SalesManListUrl` below (`/api/SalesManApp/SelectSalesMan`) and its
//     `labelKey`/payload shape are a best guess mirroring the Supplier combo
//     convention (`AccountType: "SALESMAN"`). Please verify against your
//     actual master API layer.
//  5. QUIRK PRESERVED: the field names are swapped between the AJAX payload
//     and the report-viewer URL. The payload sends the *mode* indicator
//     ("" or "SALES") as `GroupByNew` and the *selected item's value* as
//     `GroupBy`; the report-viewer URL sends the mode as `GroupBy` and the
//     selected value as `GroupByText`. Reproduced exactly — see handleView.
//  6. QUIRK PRESERVED: like Supplier List, the selected combo item's
//     `.value` (not `.label`) is what's used as the group-by value.
//  7. BUG PRESERVED: after a View click, only the Supplier combo is cleared
//     (`$("#cmbsupplier").jqxComboBox('clearSelection')`) — the Salesman
//     combo is never cleared post-view in the original, regardless of which
//     mode was used. Refresh, by contrast, does clear both.
//  8. `Orderby` (0 = none, 1 = ascending, 2 = descending) is sent as an HTTP
//     header exactly as in the original, not as a body field.
//  9. The original's XHR-title-scraping error handler (relying on a shared
//     `formatErrorMessage(xhr, err)` helper not defined in this file) is
//     approximated here with a generic technical-fault fallback — wire in
//     the real helper from Common.jsx if one exists.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Save, XCircle } from "lucide-react";
import * as CC from "../../components/Common";
import Topbar from "../../components/Topbar";

const BASE_URL = "http://localhost:64215";

// ── API endpoints ───────────────────────────────────────────────────────────
// Report endpoint — see assumption #3 above.
const SupplierBalanceReportUrl = "/api/PurchaseReportApp/SupplierBalanceReport";

// Combo endpoints — Supplier reused from the established convention; SalesMan
// is a best guess (assumption #4).
const SupplierListUrl = "/api/SupplierApp/SelectSupplier";
const SalesManListUrl = "/api/SalesManApp/SelectSalesMan";

// ── Group-by mode identifiers (mirrors the Pane2 radio group) ──────────────
// NOTE: these string values match the legacy `GroupBy` variable exactly —
// "" for Supplier mode, "SALES" for Salesman mode.
const GROUP_MODE = {
  SUPPLIER: "",
  SALESMAN: "SALES",
};

// ── Order-by identifiers (mirrors the Pane3 radio group) ───────────────────
const ORDER_BY = {
  NONE: 0,
  ASCENDING: 1,
  DESCENDING: 2,
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

export default function SupplierBalance() {
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

  // ── Group-by mode (Pane2 — Supplier / Salesman, checked-radio behaviour) ──
  const [groupMode, setGroupMode] = useState(GROUP_MODE.SUPPLIER); // rdoSupplier checked by default

  // ── Combo selections { value, label } ───────────────────────────────────
  const [supplierSel, setSupplierSel] = useState(null);
  const [salesManSel, setSalesManSel] = useState(null);

  // ── Order-by (Pane3) ─────────────────────────────────────────────────────
  const [orderBy, setOrderBy] = useState(ORDER_BY.NONE); // rdoNone checked by default

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

    const menudata = menulist.filter((obj) => obj.PageName === "Supplier Balance");
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
          navigate("/dashboard");
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [navigate]);

  // ── Pane2 radio clicks — clears the *other* combo, mirrors rdoSupplier/rdoSalesMan click handlers ──
  const selectSupplierMode = useCallback(() => {
    setGroupMode(GROUP_MODE.SUPPLIER);
    setSalesManSel(null);
  }, []);
  const selectSalesManMode = useCallback(() => {
    setGroupMode(GROUP_MODE.SALESMAN);
    setSupplierSel(null);
  }, []);

  // ── Combo change handlers — mirrors the cmbsupplier/cmbSalesMan 'change' handlers:
  // selecting/deselecting a value forces its own radio checked and clears the other combo ──
  const handleSupplierChange = useCallback((val) => {
    setSupplierSel(val);
    setGroupMode(GROUP_MODE.SUPPLIER);
    setSalesManSel(null);
  }, []);
  const handleSalesManChange = useCallback((val) => {
    setSalesManSel(val);
    setGroupMode(GROUP_MODE.SALESMAN);
    setSupplierSel(null);
  }, []);

  // ── Refresh button — clears both combos and resets the date; radios untouched (matches original) ──
  const handleRefresh = useCallback(() => {
    setSupplierSel(null);
    setSalesManSel(null);
    setFromDate(todayStr());
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
          w.document.title = "Supplier Balance-Report";
        },
        false
      );
    }
    return w;
  }, []);

  // ── View button — replicates the SupplierBalanceReportNew $.ajax logic exactly ──
  const handleView = useCallback(async () => {
    const GroupBy = groupMode; // "" (Supplier) or "SALES" (Salesman) — mirrors legacy `GroupBy`
    let GroupByText = ""; // mirrors legacy `GroupByText` — the selected item's `.value`

    if (groupMode === GROUP_MODE.SUPPLIER) {
      if (supplierSel) {
        GroupByText = supplierSel.value;
        if (!GroupByText) {
          setMsg({ text: "Please Select Valid Supplier Name !!!.", isErr: true });
          setSupplierSel(null);
          return;
        }
      }
    } else if (groupMode === GROUP_MODE.SALESMAN) {
      if (salesManSel) {
        GroupByText = salesManSel.value;
        if (!GroupByText) {
          setMsg({ text: "Please Select Valid Salesman Name !!!.", isErr: true });
          setSalesManSel(null);
          return;
        }
      }
    }

    const Fromdate = toMMDDYYYY(fromDate);

    setLoading(true);
    setMsg(null);

    try {
      const res = await CC.api(
        SupplierBalanceReportUrl,
        null,
        { CacheKeyType: "SupplierBalanceReportNew", React: 1, Orderby: orderBy },
        {
          // QUIRK PRESERVED (assumption #5) — swapped vs. the report-viewer params below.
          GroupBy: GroupByText,
          GroupByNew: GroupBy,
          Fromdate,
          Comid: session.Comid,
          MComid: session.MComid,
        }
      );

      if (res?.ok || res?.IsSuccess) {
        const cacheKey = res.Data15 || res.CacheKey || "";
        openReportViewer({
          ReportName: "SupplierBalanceReport",
          CacheKey: cacheKey,
          GroupBy,
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
      setMsg({ text: err?.message || "Technical Fault Contact Software Vendor  !!!.", isErr: true });
    } finally {
      setLoading(false);
      // BUG PRESERVED (assumption #7): only the Supplier combo is cleared
      // after View, regardless of which mode was actually used.
      setSupplierSel(null);
    }
  }, [groupMode, supplierSel, salesManSel, fromDate, orderBy, session, openReportViewer]);

  // ── Reusable combo component (same pattern as other converted pages) ───
  // Ported from SupplierAgingReport.jsx: the popup now renders through a
  // portal into document.body, positioned with fixed coordinates computed
  // from the trigger button's bounding rect, instead of being absolutely
  // positioned inside the (possibly clipped/narrow) so-combo-slot. Same
  // external contract as before: value={value}/onChange({value,label}) —
  // only the picker UI changed, so every consumer (Supplier, Salesman)
  // keeps working exactly as before.
  const ApiSelect = ({ url, payload, headers = {}, labelKey, valueKey, value, onChange, placeholder }) => {
    const [list, setList] = useState([]);
    const [loadingList, setLoadingList] = useState(false);
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
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

    // Compute/refresh the popup's fixed-position coordinates from the button.
    const updatePopRect = useCallback(() => {
      if (!btnRef.current) return;
      const r = btnRef.current.getBoundingClientRect();
      setPopRect({ top: r.bottom + 6, left: r.left, width: r.width });
    }, []);

    // Close the popup on outside click — checks both the trigger wrap AND
    // the portal popup itself, since the popup no longer lives inside
    // wrapRef in the DOM tree.
    useEffect(() => {
      if (!open) return;
      const handleClickOutside = (e) => {
        const insideTrigger = wrapRef.current && wrapRef.current.contains(e.target);
        const insidePopup = popRef.current && popRef.current.contains(e.target);
        if (!insideTrigger && !insidePopup) {
          setOpen(false);
          setSearch("");
        }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
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

    // Focus the search box the moment the popup opens.
    useEffect(() => {
      if (open) searchRef.current?.focus();
    }, [open]);

    const filteredList = useMemo(() => {
      const q = search.trim().toLowerCase();
      if (!q) return list;
      return list.filter((o) => String(o[labelKey] ?? "").toLowerCase().includes(q));
    }, [list, search, labelKey]);

    const handleToggle = () => {
      if (loadingList) return;
      if (!open) updatePopRect();
      setOpen((o) => !o);
    };

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

    const popup =
      open && !loadingList && popRect ? (
        <div
          ref={popRef}
          className="so-select-pop so-select-pop-portal"
          style={{ top: popRect.top, left: popRect.left, width: popRect.width }}
        >
          <div className="so-select-search-wrap">
            <input
              ref={searchRef}
              type="text"
              className="so-select-search"
              placeholder="Type to search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setOpen(false);
                  setSearch("");
                } else if (e.key === "Enter" && filteredList.length === 1) {
                  selectOption(filteredList[0]);
                }
              }}
            />
          </div>
          <div className="so-select-list">
            {filteredList.length === 0 ? (
              <div className="so-select-empty">No matches found</div>
            ) : (
              filteredList.map((o) => (
                <div
                  key={o[valueKey]}
                  className={`so-select-opt${
                    String(value?.value ?? "") === String(o[valueKey]) ? " is-selected" : ""
                  }`}
                  onClick={() => selectOption(o)}
                >
                  {o[labelKey]}
                </div>
              ))
            )}
          </div>
        </div>
      ) : null;

    return (
      <div className="so-select-wrap" ref={wrapRef}>
        <button
          type="button"
          ref={btnRef}
          className="so-input so-select-btn"
          disabled={loadingList}
          onClick={handleToggle}
        >
          <span className={`so-select-btn-text${value ? "" : " is-placeholder"}`}>
            {loadingList ? "Loading..." : value ? value.label : placeholder}
          </span>
          {value && !loadingList && (
            <span className="so-select-clear" onClick={clearSelection} aria-label="Clear selection">✕</span>
          )}
          <span className="so-select-caret" aria-hidden="true">▾</span>
        </button>

        {popup && createPortal(popup, document.body)}
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
    .so-card { width: 100%; max-width: 560px; background: #fff; border: 2px solid #1a56db; border-radius: 10px; box-shadow: 0 4px 16px rgba(26,86,219,.18); overflow: hidden; }

    .so-card-header { background: linear-gradient(135deg, #3b6fe0, #1a4fd1); border-bottom: 1px solid #1a4fd1; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; }
    .so-card-header-title { font-size: 14px; font-weight: 700; color: #fff; letter-spacing: .2px; }
    .so-close-x { background: rgba(255,255,255,.15); border: none; font-size: 14px; color: #fff; cursor: pointer; line-height: 1; padding: 6px 8px; border-radius: 6px; transition: background .15s; }
    .so-close-x:hover { background: rgba(255,255,255,.28); }

    .so-card-body { padding: 24px 32px 30px; }
    .so-report-title { text-align: center; font-size: 22px; font-weight: 800; color: #1a3fd6; margin: 0 0 26px; }

    .so-section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; color: #8492a6; margin: 20px 0 10px; }
    .so-section-title:first-of-type { margin-top: 0; }

    .so-radio-row { display: flex; flex-wrap: wrap; gap: 18px; }
    .so-radio-chip { display: flex; align-items: center; gap: 8px; cursor: pointer; user-select: none; font-size: 13px; color: #2b2b2b; font-weight: 500; }
    .so-radio-dot { width: 16px; height: 16px; flex-shrink: 0; border-radius: 50%; border: 1.5px solid #c7cdd6; display: flex; align-items: center; justify-content: center; transition: border-color .15s; }
    .so-radio-chip.active .so-radio-dot { border-color: #1a56db; }
    .so-radio-chip.active .so-radio-dot::after { content: ""; width: 8px; height: 8px; border-radius: 50%; background: #1a56db; }

    .so-combo-slot { margin-top: 12px; }

    .so-field { display: flex; flex-direction: column; gap: 6px; margin-top: 18px; }
    .so-label { font-size: 13px; font-weight: 600; color: #1e293b; }
    .so-input { height: 34px; border: 1px solid #c7cdd6; border-radius: 4px; padding: 0 10px; font-size: 13px; color: #1e2d3d; background: #fff; width: 100%; box-sizing: border-box; transition: border-color .15s, box-shadow .15s; outline: none; }
    .so-input:focus { border-color: #1a56db; box-shadow: 0 0 0 3px rgba(26,86,219,.15); }
    select.so-input { appearance: auto; cursor: pointer; }

    .so-select-wrap { position: relative; }
    .so-select-btn { display: flex; align-items: center; gap: 8px; cursor: pointer; text-align: left; font-family: inherit; }
    .so-select-btn:disabled { cursor: not-allowed; opacity: .7; }
    .so-select-btn-text { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .so-select-btn-text.is-placeholder { color: #8492a6; }
    .so-select-caret { font-size: 11px; color: #8492a6; flex-shrink: 0; }
    .so-select-clear { font-size: 11px; color: #8492a6; flex-shrink: 0; padding: 2px 4px; border-radius: 4px; line-height: 1; }
    .so-select-clear:hover { color: #dc3545; background: #fff0f0; }

    /* Base popup look. Positioning differs for the portal variant below. */
    .so-select-pop { position: absolute; top: calc(100% + 6px); left: 0; right: 0; z-index: 40; background: #fff; border: 1px solid #c7cdd6; border-radius: 8px; box-shadow: 0 8px 24px rgba(20,30,50,.16); overflow: hidden; }

    /* Portal variant: rendered into document.body, so it's positioned with
       fixed viewport coordinates (set inline via popRect) instead of being
       anchored relative to a parent. This is what lets the full result list
       float above the card instead of being clipped/squeezed inside it. */
    .so-select-pop-portal { position: fixed; right: auto; z-index: 3000; max-height: min(320px, calc(100vh - 24px)); display: flex; flex-direction: column; }

    .so-select-search-wrap { padding: 8px; border-bottom: 1px solid #e8ecf0; flex-shrink: 0; }
    .so-select-search { width: 100%; box-sizing: border-box; height: 32px; padding: 0 10px; border: 1px solid #c7cdd6; border-radius: 4px; font-size: 13px; color: #1e2d3d; outline: none; transition: border-color .15s, box-shadow .15s; }
    .so-select-search:focus { border-color: #1a56db; box-shadow: 0 0 0 3px rgba(26,86,219,.15); }
    .so-select-list { max-height: 220px; overflow-y: auto; }
    .so-select-pop-portal .so-select-list { max-height: none; overflow-y: auto; flex: 1; }
    .so-select-opt { padding: 9px 12px; font-size: 13px; color: #1e2d3d; cursor: pointer; transition: background .12s; }
    .so-select-opt:hover { background: #eef3ff; }
    .so-select-opt.is-selected { background: #e3ecff; font-weight: 600; color: #1a56db; }
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
              <div className="so-card-header-title">Supplier Balance</div>
              <button type="button" className="so-close-x" aria-label="Close" onClick={() => navigate(-1)}>✕</button>
            </div>

            <div className="so-card-body">
              <div className="so-report-title">Supplier Balance - Report</div>

              {/* Pane2 — Group By: Supplier / Salesman (true mutually-exclusive radio) */}
              <div className="so-section-title">Group By</div>
              <div className="so-radio-row">
                <div
                  className={`so-radio-chip${groupMode === GROUP_MODE.SUPPLIER ? " active" : ""}`}
                  onClick={selectSupplierMode}
                  role="button"
                  tabIndex={0}
                >
                  <span className="so-radio-dot" aria-hidden="true" />
                  Supplier
                </div>
                <div
                  className={`so-radio-chip${groupMode === GROUP_MODE.SALESMAN ? " active" : ""}`}
                  onClick={selectSalesManMode}
                  role="button"
                  tabIndex={0}
                >
                  <span className="so-radio-dot" aria-hidden="true" />
                  Sales Man
                </div>
              </div>

              <div className="so-combo-slot">
                {groupMode === GROUP_MODE.SUPPLIER ? (
                  <ApiSelect
                    url={SupplierListUrl}
                    payload={{ Comid: Number(session.Comid), Startindex: -1, PageCount: 99999, AccountType: "SUPPLIER", Keyword: "", Column: "" }}
                    labelKey="AccountName"
                    valueKey="Id"
                    value={supplierSel}
                    onChange={handleSupplierChange}
                    placeholder="Select Supplier"
                  />
                ) : (
                  <ApiSelect
                    url={SalesManListUrl}
                    payload={{ Comid: Number(session.Comid), Startindex: -1, PageCount: 99999, AccountType: "SALESMAN", Keyword: "", Column: "" }}
                    labelKey="SalesManName"
                    valueKey="Id"
                    value={salesManSel}
                    onChange={handleSalesManChange}
                    placeholder="Select Salesman"
                  />
                )}
              </div>

              {/* Pane3 — Order By */}
              <div className="so-section-title">Order By</div>
              <div className="so-radio-row">
                {[
                  { value: ORDER_BY.NONE, label: "None" },
                  { value: ORDER_BY.ASCENDING, label: "Ascending" },
                  { value: ORDER_BY.DESCENDING, label: "Descending" },
                ].map((o) => (
                  <div
                    key={o.value}
                    className={`so-radio-chip${orderBy === o.value ? " active" : ""}`}
                    onClick={() => setOrderBy(o.value)}
                    role="button"
                    tabIndex={0}
                  >
                    <span className="so-radio-dot" aria-hidden="true" />
                    {o.label}
                  </div>
                ))}
              </div>

              <div className="so-field">
                <label className="so-label" htmlFor="sb-from-date">From Date</label>
                <input
                  id="sb-from-date"
                  type="date"
                  className="so-input"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
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