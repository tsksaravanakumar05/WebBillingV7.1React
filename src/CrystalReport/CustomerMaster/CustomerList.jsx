// ─────────────────────────────────────────────────────────────────────────────
//  CRMCustomer.jsx
//  React conversion of the "CRM Customer" list-report page (jQuery / jqxWidgets)
//  Built on the same skeleton as ClosingStock.jsx / SaleOrder.jsx:
//    - CC.api / CC.getLocal / CC.getStr from Common.jsx
//    - same permission/session bootstrap pattern
//    - same openReportViewer(BASE_URL + /Reports/ReportViewer.aspx) pattern
//    - single centered panel (no Group-By nav sidebar), since the source page
//      has only one combo and no grouping choice — same shape as
//      ItemwiseStockDetails.jsx's layout variant.
//    - "cc-" scoped style system (unique prefix, does not collide with
//      cs-/iq-/iw- used by other converted pages).
//  Styling: matches BranchWise.jsx design system exactly (card, header,
//  field rows, buttons, palette). Only visuals/layout were changed here —
//  all business logic, state, handlers, and API calls are 100% unchanged
//  from the original. This page has no report-type radio nav (single
//  customer combo only), so the card body uses a single centered field
//  column rather than BranchWise's left-radio/right-field split.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Save, XCircle } from "lucide-react";
import * as CC from "../../components/Common";
import Topbar from "../../components/Topbar";

const BASE_URL = "http://localhost:64215";

// ── API endpoints ───────────────────────────────────────────────────────────
// Original ASMX-style path was /SalesReport/CustomerListReport. Mapped to this
// app's Web API layer per convention: first path segment (SalesReport) →
// module name.
const CustomerListReportUrl = "/api/SalesReportApp/CustomerListReport";

// NOTE: the original jQuery file loads the combo via a shared helper
// (CustomerComboListSingle("#cmbcustomer", true, "CUSTOMER")) whose actual API
// URL was not provided. This is a best-guess endpoint name following the
// SupplierApp/BrandApp naming convention used elsewhere in this app — please
// replace with the real endpoint from your Common.jsx / master API layer if
// different.
const CustomerListUrl = "/api/SupplierApp/SelectSupplierAll";

export default function CRMCustomer() {
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
    CName: "",
    CAddress: "",
    CPhone: "",
  });

  // ── Combo selection { value, label } ────────────────────────────────────
  const [customerSel, setCustomerSel] = useState(null);

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

    const menudata = menulist.filter((obj) => obj.PageName === "CRM Customer");
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
    const ComSet = CC.getLocal("Companysetting") || [{}];

    setSession({
      Comid,
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

  // ── Report viewer opener — same pattern as ClosingStock.jsx ─────────────
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
        () => {
          w.document.title = "Customer List-Report";
        },
        false
      );
    }
    return w;
  }, []);

  // ── Refresh button — clears the customer combo, nothing else ───────────
  const handleRefresh = useCallback(() => {
    setCustomerSel(null);
    setMsg(null);
  }, []);

  // ── View button — replicates the CRM Customer $.ajax logic exactly ─────
  const handleView = useCallback(async () => {
    // Mirrors: if a combo item is selected but its value is null/empty,
    // reject and bail out (parity with the jQuery guard, even though a
    // native <select> can't really produce this state).
    let GroupByText = "";
    if (customerSel != null) {
      GroupByText = customerSel.value;
      if (GroupByText == null || GroupByText === "") {
        setMsg({ text: "Please Select Valid Customer Name !!!.", isErr: true });
        setCustomerSel(null);
        return;
      }
      GroupByText = customerSel.label;
    }

    setLoading(true);
    setMsg(null);

    try {
      const res = await CC.api(
        CustomerListReportUrl,
        null,
        { CacheKeyType: "CustomerListReport", React: 1 },
        {
          GroupBy: GroupByText,
          Comid: session.Comid,
          FromDate:"",ToDate: "",
        }
      );

      if (res?.ok || res?.IsSuccess) {
        const cacheKey = res.Data15 || res.CacheKey || "";
        openReportViewer({
          ReportName: "CustomerListReport",
          CacheKey: cacheKey,
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
      // Clear the combo selection after view, matching the jQuery file's
      // synchronous clearSelection() call right after the (async:false) ajax.
      setCustomerSel(null);
    }
  }, [customerSel, session, openReportViewer]);

  // ── Combo box (fetch-on-mount, controlled <select>) ─────────────────────
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
      return () => {
        active = false;
      };
    }, [url, JSON.stringify(payload), JSON.stringify(headers)]);

    return (
      <div className="cc-field">
        <label className="cc-label" htmlFor="cc-customer">{placeholder.replace("Select ", "")}</label>
        <select
          id="cc-customer"
          className="cc-input"
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
  // ── Scoped styles injected once ─────────────────────────────────────────
  // Design system copied 1:1 from BranchWise.jsx (card, header, field rows,
  // buttons, palette), "cc-" prefix preserved. This page has no report-type
  // radio nav (single customer combo only), so the card body uses a single
  // centered field column instead of BranchWise's left-radio/right-field split.
  //   Border / header / heading : blue  #1a56db
  //   Save accent                : green #1e7e34
  //   Cancel / link accent       : red   #dc3545
  const styles = `
    .cc-shell { min-height: 100vh; background: #f0f2f5; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; flex-direction: column; }
    .cc-layout { flex: 1; display: flex; align-items: flex-start; justify-content: center; padding: 24px; box-sizing: border-box; }
    .cc-panel { width: 100%; max-width: 480px; background: #fff; border: 2px solid #1a56db; border-radius: 10px; box-shadow: 0 4px 16px rgba(26,86,219,.18); overflow: hidden; }

    .cc-card-header { background: linear-gradient(135deg, #3b6fe0, #1a4fd1); border-bottom: 1px solid #1a4fd1; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; }
    .cc-card-header-title { font-size: 14px; font-weight: 700; color: #fff; letter-spacing: .2px; }
    .cc-close-x { background: rgba(255,255,255,.15); border: none; font-size: 14px; color: #fff; cursor: pointer; line-height: 1; padding: 6px 8px; border-radius: 6px; transition: background .15s; }
    .cc-close-x:hover { background: rgba(255,255,255,.28); }

    .cc-panel-body { padding: 24px 32px 30px; }
    .cc-panel-title { text-align: center; font-size: 22px; font-weight: 800; color: #1a3fd6; margin: 0 0 26px; }

    .cc-field { display: flex; align-items: center; gap: 14px; }
    .cc-label { font-size: 13px; font-weight: 600; color: #1e293b; width: 96px; flex-shrink: 0; }
    .cc-input { height: 34px; border: 1px solid #c7cdd6; border-radius: 4px; padding: 0 10px; font-size: 13px; color: #1e2d3d; background: #fff; width: 100%; box-sizing: border-box; transition: border-color .15s, box-shadow .15s; outline: none; }
    .cc-input:focus { border-color: #1a56db; box-shadow: 0 0 0 3px rgba(26,86,219,.15); }
    select.cc-input { appearance: auto; cursor: pointer; }

    .cc-actions { display: flex; gap: 12px; justify-content: center; margin-top: 32px; padding-top: 22px; border-top: 1px solid #e8ecf0; }
    .cc-btn { height: 38px; padding: 0 30px; border-radius: 6px; border: 1px solid #1a56db; font-size: 14px; font-weight: 700; cursor: pointer; transition: opacity .15s, box-shadow .15s, background .15s; display: flex; align-items: center; gap: 8px; background: #fff; color: #1a56db; }
    .cc-btn:disabled { opacity: .5; cursor: not-allowed; }
    .cc-btn:not(:disabled):hover { background: #eef3ff; }
    .cc-btn-primary { border-color: #1e7e34; color: #1e7e34; }
    .cc-btn-primary .cc-icon-save { color: #1e7e34; }
    .cc-btn-secondary { border-color: #dc3545; color: #dc3545; }
    .cc-btn-secondary .cc-icon-cancel { color: #dc3545; }

    .cc-msg { margin-top: 18px; padding: 10px 14px; border-radius: 8px; font-size: 13px; font-weight: 500; text-align: center; }
    .cc-msg.err { background: #fff0f0; color: #c53030; border: 1px solid #fed7d7; }
    .cc-msg.ok  { background: #f0fff4; color: #276749; border: 1px solid #c6f6d5; }

    @media (max-width: 620px) {
      .cc-panel-body { padding: 20px; }
      .cc-field { flex-direction: column; align-items: stretch; gap: 6px; }
      .cc-label { width: auto; }
    }
  `;

  if (!pageAccess.ready) {
    return (
      <>
        <style>{styles}</style>
        <div className="cc-shell">
          <Topbar />
          <div className="cc-layout">
            <div className="cc-panel">
              <div className="cc-panel-body">
                {msg && <div className={`cc-msg ${msg.isErr ? "err" : "ok"}`}>{msg.text}</div>}
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
        <div className="cc-shell">
          <Topbar />
          <div className="cc-layout">
            <div className="cc-panel">
              <div className="cc-panel-body">
                <div className="cc-msg err">Page Access Permission Denied !!!.</div>
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
      <div className="cc-shell">
        <Topbar />

        <div className="cc-layout">
          <div className="cc-panel">
            <div className="cc-card-header">
              <div className="cc-card-header-title">CRM Customer</div>
              <button type="button" className="cc-close-x" aria-label="Close" onClick={() => navigate(-1)}>✕</button>
            </div>

            <div className="cc-panel-body">
              <div className="cc-panel-title">Customer List Report</div>

              <ApiSelect
                url={CustomerListUrl}
                payload={{ Comid: session.Comid,AccountType:"CUSTOMER" }}
                labelKey="AccountName"
                valueKey="Id"
                value={customerSel}
                onChange={setCustomerSel}
                placeholder="Select Customer"
              />

              <div className="cc-actions">
                <button
                  type="button"
                  className="cc-btn cc-btn-primary"
                  disabled={loading || pageAccess.pageview === 0}
                  onClick={handleView}
                >
                  <Save size={16} className="cc-icon-save" />
                  {loading ? "Loading…" : "View"}
                </button>
                <button
                  type="button"
                  className="cc-btn cc-btn-secondary"
                  onClick={handleRefresh}
                  disabled={loading}
                >
                  <XCircle size={16} className="cc-icon-cancel" />
                  Refresh
                </button>
              </div>

              {msg && <div className={`cc-msg ${msg.isErr ? "err" : "ok"}`}>{msg.text}</div>}
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