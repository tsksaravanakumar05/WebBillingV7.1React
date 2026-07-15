// ─────────────────────────────────────────────────────────────────────────────
//  ItemwiseStockDetails.jsx
//  React conversion of the ItemWise Stock Details jQuery/jqxWidgets page
//  ("ItemwiseStockDetailsReport" — Description/Code combo + MRP/batch picker
//  modal for duplicate product-code items). Built on the same skeleton/design
//  as ClosingStock.jsx / InventoryQtyWise.jsx:
//    - CC.api / CC.getLocal / CC.getStr from Common.jsx
//    - same permission/session bootstrap pattern
//    - same openReportViewer(BASE_URL + /Reports/ReportViewer.aspx) pattern
//    - same panel / chip / "iw-" scoped style system
//    - re-uses the same product dropdown API used by ClosingStock/InventoryQtyWise
//  Styling: MasterPage.css tokens only — no new theme colors.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import * as CC from "../../components/Common";
import Topbar from "../../components/Topbar";

const BASE_URL = "http://localhost:64215";

// ── API endpoints ───────────────────────────────────────────────────────────
// Report endpoint — mirrors the original "/Stock/ItemwiseStockDetailsReport".
const ItemwiseStockDetailsReportUrl = "/api/StockReportApp/ItemwiseStockDetailsReport";

// Same product dropdown endpoint used by ClosingStock.jsx / InventoryQtyWise.jsx
// (loadproductcombo in the legacy jQuery layer) — used for both the
// Description combo and the Code combo, and to detect duplicate-code (MRP)
// items exactly like objProductList did in the original file.
const ProductListUrl = "/api/ItemMasterApp/SelectItemMaster";

// Identifies this report's cache-key bucket on the backend (same pattern used
// by ClosingStockReport / InventoryQtyWiseReport).
const CACHE_KEY_TYPE = "ItemwiseStockDetailsReport";

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

export default function ItemwiseStockDetails() {
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

  // ── Product list (objProductList equivalent) — fetched once, reused for
  //    both combos and for duplicate product-code (MRP) detection ─────────
  const [productList, setProductList] = useState([]);
  const [productLoading, setProductLoading] = useState(false);

  // ── Selection state ──────────────────────────────────────────────────────
  const [descriptionSel, setDescriptionSel] = useState(null); // { value: Id, label: ProductName }
  const [codeSel, setCodeSel] = useState(null); // { value: Id, label: ProductCode }
  const [selectedItemId, setSelectedItemId] = useState(""); // GroupByText equivalent

  // ── Date range ───────────────────────────────────────────────────────────
  const [fromDate, setFromDate] = useState(todayStr());
  const [toDate, setToDate] = useState(todayStr());

  // ── MRP / duplicate-code picker modal ───────────────────────────────────
  const [mrpOpen, setMrpOpen] = useState(false);
  const [mrpRows, setMrpRows] = useState([]);
  const [mrpHighlight, setMrpHighlight] = useState(0);
  const mrpListRef = useRef(null);

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

    const menudata = menulist.filter((obj) => obj.PageName === "ItemWise Stock Details");
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

  // ── Load the product list once (mirrors loadproductcombo -> objProductList) ─
  useEffect(() => {
    if (!pageAccess.ready) return;
    let active = true;
    (async () => {
      setProductLoading(true);
      try {
        const res = await CC.api(
          ProductListUrl,
          null,
          { Download: "1" },
          { Comid: session.MComid, Startindex: 0, PageCount: 99999, Keyword: "", Column: "" }
        );
        if (!active) return;
        const raw = Array.isArray(res?.data) ? res.data : Array.isArray(res?.Data1) ? res.Data1 : Array.isArray(res) ? res : [];
        setProductList(raw);
      } catch (err) {
        console.error(err);
      } finally {
        if (active) setProductLoading(false);
      }
    })();
    return () => { active = false; };
  }, [pageAccess.ready, session.MComid]);

  // ── Esc key — "Do you want to quit page?" (same as ClosingStock.jsx) ────
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (mrpOpen) return; // MRP modal owns keydown while open
      if (e.keyCode === 27) {
        e.preventDefault();
        if (window.confirm("Do You Want To Quit Page?")) {
          navigate("/Login/Home");
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [navigate, mrpOpen]);

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
    return w;
  }, []);

  // ── LoadFun(value) — validates dates, calls the report API, opens viewer ─
  const loadFun = useCallback(
    async (value) => {
      const Fromdate = toMMDDYYYY(fromDate);
      const Todate = toMMDDYYYY(toDate);
      const startdate = new Date(Fromdate);
      const enddate = new Date(Todate);
      if (startdate > enddate) {
        setMsg({ text: "From Date Is Greater Than To Date!!", isErr: true });
        return;
      }

      setLoading(true);
      setMsg(null);

      try {
        const res = await CC.api(
          ItemwiseStockDetailsReportUrl,
          null,
          { CacheKeyType: CACHE_KEY_TYPE, React: 1 },
          {
            Id: Number(value),
            Fromdate,
            Todate,
            Comid: session.Comid,
            MComid: session.MComid,
          }
        );

        if (res?.ok || res?.IsSuccess) {
          // CacheKey returned by the backend for this run — same Data15
          // pattern used by ClosingStockReport / InventoryQtyWiseReport.
          const cacheKey = res.Data15 || res.CacheKey || "";

          openReportViewer({
            ReportName: "ItemwiseStockDetailsReport",
            CacheKey: cacheKey,
            Fromdate,
            Todate,
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
        // Clear selections after view, matching the original flag/clear logic.
        setDescriptionSel(null);
        setCodeSel(null);
        setSelectedItemId("");
      }
    },
    [fromDate, toDate, session, openReportViewer]
  );

  // ── Duplicate product-code (MRP) detection — mirrors the cmbDescription /
  //    cmbproductcode 'change' handlers filtering objProductList by code ──
  const handleItemPicked = useCallback(
    (item, from) => {
      if (!item) return;
      if (from === "description") {
        setDescriptionSel({ value: String(item.Id), label: item.ProductName });
        setCodeSel(null);
      } else {
        setCodeSel({ value: String(item.Id), label: item.ProductCode });
        setDescriptionSel(null);
      }

      const code = item.ProductCode;
      const matches = productList.filter((p) => p.ProductCode === code);

      if (matches.length > 1) {
        // Multiple items share this product code (e.g. batch/MRP variants) —
        // open the picker modal instead of auto-selecting, same as
        // MRPWindow(...) in the original file.
        setMrpRows(matches);
        setMrpHighlight(0);
        setMrpOpen(true);
        setSelectedItemId("");
      } else {
        setSelectedItemId(String(item.Id));
      }
    },
    [productList]
  );

  // ── MRP modal keyboard nav — mirrors gridmrp keydown (down arrow / enter) ─
  useEffect(() => {
    if (!mrpOpen) return;
    const handler = (e) => {
      if (e.keyCode === 40) {
        // ArrowDown
        e.preventDefault();
        setMrpHighlight((prev) => Math.min(prev + 1, mrpRows.length - 1));
      } else if (e.keyCode === 38) {
        // ArrowUp
        e.preventDefault();
        setMrpHighlight((prev) => Math.max(prev - 1, 0));
      } else if (e.keyCode === 13) {
        // Enter — selects the highlighted row and closes, then loads
        e.preventDefault();
        const row = mrpRows[mrpHighlight];
        if (row) {
          setMrpOpen(false);
          setSelectedItemId(String(row.Id));
          loadFun(row.Id);
        }
      } else if (e.keyCode === 27) {
        e.preventDefault();
        setMrpOpen(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [mrpOpen, mrpRows, mrpHighlight, loadFun]);

  const pickMrpRow = useCallback(
    (row) => {
      setMrpOpen(false);
      setSelectedItemId(String(row.Id));
      loadFun(row.Id);
    },
    [loadFun]
  );

  // ── Refresh button — mirrors #btnrefresh click handler ─────────────────
  const handleRefresh = useCallback(() => {
    setDescriptionSel(null);
    setCodeSel(null);
    setSelectedItemId("");
    setFromDate(todayStr());
    setToDate(todayStr());
    setMsg(null);
  }, []);

  // ── View button — replicates the $('#btnview').on('click', ...) logic ──
  const handleView = useCallback(() => {
    let GroupByText = selectedItemId;

    if (GroupByText === "" || GroupByText == null) {
      setMsg({ text: "Please Select Valid Item Name !!!.", isErr: true });
      return;
    }

    loadFun(GroupByText);
  }, [selectedItemId, loadFun]);

  // ── Re-usable API-backed <select>, same pattern as ClosingStock.jsx's
  //    ApiSelect but driven off the already-fetched productList ───────────
  const ProductSelect = ({ labelKey, value, from, placeholder }) => (
    <div className="iw-field">
      <label className="iw-label">{placeholder.replace("Select ", "")}</label>
      <select
        className="iw-input"
        value={value?.value ?? ""}
        disabled={productLoading}
        onChange={(e) => {
          const selectedVal = e.target.value;
          const opt = productList.find((o) => String(o.Id) === selectedVal);
          handleItemPicked(opt || null, from);
        }}
      >
        <option value="">{productLoading ? "Loading..." : placeholder}</option>
        {productList.map((o) => (
          <option key={o.Id} value={o.Id}>
            {o[labelKey]}
          </option>
        ))}
      </select>
    </div>
  );

  // Column keys to display in the MRP picker table — every field on the row
  // except Id, shown generically since the exact batch/MRP schema varies.
  const mrpColumns = mrpRows.length > 0 ? Object.keys(mrpRows[0]).filter((k) => k !== "Id") : [];

  // ── Scoped styles injected once (same tokens as ClosingStock.jsx, "iw-" prefix) ──
  const styles = `
    .iw-shell {
      min-height: 100vh;
      background: #f0f2f5;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      flex-direction: column;
    }
    .iw-layout {
      display: flex;
      flex: 1;
      justify-content: center;
      padding: 24px;
      max-width: 1200px;
      width: 100%;
      margin: 0 auto;
      box-sizing: border-box;
    }
    .iw-panel {
      flex: 1;
      max-width: 720px;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 2px 12px rgba(0,0,0,.08);
      padding: 28px 32px;
      display: flex;
      flex-direction: column;
    }
    .iw-panel-header {
      border-bottom: 1px solid #e8ecf0;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .iw-panel-eyebrow {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .8px;
      color: var(--clr-primary, #1a56db);
      margin-bottom: 6px;
    }
    .iw-panel-title {
      font-size: 20px;
      font-weight: 700;
      color: #1e2d3d;
      line-height: 1.2;
    }
    .iw-form-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 16px 20px;
      align-items: start;
      max-width: 100%;
      margin-top: 10px;
      margin-bottom: 24px;
    }
    .iw-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .iw-label {
      font-size: 13px;
      font-weight: 600;
      color: #4a5568;
    }
    .iw-input {
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
    .iw-input:focus {
      border-color: var(--clr-primary, #1a56db);
      box-shadow: 0 0 0 3px rgba(26,86,219,.1);
    }
    .iw-actions {
      display: flex;
      gap: 12px;
      margin-top: 28px;
      padding-top: 20px;
      border-top: 1px solid #e8ecf0;
    }
    .iw-btn {
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
    .iw-btn:disabled { opacity: .5; cursor: not-allowed; }
    .iw-btn-primary {
      background: var(--clr-primary, #1a56db);
      color: #fff;
      box-shadow: 0 2px 8px rgba(26,86,219,.3);
    }
    .iw-btn-primary:not(:disabled):hover {
      opacity: .9;
      box-shadow: 0 4px 14px rgba(26,86,219,.4);
    }
    .iw-btn-secondary {
      background: #f0f2f5;
      color: #4a5568;
      border: 1.5px solid #d1d9e6;
    }
    .iw-btn-secondary:not(:disabled):hover {
      background: #e8ecf0;
    }
    .iw-msg {
      margin-top: 18px;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
    }
    .iw-msg.err { background: #fff0f0; color: #c53030; border: 1px solid #fed7d7; }
    .iw-msg.ok  { background: #f0fff4; color: #276749; border: 1px solid #c6f6d5; }

    .iw-modal-ov {
      position: fixed;
      inset: 0;
      background: rgba(20,26,36,.45);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
    }
    .iw-modal {
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0,0,0,.25);
      width: min(560px, 92vw);
      max-height: 80vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .iw-modal-header {
      padding: 16px 20px;
      border-bottom: 1px solid #e8ecf0;
      font-size: 15px;
      font-weight: 700;
      color: #1e2d3d;
    }
    .iw-modal-sub {
      font-size: 12px;
      color: #8a94a6;
      font-weight: 500;
      margin-top: 2px;
    }
    .iw-modal-list {
      overflow-y: auto;
      flex: 1;
    }
    .iw-modal-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    .iw-modal-table th {
      text-align: left;
      padding: 8px 14px;
      background: #f7f9fc;
      color: #8a94a6;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: .5px;
      position: sticky;
      top: 0;
    }
    .iw-modal-table td {
      padding: 9px 14px;
      border-top: 1px solid #eef1f5;
      color: #1e2d3d;
    }
    .iw-modal-row { cursor: pointer; }
    .iw-modal-row:hover { background: #f7f9fc; }
    .iw-modal-row.hl { background: #eef3fd; }
    .iw-modal-footer {
      padding: 12px 20px;
      border-top: 1px solid #e8ecf0;
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }
    @media (max-width: 760px) {
      .iw-layout { padding: 16px; }
      .iw-panel { padding: 20px 16px; max-width: 100%; }
      .iw-form-grid { grid-template-columns: 1fr; }
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
      <div className="iw-shell">
        <Topbar />

        <div className="iw-layout">
          <main className="iw-panel">
            <div className="iw-panel-header">
              <div className="iw-panel-eyebrow">Stock</div>
              <div className="iw-panel-title">ItemWise Stock Details</div>
            </div>

            <div className="iw-form-grid">
              <ProductSelect labelKey="ProductName" value={descriptionSel} from="description" placeholder="Select Item Name" />
              <ProductSelect labelKey="ProductCode" value={codeSel} from="code" placeholder="Select Item Code" />

              <div className="iw-field">
                <label className="iw-label" htmlFor="iw-from-date">From Date</label>
                <input
                  id="iw-from-date"
                  type="date"
                  className="iw-input"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>
              <div className="iw-field">
                <label className="iw-label" htmlFor="iw-to-date">To Date</label>
                <input
                  id="iw-to-date"
                  type="date"
                  className="iw-input"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>
            </div>

            <div className="iw-actions">
              <button
                type="button"
                className="iw-btn iw-btn-primary"
                disabled={loading || pageAccess.pageview === 0}
                onClick={handleView}
              >
                {loading ? "Loading…" : "▶ View"}
              </button>
              <button
                type="button"
                className="iw-btn iw-btn-secondary"
                onClick={handleRefresh}
                disabled={loading}
              >
                ↺ Refresh
              </button>
            </div>

            {msg && <div className={`iw-msg ${msg.isErr ? "err" : "ok"}`}>{msg.text}</div>}
          </main>
        </div>

        {/* ── MRP / duplicate product-code picker modal ── */}
        {mrpOpen && (
          <div className="iw-modal-ov" onClick={() => setMrpOpen(false)}>
            <div className="iw-modal" onClick={(e) => e.stopPropagation()} ref={mrpListRef}>
              <div className="iw-modal-header">
                Multiple Items Found
                <div className="iw-modal-sub">
                  This code matches more than one item — pick the exact one (↑ ↓ then Enter, or click a row).
                </div>
              </div>
              <div className="iw-modal-list">
                <table className="iw-modal-table">
                  <thead>
                    <tr>
                      {mrpColumns.map((col) => (
                        <th key={col}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {mrpRows.map((row, idx) => (
                      <tr
                        key={row.Id}
                        className={`iw-modal-row${idx === mrpHighlight ? " hl" : ""}`}
                        onClick={() => pickMrpRow(row)}
                        onMouseEnter={() => setMrpHighlight(idx)}
                      >
                        {mrpColumns.map((col) => (
                          <td key={col}>{String(row[col] ?? "")}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="iw-modal-footer">
                <button type="button" className="iw-btn iw-btn-secondary" onClick={() => setMrpOpen(false)}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

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