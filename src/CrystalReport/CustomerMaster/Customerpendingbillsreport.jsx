// ─────────────────────────────────────────────────────────────────────────────
//  CustomerPendingBillsReport.jsx
//  React conversion of the "Customer Pending Bills-Report" page (jQuery / jqxWidgets)
//  Built on the same skeleton as ClosingStock.jsx / CRMCustomer.jsx:
//    - CC.api / CC.getLocal / CC.getStr from Common.jsx
//    - same permission/session bootstrap pattern
//    - same openReportViewer(BASE_URL + /Reports/ReportViewer.aspx) pattern
//    - single centered panel (no Group-By nav sidebar) — the two checkboxes
//      here are report-type toggles, not a nav-card grouping list.
//    - "cp-" scoped style system (unique prefix, does not collide with
//      cs-/iq-/iw-/cc- used by other converted pages).
//  Styling: matches BranchWise.jsx design system exactly (card, header,
//  field rows, buttons, palette). Only visuals/layout were changed here —
//  all business logic, state, handlers, and API calls are 100% unchanged
//  from the original. This page has no report-type radio nav (three combos
//  + two checkboxes instead), so the card body uses a single centered field
//  column rather than BranchWise's left-radio/right-field split.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Save, XCircle } from "lucide-react";
import * as CC from "../../components/Common";
import Topbar from "../../components/Topbar";
import   DateFieldDDMMYYYY from "../../Commondatetime";

const BASE_URL = "http://localhost:64215";

// ── API endpoints ───────────────────────────────────────────────────────────
// Original ASMX-style path was /SalesReport/CustomerPendingReportCR. Mapped to
// this app's Web API layer per convention: first path segment (SalesReport) →
// module name.
const CustomerPendingReportUrl = "/api/SalesReportApp/CustomerPendingReport_Rct";

// NOTE: the original jQuery file loads these three combos via shared helpers
// (CustomerComboListSingle, loadAreacombo, loadSalesMancombo) whose actual API
// URLs were not provided. These are best-guess endpoint names following the
// SupplierApp/BrandApp naming convention used elsewhere in this app — please
// replace with the real endpoints from your Common.jsx / master API layer if
// different. CustomerListUrl matches the one used in CRMCustomer.jsx.
const CustomerListUrl = "/api/SupplierApp/SelectSupplierAll";
const AreaListUrl = "/api/AreaApp/SelectArea";
const SalesManListUrl = "/api/SalesManApp/SelectSalesMan";

export default function CustomerPendingBillsReport() {
  const navigate = useNavigate();

  // ── Session / permission state ─────────────────────────────────────────
  const [pageAccess, setPageAccess] = useState({
    ready: false,
    allowed: false,
    pageview: 0,
  });

  // ── Company / settings state (loaded once from localStorage, same as jQuery) ──
  const [session, setSession] = useState({
    Comid: "",
    MComid: "",
    CName: "",
    CAddress: "",
    CPhone: "",
  });

  // ── Combo selections { value, label } ───────────────────────────────────
  const [customerSel, setCustomerSel] = useState(null);
  const [areaSel, setAreaSel] = useState(null);
  const [salesManSel, setSalesManSel] = useState(null);

  // ── Report-type checkboxes (mutually exclusive) ─────────────────────────
  const [chkArea, setChkArea] = useState(false);
  const [chkSales, setChkSales] = useState(false);

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

    const menudata = menulist.filter((obj) => obj.PageName === "Customer Pending Bills-Report");
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

  // ── Esc key — "Do you want to quit page?" (preserved from ClosingStock.jsx) ──
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

  // ── Report-type checkbox handlers ───────────────────────────────────────
  // chkArea's own click handler: reads its OWN (just-toggled) value — if now
  // checked, it clears the Salesman combo and unchecks chkSales. This part
  // matches the source exactly.
  const handleChkAreaChange = useCallback((checked) => {
    setChkArea(checked);
    if (checked) {
      setSalesManSel(null);
      setChkSales(false);
    }
  }, []);

  // chkSales's click handler in the source reads $("#chkArea").val() instead
  // of its own checkbox — a copy-paste quirk in the legacy file. Preserved
  // verbatim here rather than "fixed": toggling Sales only clears the Area
  // combo/unchecks Area when Area happens to already be checked at the time
  // of the click, regardless of the new Sales state.
  const handleChkSalesChange = useCallback(
    (checked) => {
      setChkSales(checked);
      if (chkArea) {
        setAreaSel(null);
        setChkArea(false);
      }
    },
    [chkArea]
  );

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
        () => {
          w.document.title = "Customer Pending-Report";
        },
        false
      );
    }
    return w;
  }, []);

  // ── Refresh button — clears all three combos + both checkboxes ─────────
  const handleRefresh = useCallback(() => {
    setCustomerSel(null);
    setSalesManSel(null);
    setAreaSel(null);
    setChkArea(false);
    setChkSales(false);
    setMsg(null);
  }, []);

  // ── View button — replicates the Customer Pending $.ajax logic exactly ─
  const handleView = useCallback(async () => {
    // Sequential resolution mirroring the source: customer, then area, then
    // salesman — each later block overwrites GroupByText if its own combo
    // has a selection, exactly as the jQuery if-blocks do.
    let GroupByText = "";

    if (customerSel != null) {
      if (customerSel.value == null || customerSel.value === "") {
        setMsg({ text: "Please Select Valid Supplier Name !!!.", isErr: true });
        setCustomerSel(null);
        return;
      }
      GroupByText = customerSel.label;
    }
    if (areaSel != null) {
      if (areaSel.value == null || areaSel.value === "") {
        setMsg({ text: "Please Select Valid Area Name !!!.", isErr: true });
        setAreaSel(null);
        return;
      }
      GroupByText = areaSel.label;
    }
    if (salesManSel != null) {
      if (salesManSel.value == null || salesManSel.value === "") {
        setMsg({ text: "Please Select Valid Salesman Name !!!.", isErr: true });
        setSalesManSel(null);
        return;
      }
      GroupByText = salesManSel.label;
    }

    let ReportTitle = "";
    let RptType = "";
    if (chkArea) {
      ReportTitle = "Area Wise Customer Pending Bill Report";
      RptType = "AREA";
    } else if (chkSales) {
      ReportTitle = "Saleman Wise Customer Pending Bill Report";
      RptType = "SALES";
    } else {
      ReportTitle = "Customer Pending Bill Report";
      RptType = "";
    }

    setLoading(true);
    setMsg(null);

    try {
      const res = await CC.api(
        CustomerPendingReportUrl,
        null,
        { CacheKeyType: "CustomerPendingReportCR", React: 1 },
        {
          GroupBy: GroupByText,
          ReportType: RptType,
          Comid: session.Comid,
          MComid: session.MComid,
        }
      );

      if (res) {
        const cacheKey = res.Data15 || res.CacheKey || "";
        openReportViewer({
          ReportName: "CustomerPendingReport",
          CacheKey: cacheKey,
          ReportType: RptType,
          ReportTitle,
          CName: session?.CName || localStorage.getItem("CompanyName") || "",
          CAddress: session?.CAddress || localStorage.getItem("Address") || "",
          CPhone: session?.CPhone || localStorage.getItem("Phone") || "",

        });
      } else {
        setMsg({ text: "No Record !!!.", isErr: true });
      }
    } catch (err) {
      setMsg({ text: err.message || "Something went wrong.", isErr: true });
    } finally {
      setLoading(false);
      // Clear the three combo selections after view, matching the jQuery
      // file's synchronous clearSelection() calls right after the
      // (async:false) ajax. Note the checkboxes are NOT reset here — only
      // Refresh resets them, same as the source.
      setCustomerSel(null);
      setSalesManSel(null);
      setAreaSel(null);
    }
  }, [customerSel, areaSel, salesManSel, chkArea, chkSales, session, openReportViewer]);

  // ── Combo box — same ApiSelect pattern used in CRMCustomer.jsx ──────────
  // Native <select> replaced with a searchable dropdown popup so the user
  // can instant-filter long lookup lists. The results popup is rendered
  // through a portal into document.body and positioned with `fixed`
  // coordinates computed from the trigger button's bounding rect, so it
  // floats fully visible above the card, even with three stacked combos.
  // Props, data fetching, and the onChange({ value, label }) contract are
  // unchanged — only the selection UI changed. `id` is still accepted (and
  // passed by each call site below) since this page has three distinct
  // combos that need distinct label/button ids.
  const ApiSelect = ({ id, url, payload, headers = {}, labelKey, valueKey, value, onChange, placeholder }) => {
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
    // close it if the trigger scrolls out of the viewport entirely.
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
          className="cp-select-pop cp-select-pop-portal"
          style={{ top: popRect.top, left: popRect.left, width: popRect.width }}
        >
          <div className="cp-select-search-wrap">
            <input
              ref={searchRef}
              type="text"
              className="cp-select-search"
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
          <div className="cp-select-list">
            {filtered.length === 0 ? (
              <div className="cp-select-empty">No matches found</div>
            ) : (
              filtered.map((o) => (
                <div
                  key={o[valueKey]}
                  className={`cp-select-opt${
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
      <div className="cp-field">
        <label className="cp-label" htmlFor={id}>{placeholder.replace("Select ", "")}</label>
        <div className="cp-select-wrap" ref={wrapRef}>
          <button
            type="button"
            id={id}
            ref={btnRef}
            className="cp-input cp-select-btn"
            disabled={loadingList}
            onClick={handleToggle}
          >
            <span className={`cp-select-btn-text${!value ? " is-placeholder" : ""}`}>
              {loadingList ? "Loading..." : value?.label || placeholder}
            </span>
            {value && !loadingList && (
              <span
                className="cp-select-clear"
                onClick={handleClear}
                role="button"
                aria-label="Clear selection"
                title="Clear"
              >
                ✕
              </span>
            )}
            <span className="cp-select-caret" aria-hidden="true">▾</span>
          </button>

          {popup && createPortal(popup, document.body)}
        </div>
      </div>
    );
  };

  // ── Scoped styles injected once ─────────────────────────────────────────
  // Design system copied 1:1 from BranchWise.jsx (card, header, field rows,
  // buttons, palette), "cp-" prefix preserved. This page has no report-type
  // radio nav (three combos + two checkboxes instead), so the card body
  // uses a single centered field column instead of BranchWise's
  // left-radio/right-field split.
  //   Border / header / heading : blue  #1a56db
  //   Save accent                : green #1e7e34
  //   Cancel / link accent       : red   #dc3545
  const styles = `
    .cp-shell { min-height: 100vh; background: #f0f2f5; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; flex-direction: column; }
    .cp-layout { flex: 1; display: flex; align-items: flex-start; justify-content: center; padding: 24px; box-sizing: border-box; }
    .cp-panel { width: 100%; max-width: 560px; background: #fff; border: 2px solid #1a56db; border-radius: 10px; box-shadow: 0 4px 16px rgba(26,86,219,.18); overflow: hidden; }

    .cp-card-header { background: linear-gradient(135deg, #3b6fe0, #1a4fd1); border-bottom: 1px solid #1a4fd1; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; }
    .cp-card-header-title { font-size: 14px; font-weight: 700; color: #fff; letter-spacing: .2px; }
    .cp-close-x { background: rgba(255,255,255,.15); border: none; font-size: 14px; color: #fff; cursor: pointer; line-height: 1; padding: 6px 8px; border-radius: 6px; transition: background .15s; }
    .cp-close-x:hover { background: rgba(255,255,255,.28); }

    .cp-panel-body { padding: 24px 32px 30px; }
    .cp-panel-title { text-align: center; font-size: 22px; font-weight: 800; color: #1a3fd6; margin: 0 0 26px; }

    .cp-form-grid { display: flex; flex-direction: column; gap: 16px; margin-bottom: 8px; }
    .cp-field { display: flex; align-items: center; gap: 14px; }
    .cp-label { font-size: 13px; font-weight: 600; color: #1e293b; width: 96px; flex-shrink: 0; }
    .cp-input { height: 34px; border: 1px solid #c7cdd6; border-radius: 4px; padding: 0 10px; font-size: 13px; color: #1e2d3d; background: #fff; width: 100%; box-sizing: border-box; transition: border-color .15s, box-shadow .15s; outline: none; }
    .cp-input:focus { border-color: #1a56db; box-shadow: 0 0 0 3px rgba(26,86,219,.15); }
    select.cp-input { appearance: auto; cursor: pointer; }
    .cp-input:disabled { background: #f5f6f8; cursor: not-allowed; }

    /* Searchable select (Customer / Area / Salesman) */
    .cp-select-wrap { position: relative; width: 100%; }
    .cp-select-btn { display: flex; align-items: center; gap: 8px; cursor: pointer; text-align: left; font-family: inherit; }
    .cp-select-btn:disabled { cursor: not-allowed; }
    .cp-select-btn-text { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .cp-select-btn-text.is-placeholder { color: #8a94a3; }
    .cp-select-clear { flex-shrink: 0; width: 16px; height: 16px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #8a94a3; transition: background .15s, color .15s; }
    .cp-select-clear:hover { background: #fff0f0; color: #dc3545; }
    .cp-select-caret { flex-shrink: 0; font-size: 10px; color: #8a94a3; }

    /* Base popup look. Positioning differs for the portal variant below. */
    .cp-select-pop { position: absolute; top: calc(100% + 6px); left: 0; right: 0; z-index: 40; background: #fff; border: 1px solid #c7cdd6; border-radius: 8px; box-shadow: 0 8px 24px rgba(26,43,80,.16); overflow: hidden; }

    /* Portal variant: rendered into document.body, so it's positioned with
       fixed viewport coordinates (set inline via popRect) instead of being
       anchored relative to a parent. This is what lets the full result list
       float above the card instead of being clipped/squeezed inside it. */
    .cp-select-pop-portal { position: fixed; right: auto; z-index: 3000; max-height: min(320px, calc(100vh - 24px)); display: flex; flex-direction: column; }

    .cp-select-search-wrap { padding: 8px; border-bottom: 1px solid #e8ecf0; flex-shrink: 0; }
    .cp-select-search { width: 100%; height: 32px; border: 1px solid #c7cdd6; border-radius: 4px; padding: 0 10px; font-size: 13px; color: #1e2d3d; box-sizing: border-box; outline: none; transition: border-color .15s, box-shadow .15s; }
    .cp-select-search:focus { border-color: #1a56db; box-shadow: 0 0 0 3px rgba(26,86,219,.15); }
    .cp-select-list { max-height: 260px; overflow-y: auto; }
    .cp-select-pop-portal .cp-select-list { max-height: none; overflow-y: auto; flex: 1; }
    .cp-select-opt { padding: 8px 12px; font-size: 13px; color: #1e2d3d; cursor: pointer; transition: background .12s; }
    .cp-select-opt:hover { background: #eef3ff; }
    .cp-select-opt.is-selected { background: #e3ecff; color: #1a4fd1; font-weight: 600; }
    .cp-select-empty { padding: 14px 12px; font-size: 13px; color: #8a94a3; text-align: center; }

    .cp-section-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .6px; color: #8a94a6; margin: 20px 0 10px; }
    .cp-toggle-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 16px; }
    .cp-toggle-row { display: flex; align-items: center; gap: 8px; height: 34px; background: #f7f9fc; border: 1px solid #c7cdd6; border-radius: 4px; padding: 0 10px; cursor: pointer; font-size: 13px; color: #1e2d3d; font-weight: 500; user-select: none; transition: border-color .15s; }
    .cp-toggle-row:hover { border-color: #1a56db; }
    .cp-toggle-row input[type="checkbox"] { width: 15px; height: 15px; accent-color: #1a56db; cursor: pointer; flex-shrink: 0; }

    .cp-actions { display: flex; gap: 12px; justify-content: center; margin-top: 32px; padding-top: 22px; border-top: 1px solid #e8ecf0; }
    .cp-btn { height: 38px; padding: 0 30px; border-radius: 6px; border: 1px solid #1a56db; font-size: 14px; font-weight: 700; cursor: pointer; transition: opacity .15s, box-shadow .15s, background .15s; display: flex; align-items: center; gap: 8px; background: #fff; color: #1a56db; }
    .cp-btn:disabled { opacity: .5; cursor: not-allowed; }
    .cp-btn:not(:disabled):hover { background: #eef3ff; }
    .cp-btn-primary { border-color: #1e7e34; color: #1e7e34; }
    .cp-btn-primary .cp-icon-save { color: #1e7e34; }
    .cp-btn-secondary { border-color: #dc3545; color: #dc3545; }
    .cp-btn-secondary .cp-icon-cancel { color: #dc3545; }

    .cp-msg { margin-top: 18px; padding: 10px 14px; border-radius: 8px; font-size: 13px; font-weight: 500; text-align: center; }
    .cp-msg.err { background: #fff0f0; color: #c53030; border: 1px solid #fed7d7; }
    .cp-msg.ok  { background: #f0fff4; color: #276749; border: 1px solid #c6f6d5; }

    @media (max-width: 620px) {
      .cp-panel-body { padding: 20px; }
      .cp-field { flex-direction: column; align-items: stretch; gap: 6px; }
      .cp-label { width: auto; }
      .cp-toggle-grid { grid-template-columns: 1fr; }
    }
  `;

  if (!pageAccess.ready) {
    return (
      <>
        <style>{styles}</style>
        <div className="cp-shell">
          <Topbar />
          <div className="cp-layout">
            <div className="cp-panel">
              <div className="cp-panel-body">
                {msg && <div className={`cp-msg ${msg.isErr ? "err" : "ok"}`}>{msg.text}</div>}
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (!pageAccess.allowed) {
    return (
      <>
        <style>{styles}</style>
        <div className="cp-shell">
          <Topbar />
          <div className="cp-layout">
            <div className="cp-panel">
              <div className="cp-panel-body">
                <div className="cp-msg err">Page Access Permission Denied !!!.</div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{styles}</style>
      <div className="cp-shell">
        <Topbar />

        <div className="cp-layout">
          <div className="cp-panel">
            <div className="cp-card-header">
              <div className="cp-card-header-title">Sales Report</div>
              <button type="button" className="cp-close-x" aria-label="Close" onClick={() => navigate(-1)}>✕</button>
            </div>

            <div className="cp-panel-body">
              <div className="cp-panel-title">Customer Pending Bills Report</div>

              <div className="cp-form-grid">
                <ApiSelect
                  id="cp-customer"
                  url={CustomerListUrl}
                  payload={{ Comid: session.Comid,AccountType:"CUSTOMER" }}
                  labelKey="AccountName"
                  valueKey="Id"
                  value={customerSel}
                  onChange={setCustomerSel}
                  placeholder="Select Customer"
                />
                <ApiSelect
                  id="cp-area"
                  url={AreaListUrl}
                  payload={{ Comid: session.Comid }}
                  labelKey="AreaName"
                  valueKey="Id"
                  value={areaSel}
                  onChange={setAreaSel}
                  placeholder="Select Area"
                />
                <ApiSelect
                  id="cp-salesman"
                  url={SalesManListUrl}
                  payload={{ Comid: session.Comid }}
                  labelKey="SalesManName"
                  valueKey="Id"
                  value={salesManSel}
                  onChange={setSalesManSel}
                  placeholder="Select Salesman"
                />
              </div>

              <div className="cp-section-title">Report Type</div>
              <div className="cp-toggle-grid">
                <label className="cp-toggle-row">
                  <input
                    type="checkbox"
                    checked={chkArea}
                    onChange={(e) => handleChkAreaChange(e.target.checked)}
                  />
                  Area Wise
                </label>
                <label className="cp-toggle-row">
                  <input
                    type="checkbox"
                    checked={chkSales}
                    onChange={(e) => handleChkSalesChange(e.target.checked)}
                  />
                  Salesman Wise
                </label>
              </div>

              <div className="cp-actions">
                <button
                  type="button"
                  className="cp-btn cp-btn-primary"
                  disabled={loading || pageAccess.pageview === 0}
                  onClick={handleView}
                >
                  <Save size={16} className="cp-icon-save" />
                  {loading ? "Loading…" : "View"}
                </button>
                <button
                  type="button"
                  className="cp-btn cp-btn-secondary"
                  onClick={handleRefresh}
                  disabled={loading}
                >
                  <XCircle size={16} className="cp-icon-cancel" />
                  Refresh
                </button>
              </div>

              {msg && <div className={`cp-msg ${msg.isErr ? "err" : "ok"}`}>{msg.text}</div>}
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