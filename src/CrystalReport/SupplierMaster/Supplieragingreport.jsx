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

import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Save, XCircle } from "lucide-react";
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

  // ── Esc key — "Do you want to quit page?" (same as other converted pages) ──
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

  // ── Refresh button — mirrors #btnrefresh click handler ─────────────────
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

    return (
      <div className="sa-field">
        <label className="sa-label" htmlFor="sa-supplier">{placeholder.replace("Select ", "")}</label>
        <select
          id="sa-supplier"
          className="sa-input"
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

  // ── Scoped styles injected once ("sa-" prefix, ported from BranchWise.jsx's
  //    design system — colors/spacing/cards/buttons only, no logic here) ────
  const styles = `
    .sa-shell { min-height: 100vh; background: #f0f2f5; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; flex-direction: column; }

    .sa-layout { flex: 1; display: flex; align-items: flex-start; justify-content: center; padding: 24px; box-sizing: border-box; }
    .sa-card { width: 100%; max-width: 480px; background: #fff; border: 2px solid #1a56db; border-radius: 10px; box-shadow: 0 4px 16px rgba(26,86,219,.18); overflow: hidden; }

    .sa-card-header { background: linear-gradient(135deg, #3b6fe0, #1a4fd1); border-bottom: 1px solid #1a4fd1; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; }
    .sa-card-header-title { font-size: 14px; font-weight: 700; color: #fff; letter-spacing: .2px; }

    .sa-card-body { padding: 24px 32px 30px; }
    .sa-report-title { text-align: center; font-size: 22px; font-weight: 800; color: #1a3fd6; margin: 0 0 26px; }

    .sa-content { display: flex; flex-direction: column; gap: 16px; }

    .sa-field { display: flex; align-items: center; gap: 14px; }
    .sa-label { font-size: 13px; font-weight: 600; color: #1e293b; width: 96px; flex-shrink: 0; }
    .sa-input { height: 34px; border: 1px solid #c7cdd6; border-radius: 4px; padding: 0 10px; font-size: 13px; color: #1e2d3d; background: #fff; width: 100%; box-sizing: border-box; transition: border-color .15s, box-shadow .15s; outline: none; }
    .sa-input:focus { border-color: #1a56db; box-shadow: 0 0 0 3px rgba(26,86,219,.15); }
    select.sa-input { appearance: auto; cursor: pointer; }
    .sa-input:disabled { background: #f5f6f8; cursor: not-allowed; }

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