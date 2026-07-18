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

import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import * as CC from "../../components/Common";
import Topbar from "../../components/Topbar";

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
      <div className="db-field">
        <label className="db-label">{placeholder.replace("Select ", "")}</label>
        <select
          className="db-input"
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

  // ── Scoped styles injected once ("db-" prefix — new, non-colliding) ────
  const styles = `
    .db-shell {
      min-height: 100vh;
      background: #f0f2f5;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      flex-direction: column;
    }
    .db-layout {
      display: flex;
      flex: 1;
      justify-content: center;
      padding: 24px;
      box-sizing: border-box;
    }
    .db-panel {
      width: 100%;
      max-width: 640px;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 2px 12px rgba(0,0,0,.08);
      padding: 28px 32px;
      display: flex;
      flex-direction: column;
      height: fit-content;
    }
    .db-panel-header {
      border-bottom: 1px solid #e8ecf0;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .db-panel-eyebrow {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .8px;
      color: var(--clr-primary, #1a56db);
      margin-bottom: 6px;
    }
    .db-panel-title {
      font-size: 20px;
      font-weight: 700;
      color: #1e2d3d;
      line-height: 1.2;
    }
    .db-form-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 16px 20px;
      align-items: start;
      margin-bottom: 8px;
    }
    .db-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .db-label {
      font-size: 13px;
      font-weight: 600;
      color: #4a5568;
    }
    .db-input {
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
    .db-input:focus {
      border-color: var(--clr-primary, #1a56db);
      box-shadow: 0 0 0 3px rgba(26,86,219,.1);
    }
    .db-toggle-row {
      display: flex;
      align-items: center;
      gap: 8px;
      height: 36px;
      background: #f7f9fc;
      border: 1.5px solid #d1d9e6;
      border-radius: 8px;
      padding: 0 12px;
      cursor: pointer;
      font-size: 13px;
      color: #4a5568;
      font-weight: 500;
      user-select: none;
      width: fit-content;
      margin-top: 20px;
    }
    .db-toggle-row input[type="checkbox"] {
      width: 15px;
      height: 15px;
      accent-color: var(--clr-primary, #1a56db);
      cursor: pointer;
    }
    .db-actions {
      display: flex;
      gap: 12px;
      margin-top: 28px;
      padding-top: 20px;
      border-top: 1px solid #e8ecf0;
    }
    .db-btn {
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
    .db-btn:disabled { opacity: .5; cursor: not-allowed; }
    .db-btn-primary {
      background: var(--clr-primary, #1a56db);
      color: #fff;
      box-shadow: 0 2px 8px rgba(26,86,219,.3);
    }
    .db-btn-primary:not(:disabled):hover {
      opacity: .9;
      box-shadow: 0 4px 14px rgba(26,86,219,.4);
    }
    .db-btn-secondary {
      background: #f0f2f5;
      color: #4a5568;
      border: 1.5px solid #d1d9e6;
    }
    .db-btn-secondary:not(:disabled):hover {
      background: #e8ecf0;
    }
    .db-msg {
      margin-top: 18px;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
    }
    .db-msg.err { background: #fff0f0; color: #c53030; border: 1px solid #fed7d7; }
    .db-msg.ok  { background: #f0fff4; color: #276749; border: 1px solid #c6f6d5; }
    @media (max-width: 760px) {
      .db-layout { padding: 16px; }
      .db-panel { padding: 20px 16px; }
      .db-form-grid { grid-template-columns: 1fr; }
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
      <div className="db-shell">
        <Topbar />

        <div className="db-layout">
          <main className="db-panel">
            <div className="db-panel-header">
              <div className="db-panel-eyebrow">Stock</div>
              <div className="db-panel-title">DCB Branch Stock Report</div>
            </div>

            <div className="db-form-grid">
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

              <div className="db-field">
                <label className="db-label" htmlFor="db-from-date">From Date</label>
                <input
                  id="db-from-date"
                  type="date"
                  className="db-input"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>
              <div className="db-field">
                <label className="db-label" htmlFor="db-to-date">To Date</label>
                <input
                  id="db-to-date"
                  type="date"
                  className="db-input"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>
            </div>

            {session.TextilesSerialNowiseBilling && (
              <label className="db-toggle-row">
                <input
                  type="checkbox"
                  checked={chkBatch}
                  onChange={(e) => setChkBatch(e.target.checked)}
                />
                Batch
              </label>
            )}

            <div className="db-actions">
              <button
                type="button"
                className="db-btn db-btn-primary"
                disabled={loading}
                onClick={handleView}
              >
                {loading ? "Loading…" : "▶ View"}
              </button>
              <button
                type="button"
                className="db-btn db-btn-secondary"
                onClick={handleRefresh}
                disabled={loading}
              >
                ↺ Refresh
              </button>
            </div>

            {msg && <div className={`db-msg ${msg.isErr ? "err" : "ok"}`}>{msg.text}</div>}
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