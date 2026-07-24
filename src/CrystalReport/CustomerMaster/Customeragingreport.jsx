// ─────────────────────────────────────────────────────────────────────────────
//  CustomerAgingReport.jsx
//  React conversion of customeragingreport.js (jQuery / jqxWidgets) — "Customer Aging Report"
//  Built on the same skeleton as ClosingStock.jsx / ItemwiseStockDetails.jsx:
//    - CC.api / CC.getLocal / CC.getStr from Common.jsx
//    - same permission/session bootstrap pattern
//    - same openReportViewer(BASE_URL + /Reports/ReportViewer.aspx) pattern
//    - no Group-By nav needed here (single customer picker only) — single
//      centered panel layout, like ItemwiseStockDetails.jsx, scoped "ca-"
//  Styling: token-for-token identical values to ClosingStock/ItemwiseStockDetails
//  — only the class prefix changes ("ca-" — unused by any other converted page).
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
// NOTE: the original jQuery file posts to "/SalesReport/CustomerAgingReport"
// (ASMX-style path). Following the same module-inference convention used for
// the other converted pages ("/Stock/..." -> "/api/StockReportApp/..."),
// this becomes "/api/SalesReportApp/CustomerAgingReport" — please verify
// against the real Web API route.
const CustomerAgingReportUrl = "/api/SalesReportApp/CustomerAgingReport";

// NOTE: the original file loads the customer combo via a shared helper,
// CustomerComboListSingle("#cmbcustomer", true, "CUSTOMER"), whose actual API
// URL was not provided. This mirrors the naming convention used for
// SupplierListUrl ("/api/SupplierApp/SelectSupplier" + AccountType filter) —
// best-guess endpoint, please replace with the real one from Common.jsx.
const CustomerListUrl = "/api/SupplierApp/SelectSupplierAll";

export default function CustomerAgingReport() {
  const navigate = useNavigate();

  // ── Session / permission state ─────────────────────────────────────────
  const [pageAccess, setPageAccess] = useState({
    ready: false,
    allowed: false,
    pageview: 0,
  });

  // ── Company / settings state (loaded once from localStorage) ───────────
  const [session, setSession] = useState({
    Comid: "",
    MComid: "",
    CName: "",
    CAddress: "",
    CPhone: "",
  });

  // ── Customer combo selection { value, label } ───────────────────────────
  const [customerSel, setCustomerSel] = useState(null);

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

    const menudata = menulist.filter((obj) => obj.PageName === "Customer Aging Report");
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

  // ── Esc key — "Do you want to quit page?" (preserved convention) ───────
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
          w.document.title = "Customer Aging-Report";
        },
        false
      );
    }
    return w;
  }, []);

  // ── Refresh button — clears the customer selection only ────────────────
  const handleRefresh = useCallback(() => {
    setCustomerSel(null);
    setMsg(null);
  }, []);

  // ── View button — replicates the customeragingreport.js $.ajax logic ───
  const handleView = useCallback(async () => {
    // Mirrors: GroupByText = ""; if a customer item is selected, validate it.
    let GroupByText = "";
    if (customerSel != null) {
      if (customerSel.value == null || customerSel.value === "") {
        setMsg({ text: "Please Select Valid Customer Name !!!.", isErr: true });
        setCustomerSel(null);
        return;
      }
      GroupByText = customerSel.label;
    }

    const Comid = session.Comid;
    const MComid = session.MComid;

    setLoading(true);
    setMsg(null);

    try {
      const res = await CC.api(
        CustomerAgingReportUrl,
        null,
        { CacheKeyType: "CustomerAgingReport", React: 1 },
        {
          GroupBy: GroupByText,
          Comid,
          MComid,
        }
      );

      if (res?.ok || res?.IsSuccess) {
        const cacheKey = res.Data15 || res.CacheKey || "";
        openReportViewer({
          ReportName: "CustomerAgingReport",
          GroupByText,
          CacheKey: cacheKey,
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
      // Matches the original: clear the combo selection after the request
      // completes, whether it succeeded or not.
      setCustomerSel(null);
    }
  }, [customerSel, session, openReportViewer]);

  // ── Reusable API-backed select — same searchable-popup pattern used in
  // CRMCustomer.jsx. Native <select> replaced with a searchable dropdown
  // popup so the user can instant-filter long lookup lists. The results
  // popup is rendered through a portal into document.body and positioned
  // with `fixed` coordinates computed from the trigger button's bounding
  // rect, so it floats fully visible above the card. Props, data fetching,
  // and the onChange({ value, label }) contract are unchanged — only the
  // selection UI changed.
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
          className="so-select-pop so-select-pop-portal"
          style={{ top: popRect.top, left: popRect.left, width: popRect.width }}
        >
          <div className="so-select-search-wrap">
            <input
              ref={searchRef}
              type="text"
              className="so-select-search"
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
          <div className="so-select-list">
            {filtered.length === 0 ? (
              <div className="so-select-empty">No matches found</div>
            ) : (
              filtered.map((o) => (
                <div
                  key={o[valueKey]}
                  className={`so-select-opt${
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
      <div className="so-field">
        <label className="so-label" htmlFor="ca-customer">
          Customer Name
        </label>
        <div className="so-select-wrap" ref={wrapRef}>
          <button
            type="button"
            id="ca-customer"
            ref={btnRef}
            className="so-input so-select-btn"
            disabled={loadingList}
            onClick={handleToggle}
          >
            <span className={`so-select-btn-text${!value ? " is-placeholder" : ""}`}>
              {loadingList ? "Loading..." : value?.label || placeholder}
            </span>
            {value && !loadingList && (
              <span
                className="so-select-clear"
                onClick={handleClear}
                role="button"
                aria-label="Clear selection"
                title="Clear"
              >
                ✕
              </span>
            )}
            <span className="so-select-caret" aria-hidden="true">▾</span>
          </button>

          {popup && createPortal(popup, document.body)}
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
    .so-card { width: 100%; max-width: 520px; background: #fff; border: 2px solid #1a56db; border-radius: 10px; box-shadow: 0 4px 16px rgba(26,86,219,.18); overflow: hidden; }

    .so-card-header { background: linear-gradient(135deg, #3b6fe0, #1a4fd1); border-bottom: 1px solid #1a4fd1; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; }
    .so-card-header-title { font-size: 14px; font-weight: 700; color: #fff; letter-spacing: .2px; }
    .so-close-x { background: rgba(255,255,255,.15); border: none; font-size: 14px; color: #fff; cursor: pointer; line-height: 1; padding: 6px 8px; border-radius: 6px; transition: background .15s; }
    .so-close-x:hover { background: rgba(255,255,255,.28); }

    .so-card-body { padding: 24px 32px 30px; }
    .so-report-title { text-align: center; font-size: 22px; font-weight: 800; color: #1a3fd6; margin: 0 0 26px; }

    .so-form-grid { display: grid; grid-template-columns: 1fr; gap: 16px; align-items: start; margin-top: 4px; }
    .so-field { display: flex; flex-direction: column; gap: 6px; }
    .so-label { font-size: 13px; font-weight: 600; color: #1e293b; }
    .so-input { height: 34px; border: 1px solid #c7cdd6; border-radius: 4px; padding: 0 10px; font-size: 13px; color: #1e2d3d; background: #fff; width: 100%; box-sizing: border-box; transition: border-color .15s, box-shadow .15s; outline: none; }
    .so-input:focus { border-color: #1a56db; box-shadow: 0 0 0 3px rgba(26,86,219,.15); }
    select.so-input { appearance: auto; cursor: pointer; }
    .so-input:disabled { background: #f5f6f8; cursor: not-allowed; }

    /* Searchable select (Customer Name) */
    .so-select-wrap { position: relative; width: 100%; }
    .so-select-btn { display: flex; align-items: center; gap: 8px; cursor: pointer; text-align: left; font-family: inherit; }
    .so-select-btn:disabled { cursor: not-allowed; }
    .so-select-btn-text { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .so-select-btn-text.is-placeholder { color: #8a94a3; }
    .so-select-clear { flex-shrink: 0; width: 16px; height: 16px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #8a94a3; transition: background .15s, color .15s; }
    .so-select-clear:hover { background: #fff0f0; color: #dc3545; }
    .so-select-caret { flex-shrink: 0; font-size: 10px; color: #8a94a3; }

    /* Base popup look. Positioning differs for the portal variant below. */
    .so-select-pop { position: absolute; top: calc(100% + 6px); left: 0; right: 0; z-index: 40; background: #fff; border: 1px solid #c7cdd6; border-radius: 8px; box-shadow: 0 8px 24px rgba(26,43,80,.16); overflow: hidden; }

    /* Portal variant: rendered into document.body, so it's positioned with
       fixed viewport coordinates (set inline via popRect) instead of being
       anchored relative to a parent. This is what lets the full result list
       float above the card instead of being clipped/squeezed inside it. */
    .so-select-pop-portal { position: fixed; right: auto; z-index: 3000; max-height: min(320px, calc(100vh - 24px)); display: flex; flex-direction: column; }

    .so-select-search-wrap { padding: 8px; border-bottom: 1px solid #e8ecf0; flex-shrink: 0; }
    .so-select-search { width: 100%; height: 32px; border: 1px solid #c7cdd6; border-radius: 4px; padding: 0 10px; font-size: 13px; color: #1e2d3d; box-sizing: border-box; outline: none; transition: border-color .15s, box-shadow .15s; }
    .so-select-search:focus { border-color: #1a56db; box-shadow: 0 0 0 3px rgba(26,86,219,.15); }
    .so-select-list { max-height: 260px; overflow-y: auto; }
    .so-select-pop-portal .so-select-list { max-height: none; overflow-y: auto; flex: 1; }
    .so-select-opt { padding: 8px 12px; font-size: 13px; color: #1e2d3d; cursor: pointer; transition: background .12s; }
    .so-select-opt:hover { background: #eef3ff; }
    .so-select-opt.is-selected { background: #e3ecff; color: #1a4fd1; font-weight: 600; }
    .so-select-empty { padding: 14px 12px; font-size: 13px; color: #8a94a3; text-align: center; }

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
              <div className="so-card-header-title">Customer Aging Report</div>
              <button type="button" className="so-close-x" aria-label="Close" onClick={() => navigate(-1)}>✕</button>
            </div>

            <div className="so-card-body">
              <div className="so-report-title">Customer Aging Report</div>

              <div className="so-form-grid">
                <ApiSelect
                  url={CustomerListUrl}
                  payload={{ Comid: session.Comid, AccountType: "CUSTOMER" }}
                  labelKey="AccountName"
                  valueKey="Id"
                  value={customerSel}
                  onChange={setCustomerSel}
                  placeholder="Select Customer"
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