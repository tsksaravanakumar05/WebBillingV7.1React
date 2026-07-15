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

import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
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
          navigate("/Login/Home");
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
      <select
        className="sb-input"
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
    );
  };

  // ── Scoped styles injected once ("sb-" prefix — new, non-colliding) ────
  const styles = `
    .sb-shell {
      min-height: 100vh;
      background: #f0f2f5;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      flex-direction: column;
    }
    .sb-layout {
      display: flex;
      flex: 1;
      justify-content: center;
      padding: 24px;
      box-sizing: border-box;
    }
    .sb-panel {
      width: 100%;
      max-width: 560px;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 2px 12px rgba(0,0,0,.08);
      padding: 28px 32px;
      display: flex;
      flex-direction: column;
      height: fit-content;
    }
    .sb-panel-header {
      border-bottom: 1px solid #e8ecf0;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .sb-panel-eyebrow {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .8px;
      color: var(--clr-primary, #1a56db);
      margin-bottom: 6px;
    }
    .sb-panel-title {
      font-size: 20px;
      font-weight: 700;
      color: #1e2d3d;
      line-height: 1.2;
    }
    .sb-section-title {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .6px;
      color: #8a94a6;
      margin: 20px 0 10px;
    }
    .sb-section-title:first-of-type { margin-top: 0; }
    .sb-radio-row {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
    .sb-chip {
      display: flex;
      align-items: center;
      gap: 8px;
      height: 36px;
      padding: 0 14px;
      border-radius: 20px;
      border: 1.5px solid #d1d9e6;
      background: #f7f9fc;
      font-size: 13px;
      font-weight: 500;
      color: #4a5568;
      cursor: pointer;
      user-select: none;
      transition: border-color .15s, background .15s, color .15s;
    }
    .sb-chip:hover { border-color: var(--clr-primary, #1a56db); }
    .sb-chip.active {
      background: var(--clr-primary, #1a56db);
      border-color: var(--clr-primary, #1a56db);
      color: #fff;
    }
    .sb-combo-slot {
      margin-top: 10px;
    }
    .sb-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-top: 16px;
    }
    .sb-label {
      font-size: 13px;
      font-weight: 600;
      color: #4a5568;
    }
    .sb-input {
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
    .sb-input:focus {
      border-color: var(--clr-primary, #1a56db);
      box-shadow: 0 0 0 3px rgba(26,86,219,.1);
    }
    .sb-actions {
      display: flex;
      gap: 12px;
      margin-top: 24px;
      padding-top: 20px;
      border-top: 1px solid #e8ecf0;
    }
    .sb-btn {
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
    .sb-btn:disabled { opacity: .5; cursor: not-allowed; }
    .sb-btn-primary {
      background: var(--clr-primary, #1a56db);
      color: #fff;
      box-shadow: 0 2px 8px rgba(26,86,219,.3);
    }
    .sb-btn-primary:not(:disabled):hover {
      opacity: .9;
      box-shadow: 0 4px 14px rgba(26,86,219,.4);
    }
    .sb-btn-secondary {
      background: #f0f2f5;
      color: #4a5568;
      border: 1.5px solid #d1d9e6;
    }
    .sb-btn-secondary:not(:disabled):hover {
      background: #e8ecf0;
    }
    .sb-msg {
      margin-top: 18px;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
    }
    .sb-msg.err { background: #fff0f0; color: #c53030; border: 1px solid #fed7d7; }
    .sb-msg.ok  { background: #f0fff4; color: #276749; border: 1px solid #c6f6d5; }
    @media (max-width: 760px) {
      .sb-layout { padding: 16px; }
      .sb-panel { padding: 20px 16px; }
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
      <div className="sb-shell">
        <Topbar />

        <div className="sb-layout">
          <main className="sb-panel">
            <div className="sb-panel-header">
              <div className="sb-panel-eyebrow">Purchase</div>
              <div className="sb-panel-title">Supplier Balance Report</div>
            </div>

            {/* Pane2 — Group By: Supplier / Salesman (true mutually-exclusive radio) */}
            <div className="sb-section-title">Group By</div>
            <div className="sb-radio-row">
              <div
                className={`sb-chip${groupMode === GROUP_MODE.SUPPLIER ? " active" : ""}`}
                onClick={selectSupplierMode}
                role="button"
                tabIndex={0}
              >
                Supplier
              </div>
              <div
                className={`sb-chip${groupMode === GROUP_MODE.SALESMAN ? " active" : ""}`}
                onClick={selectSalesManMode}
                role="button"
                tabIndex={0}
              >
                Sales Man
              </div>
            </div>

            <div className="sb-combo-slot">
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
            <div className="sb-section-title">Order By</div>
            <div className="sb-radio-row">
              {[
                { value: ORDER_BY.NONE, label: "None" },
                { value: ORDER_BY.ASCENDING, label: "Ascending" },
                { value: ORDER_BY.DESCENDING, label: "Descending" },
              ].map((o) => (
                <div
                  key={o.value}
                  className={`sb-chip${orderBy === o.value ? " active" : ""}`}
                  onClick={() => setOrderBy(o.value)}
                  role="button"
                  tabIndex={0}
                >
                  {o.label}
                </div>
              ))}
            </div>

            <div className="sb-field">
              <label className="sb-label" htmlFor="sb-from-date">From Date</label>
              <input
                id="sb-from-date"
                type="date"
                className="sb-input"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>

            <div className="sb-actions">
              <button
                type="button"
                className="sb-btn sb-btn-primary"
                disabled={loading || pageAccess.pageview === 0}
                onClick={handleView}
              >
                {loading ? "Loading…" : "▶ View"}
              </button>
              <button
                type="button"
                className="sb-btn sb-btn-secondary"
                onClick={handleRefresh}
                disabled={loading}
              >
                ↺ Refresh
              </button>
            </div>

            {msg && <div className={`sb-msg ${msg.isErr ? "err" : "ok"}`}>{msg.text}</div>}
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