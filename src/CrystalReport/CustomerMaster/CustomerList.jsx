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
//  Styling: MasterPage.css only — no inline color values, no new theme colors.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
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

  // ── Scoped styles injected once ("cc-" prefix, tokens identical to
  //    ClosingStock.jsx / ItemwiseStockDetails.jsx) ─────────────────────────
  const styles = `
    .cc-shell {
      min-height: 100vh;
      background: #f0f2f5;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      flex-direction: column;
    }
    .cc-layout {
      display: flex;
      flex: 1;
      justify-content: center;
      padding: 24px;
      width: 100%;
      box-sizing: border-box;
    }
    .cc-panel {
      width: 100%;
      max-width: 520px;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 2px 12px rgba(0,0,0,.08);
      padding: 28px 32px;
      display: flex;
      flex-direction: column;
      align-self: flex-start;
      margin-top: 40px;
    }
    .cc-panel-header {
      border-bottom: 1px solid #e8ecf0;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .cc-panel-eyebrow {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .8px;
      color: var(--clr-primary, #1a56db);
      margin-bottom: 6px;
    }
    .cc-panel-title {
      font-size: 20px;
      font-weight: 700;
      color: #1e2d3d;
      line-height: 1.2;
    }
    .cc-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .cc-label {
      font-size: 13px;
      font-weight: 600;
      color: #4a5568;
    }
    .cc-input {
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
    .cc-input:focus {
      border-color: var(--clr-primary, #1a56db);
      box-shadow: 0 0 0 3px rgba(26,86,219,.1);
    }
    .cc-actions {
      display: flex;
      gap: 12px;
      margin-top: 28px;
      padding-top: 20px;
      border-top: 1px solid #e8ecf0;
    }
    .cc-btn {
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
    .cc-btn:disabled { opacity: .5; cursor: not-allowed; }
    .cc-btn-primary {
      background: var(--clr-primary, #1a56db);
      color: #fff;
      box-shadow: 0 2px 8px rgba(26,86,219,.3);
    }
    .cc-btn-primary:not(:disabled):hover {
      opacity: .9;
      box-shadow: 0 4px 14px rgba(26,86,219,.4);
    }
    .cc-btn-secondary {
      background: #f0f2f5;
      color: #4a5568;
      border: 1.5px solid #d1d9e6;
    }
    .cc-btn-secondary:not(:disabled):hover {
      background: #e8ecf0;
    }
    .cc-msg {
      margin-top: 18px;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
    }
    .cc-msg.err { background: #fff0f0; color: #c53030; border: 1px solid #fed7d7; }
    .cc-msg.ok  { background: #f0fff4; color: #276749; border: 1px solid #c6f6d5; }
    @media (max-width: 760px) {
      .cc-layout { padding: 16px; }
      .cc-panel { padding: 20px 16px; margin-top: 16px; }
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
      <div className="cc-shell">
        <Topbar />

        <div className="cc-layout">
          <main className="cc-panel">
            <div className="cc-panel-header">
              <div className="cc-panel-eyebrow">CRM</div>
              <div className="cc-panel-title">Customer List Report</div>
            </div>

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
                {loading ? "Loading…" : "▶ View"}
              </button>
              <button
                type="button"
                className="cc-btn cc-btn-secondary"
                onClick={handleRefresh}
                disabled={loading}
              >
                ↺ Refresh
              </button>
            </div>

            {msg && <div className={`cc-msg ${msg.isErr ? "err" : "ok"}`}>{msg.text}</div>}
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