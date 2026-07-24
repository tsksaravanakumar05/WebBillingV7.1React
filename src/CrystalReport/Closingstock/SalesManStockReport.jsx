// ─────────────────────────────────────────────────────────────────────────────
//  SalesManStockReport.jsx
//  React conversion of the legacy SalesManStockReport.js jQuery/jqxWidgets page
//  ("Customer Statement" menu entry — SalesMan combo + ItemWise Details /
//  With Total checkboxes, toggling between the "SalesMan wise" and
//  "SalesMan wise ALL" stock reports). Built on the exact same skeleton/design
//  as ItemwiseStockDetails.jsx (the reference component supplied for this
//  conversion):
//    - CC.api / CC.getLocal / CC.getStr from Common.jsx
//    - same permission/session bootstrap pattern
//    - same openReportViewer(BASE_URL + /Reports/ReportViewer.aspx) pattern
//    - same panel / chip / "sm-" scoped style system (mirrors the "iw-"
//      prefix used in ItemwiseStockDetails.jsx, renamed for this page)
//  Styling: MasterPage.css tokens only — no new theme colors.
//
//  Business logic preserved 1:1 from SalesManStockReport.js:
//    - Permission lookup uses PageName "Customer Statement" (kept exactly as
//      in the legacy file, even though the page itself is a SalesMan Stock
//      Report — this is the original menu key and must not be changed).
//    - Two legacy MVC endpoints, called exactly as before:
//        POST /Stock/SalesManStockReport     (when "Item Wise Details" OFF)
//        POST /Stock/SalesManAllStockReport  (when "Item Wise Details" ON)
//    - CustomerWise / Narration flag logic reproduced exactly, including the
//      original's override of CustomerWise when "With Total" is checked.
//    - Report viewer window title is set to 'Customer Payment - Report' in
//      both branches — this looks like a copy/paste artifact in the legacy
//      file, but per the conversion requirements no business logic/text is
//      changed, so it is kept verbatim.
//    - SalesMan selection is only mandatory when "Item Wise Details" is OFF,
//      exactly as in the legacy validation block.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Save, XCircle } from "lucide-react";
import * as CC from "../../components/Common";
import Topbar from "../../components/Topbar";
import   DateFieldDDMMYYYY from "../../Commondatetime";

const BASE_URL = "http://localhost:64215";

// ── API endpoints ───────────────────────────────────────────────────────────
// Kept exactly as in the legacy $.ajax calls — these are the original MVC
// action URLs, not the newer /api/... REST endpoints.
const SalesManStockReportUrl = "/Stock/SalesManStockReport";
const SalesManAllStockReportUrl = "/Stock/SalesManAllStockReport";

// Confirmed against the real Common.jsx: it already exports a ready-made
// loadSalesmanData(MComid) helper (uses SalesManSelect = "/api/SalesManApp/SelectSalesMan"
// under the hood) — this is the true React equivalent of the legacy
// loadSalesMancombo("#cmbcustomer") helper, so we call that directly instead
// of guessing an endpoint.

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

export default function SalesManStockReport() {
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
    BillFormatName: "",
    TaxName: "",
    Taxtype: 1,
  });

  // ── SalesMan list (loadSalesMancombo equivalent) — fetched once ────────
  const [salesManList, setSalesManList] = useState([]);
  const [salesManLoading, setSalesManLoading] = useState(false);

  // ── Selection state (cmbcustomer equivalent — GroupByText/custname) ────
  const [salesManSel, setSalesManSel] = useState(null); // { value: Id, label: Name }

  // ── Date range ───────────────────────────────────────────────────────────
  const [fromDate, setFromDate] = useState(todayStr());
  const [toDate, setToDate] = useState(todayStr());

  // ── Checkboxes (chkiwdetails / chkwtotal) ───────────────────────────────
  const [chkItemWiseDetails, setChkItemWiseDetails] = useState(false); // #chkiwdetails
  const [chkWithTotal, setChkWithTotal] = useState(false); // #chkwtotal

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

    // PageName kept exactly as in the legacy file ("Customer Statement").
    const menudata = menulist.filter((obj) => obj.PageName === "Customer Statement");
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
      // BillFormatName = ComSet[0].SaleBillFormat
      BillFormatName: ComSet[0]?.SaleBillFormat || "",
      // TaxName = ComSet[0].POSTax; Taxtype = 0 when "Inclusive Don't Show Tax", else 1.
      // Kept exactly as computed in the legacy file, even though it is not
      // ultimately sent to either report call there either.
      TaxName: ComSet[0]?.POSTax || "",
      Taxtype: ComSet[0]?.POSTax === "Inclusive Don't Show Tax" ? 0 : 1,
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

  // ── Load the SalesMan combo once (mirrors loadSalesMancombo("#cmbcustomer")) ─
  useEffect(() => {
    if (!pageAccess.ready) return;
    let active = true;
    (async () => {
      setSalesManLoading(true);
      try {
        const raw = await CC.loadSalesmanData(session.MComid);
        if (!active) return;
        setSalesManList(Array.isArray(raw) ? raw : []);
      } catch (err) {
        console.error(err);
      } finally {
        if (active) setSalesManLoading(false);
      }
    })();
    return () => { active = false; };
  }, [pageAccess.ready, session.MComid]);

  // ── Esc key — "Do you want to quit page?" (same app-shell convention as
  //    ItemwiseStockDetails.jsx) ───────────────────────────────────────────
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

  // ── Report viewer opener — same pattern as ItemwiseStockDetails.jsx ─────
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
    // Window title kept exactly as in the legacy file (both branches use the
    // same 'Customer Payment - Report' title verbatim).
    if (w) {
      w.addEventListener(
        "load",
        function () {
          w.document.title = "Customer Payment - Report";
        },
        false
      );
    }
    return w;
  }, []);

  // ── #btnview click handler, replicated exactly ──────────────────────────
  const handleView = useCallback(async () => {
    const custname = salesManSel?.label ?? "";
    const GroupByText = salesManSel?.value ?? "";

    // if (custname == "" || GroupByText == null) { if (!chkiwdetails) { alert(...) return; } }
    if (custname === "" || GroupByText == null || GroupByText === "") {
      if (!chkItemWiseDetails) {
        setMsg({ text: "Please Select Valid SalesMan !!!.", isErr: true });
        setSalesManSel(null);
        return;
      }
    }

    const Fromdate = toMMDDYYYY(fromDate);
    const Todate = toMMDDYYYY(toDate);
    const startdate = new Date(Fromdate);
    const enddate = new Date(Todate);
    if (startdate > enddate) {
      setMsg({ text: "From Date Is Greater Than To Date!!", isErr: true });
      return;
    }

    // var CustomerWise = chkiwdetails; var Narration = chkwtotal;
    // if (chkwtotal == true) { CustomerWise = chkwtotal; }
    let CustomerWise = chkItemWiseDetails;
    const Narration = chkWithTotal;
    if (chkWithTotal === true) {
      CustomerWise = chkWithTotal;
    }

    setMsg(null);
    setLoading(true);

    try {
      if (!chkItemWiseDetails) {
        // ── branch 1: /Stock/SalesManStockReport (Sid = selected salesman) ──
        const res = await CC.api(
          SalesManStockReportUrl,
          null,
          {},
          {
            Fromdate,
            Todate,
            MComid: session.MComid,
            Comid: session.Comid,
            Sid: GroupByText,
          }
        );

        if (res?.ok === true) {
          openReportViewer({
            ReportName: "SalesManWiseStockReport",
            GroupBy: custname,
            CustomerWise,
            Narration,
            Fromdate,
            Todate,
            CName: session.CName,
            CAddress: session.CAddress,
            CPhone: session.CPhone,
            BillFormatName: session.BillFormatName,
          });
        } else {
          setMsg({ text: "No Record !!!.", isErr: true });
        }
      } else {
        // ── branch 2: /Stock/SalesManAllStockReport (no Sid) ────────────────
        const res = await CC.api(
          SalesManAllStockReportUrl,
          null,
          {},
          {
            Fromdate,
            Todate,
            MComid: session.MComid,
            Comid: session.Comid,
          }
        );

        if (res?.ok === true) {
          openReportViewer({
            ReportName: "SalesManWiseAllStockReport",
            GroupBy: custname,
            CustomerWise,
            Narration,
            Fromdate,
            Todate,
            CName: session.CName,
            CAddress: session.CAddress,
            CPhone: session.CPhone,
            BillFormatName: session.BillFormatName,
          });
        } else {
          setMsg({ text: "No Record !!!.", isErr: true });
        }
      }
    } catch (err) {
      // Mirrors the legacy error handler (title + formatErrorMessage text).
      setMsg({ text: err.message || "Something went wrong.", isErr: true });
    } finally {
      setLoading(false);
      // $("#cmbcustomer").jqxComboBox('clearSelection'); — runs after both
      // branches complete, unconditionally, exactly as in the legacy file.
      setSalesManSel(null);
    }
  }, [salesManSel, chkItemWiseDetails, chkWithTotal, fromDate, toDate, session, openReportViewer]);

  // ── #btnrefresh click handler, replicated exactly ───────────────────────
  const handleRefresh = useCallback(() => {
    setSalesManSel(null);
    setChkItemWiseDetails(false);
    setChkWithTotal(false);
    setFromDate(todayStr());
    setToDate(todayStr());
    setMsg(null);
  }, []);

  // ── Re-usable SalesMan combo, driven off the already-fetched salesManList —
  //    now a searchable dropdown instead of a plain <select> so users can
  //    instant-filter by name, while keeping the exact same salesManSel
  //    {value, label} contract used by handleView/handleRefresh. ──
  const SalesManSelect = () => {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const wrapRef = useRef(null);
    const searchRef = useRef(null);

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

    useEffect(() => {
      if (open && searchRef.current) searchRef.current.focus();
    }, [open]);

    const filteredList = useMemo(() => {
      const q = search.trim().toLowerCase();
      if (!q) return salesManList;
      return salesManList.filter((o) =>
        String(o.Name ?? o.SalesManName ?? "").toLowerCase().includes(q)
      );
    }, [salesManList, search]);

    const handleSelect = (opt) => {
      setSalesManSel({ value: String(opt.Id), label: opt.Name ?? opt.SalesManName ?? "" });
      setOpen(false);
      setSearch("");
    };

    const handleClear = (e) => {
      e.stopPropagation();
      setSalesManSel(null);
    };

    const handleToggle = () => {
      if (salesManLoading) return;
      setOpen((o) => !o);
    };

    const handleKeyDown = (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleToggle();
      } else if (e.key === "Escape") {
        setOpen(false);
        setSearch("");
      }
    };

    return (
      <div className="so-field">
        <label className="so-label" htmlFor="sm-salesman">SalesMan</label>
        <div className="so-select-wrap" ref={wrapRef}>
          <div
            id="sm-salesman"
            className={`so-input so-select-trigger${open ? " open" : ""}`}
            role="button"
            tabIndex={0}
            aria-haspopup="listbox"
            aria-expanded={open}
            onClick={handleToggle}
            onKeyDown={handleKeyDown}
          >
            <span className={`so-select-value${!salesManSel ? " placeholder" : ""}`}>
              {salesManLoading ? "Loading..." : salesManSel ? salesManSel.label : "Select SalesMan"}
            </span>
            {salesManSel && !salesManLoading && (
              <span
                className="so-select-clear"
                role="button"
                tabIndex={0}
                aria-label="Clear selection"
                onClick={handleClear}
                onKeyDown={(e) => e.key === "Enter" && handleClear(e)}
              >
                ×
              </span>
            )}
            <span className="so-select-caret" aria-hidden="true">▾</span>
          </div>

          {open && !salesManLoading && (
            <div className="so-select-popup" role="listbox">
              <input
                ref={searchRef}
                type="text"
                className="so-select-search"
                placeholder="Type to search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setOpen(false);
                    setSearch("");
                  }
                }}
              />
              <div className="so-select-list">
                {filteredList.length === 0 && (
                  <div className="so-select-empty">No matches found</div>
                )}
                {filteredList.map((o) => (
                  <div
                    key={o.Id}
                    role="option"
                    aria-selected={salesManSel?.value === String(o.Id)}
                    className={`so-select-option${salesManSel?.value === String(o.Id) ? " selected" : ""}`}
                    onClick={() => handleSelect(o)}
                  >
                    {o.Name ?? o.SalesManName}
                  </div>
                ))}
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
    .so-card { width: 100%; max-width: 700px; background: #fff; border: 2px solid #1a56db; border-radius: 10px; box-shadow: 0 4px 16px rgba(26,86,219,.18); overflow: hidden; }

    .so-card-header { background: linear-gradient(135deg, #3b6fe0, #1a4fd1); border-bottom: 1px solid #1a4fd1; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; }
    .so-card-header-title { font-size: 14px; font-weight: 700; color: #fff; letter-spacing: .2px; }
    .so-close-x { background: rgba(255,255,255,.15); border: none; font-size: 14px; color: #fff; cursor: pointer; line-height: 1; padding: 6px 8px; border-radius: 6px; transition: background .15s; }
    .so-close-x:hover { background: rgba(255,255,255,.28); }

    .so-card-body { padding: 24px 32px 30px; }
    .so-report-title { text-align: center; font-size: 22px; font-weight: 800; color: #1a3fd6; margin: 0 0 26px; }

    .so-content { display: flex; gap: 32px; }

    .so-left { flex: 0 0 170px; display: flex; flex-direction: column; gap: 14px; }
    .so-right { flex: 1; display: flex; flex-direction: column; gap: 16px; max-width: 320px; }

    .so-col-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; color: #1a56db; margin-bottom: 4px; }

    .so-checkbox { display: flex; align-items: center; gap: 8px; cursor: pointer; user-select: none; font-size: 13px; color: #2b2b2b; font-weight: 500; }
    .so-checkbox input { position: absolute; opacity: 0; width: 0; height: 0; }
    .so-checkbox-box { width: 16px; height: 16px; flex-shrink: 0; border: 1px solid #c7cdd6; border-radius: 4px; background: #fff; display: flex; align-items: center; justify-content: center; transition: border-color .15s, background .15s, box-shadow .15s; }
    .so-checkbox input:checked ~ .so-checkbox-box { background: #1a56db; border-color: #1a56db; }
    .so-checkbox input:focus-visible ~ .so-checkbox-box { box-shadow: 0 0 0 3px rgba(26,86,219,.2); }
    .so-checkbox-box svg { width: 10px; height: 10px; opacity: 0; transform: scale(.6); transition: opacity .12s, transform .12s; }
    .so-checkbox input:checked ~ .so-checkbox-box svg { opacity: 1; transform: scale(1); }

    .so-field { display: flex; align-items: center; gap: 14px; }
    .so-label { font-size: 13px; font-weight: 600; color: #1e293b; width: 96px; flex-shrink: 0; }
    .so-input { height: 34px; border: 1px solid #c7cdd6; border-radius: 4px; padding: 0 10px; font-size: 13px; color: #1e2d3d; background: #fff; width: 100%; box-sizing: border-box; transition: border-color .15s, box-shadow .15s; outline: none; }
    .so-input:focus { border-color: #1a56db; box-shadow: 0 0 0 3px rgba(26,86,219,.15); }
    .so-input:disabled { background: #f5f6f8; color: #a0aab5; cursor: not-allowed; }
    select.so-input { appearance: auto; cursor: pointer; }

    .so-select-wrap { position: relative; width: 100%; }
    .so-select-trigger { display: flex; align-items: center; gap: 6px; cursor: pointer; user-select: none; }
    .so-select-trigger.open { border-color: #1a56db; box-shadow: 0 0 0 3px rgba(26,86,219,.15); }
    .so-select-value { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .so-select-value.placeholder { color: #8a94a6; }
    .so-select-clear { flex-shrink: 0; width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; border-radius: 50%; color: #8a94a6; font-size: 14px; line-height: 1; cursor: pointer; transition: background .15s, color .15s; }
    .so-select-clear:hover { background: #eef1f5; color: #dc3545; }
    .so-select-caret { flex-shrink: 0; font-size: 10px; color: #8a94a6; }

    .so-select-popup { position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 20; background: #fff; border: 1px solid #c7cdd6; border-radius: 6px; box-shadow: 0 8px 24px rgba(30,45,61,.14); overflow: hidden; }
    .so-select-search { width: 100%; height: 32px; border: none; border-bottom: 1px solid #e8ecf0; padding: 0 10px; font-size: 13px; color: #1e2d3d; outline: none; box-sizing: border-box; }
    .so-select-search:focus { background: #f7f9fc; }
    .so-select-list { max-height: 220px; overflow-y: auto; }
    .so-select-option { padding: 8px 12px; font-size: 13px; color: #1e2d3d; cursor: pointer; transition: background .12s; }
    .so-select-option:hover { background: #eef3ff; }
    .so-select-option.selected { background: #eef3ff; color: #1a56db; font-weight: 600; }
    .so-select-empty { padding: 10px 12px; font-size: 12.5px; color: #8a94a6; text-align: center; }

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
      .so-content { flex-direction: column; gap: 22px; }
      .so-left { flex: none; }
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
              <div className="so-card-header-title">SalesMan Stock Report</div>
              <button type="button" className="so-close-x" aria-label="Close" onClick={() => navigate(-1)}>✕</button>
            </div>

            <div className="so-card-body">
              <div className="so-report-title">SalesMan Stock Report</div>

              <div className="so-content">
                {/* ── Left: options (design only, same chkItemWiseDetails/chkWithTotal state) ── */}
                <div className="so-left">
                  <div className="so-col-title">Options</div>
                  <label className="so-checkbox">
                    <input
                      type="checkbox"
                      checked={chkItemWiseDetails}
                      onChange={(e) => setChkItemWiseDetails(e.target.checked)}
                    />
                    <span className="so-checkbox-box">
                      <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                    Item Wise Details
                  </label>
                  <label className="so-checkbox">
                    <input
                      type="checkbox"
                      checked={chkWithTotal}
                      onChange={(e) => setChkWithTotal(e.target.checked)}
                    />
                    <span className="so-checkbox-box">
                      <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                    With Total
                  </label>
                </div>

                {/* ── Right: salesman select + dates ── */}
                <div className="so-right">
                  <SalesManSelect />

                  <div className="so-field">
                    <label className="so-label" htmlFor="sm-from-date">From Date</label>
                    <input
                      id="sm-from-date"
                      type="date"
                      className="so-input"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                    />
                  </div>
                  <div className="so-field">
                    <label className="so-label" htmlFor="sm-to-date">To Date</label>
                    <input
                      id="sm-to-date"
                      type="date"
                      className="so-input"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                    />
                  </div>
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