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

import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import * as CC from "../../components/Common";
import Topbar from "../../components/Topbar";

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

  // ── Re-usable SalesMan <select>, same pattern as ItemwiseStockDetails.jsx's
  //    ProductSelect but driven off the already-fetched salesManList ───────
  const SalesManSelect = () => (
    <div className="sm-field">
      <label className="sm-label" htmlFor="sm-salesman">SalesMan</label>
      <select
        id="sm-salesman"
        className="sm-input"
        value={salesManSel?.value ?? ""}
        disabled={salesManLoading}
        onChange={(e) => {
          const selectedVal = e.target.value;
          if (selectedVal === "") {
            setSalesManSel(null);
            return;
          }
          const opt = salesManList.find((o) => String(o.Id) === selectedVal);
          if (opt) {
            setSalesManSel({ value: String(opt.Id), label: opt.Name ?? opt.SalesManName ?? "" });
          }
        }}
      >
        <option value="">{salesManLoading ? "Loading..." : "Select SalesMan"}</option>
        {salesManList.map((o) => (
          <option key={o.Id} value={o.Id}>
            {o.Name ?? o.SalesManName}
          </option>
        ))}
      </select>
    </div>
  );

  // ── Scoped styles injected once (same tokens as ItemwiseStockDetails.jsx,
  //    "sm-" prefix in place of "iw-") ─────────────────────────────────────
  const styles = `
    .sm-shell {
      min-height: 100vh;
      background: #f0f2f5;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      flex-direction: column;
    }
    .sm-layout {
      display: flex;
      flex: 1;
      justify-content: center;
      padding: 24px;
      max-width: 1200px;
      width: 100%;
      margin: 0 auto;
      box-sizing: border-box;
    }
    .sm-panel {
      flex: 1;
      max-width: 720px;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 2px 12px rgba(0,0,0,.08);
      padding: 28px 32px;
      display: flex;
      flex-direction: column;
    }
    .sm-panel-header {
      border-bottom: 1px solid #e8ecf0;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .sm-panel-eyebrow {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .8px;
      color: var(--clr-primary, #1a56db);
      margin-bottom: 6px;
    }
    .sm-panel-title {
      font-size: 20px;
      font-weight: 700;
      color: #1e2d3d;
      line-height: 1.2;
    }
    .sm-form-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 16px 20px;
      align-items: start;
      max-width: 100%;
      margin-top: 10px;
      margin-bottom: 12px;
    }
    .sm-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .sm-label {
      font-size: 13px;
      font-weight: 600;
      color: #4a5568;
    }
    .sm-input {
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
    .sm-input:focus {
      border-color: var(--clr-primary, #1a56db);
      box-shadow: 0 0 0 3px rgba(26,86,219,.1);
    }
    .sm-input:disabled {
      background: #f7f9fc;
      color: #8a94a6;
      cursor: not-allowed;
    }
    .sm-checks {
      display: flex;
      flex-wrap: wrap;
      gap: 24px;
      margin-bottom: 24px;
      padding-top: 4px;
    }
    .sm-check {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      font-weight: 600;
      color: #4a5568;
      cursor: pointer;
      user-select: none;
    }
    .sm-check input[type="checkbox"] {
      width: 16px;
      height: 16px;
      accent-color: var(--clr-primary, #1a56db);
      cursor: pointer;
    }
    .sm-actions {
      display: flex;
      gap: 12px;
      margin-top: 8px;
      padding-top: 20px;
      border-top: 1px solid #e8ecf0;
    }
    .sm-btn {
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
    .sm-btn:disabled { opacity: .5; cursor: not-allowed; }
    .sm-btn-primary {
      background: var(--clr-primary, #1a56db);
      color: #fff;
      box-shadow: 0 2px 8px rgba(26,86,219,.3);
    }
    .sm-btn-primary:not(:disabled):hover {
      opacity: .9;
      box-shadow: 0 4px 14px rgba(26,86,219,.4);
    }
    .sm-btn-secondary {
      background: #f0f2f5;
      color: #4a5568;
      border: 1.5px solid #d1d9e6;
    }
    .sm-btn-secondary:not(:disabled):hover {
      background: #e8ecf0;
    }
    .sm-msg {
      margin-top: 18px;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
    }
    .sm-msg.err { background: #fff0f0; color: #c53030; border: 1px solid #fed7d7; }
    .sm-msg.ok  { background: #f0fff4; color: #276749; border: 1px solid #c6f6d5; }
    @media (max-width: 760px) {
      .sm-layout { padding: 16px; }
      .sm-panel { padding: 20px 16px; max-width: 100%; }
      .sm-form-grid { grid-template-columns: 1fr; }
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
      <div className="sm-shell">
        <Topbar />

        <div className="sm-layout">
          <main className="sm-panel">
            <div className="sm-panel-header">
              <div className="sm-panel-eyebrow">Stock</div>
              <div className="sm-panel-title">SalesMan Stock Report</div>
            </div>

            <div className="sm-form-grid">
              <SalesManSelect />

              <div className="sm-field">
                <label className="sm-label" htmlFor="sm-from-date">From Date</label>
                <input
                  id="sm-from-date"
                  type="date"
                  className="sm-input"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>
              <div className="sm-field">
                <label className="sm-label" htmlFor="sm-to-date">To Date</label>
                <input
                  id="sm-to-date"
                  type="date"
                  className="sm-input"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>
            </div>

            <div className="sm-checks">
              <label className="sm-check">
                <input
                  type="checkbox"
                  checked={chkItemWiseDetails}
                  onChange={(e) => setChkItemWiseDetails(e.target.checked)}
                />
                Item Wise Details
              </label>
              <label className="sm-check">
                <input
                  type="checkbox"
                  checked={chkWithTotal}
                  onChange={(e) => setChkWithTotal(e.target.checked)}
                />
                With Total
              </label>
            </div>

            <div className="sm-actions">
              <button
                type="button"
                className="sm-btn sm-btn-primary"
                disabled={loading || pageAccess.pageview === 0}
                onClick={handleView}
              >
                {loading ? "Loading…" : "▶ View"}
              </button>
              <button
                type="button"
                className="sm-btn sm-btn-secondary"
                onClick={handleRefresh}
                disabled={loading}
              >
                ↺ Refresh
              </button>
            </div>

            {msg && <div className={`sm-msg ${msg.isErr ? "err" : "ok"}`}>{msg.text}</div>}
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