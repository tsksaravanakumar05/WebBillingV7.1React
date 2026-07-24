// ─────────────────────────────────────────────────────────────────────────────
//  DCBBranchStockReport.jsx
//  React conversion of the legacy jQuery/jqxWidgets "DCB Branch Stock Report" page
//  Built on the same skeleton as ClosingStock.jsx / SaleOrder.jsx:
//    - CC.api / CC.getLocal / CC.getStr from Common.jsx
//    - same session bootstrap pattern
//    - same openReportViewer(BASE_URL + /Reports/ReportViewer.aspx) pattern
//    - "db-" scoped style system (new prefix — no collision with cs-/iq-/iw-)
//
//  ── Assumptions / call-outs (please verify) ─────────────────────────────────
//  1. The original .js file's permission-check block (menulist.filter on
//     PageName === "Closing Stock", View/Add/Edit/Delete gating) is entirely
//     commented out in the source — only the `menulist == null` session check
//     is active. This conversion preserves that: only the session-exists
//     redirect runs; there is no page-permission gate on the View button.
//  2. Company-setting field names (Companyname, Address1, Address2, City,
//     Phone) are taken directly from this source file, not guessed.
//  3. BUG PRESERVED: in the original, `Todate` is computed from the *From
//     Date* picker's value (`date`), not the To Date picker's value
//     (`date1`) — the To Date field is selectable but its value is never
//     actually used. Reproduced verbatim below (see handleView) since the
//     instructions are to preserve business logic exactly; flagging this in
//     case it should actually be fixed.
//  4. BUG PRESERVED: the report-viewer popup's window title is hardcoded to
//     "ClosingStockReport-Report" in the original (clearly a copy/paste
//     leftover from the Closing Stock page) rather than a DCB-specific
//     title. Reproduced verbatim.
//  5. Endpoint mapping: `/Stock/DCBBranchStockReportAll` → assumed to be
//     `/api/StockReportApp/DCBBranchStockReportAll` per this app family's
//     module-naming convention (Stock → StockReportApp). Please verify.
//  6. Per this app's report-request convention, a `CacheKeyType` header and
//     `React: 1` are sent (the original predates this convention and had
//     neither), and the returned cache key is passed through to the report
//     viewer as `CacheKey`.
//  7. `RateType` is declared in the original but never assigned — it is
//     always sent to the report viewer as an empty string. Preserved as-is.
//  8. `#chkbatch` is only ever toggled visible/hidden by
//     TextilesSerialNowiseBilling in the original; its value is never read
//     anywhere else (not part of the AJAX payload). It's reproduced here as
//     an inert checkbox (no effect on submit) — label text is a best guess
//     since no markup file was provided.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Save, XCircle } from "lucide-react";
import * as CC from "../../components/Common";
import Topbar from "../../components/Topbar";
import   DateFieldDDMMYYYY from "../../Commondatetime";

const BASE_URL = "http://localhost:64215";

// ── API endpoints ───────────────────────────────────────────────────────────
// Report endpoint — see assumption #5 above.
const DCBBranchStockReportUrl = "/api/StockReportApp/DCBBranchStockReportAll";

// Combo endpoints reused from the established convention across converted
// pages (Brand / Category / Department dropdowns).
const BrandListUrl = "/api/BrandApp/SelectBrand";
const CategoryListUrl = "/api/CategoryApp/SelectCategory";
const DepartmentListUrl = "/api/DepartmentApp/SelectDepartment";

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

export default function DCBBranchStockReport() {
  const navigate = useNavigate();

  // ── Session / readiness state ───────────────────────────────────────────
  // No page-permission gating in the original (see assumption #1) — just a
  // "did the session bootstrap finish" flag.
  const [pageReady, setPageReady] = useState(false);

  // ── Company / settings state (loaded once from localStorage) ───────────
  const [session, setSession] = useState({
    Comid: "",
    MComid: "",
    CompanyName: "",
    CAddress1: "",
    CAddress2: "",
    CCity: "",
    CMobileNo: "",
    RiceUOMSetting: false, // MultipleUOMBilling — read in original, unused elsewhere
    BatchNoText: "",       // read in original, unused elsewhere
    TextilesSerialNowiseBilling: false, // drives chkBatch visibility
    BatchWiseStock: false, // read in original, unused elsewhere
    univercell: false,     // read in original, passed through in the AJAX payload
  });

  // ── Group-by combo selections { value, label } ───────────────────────────
  // All three combos are simultaneously visible/selectable in the original
  // (no exclusive radio-style gating) — resolution priority at submit time
  // is Department > Category > Brand, exactly mirroring the sequential
  // if-blocks in the legacy file.
  const [brandSel, setBrandSel] = useState(null);
  const [categorySel, setCategorySel] = useState(null);
  const [departmentSel, setDepartmentSel] = useState(null);

  // ── Dates ────────────────────────────────────────────────────────────────
  const [fromDate, setFromDate] = useState(todayStr());
  const [toDate, setToDate] = useState(todayStr());

  // ── Dead/inert toggle (assumption #8) ───────────────────────────────────
  const [chkBatch, setChkBatch] = useState(false);

  // ── UI feedback state ────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null); // { text, isErr }

  // ── Bootstrap: session only, mirrors the active part of $(document).ready ──
  useEffect(() => {
    const menulist = CC.getLocal("menulist");
    if (menulist == null) {
      setMsg({ text: "Session Close Please Login !!!.", isErr: true });
      navigate("/Login/Index");
      return;
    }

    const Comid = CC.getStr("Comid");
    const MComid = CC.getStr("MComid");
    const MainSet = CC.getLocal("Mainsetting") || [{}];
    const ComSet = CC.getLocal("Companysetting") || [{}];

    setSession({
      Comid,
      MComid,
      CompanyName: ComSet[0]?.Companyname || "",
      CAddress1: ComSet[0]?.Address1 || "",
      CAddress2: ComSet[0]?.Address2 || "",
      CCity: ComSet[0]?.City || "",
      CMobileNo: ComSet[0]?.Phone || "",
      RiceUOMSetting: !!MainSet[0]?.MultipleUOMBilling,
      BatchNoText: MainSet[0]?.BatchNoName || "",
      TextilesSerialNowiseBilling: !!MainSet[0]?.TextilesSerialNowiseBilling,
      BatchWiseStock: !!MainSet[0]?.BatchWiseStock,
      univercell: !!MainSet[0]?.univercell,
    });

    setPageReady(true);
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

  // ── Refresh button — resets exactly what the legacy refresh handler did ──
  // (clears the three combos, re-enables them, resets From Date only — the
  // original refresh handler never touches the To Date field.)
  const handleRefresh = useCallback(() => {
    setBrandSel(null);
    setCategorySel(null);
    setDepartmentSel(null);
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
      // Preserved verbatim from the original — see assumption #4.
      w.addEventListener(
        "load",
        function () {
          w.document.title = "ClosingStockReport-Report";
        },
        false
      );
    }
    return w;
  }, []);

  // ── View button — replicates the DCB Branch Stock Report $.ajax logic ──
  const handleView = useCallback(async () => {
    let GroupBy = "";
    let GroupByBrand = "";
    let GroupByCategory = "";
    let GroupByText = ""; // department label, matches legacy variable name

    if (brandSel) {
      GroupBy = "Brand";
      GroupByBrand = brandSel.label;
      if (!GroupByBrand) {
        setMsg({ text: "Please Select Valid Brand Name !!!.", isErr: true });
        setBrandSel(null);
        return;
      }
    }
    if (categorySel) {
      GroupBy = "Category";
      GroupByCategory = categorySel.label;
      if (!GroupByCategory) {
        setMsg({ text: "Please Select Valid Category Name !!!.", isErr: true });
        setCategorySel(null);
        return;
      }
    }
    if (departmentSel) {
      GroupBy = "Department";
      GroupByText = departmentSel.label;
      if (!GroupByText) {
        setMsg({ text: "Please Select Valid Department Name !!!.", isErr: true });
        setDepartmentSel(null);
        return;
      }
    }

    const StockType = ""; // declared, never assigned in the original
    const RateType = "";  // declared, never assigned in the original — see assumption #7

    const Fromdate = toMMDDYYYY(fromDate);
    // BUG PRESERVED (assumption #3): the original computes Todate from the
    // From Date picker's value, not the To Date picker's — so the To Date
    // field's own value is effectively unused. Reproduced verbatim.
    const Todate = toMMDDYYYY(fromDate);

    setLoading(true);
    setMsg(null);

    try {
      const res = await CC.api(
        DCBBranchStockReportUrl,
        null,
        { CacheKeyType: "DCBBranchStockReport", React: 1 },
        {
          Id: 0,
          Type: "",
          CompanyName: session.CompanyName,
          CAddress1: session.CAddress1,
          CAddress2: session.CAddress2,
          CCity: session.CCity,
          CMobileNo: session.CMobileNo,
          GroupByText,
          Fromdate,
          GroupByCategory,
          GroupByBrand,
          Comid: session.Comid,
          MComid: session.MComid,
          univercell: session.univercell,
          CName: session?.CName || localStorage.getItem("CompanyName") || "",
          CAddress: session?.CAddress || localStorage.getItem("Address") || "",
          CPhone: session?.CPhone || localStorage.getItem("Phone") || "",

        }
      );

      if (res?.ok || res?.IsSuccess) {
        const cacheKey = res.Data15 || res.CacheKey || "";
        openReportViewer({
          ReportName: "DCBBranchStockReport",
          CacheKey: cacheKey,
          GroupBy,
          DeptName: GroupByText,
          CateName: GroupByCategory,
          BrandName: GroupByBrand,
          Fromdate,
          Todate,
          RateType,
          CName: session?.CName || localStorage.getItem("CompanyName") || "",
          CAddress: session?.CAddress || localStorage.getItem("Address") || "",
          CPhone: session?.CPhone || localStorage.getItem("Phone") || "",

        });
      } else {
        setMsg({ text: "No Record !!!.", isErr: true });
      }
    } catch (err) {
      setMsg({ text: "Technical Fault Contact Software Vendor  !!!.", isErr: true });
    } finally {
      setLoading(false);
      // Matches methods.Clear() in the legacy file — combos are cleared
      // after every View attempt, success or failure.
      setBrandSel(null);
      setCategorySel(null);
      setDepartmentSel(null);
    }
  }, [brandSel, categorySel, departmentSel, fromDate, session, openReportViewer]);

  // ── Reusable combo component (same pattern as other converted pages) ───
  // Now a searchable combo box instead of a plain <select> — same
  // {value,label} contract, so all call sites stay unchanged.
  const ApiSelect = ({ url, payload, headers = {}, labelKey, valueKey, value, onChange, placeholder }) => {
    const [list, setList] = useState([]);
    const [loadingList, setLoadingList] = useState(false);
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const boxRef = useRef(null);
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

    // Close the popup on outside click.
    useEffect(() => {
      if (!open) return;
      const handleClickOutside = (e) => {
        if (boxRef.current && !boxRef.current.contains(e.target)) {
          setOpen(false);
        }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [open]);

    useEffect(() => {
      if (open) {
        setSearch("");
        setTimeout(() => searchRef.current?.focus(), 0);
      }
    }, [open]);

    const filteredList = useMemo(() => {
      const q = search.trim().toLowerCase();
      if (!q) return list;
      return list.filter((o) => String(o[labelKey] ?? "").toLowerCase().includes(q));
    }, [list, search, labelKey]);

    const handlePick = (opt) => {
      onChange(opt ? { value: String(opt[valueKey]), label: opt[labelKey] } : null);
      setOpen(false);
    };

    return (
      <div className="so-field">
        <label className="so-label">{placeholder.replace("Select ", "")}</label>
        <div className="so-combo" ref={boxRef}>
          <button
            type="button"
            className="so-input so-combo-toggle"
            disabled={loadingList}
            onClick={() => setOpen((o) => !o)}
          >
            <span className={`so-combo-value${value?.label ? "" : " ph"}`}>
              {loadingList ? "Loading..." : value?.label || placeholder}
            </span>
            <span className="so-combo-caret" aria-hidden="true">▾</span>
          </button>

          {open && !loadingList && (
            <div className="so-combo-panel">
              <input
                ref={searchRef}
                type="text"
                className="so-combo-search"
                placeholder="Type to search…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setOpen(false);
                  if (e.key === "Enter" && filteredList.length === 1) handlePick(filteredList[0]);
                }}
              />
              <ul className="so-combo-list" role="listbox">
                <li
                  className={`so-combo-option so-combo-clear${!value ? " active" : ""}`}
                  onClick={() => handlePick(null)}
                >
                  {placeholder}
                </li>
                {filteredList.length === 0 && (
                  <li className="so-combo-empty">No matches found</li>
                )}
                {filteredList.map((o) => (
                  <li
                    key={o[valueKey]}
                    className={`so-combo-option${String(value?.value) === String(o[valueKey]) ? " active" : ""}`}
                    onClick={() => handlePick(o)}
                    role="option"
                    aria-selected={String(value?.value) === String(o[valueKey])}
                  >
                    {o[labelKey]}
                  </li>
                ))}
              </ul>
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
    .so-card { width: 100%; max-width: 560px; background: #fff; border: 2px solid #1a56db; border-radius: 10px; box-shadow: 0 4px 16px rgba(26,86,219,.18); overflow: hidden; }

    .so-card-header { background: linear-gradient(135deg, #3b6fe0, #1a4fd1); border-bottom: 1px solid #1a4fd1; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; }
    .so-card-header-title { font-size: 14px; font-weight: 700; color: #fff; letter-spacing: .2px; }
    .so-close-x { background: rgba(255,255,255,.15); border: none; font-size: 14px; color: #fff; cursor: pointer; line-height: 1; padding: 6px 8px; border-radius: 6px; transition: background .15s; }
    .so-close-x:hover { background: rgba(255,255,255,.28); }

    .so-card-body { padding: 24px 32px 30px; }
    .so-report-title { text-align: center; font-size: 22px; font-weight: 800; color: #1a3fd6; margin: 0 0 26px; }

    .so-content { display: flex; justify-content: center; }
    .so-right { flex: 1; display: flex; flex-direction: column; gap: 16px; max-width: 340px; margin: 0 auto; }

    .so-field { display: flex; align-items: center; gap: 14px; }
    .so-label { font-size: 13px; font-weight: 600; color: #1e293b; width: 100px; flex-shrink: 0; }
    .so-input { height: 34px; border: 1px solid #c7cdd6; border-radius: 4px; padding: 0 10px; font-size: 13px; color: #1e2d3d; background: #fff; width: 100%; box-sizing: border-box; transition: border-color .15s, box-shadow .15s; outline: none; }
    .so-input:focus { border-color: #1a56db; box-shadow: 0 0 0 3px rgba(26,86,219,.15); }
    .so-input:disabled { background: #f5f6f8; color: #a0aab5; cursor: not-allowed; }
    select.so-input { appearance: auto; cursor: pointer; }

    .so-combo { position: relative; flex: 1; min-width: 0; }
    .so-combo-toggle { display: flex; align-items: center; justify-content: space-between; gap: 8px; text-align: left; cursor: pointer; }
    .so-combo-toggle:disabled { cursor: not-allowed; opacity: .65; }
    .so-combo-value { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #1e2d3d; }
    .so-combo-value.ph { color: #8492a6; }
    .so-combo-caret { flex-shrink: 0; font-size: 10px; color: #8492a6; }
    .so-combo-panel { position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 30; background: #fff; border: 1px solid #1a56db; border-radius: 6px; box-shadow: 0 8px 24px rgba(26,86,219,.18); overflow: hidden; }
    .so-combo-search { width: 100%; height: 32px; border: none; border-bottom: 1px solid #e8ecf0; padding: 0 10px; font-size: 13px; color: #1e2d3d; box-sizing: border-box; outline: none; background: #f8fafc; }
    .so-combo-search:focus { background: #eef3ff; }
    .so-combo-list { list-style: none; margin: 0; padding: 4px 0; max-height: 220px; overflow-y: auto; }
    .so-combo-option { padding: 7px 12px; font-size: 13px; color: #1e2d3d; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .so-combo-option:hover { background: #eef3ff; }
    .so-combo-option.active { background: #e3ecff; color: #1a4fd1; font-weight: 600; }
    .so-combo-option.so-combo-clear { color: #8492a6; font-style: italic; border-bottom: 1px solid #e8ecf0; margin-bottom: 2px; }
    .so-combo-empty { padding: 10px 12px; font-size: 12.5px; color: #8492a6; text-align: center; }

    .so-checkbox { display: flex; align-items: center; gap: 8px; cursor: pointer; user-select: none; font-size: 13px; color: #2b2b2b; font-weight: 500; margin-top: 4px; }
    .so-checkbox input { position: absolute; opacity: 0; width: 0; height: 0; }
    .so-checkbox-box { width: 16px; height: 16px; flex-shrink: 0; border: 1px solid #c7cdd6; border-radius: 4px; background: #fff; display: flex; align-items: center; justify-content: center; transition: border-color .15s, background .15s, box-shadow .15s; }
    .so-checkbox input:checked ~ .so-checkbox-box { background: #1a56db; border-color: #1a56db; }
    .so-checkbox input:focus-visible ~ .so-checkbox-box { box-shadow: 0 0 0 3px rgba(26,86,219,.2); }
    .so-checkbox-box svg { width: 10px; height: 10px; opacity: 0; transform: scale(.6); transition: opacity .12s, transform .12s; }
    .so-checkbox input:checked ~ .so-checkbox-box svg { opacity: 1; transform: scale(1); }

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

  if (!pageReady) {
    return (
      <div className="mp-wrap">
        <div className="mp-body">
          {msg && <div className={`mp-msg ${msg.isErr ? "err" : "ok"}`}>{msg.text}</div>}
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
              <div className="so-card-header-title">DCB Branch Stock Report</div>
              <button type="button" className="so-close-x" aria-label="Close" onClick={() => navigate(-1)}>✕</button>
            </div>

            <div className="so-card-body">
              <div className="so-report-title">DCB Branch Stock Report</div>

              <div className="so-content">
                <div className="so-right">
                  <ApiSelect
                    url={BrandListUrl}
                    payload={{ Comid: session.Comid }}
                    labelKey="BrandName"
                    valueKey="Id"
                    value={brandSel}
                    onChange={setBrandSel}
                    placeholder="Select Brand"
                  />
                  <ApiSelect
                    url={CategoryListUrl}
                    payload={{ Comid: session.Comid }}
                    labelKey="Cat_Name"
                    valueKey="Id"
                    value={categorySel}
                    onChange={setCategorySel}
                    placeholder="Select Category"
                  />
                  <ApiSelect
                    url={DepartmentListUrl}
                    payload={{ Comid: session.Comid }}
                    labelKey="DepartmentName"
                    valueKey="Id"
                    value={departmentSel}
                    onChange={setDepartmentSel}
                    placeholder="Select Department"
                  />

                  <div className="so-field">
                  <DateFieldDDMMYYYY id="pri-from-date" value={fromDate} onChange={setFromDate} />
                  </div>
                  <div className="so-field">
                    <label className="so-label" htmlFor="db-to-date">To Date</label>
                    <DateFieldDDMMYYYY id="pri-to-date" value={toDate} onChange={setToDate} />
                  </div>

                  {session.TextilesSerialNowiseBilling && (
                    <label className="so-checkbox">
                      <input
                        type="checkbox"
                        checked={chkBatch}
                        onChange={(e) => setChkBatch(e.target.checked)}
                      />
                      <span className="so-checkbox-box">
                        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </span>
                      Batch
                    </label>
                  )}
                </div>
              </div>

              <div className="so-actions">
                <button
                  type="button"
                  className="so-btn so-btn-primary"
                  disabled={loading}
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