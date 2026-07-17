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
import { Save, XCircle } from "lucide-react";
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
    <div className="so-field">
      <label className="so-label">{placeholder.replace("Select ", "")}</label>
      <select
        className="so-input"
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
    .so-card { width: 100%; max-width: 640px; background: #fff; border: 2px solid #1a56db; border-radius: 10px; box-shadow: 0 4px 16px rgba(26,86,219,.18); overflow: hidden; }

    .so-card-header { background: linear-gradient(135deg, #3b6fe0, #1a4fd1); border-bottom: 1px solid #1a4fd1; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; }
    .so-card-header-title { font-size: 14px; font-weight: 700; color: #fff; letter-spacing: .2px; }
    .so-close-x { background: rgba(255,255,255,.15); border: none; font-size: 14px; color: #fff; cursor: pointer; line-height: 1; padding: 6px 8px; border-radius: 6px; transition: background .15s; }
    .so-close-x:hover { background: rgba(255,255,255,.28); }

    .so-card-body { padding: 24px 32px 30px; }
    .so-report-title { text-align: center; font-size: 22px; font-weight: 800; color: #1a3fd6; margin: 0 0 26px; }

    .so-content { display: flex; justify-content: center; }
    .so-right { flex: 1; display: flex; flex-direction: column; gap: 16px; max-width: 360px; margin: 0 auto; }

    .so-field { display: flex; align-items: center; gap: 14px; }
    .so-label { font-size: 13px; font-weight: 600; color: #1e293b; width: 100px; flex-shrink: 0; }
    .so-input { height: 34px; border: 1px solid #c7cdd6; border-radius: 4px; padding: 0 10px; font-size: 13px; color: #1e2d3d; background: #fff; width: 100%; box-sizing: border-box; transition: border-color .15s, box-shadow .15s; outline: none; }
    .so-input:focus { border-color: #1a56db; box-shadow: 0 0 0 3px rgba(26,86,219,.15); }
    .so-input:disabled { background: #f5f6f8; color: #a0aab5; cursor: not-allowed; }
    select.so-input { appearance: auto; cursor: pointer; }

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

    .so-modal-ov { position: fixed; inset: 0; background: rgba(20,26,36,.45); display: flex; align-items: center; justify-content: center; z-index: 100; }
    .so-modal { background: #fff; border: 2px solid #1a56db; border-radius: 10px; box-shadow: 0 10px 40px rgba(0,0,0,.25); width: min(560px, 92vw); max-height: 80vh; display: flex; flex-direction: column; overflow: hidden; }
    .so-modal-header { background: linear-gradient(135deg, #3b6fe0, #1a4fd1); padding: 14px 20px; font-size: 14px; font-weight: 700; color: #fff; }
    .so-modal-sub { font-size: 12px; color: rgba(255,255,255,.85); font-weight: 500; margin-top: 4px; }
    .so-modal-list { overflow-y: auto; flex: 1; }
    .so-modal-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .so-modal-table th { text-align: left; padding: 8px 14px; background: #f7f9fc; color: #1a56db; font-size: 11px; text-transform: uppercase; letter-spacing: .5px; position: sticky; top: 0; }
    .so-modal-table td { padding: 9px 14px; border-top: 1px solid #eef1f5; color: #1e2d3d; }
    .so-modal-row { cursor: pointer; }
    .so-modal-row:hover { background: #eef3ff; }
    .so-modal-row.hl { background: #dde9fd; }
    .so-modal-footer { padding: 12px 20px; border-top: 1px solid #e8ecf0; display: flex; justify-content: flex-end; gap: 10px; }

    @media (max-width: 620px) {
      .so-card-body { padding: 20px; }
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
              <div className="so-card-header-title">ItemWise Stock Details</div>
              <button type="button" className="so-close-x" aria-label="Close" onClick={() => navigate(-1)}>✕</button>
            </div>

            <div className="so-card-body">
              <div className="so-report-title">ItemWise Stock Details Report</div>

              <div className="so-content">
                <div className="so-right">
                  <ProductSelect labelKey="ProductName" value={descriptionSel} from="description" placeholder="Select Item Name" />
                  <ProductSelect labelKey="ProductCode" value={codeSel} from="code" placeholder="Select Item Code" />

                  <div className="so-field">
                    <label className="so-label" htmlFor="iw-from-date">From Date</label>
                    <input
                      id="iw-from-date"
                      type="date"
                      className="so-input"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                    />
                  </div>
                  <div className="so-field">
                    <label className="so-label" htmlFor="iw-to-date">To Date</label>
                    <input
                      id="iw-to-date"
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

        {/* ── MRP / duplicate product-code picker modal ── */}
        {mrpOpen && (
          <div className="so-modal-ov" onClick={() => setMrpOpen(false)}>
            <div className="so-modal" onClick={(e) => e.stopPropagation()} ref={mrpListRef}>
              <div className="so-modal-header">
                Multiple Items Found
                <div className="so-modal-sub">
                  This code matches more than one item — pick the exact one (↑ ↓ then Enter, or click a row).
                </div>
              </div>
              <div className="so-modal-list">
                <table className="so-modal-table">
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
                        className={`so-modal-row${idx === mrpHighlight ? " hl" : ""}`}
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
              <div className="so-modal-footer">
                <button type="button" className="so-btn so-btn-secondary" onClick={() => setMrpOpen(false)}>
                  <XCircle size={16} className="so-icon-cancel" />
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